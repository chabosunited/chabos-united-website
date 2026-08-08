(() => {
  const cfg = window.CHABOS_CONFIG || { apiBase: '', discordUrl: '#' };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    ensureFontAwesome();
    setActiveNav();

    const [site, partners] = await Promise.all([
      loadContent('site', 'data/site.json', {}),
      loadContent('partners', 'data/partners.json', [])
    ]);

    renderSocials(site.socials || {});
    applySiteSettings(site);
    renderPartners(partners);
  }

  function ensureFontAwesome() {
    if (document.querySelector('link[href*="font-awesome"],link[href*="fontawesome"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css';
    document.head.appendChild(link);
  }

  function apiBase() {
    return (cfg.apiBase || '').replace(/\/$/, '');
  }

  async function loadContent(key, fallbackUrl, fallback) {
    try {
      const response = await fetch(`${apiBase()}/api/content?key=${encodeURIComponent(key)}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      if (response.ok) {
        const payload = await response.json();
        if (payload && payload.data !== undefined) return payload.data;
      }
    } catch {}

    try {
      const response = await fetch(fallbackUrl, { cache: 'no-store' });
      if (response.ok) return await response.json();
    } catch {}
    return fallback;
  }

  function setActiveNav() {
    const path = location.pathname.split('/').pop() || 'index.html';
    const page = path === '' ? 'index.html' : path;
    $$('.main-nav a').forEach(link => {
      const href = (link.getAttribute('href') || '').split('#')[0];
      link.classList.toggle('active', href === page || (page === 'index.html' && href === 'index.html'));
    });
  }

  function renderSocials(socials) {
    const box = $('.socials');
    if (!box) return;

    const items = [
      ['twitch', 'fa-twitch', 'Twitch'],
      ['instagram', 'fa-instagram', 'Instagram'],
      ['x', 'fa-x-twitter', 'X / Twitter'],
      ['youtube', 'fa-youtube', 'YouTube']
    ];

    box.innerHTML = items.map(([key, icon, label]) => {
      const href = socials[key] || '#';
      return `<a href="${escapeAttr(href)}" ${href !== '#' ? 'target="_blank" rel="noopener noreferrer"' : ''} aria-label="${label}" title="${label}">
        <i class="fa-brands ${icon}" aria-hidden="true"></i>
      </a>`;
    }).join('');
  }

  function applySiteSettings(site) {
    if (!site || typeof site !== 'object') return;

    if (site.logo) {
      $$('.brand img,.footer-brand img').forEach(img => img.src = site.logo);
    }

    if (site.heroTitleImage) {
      const heroTitle = $('.hero-title-image');
      if (heroTitle) heroTitle.src = site.heroTitleImage;
    }

    if (site.websiteBackground) {
      const bg = $('.site-bg');
      if (bg) bg.style.backgroundImage = `url("${site.websiteBackground.replace(/"/g, '\\"')}")`;
    }

    if (site.homeRecruitTitle) {
      const el = $('.recruit h2');
      if (el) el.textContent = site.homeRecruitTitle;
    }

    if (site.homeRecruitText) {
      const el = $('.recruit p');
      if (el) el.textContent = site.homeRecruitText;
    }

    if (site.contactIntro && document.body.dataset.page === 'contact') {
      const el = $('.subhero p');
      if (el) el.textContent = site.contactIntro;
    }

    if (site.footerTagline) {
      $$('.footer-brand small').forEach(el => el.textContent = site.footerTagline);
    }

    if (site.contactEmail) {
      $$('a[href^="mailto:"]').forEach(a => {
        a.href = `mailto:${site.contactEmail}`;
        a.textContent = site.contactEmail;
      });
    }

    const discordUrl = site.discordUrl || cfg.discordUrl || '#';
    $$('[data-discord-link]').forEach(link => {
      link.href = discordUrl;
      if (discordUrl !== '#') {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
    });
  }

  function renderPartners(partners) {
    const box = $('.partner-row');
    if (!box || !Array.isArray(partners) || !partners.length) return;

    box.innerHTML = partners.map(item => {
      const inner = `${escapeHtml(item.name || '')}${item.sub ? `<br><b>${escapeHtml(item.sub)}</b>` : ''}`;
      return item.url && item.url !== '#'
        ? `<a href="${escapeAttr(item.url)}" target="_blank" rel="noopener noreferrer">${inner}</a>`
        : `<span>${inner}</span>`;
    }).join('');
  }

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>"']/g, char => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[char]));
  }

  function escapeAttr(value = '') {
    return escapeHtml(value);
  }
})();
