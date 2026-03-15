export const config = { runtime: 'edge' };

function fixJsonNewlines(s) {
  let out = '';
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) { out += c; esc = false; continue; }
    if (c === '\\') { esc = true; out += c; continue; }
    if (c === '"') { inStr = !inStr; out += c; continue; }
    if (inStr && (c === '\n' || c === '\r' || c === '\t')) { out += ' '; continue; }
    out += c;
  }
  return out;
}

function extractJson(raw) {
  let s = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a === -1 || b === -1 || b < a) return null;
  s = s.slice(a, b + 1);
  s = s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, '-');
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

  const prompt = `You are a Disney Lorcana TCG expert. Identify the card in this image. Respond ONLY with a single compact JSON object, no markdown, no newlines inside string values.

If card found: {"found":true,"name":"NAME","subtitle":"SUBTITLE or null","cost":N,"color":"COLOR","type":"TYPE","strength":N,"willpower":N,"lore":N,"rarity":"RARITY","inkwell":true,"set":"SET NAME","set_num":"NUM","abilities":[{"name":"NAME","text":"TEXT"}],"flavor_text":"TEXT or null","confidence":"high"}
If no card: {"found":false,"message":"No card detected"}

color: Amber|Amethyst|Emerald|Ruby|Sapphire|Steel
type: Character|Action|Item|Location
rarity: Common|Uncommon|Rare|Super Rare|Legendary|Enchanted`;

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
        generationConfig: { temperature: 0.1, maxOutputTokens: 2000 }
      })
    }
  );

  const data = await geminiRes.json();

  if (!geminiRes.ok) {
    return new Response(JSON.stringify({ error: data?.error?.message || 'Gemini API error' }), { status: geminiRes.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }

  // Get FULL raw response — no slicing
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const clean = extractJson(raw);

  if (!clean) {
    return new Response(JSON.stringify({ result: null, raw: raw }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    JSON.parse(clean);
    return new Response(JSON.stringify({ result: clean }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  } catch (e) {
    return new Response(JSON.stringify({ result: null, raw: raw, cleaned: clean, error: e.message }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }
}
