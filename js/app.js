(() => {
  const cfg = window.CHABOS_CONFIG || {
    clubId: '5395290',
    platform: 'common-gen5',
    apiBase: '',
    discordUrl: '#'
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value = '') => String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
  const val = (...values) => values.find(value => value !== undefined && value !== null && value !== '') ?? '--';
  const num = value => Number.parseFloat(value);
  const normalizeName = value => String(value ?? '').trim().toLowerCase();

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    bindChrome();
    $$('[data-discord-link]').forEach(link => {
      link.href = cfg.discordUrl || '#';
      link.target = '_blank';
      link.rel = 'noopener';
    });

    if ($('#teamCarousel')) await initHome();
  }

  function bindChrome() {
    const bar = $('#topbar');
    addEventListener('scroll', () => bar?.classList.toggle('sticky', scrollY > 45), { passive: true });

    const toggle = $('.nav-toggle');
    const nav = $('.main-nav');
    toggle?.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    $$('.main-nav a').forEach(link => link.addEventListener('click', () => nav?.classList.remove('open')));
  }

  async function initHome() {
    const [players, news] = await Promise.all([
      getJson('data/players.json', []),
      getJson('data/news.json', [])
    ]);

    renderPlayers(players, null);
    renderNews(news);
    renderEmptyMatches();

    const live = await getEaData();
    if (live) applyEa(live, players);
  }

  async function getJson(url, fallback) {
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

  async function getEaData() {
    const params = new URLSearchParams(location.search);
    if ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') && params.get('preview') === '1') {
      return getJson('data/ea-preview.json', null);
    }

    try {
      const base = (cfg.apiBase || '').replace(/\/$/, '');
      const response = await fetch(`${base}/api/ea?resource=all`, {
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error(`EA endpoint ${response.status}`);
      const json = await response.json();
      return json.data || json;
    } catch (error) {
      console.info('[Chabos United] EA Live Data nicht erreichbar:', error.message);
      return null;
    }
  }

  function memberArray(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw.members)) return raw.members;
    if (Array.isArray(raw.players)) return raw.players;
    if (raw.members && typeof raw.members === 'object') return Object.values(raw.members);
    return Object.values(raw).filter(value => value && typeof value === 'object' && ('name' in value || 'proPos' in value));
  }

  function presentationEaNames(player) {
    if (Array.isArray(player?.eaNames)) return player.eaNames.map(normalizeName).filter(Boolean);
    if (player?.eaName) return [normalizeName(player.eaName)];
    return [];
  }

  function findExactMember(player, members, used = new Set()) {
    const targets = presentationEaNames(player);
    if (!targets.length) return null;

    const index = members.findIndex((member, memberIndex) => {
      if (used.has(memberIndex)) return false;
      const liveName = normalizeName(val(member?.name, member?.gamertag, member?.displayName, ''));
      return targets.includes(liveName);
    });

    if (index === -1) return null;
    used.add(index);
    return members[index];
  }

  function renderPlayers(presentation, liveMembers) {
    const box = $('#teamCarousel');
    if (!box) return;

    const members = memberArray(liveMembers);
    const used = new Set();
    const ordered = [...presentation].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

    let cards = ordered.map(player => playerCard(player, findExactMember(player, members, used)));

    if (!ordered.length && members.length) {
      cards = members.slice(0, 8).map((member, index) => playerCard({
        displayName: val(member.name, member.gamertag, 'PLAYER'),
        position: val(member.proPos, member.position, '--'),
        role: 'SPIELER',
        image: `assets/players/hoodie-${(index % 5) + 1}.webp`
      }, member));
    }

    box.innerHTML = cards.join('');
  }

  function playerCard(player, member = null) {
    const name = val(player.displayName, member?.name, member?.gamertag, 'PLAYER');
    const position = val(player.position, member?.proPos, member?.position, '--');
    // Never use match rating as OVR.
    const overall = val(member?.proOverall, member?.overallRating, '--');
    const stats = [
      ['PAC', val(member?.pace, member?.pac, '--')],
      ['SHO', val(member?.shooting, member?.sho, '--')],
      ['PAS', val(member?.passing, member?.pas, '--')],
      ['DRI', val(member?.dribbling, member?.dri, '--')],
      ['DEF', val(member?.defending, member?.def, '--')],
      ['PHY', val(member?.physical, member?.phy, '--')]
    ];

    return `<a class="player-card" href="team.html?player=${encodeURIComponent(name)}">
      <div class="player-top"><span>${esc(position)}</span><span class="ovr">${esc(overall)}</span></div>
      <img class="player-art" src="${esc(player.image || 'assets/players/hoodie-1.webp')}" alt="">
      <div class="player-name">${esc(name)}</div>
      <div class="player-role">${esc(player.role || 'SPIELER')}</div>
      <div class="player-stats">${stats.map(([key, value]) => `<div class="player-stat"><b>${key}</b><span>${esc(value)}</span></div>`).join('')}</div>
    </a>`;
  }

  function renderNews(news) {
    const box = $('#homeNews');
    if (!box) return;

    box.innerHTML = news.slice(0, 3).map(item => {
      const page = item.type === 'INTERVIEW' ? 'interviews.html' : 'news.html';
      return `<a class="news-card" href="${page}?slug=${encodeURIComponent(item.slug)}">
        <img src="${esc(item.image)}" alt="">
        <div class="news-copy">
          <div class="news-meta">${esc(item.type)} &nbsp; ${esc(item.date)}</div>
          <h3>${esc(item.title)}</h3><p>${esc(item.excerpt)}</p>
        </div><span class="news-arrow">›</span>
      </a>`;
    }).join('');
  }

  function renderEmptyMatches() {
    const box = $('#recentMatches');
    if (!box) return;
    box.innerHTML = [0, 1, 2].map(() => `<div class="match-row">
      <div class="club-name"><img class="mini-crest" src="assets/branding/logo.webp" alt=""><span>CHABOS UNITED</span></div>
      <div class="score">--<small>LEAGUE MATCH</small></div><div class="opponent">Keine Daten</div>
    </div>`).join('');
  }

  function unwrapByClub(raw) {
    if (!raw) return {};
    if (raw[cfg.clubId]) return raw[cfg.clubId];
    if (raw.club && typeof raw.club === 'object') return raw.club;
    if (Array.isArray(raw)) return raw[0] || {};
    const values = Object.values(raw);
    return values.length === 1 && typeof values[0] === 'object' ? values[0] : raw;
  }

  function clubName(club) {
    return val(club?.details?.name, club?.name, 'GEGNER');
  }

  function normalizeMatches(raw) {
    if (!raw) return [];
    const matches = Array.isArray(raw)
      ? raw
      : Array.isArray(raw.matches)
        ? raw.matches
        : Object.values(raw).filter(value => value && typeof value === 'object' && ('clubs' in value || 'matchId' in value));

    return matches.map(match => {
      const clubs = match.clubs || match.clubInfo || {};
      const entries = Object.entries(clubs);
      let ours = clubs[cfg.clubId] || entries.find(([, club]) => String(club?.clubId || club?.id) === String(cfg.clubId))?.[1];
      if (!ours) ours = entries.find(([, club]) => normalizeName(clubName(club)) === 'chabos united')?.[1];
      let opponent = entries.map(([, club]) => club).find(club => club !== ours) || {};

      if (Array.isArray(clubs)) {
        ours = clubs.find(club => String(club.clubId || club.id) === String(cfg.clubId)) || clubs.find(club => normalizeName(clubName(club)) === 'chabos united') || {};
        opponent = clubs.find(club => club !== ours) || {};
      }

      return { ours, opponent, raw: match };
    }).filter(match => match.ours && Object.keys(match.ours).length);
  }

  function applyEa(data, presentation) {
    const members = data.memberStats?.data ?? data.memberStats ?? data.players?.data ?? data.players;
    renderPlayers(presentation, members);

    const overall = unwrapByClub(data.overallStats?.data ?? data.overallStats ?? data.stats?.data ?? data.stats);
    const wins = val(overall.wins, overall.win, '--');
    const draws = val(overall.ties, overall.draws, overall.draw, '--');
    const losses = val(overall.losses, overall.loss, '--');
    const played = val(
      overall.gamesPlayed,
      overall.matchesPlayed,
      overall.games,
      [wins, draws, losses].every(value => Number.isFinite(num(value))) ? num(wins) + num(draws) + num(losses) : '--'
    );

    setText('#tablePlayed', played);
    setText('#tableWins', wins);
    setText('#tableDraws', draws);
    setText('#tableLosses', losses);
    setText('#tablePoints', [wins, draws].every(value => Number.isFinite(num(value))) ? num(wins) * 3 + num(draws) : '--');

    const matchSource = data.leagueMatches?.data ?? data.leagueMatches ?? data.matches?.data ?? data.matches;
    const matches = normalizeMatches(matchSource);
    renderMatches(matches.slice(0, 3));
    renderForm(matches.slice(0, 5));
  }

  function setText(selector, value) {
    const element = $(selector);
    if (element) element.textContent = String(value);
  }

  function goal(club) {
    return val(club?.goals, club?.score, club?.goalsFor, '--');
  }

  function renderMatches(matches) {
    const box = $('#recentMatches');
    if (!box || !matches.length) return;
    box.innerHTML = matches.map(match => `<div class="match-row">
      <div class="club-name"><img class="mini-crest" src="assets/branding/logo.webp" alt=""><span>CHABOS UNITED</span></div>
      <div class="score">${esc(goal(match.ours))} - ${esc(goal(match.opponent))}<small>LEAGUE MATCH</small></div>
      <div class="opponent">${esc(clubName(match.opponent))}</div>
    </div>`).join('');
  }

  function renderForm(matches) {
    const box = $('#formBadges');
    if (!box || !matches.length) return;
    box.innerHTML = matches.map(match => {
      const ownGoals = num(goal(match.ours));
      const opponentGoals = num(goal(match.opponent));
      let text = '--';
      let className = 'draw';

      if (Number.isFinite(ownGoals) && Number.isFinite(opponentGoals)) {
        if (ownGoals > opponentGoals) { text = 'S'; className = ''; }
        else if (ownGoals < opponentGoals) { text = 'N'; className = 'loss'; }
        else { text = 'U'; className = 'draw'; }
      }

      return `<span class="${className}">${text}</span>`;
    }).join('');
  }
})();
