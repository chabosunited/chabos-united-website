(() => {
  const cfg = window.CHABOS_CONFIG || { clubId:'5395290', platform:'common-gen5', apiBase:'', discordUrl:'#' };
  const $ = (s,root=document) => root.querySelector(s);
  const $$ = (s,root=document) => [...root.querySelectorAll(s)];
  const esc = (v='') => String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const val = (...xs) => xs.find(x => x !== undefined && x !== null && x !== '') ?? '--';
  const num = v => Number.parseFloat(v);

  document.addEventListener('DOMContentLoaded', init);

  async function init(){
    bindChrome();
    $$('[data-discord-link]').forEach(a => { a.href = cfg.discordUrl || '#'; a.target='_blank'; a.rel='noopener'; });
    if ($('#teamCarousel')) await initHome();
  }

  function bindChrome(){
    const bar=$('#topbar');
    addEventListener('scroll',()=>bar?.classList.toggle('sticky',scrollY>45),{passive:true});
    const toggle=$('.nav-toggle'), nav=$('.main-nav');
    toggle?.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));});
    $$('.main-nav a').forEach(a=>a.addEventListener('click',()=>nav?.classList.remove('open')));
  }

  async function initHome(){
    const [players,news] = await Promise.all([getJson('/data/players.json',[]),getJson('/data/news.json',[])]);
    renderPlayers(players, null);
    renderNews(news);
    renderEmptyMatches();
    const live = await getEaData();
    if(live) applyEa(live,players);
  }

  async function getJson(url,fallback){try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw 0;return await r.json()}catch{return fallback}}

  async function getEaData(){
    const params=new URLSearchParams(location.search);
    if((location.hostname==='localhost'||location.hostname==='127.0.0.1') && params.get('preview')==='1') return getJson('/data/ea-preview.json',null);
    try{
      const base=(cfg.apiBase||'').replace(/\/$/,'');
      const r=await fetch(`${base}/api/ea?resource=all`,{headers:{Accept:'application/json'}});
      if(!r.ok) throw new Error('EA endpoint unavailable');
      const j=await r.json();
      return j.data || j;
    }catch(e){ console.info('[Chabos United] EA Live Data nicht erreichbar:',e.message); return null; }
  }

  function memberArray(raw){
    if(!raw) return [];
    if(Array.isArray(raw)) return raw;
    if(Array.isArray(raw.members)) return raw.members;
    if(Array.isArray(raw.players)) return raw.players;
    if(raw.members && typeof raw.members==='object') return Object.values(raw.members);
    return Object.values(raw).filter(v=>v && typeof v==='object' && ('name' in v || 'proPos' in v));
  }

  function renderPlayers(presentation, liveMembers){
    const box=$('#teamCarousel'); if(!box) return;
    const members=memberArray(liveMembers);
    const used=new Set();
    let cards=presentation.map((p,i)=>{
      const target=String(p.eaName||p.displayName||'').trim().toLowerCase();
      let live=members.find((m,mi)=>!used.has(mi) && String(val(m.name,m.gamertag,m.displayName,'')).trim().toLowerCase()===target);
      if(!live && members[i] && !used.has(i)) live=members[i];
      if(live){const mi=members.indexOf(live);used.add(mi)}
      return playerCard(p,live);
    });
    if(!presentation.length && members.length) cards=members.slice(0,8).map((m,i)=>playerCard({displayName:val(m.name,m.gamertag,'PLAYER'),position:val(m.proPos,m.position,'--'),role:'SPIELER',image:`/assets/players/hoodie-${(i%5)+1}-crop.png`},m));
    box.innerHTML=cards.join('');
  }

  function playerCard(p,m={}){
    const name=val(p.displayName,m?.name,m?.gamertag,'PLAYER');
    const pos=val(p.position,m?.proPos,m?.position,'--');
    const ovr=val(m?.proOverall,m?.overallRating,m?.rating,'--');
    const stats=[['PAC',val(m?.pace,m?.pac,'--')],['SHO',val(m?.shooting,m?.sho,'--')],['PAS',val(m?.passing,m?.pas,'--')],['DRI',val(m?.dribbling,m?.dri,'--')],['DEF',val(m?.defending,m?.def,'--')],['PHY',val(m?.physical,m?.phy,'--')]];
    return `<a class="player-card" href="/team.html?player=${encodeURIComponent(name)}"><div class="player-top"><span>${esc(pos)}</span><span class="ovr">${esc(ovr)}</span></div><img class="player-art" src="${esc(p.image||'/assets/players/hoodie-1.webp')}" alt=""><div class="player-name">${esc(name)}</div><div class="player-role">${esc(p.role||'SPIELER')}</div><div class="player-stats">${stats.map(([k,v])=>`<div class="player-stat"><b>${k}</b><span>${esc(v)}</span></div>`).join('')}</div></a>`;
  }

  function renderNews(news){const box=$('#homeNews');if(!box)return;box.innerHTML=news.slice(0,3).map(n=>`<a class="news-card" href="/${n.type==='INTERVIEW'?'interviews':'news'}.html?slug=${encodeURIComponent(n.slug)}"><img src="${esc(n.image)}" alt=""><div class="news-copy"><div class="news-meta">${esc(n.type)} &nbsp; ${esc(n.date)}</div><h3>${esc(n.title)}</h3><p>${esc(n.excerpt)}</p></div><span class="news-arrow">›</span></a>`).join('')}

  function renderEmptyMatches(){const box=$('#recentMatches');if(!box)return;box.innerHTML=[0,1,2].map(()=>`<div class="match-row"><div class="club-name"><img class="mini-crest" src="/assets/branding/logo.webp" alt=""><span>CHABOS UNITED</span></div><div class="score">--<small>LEAGUE MATCH</small></div><div class="opponent">Keine Daten</div></div>`).join('')}

  function unwrapByClub(raw){
    if(!raw) return {};
    if(raw[cfg.clubId]) return raw[cfg.clubId];
    if(raw.club && typeof raw.club==='object') return raw.club;
    if(Array.isArray(raw)) return raw[0]||{};
    const vals=Object.values(raw); return vals.length===1 && typeof vals[0]==='object' ? vals[0] : raw;
  }

  function normalizeMatches(raw){
    if(!raw) return [];
    const arr=Array.isArray(raw)?raw:Array.isArray(raw.matches)?raw.matches:Object.values(raw).filter(v=>v&&typeof v==='object'&&('clubs' in v||'matchId' in v));
    return arr.map(match=>{
      const clubs=match.clubs||match.clubInfo||{};
      const entries=Object.entries(clubs);
      let ours=clubs[cfg.clubId] || entries.find(([,c])=>String(c?.clubId||c?.id)==cfg.clubId)?.[1];
      if(!ours) ours=entries.find(([,c])=>String(c?.name||'').toLowerCase()==='chabos united')?.[1];
      let opponent=entries.map(([,c])=>c).find(c=>c!==ours) || {};
      if(Array.isArray(clubs)) { ours=clubs.find(c=>String(c.clubId||c.id)==cfg.clubId)||clubs.find(c=>String(c.name||'').toLowerCase()==='chabos united')||{}; opponent=clubs.find(c=>c!==ours)||{}; }
      return {ours,opponent,raw:match};
    }).filter(m=>m.ours && Object.keys(m.ours).length);
  }

  function applyEa(data,presentation){
    const members=data.memberStats?.data ?? data.memberStats ?? data.players?.data ?? data.players;
    renderPlayers(presentation,members);
    const overall=unwrapByClub(data.overallStats?.data ?? data.overallStats ?? data.stats?.data ?? data.stats);
    const wins=val(overall.wins,overall.win,'--'), draws=val(overall.ties,overall.draws,overall.draw,'--'), losses=val(overall.losses,overall.loss,'--');
    const played=val(overall.gamesPlayed,overall.matchesPlayed, overall.games, [wins,draws,losses].every(v=>Number.isFinite(num(v))) ? num(wins)+num(draws)+num(losses):'--');
    setText('#tablePlayed',played);setText('#tableWins',wins);setText('#tableDraws',draws);setText('#tableLosses',losses);
    const points=[wins,draws].every(v=>Number.isFinite(num(v)))?num(wins)*3+num(draws):'--'; setText('#tablePoints',points);
    const matchSource=data.leagueMatches?.data ?? data.leagueMatches ?? data.matches?.data ?? data.matches;
    const matches=normalizeMatches(matchSource);
    renderMatches(matches.slice(0,3)); renderForm(matches.slice(0,5));
  }

  function setText(sel,v){const el=$(sel);if(el)el.textContent=String(v)}
  function goal(c){return val(c?.goals,c?.score,c?.goalsFor,'--')}
  function renderMatches(matches){const box=$('#recentMatches');if(!box||!matches.length)return;box.innerHTML=matches.map(m=>`<div class="match-row"><div class="club-name"><img class="mini-crest" src="/assets/branding/logo.webp" alt=""><span>CHABOS UNITED</span></div><div class="score">${esc(goal(m.ours))} - ${esc(goal(m.opponent))}<small>LEAGUE MATCH</small></div><div class="opponent">${esc(val(m.opponent.name,'GEGNER'))}</div></div>`).join('')}
  function renderForm(matches){const box=$('#formBadges');if(!box||!matches.length)return;box.innerHTML=matches.map(m=>{const a=num(goal(m.ours)),b=num(goal(m.opponent));let t='--',cl='draw';if(Number.isFinite(a)&&Number.isFinite(b)){if(a>b){t='S';cl=''}else if(a<b){t='N';cl='loss'}else{t='U';cl='draw'}}return `<span class="${cl}">${t}</span>`}).join('')}
})();
