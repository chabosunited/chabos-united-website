(() => {
  const cfg = window.CHABOS_CONFIG || { clubId: '5395290', apiBase: '', discordUrl: '#' };
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
  const val = (...values) => values.find(value => value !== undefined && value !== null && value !== '') ?? '--';
  const normalizeName = value => String(value ?? '').trim().toLowerCase();
  const clubId = String(cfg.clubId || '5395290');

  async function json(url, fallback = []) {
    const cmsKey = ({
      'data/players.json': 'players',
      'data/news.json': 'news',
      'data/interviews.json': 'interviews'
    })[url];

    if (cmsKey) {
      try {
        const base = (cfg.apiBase || '').replace(/\/$/, '');
        const response = await fetch(`${base}/api/content?key=${encodeURIComponent(cmsKey)}`, {
          cache: 'no-store',
          headers: { Accept: 'application/json' }
        });
        if (response.ok) {
          const payload = await response.json();
          if (payload?.data !== undefined && payload.data !== null) return payload.data;
        }
      } catch {}
    }

    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(String(response.status));
      return await response.json();
    } catch {
      return fallback;
    }
  }

  async function ea() {
    const params = new URLSearchParams(location.search);
    if ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') && params.get('preview') === '1') {
      return json('data/ea-preview.json', null);
    }

    try {
      const base = (cfg.apiBase || '').replace(/\/$/, '');
      const response = await fetch(`${base}/api/ea?resource=all`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(String(response.status));
      const payload = await response.json();
      return payload.data || payload;
    } catch {
      return null;
    }
  }

  const arrMembers = raw => Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.members)
      ? raw.members
      : Array.isArray(raw?.players)
        ? raw.players
        : raw?.members && typeof raw.members === 'object'
          ? Object.values(raw.members)
          : [];

  const matches = raw => Array.isArray(raw) ? raw : Array.isArray(raw?.matches) ? raw.matches : [];
  const clubName = club => val(club?.details?.name, club?.name, 'GEGNER');

  const normMatch = match => {
    const clubs = match?.clubs || {};
    const entries = Object.entries(clubs);
    const ours = clubs[clubId] || entries.find(([, club]) => normalizeName(clubName(club)) === 'chabos united')?.[1] || {};
    const opponent = entries.map(([, club]) => club).find(club => club !== ours) || {};
    return { ours, opponent, raw: match };
  };

  function eaNames(player) {
    if (Array.isArray(player?.eaNames)) return player.eaNames.map(normalizeName).filter(Boolean);
    if (player?.eaName) return [normalizeName(player.eaName)];
    return [];
  }

  function exactMember(player, members) {
    const targets = eaNames(player);
    if (!targets.length) return null;
    return members.find(member => targets.includes(normalizeName(val(member?.name, member?.gamertag, '')))) || null;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.dataset.page;
    if (page === 'team') loadTeam();
    if (page === 'results') loadResults();
    if (page === 'news') loadNews();
    if (page === 'interviews') loadInterviews();
    if (page === 'apply') bindApply();
  });

  async function loadTeam() {
    const [presentation, live] = await Promise.all([json('data/players.json', []), ea()]);
    const members = arrMembers(live?.memberStats);
    const career = arrMembers(live?.careerStats);
    const box = $('#rosterGrid');
    if (!box) return;

    const ordered = [...presentation].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    box.innerHTML = ordered.map(player => {
      const member = exactMember(player, members) || {};
      const careerMember = exactMember(player, career) || {};
      const winRate = member.winRate !== undefined && member.winRate !== null && member.winRate !== '' ? `${member.winRate}%` : '--';

      return `<article class="detail-card roster-detail">
        <img src="${esc(player.image)}" alt="">
        <div>
          <span>${esc(val(player.position, member.proPos))}</span>
          <h3>${esc(player.displayName)}</h3>
          <p>${esc(player.role)}</p>
          <dl>
            <div><dt>OVR</dt><dd>${esc(val(member.proOverall))}</dd></div>
            <div><dt>SPIELE</dt><dd>${esc(val(member.gamesPlayed, careerMember.gamesPlayed))}</dd></div>
            <div><dt>TORE</dt><dd>${esc(val(member.goals, careerMember.goals))}</dd></div>
            <div><dt>ASSISTS</dt><dd>${esc(val(member.assists, careerMember.assists))}</dd></div>
            <div><dt>RATING</dt><dd>${esc(val(member.ratingAve, careerMember.ratingAve))}</dd></div>
            <div><dt>WINRATE</dt><dd>${esc(winRate)}</dd></div>
          </dl>
        </div>
      </article>`;
    }).join('');
  }

  async function loadResults() {
    const live = await ea();
    const list = matches(live?.leagueMatches || []).map(normMatch);
    const box = $('#resultsList');
    if (!box) return;

    if (!list.length) {
      box.innerHTML = '<p class="empty">Keine EA Match-Daten verfügbar.</p>';
      return;
    }

    box.innerHTML = list.map(match => `<article class="result-big">
      <div><img src="assets/branding/logo.webp" alt=""><strong>CHABOS UNITED</strong></div>
      <b>${esc(val(match.ours.goals, match.ours.score))} - ${esc(val(match.opponent.goals, match.opponent.score))}</b>
      <div class="away"><strong>${esc(clubName(match.opponent))}</strong></div>
    </article>`).join('');
  }

  async function loadNews() {
    const news = await json('data/news.json', []);
    const slug = new URLSearchParams(location.search).get('slug');
    const box = $('#newsPage');
    if (!box) return;

    if (slug) {
      const item = news.find(entry => entry.slug === slug);
      if (!item) {
        box.innerHTML = '<p class="empty">Artikel nicht gefunden.</p>';
        return;
      }
      box.innerHTML = `<article class="article-view">
        <img src="${esc(item.image)}" alt="">
        <div class="news-meta">${esc(item.type)} · ${esc(item.date)}</div>
        <h2>${esc(item.title)}</h2><p>${esc(item.excerpt)}</p>
        ${item.content ? `<div class="article-content">${formatArticleContent(item.content)}</div>` : ''}
      </article>`;
      return;
    }

    box.className = 'content-grid';
    box.innerHTML = news.map(item => `<a class="detail-card" href="news.html?slug=${encodeURIComponent(item.slug)}">
      <img class="wide-thumb" src="${esc(item.image)}" alt="">
      <div class="news-meta">${esc(item.type)} · ${esc(item.date)}</div>
      <h3>${esc(item.title)}</h3><p>${esc(item.excerpt)}</p>
    </a>`).join('');
  }

  function formatArticleContent(content) {
    return esc(content)
      .split(/\n{2,}/)
      .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  async function loadInterviews() {
    const list = await json('data/interviews.json', []);
    const slug = new URLSearchParams(location.search).get('slug');
    const box = $('#interviewPage');
    if (!box) return;
    const selected = slug ? list.find(item => item.slug === slug) : null;

    if (selected) {
      box.innerHTML = `<article class="article-view">
        <img src="${esc(selected.cover)}" alt="">
        <div class="news-meta">INTERVIEW · ${esc(selected.date)}</div>
        <h2>${esc(selected.title)}</h2><blockquote>„${esc(selected.quote)}“</blockquote>
        <p>${esc(selected.intro)}</p>
        ${(selected.qa || []).map(item => `<h3>${esc(item.q)}</h3><p>${esc(item.a)}</p>`).join('')}
      </article>`;
      return;
    }

    box.className = 'content-grid';
    box.innerHTML = list.map(item => `<a class="detail-card" href="interviews.html?slug=${encodeURIComponent(item.slug)}">
      <img class="wide-thumb" src="${esc(item.cover)}" alt="">
      <div class="news-meta">${esc(item.date)}</div>
      <h3>${esc(item.title)}</h3><p>„${esc(item.quote)}“</p>
    </a>`).join('');
  }

  function bindApply() {
    const form = $('#applicationForm');
    const status = $('#applicationStatus');
    if (!form || !status) return;

    form.addEventListener('submit', async event => {
      event.preventDefault();
      status.textContent = 'Wird gesendet …';

      const formData = new FormData(form);
      const body = Object.fromEntries(formData.entries());
      body.privacy = formData.get('privacy') === 'on';

      try {
        const base = (cfg.apiBase || '').replace(/\/$/, '');
        const response = await fetch(`${base}/api/application`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body)
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Fehler');
        status.textContent = 'Bewerbung wurde erfolgreich an Chabos United gesendet.';
        form.reset();
      } catch (error) {
        status.textContent = error.message || 'Bewerbung konnte nicht gesendet werden.';
      }
    });
  }
})();
