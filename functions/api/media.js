const encoder = new TextEncoder();

export async function onRequest(context) {
  const { request, env } = context;
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Cache-Control': 'public, max-age=3600'
  };

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!env.CHABOS_MEDIA) return json({ error: 'CHABOS_MEDIA R2 binding is missing' }, 503, cors);

  const url = new URL(request.url);

  if (request.method === 'GET') {
    const key = url.searchParams.get('key') || '';
    if (!key) return json({ error: 'Missing key' }, 400, cors);
    const object = await env.CHABOS_MEDIA.get(key);
    if (!object) return new Response('Not found', { status: 404, headers: cors });
    const headers = new Headers(cors);
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    return new Response(object.body, { headers });
  }

  if (request.method === 'POST') {
    const authorized = await verifyBearer(request, env);
    if (!authorized) return json({ error: 'Unauthorized' }, 401, cors);

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return json({ error: 'No file uploaded' }, 400, cors);
    if (file.size > 8 * 1024 * 1024) return json({ error: 'Maximale Dateigröße: 8 MB' }, 413, cors);

    const safeName = file.name.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '');
    const key = `uploads/${Date.now()}-${safeName || 'image'}`;

    await env.CHABOS_MEDIA.put(key, file.stream(), {
      httpMetadata: { contentType: file.type || 'application/octet-stream' }
    });

    return json({ ok: true, key, url: `${url.origin}/api/media?key=${encodeURIComponent(key)}` }, 200, cors);
  }

  return json({ error: 'Method not allowed' }, 405, cors);
}

async function verifyBearer(request, env) {
  if (!env.ADMIN_SESSION_SECRET) return false;
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return false;
  const token = auth.slice(7);
  const [body, signature] = token.split('.');
  if (!body || !signature) return false;

  const expected = await sign(body, env.ADMIN_SESSION_SECRET);
  if (!timingSafeEqual(signature, expected)) return false;

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body)));
    return payload.role === 'admin' && Number(payload.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

async function sign(body, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return base64UrlEncode(new Uint8Array(sig));
}

function timingSafeEqual(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function base64UrlEncode(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' }
  });
}
