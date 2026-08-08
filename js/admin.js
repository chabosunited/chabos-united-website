(() => {
  const cfg = window.CHABOS_CONFIG || { apiBase: '' };
  const tokenKey = 'chabos_admin_token';
  let token = sessionStorage.getItem(tokenKey) || '';
  let state = { players: [], news: [], interviews: [], site: {}, partners: [] };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    if (!token) {
      showLocked();
      return;
    }

    bindTabs();
    bindActions();
    await loadAll();
    renderAll();
    $('#adminApp')?.classList.remove('is-loading');
  }

  function apiBase() {
    return (cfg.apiBase || '').replace(/\/$/, '');
  }

  function showLocked() {
    document.body.innerHTML = `<main class="admin-locked">
      <img src="assets/branding/logo.webp" alt="">
      <h1>ADMIN LOGIN ERFORDERLICH</h1>
      <p>Das Admin Panel wird ausschließlich über die Kontaktseite geöffnet.</p>
      <a href="contact.html">ZUR KONTAKTSEITE</a>
    </main>`;
  }

  async function api(action, options = {}) {
    if (isLocal && token === 'local-dev') return localApi(action, options);

    const url = `${apiBase()}/api/admin?action=${encodeURIComponent(action)}${options.query || ''}`;
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body ? {'Content-Type':'application/json'} : {}),
        Authorization: `Bearer ${token}`
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) {
      sessionStorage.removeItem(tokenKey);
      token = '';
      throw new Error('Session abgelaufen. Bitte erneut über CONTACT anmelden.');
    }
    if (!response.ok) throw new Error(payload.error || `API Fehler ${response.status}`);
    return payload;
  }

  async function localApi(action, options = {}) {
    const qs = new URLSearchParams((options.query || '').replace(/^\?/, ''));
    const key = qs.get('key') || options.body?.key;

    if (action === 'get') {
      const stored = localStorage.getItem(`chabos_cms_${key}`);
      if (stored) return { data: JSON.parse(stored) };
      const fallback = await fetch(`data/${key}.json`).then(r => r.ok ? r.json() : null).catch(() => null);
      return { data: fallback };
    }
    if (action === 'save') {
      localStorage.setItem(`chabos_cms_${options.body.key}`, JSON.stringify(options.body.data));
      return { ok: true };
    }
    if (action === 'delete') {
      localStorage.removeItem(`chabos_cms_${key}`);
      return { ok: true };
    }
    if (action === 'status') return { ok: true, mode: 'LOCAL DEV' };
    throw new Error('Lokale Aktion nicht unterstützt');
  }

  async function loadAll() {
    const keys = ['players','news','interviews','site','partners'];
    const entries = await Promise.all(keys.map(async key => {
      try {
        const payload = await api('get', { query: `&key=${encodeURIComponent(key)}` });
        if (payload.data !== undefined && payload.data !== null) return [key, payload.data];

        const fallback = await fetch(`data/${key}.json`, { cache:'no-store' })
          .then(response => response.ok ? response.json() : defaultValue(key))
          .catch(() => defaultValue(key));
        return [key, fallback];
      } catch (error) {
        setStatus(error.message, true);
        const fallback = await fetch(`data/${key}.json`, { cache:'no-store' })
          .then(response => response.ok ? response.json() : defaultValue(key))
          .catch(() => defaultValue(key));
        return [key, fallback];
      }
    }));
    state = Object.fromEntries(entries);
  }

  function defaultValue(key) {
    return ['players','news','interviews','partners'].includes(key) ? [] : {};
  }

  async function saveKey(key) {
    await api('save', { method:'POST', body:{ key, data:state[key] } });
    setStatus(`${key.toUpperCase()} GESPEICHERT`);
  }

  function bindTabs() {
    $$('.admin-nav button[data-tab]').forEach(button => {
      button.addEventListener('click', () => {
        $$('.admin-nav button').forEach(b => b.classList.toggle('active', b === button));
        $$('.admin-section').forEach(section => section.classList.toggle('active', section.dataset.section === button.dataset.tab));
      });
    });
  }

  function bindActions() {
    $('#adminLogout')?.addEventListener('click', () => {
      sessionStorage.removeItem(tokenKey);
      location.href = 'contact.html';
    });

    $('#saveSite')?.addEventListener('click', async () => {
      state.site = formToObject($('#siteForm'));
      await saveKey('site');
    });

    $('#savePartners')?.addEventListener('click', async () => {
      state.partners = collectPartnerRows();
      await saveKey('partners');
    });

    $('#addPartner')?.addEventListener('click', () => {
      state.partners.push({name:'NEUER PARTNER',sub:'',url:'#'});
      renderPartnersEditor();
    });

    $('#addNews')?.addEventListener('click', () => openNewsEditor());
    $('#addInterview')?.addEventListener('click', () => openInterviewEditor());
    $('#addPlayer')?.addEventListener('click', () => openPlayerEditor());

    $('#newsForm')?.addEventListener('submit', saveNewsFromForm);
    $('#interviewForm')?.addEventListener('submit', saveInterviewFromForm);
    $('#playerForm')?.addEventListener('submit', savePlayerFromForm);

    $$('.editor-close').forEach(btn => btn.addEventListener('click', () => closeEditor(btn.closest('.admin-editor-modal'))));

    $('#mediaUploadForm')?.addEventListener('submit', uploadMedia);
  }

  function renderAll() {
    renderOverview();
    renderSite();
    renderNews();
    renderInterviews();
    renderPlayers();
    renderPartnersEditor();
  }

  function renderOverview() {
    $('#countPlayers').textContent = state.players.length;
    $('#countNews').textContent = state.news.length;
    $('#countInterviews').textContent = state.interviews.length;
    $('#countPartners').textContent = state.partners.length;
    $('#adminMode').textContent = isLocal && token === 'local-dev' ? 'LOCAL DEV' : 'CLOUDFLARE CMS';
  }

  function renderSite() {
    const site = state.site || {};
    const form = $('#siteForm');
    if (!form) return;
    Object.entries(site).forEach(([key,value]) => {
      if (key === 'socials') return;
      const input = form.elements.namedItem(key);
      if (input) input.value = value ?? '';
    });
    const socials = site.socials || {};
    ['twitch','instagram','x','youtube'].forEach(key => {
      const input = form.elements.namedItem(`social_${key}`);
      if (input) input.value = socials[key] || '';
    });
  }

  function formToObject(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    return {
      clubName: data.clubName || 'Chabos United',
      discordUrl: data.discordUrl || '#',
      contactEmail: data.contactEmail || '',
      heroTitleImage: data.heroTitleImage || '',
      websiteBackground: data.websiteBackground || '',
      logo: data.logo || '',
      homeRecruitTitle: data.homeRecruitTitle || '',
      homeRecruitText: data.homeRecruitText || '',
      contactIntro: data.contactIntro || '',
      footerTagline: data.footerTagline || '',
      socials: {
        twitch: data.social_twitch || '#',
        instagram: data.social_instagram || '#',
        x: data.social_x || '#',
        youtube: data.social_youtube || '#'
      }
    };
  }

  function renderNews() {
    const box = $('#newsAdminList');
    if (!box) return;
    box.innerHTML = state.news.map((item,index) => adminCard(item.title, item.date || item.type, item.image, `
      <button data-edit-news="${index}">BEARBEITEN</button>
      <button class="danger" data-delete-news="${index}">LÖSCHEN</button>
    `)).join('') || '<p class="admin-empty">Keine News vorhanden.</p>';

    $$('[data-edit-news]').forEach(btn => btn.onclick = () => openNewsEditor(Number(btn.dataset.editNews)));
    $$('[data-delete-news]').forEach(btn => btn.onclick = async () => {
      if (!confirm('News wirklich löschen?')) return;
      state.news.splice(Number(btn.dataset.deleteNews),1);
      await saveKey('news'); renderNews(); renderOverview();
    });
  }

  function openNewsEditor(index = -1) {
    const item = index >= 0 ? state.news[index] : {type:'NEWS',date:'',title:'',excerpt:'',content:'',image:'assets/news/team-night.webp',slug:''};
    const form = $('#newsForm');
    form.dataset.index = index;
    fillForm(form, item);
    openEditor($('#newsEditor'));
  }

  async function saveNewsFromForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const item = Object.fromEntries(new FormData(form).entries());
    const index = Number(form.dataset.index);
    if (index >= 0) state.news[index] = item; else state.news.unshift(item);
    await saveKey('news'); closeEditor($('#newsEditor')); renderNews(); renderOverview();
  }

  function renderInterviews() {
    const box = $('#interviewAdminList');
    if (!box) return;
    box.innerHTML = state.interviews.map((item,index) => adminCard(item.title, item.player || item.date, item.cover, `
      <button data-edit-interview="${index}">BEARBEITEN</button>
      <button class="danger" data-delete-interview="${index}">LÖSCHEN</button>
    `)).join('') || '<p class="admin-empty">Keine Interviews vorhanden.</p>';
    $$('[data-edit-interview]').forEach(btn => btn.onclick = () => openInterviewEditor(Number(btn.dataset.editInterview)));
    $$('[data-delete-interview]').forEach(btn => btn.onclick = async () => {
      if (!confirm('Interview wirklich löschen?')) return;
      state.interviews.splice(Number(btn.dataset.deleteInterview),1);
      await saveKey('interviews'); renderInterviews(); renderOverview();
    });
  }

  function openInterviewEditor(index = -1) {
    const item = index >= 0 ? state.interviews[index] : {slug:'',title:'',quote:'',player:'',date:'',cover:'assets/news/interview.webp',intro:'',qa:[]};
    const form = $('#interviewForm');
    form.dataset.index = index;
    fillForm(form, {
      ...item,
      qaText: Array.isArray(item.qa) ? item.qa.map(q => `${q.q}|||${q.a}`).join('\n') : ''
    });
    openEditor($('#interviewEditor'));
  }

  async function saveInterviewFromForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const item = {
      slug:data.slug,title:data.title,quote:data.quote,player:data.player,date:data.date,cover:data.cover,intro:data.intro,
      qa:(data.qaText || '').split('\n').map(line => line.trim()).filter(Boolean).map(line => {
        const [q,...rest] = line.split('|||');
        return {q:q?.trim() || '',a:rest.join('|||').trim()};
      })
    };
    const index = Number(form.dataset.index);
    if (index >= 0) state.interviews[index] = item; else state.interviews.unshift(item);
    await saveKey('interviews'); closeEditor($('#interviewEditor')); renderInterviews(); renderOverview();
  }

  function renderPlayers() {
    const box = $('#playerAdminList');
    if (!box) return;
    const sorted = [...state.players].sort((a,b) => (a.order ?? 999) - (b.order ?? 999));
    box.innerHTML = sorted.map(player => {
      const index = state.players.indexOf(player);
      return adminCard(player.displayName, `${player.position || '--'} · ${player.role || ''}`, player.image, `
        <button data-edit-player="${index}">BEARBEITEN</button>
        <button class="danger" data-delete-player="${index}">LÖSCHEN</button>
      `);
    }).join('') || '<p class="admin-empty">Keine Spieler vorhanden.</p>';

    $$('[data-edit-player]').forEach(btn => btn.onclick = () => openPlayerEditor(Number(btn.dataset.editPlayer)));
    $$('[data-delete-player]').forEach(btn => btn.onclick = async () => {
      if (!confirm('Spieler wirklich löschen?')) return;
      state.players.splice(Number(btn.dataset.deletePlayer),1);
      await saveKey('players'); renderPlayers(); renderOverview();
    });
  }

  function openPlayerEditor(index = -1) {
    const item = index >= 0 ? state.players[index] : {displayName:'',position:'',role:'',number:'',image:'assets/players/hoodie-1.webp',order:state.players.length+1,eaNames:[]};
    const form = $('#playerForm');
    form.dataset.index = index;
    fillForm(form, {...item, eaNamesText:Array.isArray(item.eaNames) ? item.eaNames.join(', ') : ''});
    openEditor($('#playerEditor'));
  }

  async function savePlayerFromForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const item = {
      displayName:data.displayName,
      position:data.position,
      role:data.role,
      number:data.number ? Number(data.number) : '',
      image:data.image,
      order:data.order ? Number(data.order) : 999,
      eaNames:(data.eaNamesText || '').split(',').map(v => v.trim()).filter(Boolean)
    };
    const index = Number(form.dataset.index);
    if (index >= 0) state.players[index] = item; else state.players.push(item);
    await saveKey('players'); closeEditor($('#playerEditor')); renderPlayers(); renderOverview();
  }

  function renderPartnersEditor() {
    const box = $('#partnersEditor');
    if (!box) return;
    box.innerHTML = state.partners.map((item,index) => `<div class="partner-edit-row" data-partner-row="${index}">
      <input name="name" value="${escapeAttr(item.name || '')}" placeholder="Name">
      <input name="sub" value="${escapeAttr(item.sub || '')}" placeholder="Untertitel">
      <input name="url" value="${escapeAttr(item.url || '#')}" placeholder="URL">
      <button type="button" class="danger" data-remove-partner="${index}">×</button>
    </div>`).join('');
    $$('[data-remove-partner]').forEach(btn => btn.onclick = () => {
      state.partners.splice(Number(btn.dataset.removePartner),1);
      renderPartnersEditor();
    });
  }

  function collectPartnerRows() {
    return $$('[data-partner-row]').map(row => ({
      name:$('input[name="name"]',row).value,
      sub:$('input[name="sub"]',row).value,
      url:$('input[name="url"]',row).value || '#'
    }));
  }

  async function uploadMedia(event) {
    event.preventDefault();
    const input = $('#mediaFile');
    const status = $('#mediaStatus');
    const file = input.files?.[0];
    if (!file) return;

    if (isLocal && token === 'local-dev') {
      status.textContent = 'Lokaler Upload ist nicht öffentlich speicherbar. Nutze Asset-Pfade oder Cloudflare R2.';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    status.textContent = 'UPLOAD …';
    try {
      const response = await fetch(`${apiBase()}/api/media`, {
        method:'POST',
        headers:{Authorization:`Bearer ${token}`},
        body:formData
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Upload fehlgeschlagen');
      $('#mediaUrl').value = payload.url;
      status.textContent = 'UPLOAD ERFOLGREICH';
    } catch (error) {
      status.textContent = error.message;
    }
  }

  function adminCard(title, meta, image, actions) {
    return `<article class="admin-card">
      <div class="admin-card-thumb">${image ? `<img src="${escapeAttr(image)}" alt="">` : ''}</div>
      <div class="admin-card-copy"><h3>${escapeHtml(title || 'OHNE TITEL')}</h3><p>${escapeHtml(meta || '')}</p></div>
      <div class="admin-card-actions">${actions}</div>
    </article>`;
  }

  function fillForm(form, data) {
    Object.entries(data || {}).forEach(([key,value]) => {
      const input = form.elements.namedItem(key);
      if (input) input.value = value ?? '';
    });
  }

  function openEditor(modal) { if (modal) modal.hidden = false; }
  function closeEditor(modal) { if (modal) modal.hidden = true; }

  function setStatus(message, error = false) {
    const box = $('#adminStatus');
    if (!box) return;
    box.textContent = message;
    box.classList.toggle('error', error);
    clearTimeout(setStatus.timer);
    setStatus.timer = setTimeout(() => box.textContent = '', 3500);
  }

  function escapeHtml(value='') {
    return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function escapeAttr(value='') { return escapeHtml(value); }
})();
