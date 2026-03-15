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

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const { imageBase64, mediaType = 'image/jpeg' } = body;
  if (!imageBase64) {
    return new Response(JSON.stringify({ error: 'Missing imageBase64' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  if (imageBase64.length > 6_000_000) {
    return new Response(JSON.stringify({ error: 'Image too large (max ~4MB)' }), {
      status: 413,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const prompt = `Eres un experto en Disney Lorcana TCG. Analiza esta imagen de una carta y devuelve SOLO JSON válido (sin markdown, sin texto extra, sin bloques de código):
{"found":true,"name":"string","subtitle":"string o null","cost":number,"color":"Amber o Amethyst o Emerald o Ruby o Sapphire o Steel","type":"Character o Action o Item o Location","strength":number o null,"willpower":number o null,"lore":number o null,"rarity":"Common o Uncommon o Rare o Super Rare o Legendary o Enchanted","inkwell":true o false,"set":"string","set_num":"string","abilities":[{"name":"string","text":"string"}],"flavor_text":"string o null","confidence":"high o medium o low"}
Si no ves ninguna carta de Lorcana devuelve exactamente: {"found":false,"message":"No se detectó ninguna carta de Lorcana"}
Responde ÚNICAMENTE con el JSON, nada más.`;

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: mediaType,
                  data: imageBase64,
                },
              },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1000,
        },
      }),
    }
  );

  const data = await geminiRes.json();

  if (!geminiRes.ok) {
    const errMsg = data?.error?.message || 'Gemini API error';
    return new Response(JSON.stringify({ error: errMsg }), {
      status: geminiRes.status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const clean = raw.replace(/```json?|```/g, '').trim();

  return new Response(JSON.stringify({ result: clean }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
