const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'Content-Type',
  'access-control-max-age': '86400'
};

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...corsHeaders
  }
});

const clean = (value, max = 1000) => String(value ?? '').trim().slice(0, max);

export async function onRequestPost({ request, env }) {
  if (!env.DISCORD_APPLICATION_WEBHOOK) {
    return json({ error: 'Bewerbungs-Webhook ist noch nicht konfiguriert.' }, 503);
  }

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Ungültige Anfrage.' }, 400); }

  // Honeypot field for simple bot protection.
  if (body.website) return json({ ok: true });

  const required = ['eaId', 'discord', 'age', 'platform', 'mainPosition', 'why'];
  if (required.some(key => !clean(body[key]))) {
    return json({ error: 'Bitte fülle alle Pflichtfelder aus.' }, 400);
  }

  if (body.privacy !== true) return json({ error: 'Datenschutz muss akzeptiert werden.' }, 400);

  const fields = [
    ['EA ID', body.eaId],
    ['Discord', body.discord],
    ['Alter', body.age],
    ['Plattform', body.platform],
    ['Hauptposition', body.mainPosition],
    ['Nebenposition', body.secondPosition],
    ['Erfahrung', body.experience],
    ['Aktive Tage', body.activeDays],
    ['Online-Zeiten', body.onlineTimes],
    ['Mikrofon', body.microphone],
    ['Warum Chabos United?', body.why],
    ['Freitext', body.message]
  ].filter(([, value]) => clean(value)).map(([name, value]) => ({
    name,
    value: clean(value, 900),
    inline: false
  }));

  const payload = {
    username: 'Chabos United Bewerbungen',
    embeds: [{
      title: 'NEUE BEWERBUNG',
      description: 'Eine neue Bewerbung wurde über die Website gesendet.',
      fields,
      timestamp: new Date().toISOString()
    }]
  };

  const response = await fetch(env.DISCORD_APPLICATION_WEBHOOK, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) return json({ error: 'Discord konnte die Bewerbung nicht annehmen.' }, 502);
  return json({ ok: true, message: 'Bewerbung wurde gesendet.' });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
