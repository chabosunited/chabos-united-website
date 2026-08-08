const encoder = new TextEncoder();

export async function onRequest(context) {
  const { request, env } = context;
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Cache-Control': 'no-store'
  };

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || '';

  if (action === 'login' && request.method === 'POST') {
    return login(request, env, cors);
  }

  const auth = await verifyBearer(request, env);
  if (!auth) return json({ error: 'Unauthorized' }, 401, cors);

  if (!env.CHABOS_CMS) return json({ error: 'CHABOS_CMS KV binding is missing' }, 503, cors);

  if (action === 'status') {
    return json({ ok: true, user: 'admin' }, 200, cors);
  }

  if (action === 'get' && request.method === 'GET') {
    const key = sanitizeKey(url.searchParams.get('key'));
    if (!key) return json({ error: 'Invalid key' }, 400, cors);
    const raw = await env.CHABOS_CMS.get(`content:${key}`);
    return json({ data: raw ? JSON.parse(raw) : null }, 200, cors);
  }

  if (action === 'save' && request.method === 'POST') {
    const body = await request.json().catch(() => null);
    const key = sanitizeKey(body?.key);
    if (!key) return json({ error: 'Invalid key' }, 400, cors);
    await env.CHABOS_CMS.put(`content:${key}`, JSON.stringify(body.data ?? null));
    await env.CHABOS_CMS.put('meta:lastUpdate', new Date().toISOString());
    return json({ ok: true, key }, 200, cors);
  }

  if (action === 'delete' && (request.method === 'DELETE' || request.method === 'POST')) {
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    const key = sanitizeKey(url.searchParams.get('key') || body?.key);
    if (!key) return json({ error: 'Invalid key' }, 400, cors);
    await env.CHABOS_CMS.delete(`content:${key}`);
    return json({ ok: true, key }, 200, cors);
  }

  return json({ error: 'Unknown action' }, 404, cors);
}

async function login(request, env, cors) {
  if (!env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET) {
    return json({ error: 'Admin environment variables are not configured' }, 503, cors);
  }

  const body = await request.json().catch(() => null);
  const password = String(body?.password || '');
  if (!timingSafeEqual(password, String(env.ADMIN_PASSWORD))) {
    return json({ error: 'Falsches Passwort' }, 401, cors);
  }

  const token = await createToken(env.ADMIN_SESSION_SECRET);
  return json({ token, expiresIn: 21600 }, 200, cors);
}

async function createToken(secret) {
  const payload = {
    role: 'admin',
    exp: Math.floor(Date.now() / 1000) + 21600
  };
  const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = await sign(body, secret);
  return `${body}.${signature}`;
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

function sanitizeKey(value) {
  const key = String(value || '').trim();
  return /^[a-z0-9_-]{1,40}$/i.test(key) ? key : '';
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
