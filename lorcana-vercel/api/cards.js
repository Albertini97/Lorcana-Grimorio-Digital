export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const res = await fetch('https://lorcanajson.org/files/en/allCards.json', {
      signal: AbortSignal.timeout(20000),
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) throw new Error('LorcanaJSON returned ' + res.status);

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600' // cache 1 hour in Vercel edge
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
