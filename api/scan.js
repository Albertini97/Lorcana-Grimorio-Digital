export const config = { runtime: 'edge' };

// Parse char-by-char replacing literal newlines inside JSON strings
function fixJsonNewlines(s) {
  let out = '';
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) { out += c; esc = false; continue; }
    if (c === '\\') { esc = true; out += c; continue; }
    if (c === '"') { inStr = !inStr; out += c; continue; }
    if (inStr && (c === '\n' || c === '\r')) { out += ' '; continue; }
    if (inStr && c === '\t') { out += ' '; continue; }
    out += c;
  }
  return out;
}

function extractJson(raw) {
  // Remove markdown fences
  let s = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  // Find first { and last }
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a === -1 || b === -1 || b < a) return null;
  s = s.slice(a, b + 1);
  // Fix curly quotes
  s = s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, '-');
  // Fix literal newlines inside strings
  s = fixJsonNewlines(s);
  return s;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }

  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }

  const { imageBase64, mediaType = 'image/jpeg' } = body;
  if (!imageBase64) {
    return new Response(JSON.stringify({ error: 'Missing imageBase64' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }
  if (imageBase64.length > 6_000_000) {
    return new Response(JSON.stringify({ error: 'Image too large' }), { status: 413, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }

  const prompt = `You are a Disney Lorcana TCG expert. Identify the card in this image and respond with ONLY a JSON object on a single line. No markdown, no newlines inside string values, no explanation.

Required format (replace values with real card data):
{"found":true,"name":"Gaston","subtitle":"Arrogant Hunter","cost":2,"color":"Ruby","type":"Character","strength":4,"willpower":2,"lore":0,"rarity":"Common","inkwell":false,"set":"Rise of the Floodborn","set_num":"115","abilities":[{"name":"Reckless","text":"This character cannot quest and must challenge each turn if able."}],"flavor_text":"It is not arrogance when you really are the best.","confidence":"high"}

Important rules:
- color must be exactly one of: Amber, Amethyst, Emerald, Ruby, Sapphire, Steel
- type must be exactly one of: Character, Action, Item, Location  
- rarity must be exactly one of: Common, Uncommon, Rare, Super Rare, Legendary, Enchanted
- ALL text inside strings must be on one line, never use actual newline characters inside a string value
- abilities is an array, each ability has name and text as single-line strings
- If no Lorcana card is visible respond with: {"found":false,"message":"No card detected"}`;

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { inline_data: { mime_type: mediaType, data: imageBase64 } },
          { text: prompt }
        ]}],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 800,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              found: { type: 'BOOLEAN' },
              name: { type: 'STRING' },
              subtitle: { type: 'STRING' },
              cost: { type: 'NUMBER' },
              color: { type: 'STRING' },
              type: { type: 'STRING' },
              strength: { type: 'NUMBER' },
              willpower: { type: 'NUMBER' },
              lore: { type: 'NUMBER' },
              rarity: { type: 'STRING' },
              inkwell: { type: 'BOOLEAN' },
              set: { type: 'STRING' },
              set_num: { type: 'STRING' },
              abilities: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    name: { type: 'STRING' },
                    text: { type: 'STRING' }
                  }
                }
              },
              flavor_text: { type: 'STRING' },
              confidence: { type: 'STRING' },
              message: { type: 'STRING' }
            },
            required: ['found']
          }
        }
      })
    }
  );

  const data = await geminiRes.json();

  if (!geminiRes.ok) {
    return new Response(JSON.stringify({ error: data?.error?.message || 'Gemini API error' }), { status: geminiRes.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }

  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // With responseSchema Gemini should return valid JSON, but sanitize anyway
  const clean = extractJson(raw) || raw.trim();

  try {
    JSON.parse(clean);
  } catch (e) {
    return new Response(JSON.stringify({ error: 'parse_failed', raw: raw.slice(0, 500) }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }

  return new Response(JSON.stringify({ result: clean }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}
