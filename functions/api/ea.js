const DEFAULT_CLUB_ID = '5395290';
const DEFAULT_PLATFORM = 'common-gen5';
const FRESH_MS = 10 * 60 * 1000;
const KEEP_SECONDS = 24 * 60 * 60;

const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'cache-control': 'no-store',
    ...extra
  }
});

export async function onRequestGet(context) {
  const { request, env } = context;
  const clubId = String(env.EA_CLUB_ID || DEFAULT_CLUB_ID);
  const platform = String(env.EA_PLATFORM || DEFAULT_PLATFORM);
  const requestUrl = new URL(request.url);
  const resource = requestUrl.searchParams.get('resource') || 'all';

  if (resource !== 'all') return json({ error: 'Only resource=all is supported.' }, 400);

  const cache = caches.default;
  const keyUrl = new URL(request.url);
  keyUrl.pathname = '/__chabos_ea_cache';
  keyUrl.search = `?clubId=${encodeURIComponent(clubId)}&platform=${encodeURIComponent(platform)}`;
  const cacheKey = new Request(keyUrl.toString(), { method: 'GET' });

  const cachedResponse = await cache.match(cacheKey);
  let cached = null;
  if (cachedResponse) {
    try { cached = await cachedResponse.clone().json(); } catch { cached = null; }
  }

  if (cached?._meta?.fetchedAt && Date.now() - cached._meta.fetchedAt < FRESH_MS) {
    return json({ data: cached, cache: 'HIT', stale: false });
  }

  const base = 'https://proclubs.ea.com/api/fc';
  const endpoints = {
    clubInfo: `${base}/clubs/info?platform=${encodeURIComponent(platform)}&clubIds=${encodeURIComponent(clubId)}`,
    overallStats: `${base}/clubs/overallStats?platform=${encodeURIComponent(platform)}&clubIds=${encodeURIComponent(clubId)}`,
    memberStats: `${base}/members/stats?platform=${encodeURIComponent(platform)}&clubId=${encodeURIComponent(clubId)}`,
    careerStats: `${base}/members/career/stats?platform=${encodeURIComponent(platform)}&clubId=${encodeURIComponent(clubId)}`,
    leagueMatches: `${base}/clubs/matches?platform=${encodeURIComponent(platform)}&clubIds=${encodeURIComponent(clubId)}&matchType=leagueMatch&maxResultCount=20`,
    playoffMatches: `${base}/clubs/matches?platform=${encodeURIComponent(platform)}&clubIds=${encodeURIComponent(clubId)}&matchType=playoffMatch&maxResultCount=20`
  };

  // These headers mirror the request context used by EA's own Clubs overview page.
  // Without them EA/Akamai can return 520 from Cloudflare's network.
  const eaOverviewUrl = `https://www.ea.com/games/ea-sports-fc/clubs/overview?clubId=${encodeURIComponent(clubId)}&platform=${encodeURIComponent(platform)}`;
  const headers = {
    accept: 'application/json',
    'accept-language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
    origin: 'https://www.ea.com',
    referer: eaOverviewUrl,
    'cache-control': 'no-cache',
    pragma: 'no-cache',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36'
  };

  const entries = Object.entries(endpoints);
  const settled = await Promise.allSettled(entries.map(async ([key, url]) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
        redirect: 'follow'
      });

      const text = await response.text();
      if (!response.ok) throw new Error(`${response.status} ${text.slice(0, 120)}`);

      let data;
      try { data = JSON.parse(text); }
      catch { throw new Error('EA returned non-JSON data'); }
      return [key, data];
    } finally {
      clearTimeout(timeout);
    }
  }));

  const fresh = {};
  const errors = {};
  settled.forEach((result, index) => {
    const key = entries[index][0];
    if (result.status === 'fulfilled') fresh[key] = result.value[1];
    else errors[key] = String(result.reason?.message || result.reason);
  });

  const successCount = Object.keys(fresh).length;
  if (!successCount && cached) {
    cached._meta = { ...(cached._meta || {}), stale: true, lastError: errors };
    return json({ data: cached, cache: 'STALE', stale: true, errors }, 200, { 'x-chabos-ea-status': 'stale' });
  }

  if (!successCount) return json({ error: 'EA Clubs ist momentan nicht erreichbar.', errors }, 502);

  const merged = {
    ...(cached || {}),
    ...fresh,
    _meta: {
      clubId,
      platform,
      fetchedAt: Date.now(),
      stale: false,
      partial: Object.keys(errors).length > 0,
      errors
    }
  };

  const store = json(merged, 200, { 'cache-control': `public, max-age=${KEEP_SECONDS}` });
  context.waitUntil(cache.put(cacheKey, store.clone()));

  return json({ data: merged, cache: cached ? 'REFRESH' : 'MISS', stale: false, errors });
}
