export async function onRequest(context) {
  const { request, env } = context;
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Cache-Control': 'no-store'
  };

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405, cors);
  if (!env.CHABOS_CMS) return json({ error: 'CMS storage not configured' }, 503, cors);

  const url = new URL(request.url);
  const key = sanitizeKey(url.searchParams.get('key'));
  if (!key) return json({ error: 'Missing or invalid key' }, 400, cors);

  const raw = await env.CHABOS_CMS.get(`content:${key}`);
  if (!raw) return json({ error: 'No CMS override stored' }, 404, cors);

  try {
    return json({ data: JSON.parse(raw) }, 200, cors);
  } catch {
    return json({ error: 'Stored content is invalid JSON' }, 500, cors);
  }
}

function sanitizeKey(value) {
  const key = String(value || '').trim();
  return /^[a-z0-9_-]{1,40}$/i.test(key) ? key : '';
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' }
  });
}
