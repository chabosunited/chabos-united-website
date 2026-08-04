(() => {
  const cfg=window.CHABOS_CONFIG||{apiBase:'',discordUrl:'#'};
  const $=(s,r=document)=>r.querySelector(s); const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const json=async(u,f=[])=>{try{const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw 0;return await r.json()}catch{return f}};
  async function ea(){const p=new URLSearchParams(location.search);if((location.hostname==='localhost'||location.hostname==='127.0.0.1')&&p.get('preview')==='1')return json('/data/ea-preview.json',null);try{const r=await fetch(`${(cfg.apiBase||'').replace(/\/$/,'')}/api/ea?resource=all`);if(!r.ok)throw 0;const j=await r.json();return j.data||j}catch{return null}}
  const arrMembers=r=>Array.isArray(r)?r:Array.isArray(r?.members)?r.members:Array.isArray(r?.players)?r.players:r?.members&&typeof r.members==='object'?Object.values(r.members):[];
  const matches=r=>Array.isArray(r)?r:Array.isArray(r?.matches)?r.matches:[];
  const val=(...x)=>x.find(v=>v!==undefined&&v!==null&&v!=='')??'--';
  const clubId=String(cfg.clubId||'5395290');
  const normMatch=m=>{const c=m?.clubs||{};const e=Object.entries(c);let ours=c[clubId]||e.find(([,v])=>String(v?.name||'').toLowerCase()==='chabos united')?.[1]||{};let opp=e.map(([,v])=>v).find(v=>v!==ours)||{};return{ours,opp,raw:m}};
  document.addEventListener('DOMContentLoaded',()=>{const page=document.body.dataset.page;if(page==='team')loadTeam();if(page==='results')loadResults();if(page==='news')loadNews();if(page==='interviews')loadInterviews();if(page==='apply')bindApply()});
    const normalizePlayerName = v =>
    String(v ?? '').trim().toLowerCase();

  function playerEaNames(player){
    if(Array.isArray(player?.eaNames)){
      return player.eaNames
        .map(normalizePlayerName)
        .filter(Boolean);
    }

    if(player?.eaName){
      return [normalizePlayerName(player.eaName)];
    }

    return [];
  }

  function exactMember(player, members){
    const targets = playerEaNames(player);

    if(!targets.length) return null;

    return members.find(member => {
      const name = normalizePlayerName(
        member?.name ??
        member?.gamertag ??
        ''
      );

      return targets.includes(name);
    }) || null;
  }

  async function loadTeam(){
    const [pres,live] = await Promise.all([
      json('/data/players.json',[]),
      ea()
    ]);

    const members = arrMembers(live?.memberStats);
    const career = arrMembers(live?.careerStats);

    const box = $('#rosterGrid');

    if(!box) return;

    const ordered = [...pres].sort(
      (a,b) => (a.order ?? 999) - (b.order ?? 999)
    );

    box.innerHTML = ordered.map(player => {

      const member = exactMember(player,members) || {};
      const careerMember = exactMember(player,career) || {};

      const winRate =
        member.winRate !== undefined &&
        member.winRate !== null &&
        member.winRate !== ''
          ? `${member.winRate}%`
          : '--';

      return `
        <article class="detail-card roster-detail">

          <img
            src="${esc(player.image)}"
            alt=""
          >

          <div>

            <span>
              ${esc(val(
                player.position,
                member.proPos
              ))}
            </span>

            <h3>
              ${esc(player.displayName)}
            </h3>

            <p>
              ${esc(player.role)}
            </p>

            <dl>

              <div>
                <dt>OVR</dt>
                <dd>
                  ${esc(val(
                    member.proOverall
                  ))}
                </dd>
              </div>

              <div>
                <dt>SPIELE</dt>
                <dd>
                  ${esc(val(
                    member.gamesPlayed,
                    careerMember.gamesPlayed
                  ))}
                </dd>
              </div>

              <div>
                <dt>TORE</dt>
                <dd>
                  ${esc(val(
                    member.goals,
                    careerMember.goals
                  ))}
                </dd>
              </div>

              <div>
                <dt>ASSISTS</dt>
                <dd>
                  ${esc(val(
                    member.assists,
                    careerMember.assists
                  ))}
                </dd>
              </div>

              <div>
                <dt>RATING</dt>
                <dd>
                  ${esc(val(
                    member.ratingAve,
                    careerMember.ratingAve
                  ))}
                </dd>
              </div>

              <div>
                <dt>WINRATE</dt>
                <dd>
                  ${esc(winRate)}
                </dd>
              </div>

            </dl>

          </div>

        </article>
      `;
    }).join('');
  }
  async function loadNews(){const news=await json('/data/news.json',[]);const slug=new URLSearchParams(location.search).get('slug');const box=$('#newsPage');if(slug){const n=news.find(x=>x.slug===slug);if(!n){box.innerHTML='<p class="empty">Artikel nicht gefunden.</p>';return}box.innerHTML=`<article class="article-view"><img src="${esc(n.image)}" alt=""><div class="news-meta">${esc(n.type)} · ${esc(n.date)}</div><h2>${esc(n.title)}</h2><p>${esc(n.excerpt)}</p><p>Weitere Inhalte kannst du direkt in <code>data/news.json</code> ergänzen. Die Website benötigt dafür keine Datenbank.</p></article>`;return}box.className='content-grid';box.innerHTML=news.map(n=>`<a class="detail-card" href="/news.html?slug=${encodeURIComponent(n.slug)}"><img class="wide-thumb" src="${esc(n.image)}" alt=""><div class="news-meta">${esc(n.type)} · ${esc(n.date)}</div><h3>${esc(n.title)}</h3><p>${esc(n.excerpt)}</p></a>`).join('')}
  async function loadInterviews(){const list=await json('/data/interviews.json',[]);const slug=new URLSearchParams(location.search).get('slug');const box=$('#interviewPage');const selected=slug?list.find(x=>x.slug===slug):null;if(selected){box.innerHTML=`<article class="article-view"><img src="${esc(selected.cover)}" alt=""><div class="news-meta">INTERVIEW · ${esc(selected.date)}</div><h2>${esc(selected.title)}</h2><blockquote>„${esc(selected.quote)}“</blockquote><p>${esc(selected.intro)}</p>${selected.qa.map(x=>`<h3>${esc(x.q)}</h3><p>${esc(x.a)}</p>`).join('')}</article>`;return}box.className='content-grid';box.innerHTML=list.map(i=>`<a class="detail-card" href="/interviews.html?slug=${encodeURIComponent(i.slug)}"><img class="wide-thumb" src="${esc(i.cover)}" alt=""><div class="news-meta">${esc(i.date)}</div><h3>${esc(i.title)}</h3><p>„${esc(i.quote)}“</p></a>`).join('')}
  function bindApply(){const f=$('#applicationForm');const status=$('#applicationStatus');f?.addEventListener('submit',async e=>{e.preventDefault();status.textContent='Wird gesendet …';const fd=new FormData(f),body=Object.fromEntries(fd.entries());body.privacy=fd.get('privacy')==='on';try{const r=await fetch('/api/application',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw new Error(j.error||'Fehler');status.textContent='Bewerbung wurde erfolgreich an Chabos United gesendet.';f.reset()}catch(err){status.textContent=err.message||'Bewerbung konnte nicht gesendet werden.'}})}
})();
