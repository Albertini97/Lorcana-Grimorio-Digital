export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { imageBase64, mediaType = 'image/jpeg' } = body;
  if (!imageBase64) {
    return new Response(JSON.stringify({ error: 'Missing imageBase64' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Basic size guard — base64 of 4MB image ~= 5.5MB string
  if (imageBase64.length > 6_000_000) {
    return new Response(JSON.stringify({ error: 'Image too large (max ~4MB)' }), {
      status: 413,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: `Eres un experto en Disney Lorcana TCG. Al recibir imagen de una carta, identifícala y devuelve SOLO JSON (sin markdown, sin texto extra):
{"found":true,"name":"string","subtitle":"string|null","cost":number,"color":"Amber|Amethyst|Emerald|Ruby|Sapphire|Steel","type":"Character|Action|Item|Location","strength":number|null,"willpower":number|null,"lore":number|null,"rarity":"Common|Uncommon|Rare|Super Rare|Legendary|Enchanted","inkwell":boolean,"set":"string","set_num":"string","abilities":[{"name":"string","text":"string"}],"flavor_text":"string|null","confidence":"high|medium|low"}
Si no hay carta: {"found":false,"message":"string"}`,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageBase64 },
            },
            { type: 'text', text: 'Identifica esta carta de Lorcana.' },
          ],
        },
      ],
    }),
  });

  const data = await anthropicRes.json();

  if (!anthropicRes.ok) {
    return new Response(JSON.stringify({ error: data?.error?.message || 'Anthropic API error' }), {
      status: anthropicRes.status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const text = (data.content || []).map(b => b.text || '').join('').replace(/```json?|```/g, '').trim();

  return new Response(JSON.stringify({ result: text }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
