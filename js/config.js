(() => {
  const isGitHubPages = location.hostname.endsWith('github.io');
  const cloudflareOrigin = 'https://chabosunited.pages.dev';

  window.CHABOS_CONFIG = Object.freeze({
    clubId: '5395290',
    platform: 'common-gen5',

    // Cloudflare Pages runs /functions/api/*.js itself.
    // GitHub Pages is static only, so it uses the Cloudflare deployment as API backend.
    apiBase: isGitHubPages ? cloudflareOrigin : '',
    cloudflareOrigin,
    isGitHubPages,

    discordUrl: 'https://discord.gg/Jg5Mfyhg6'
  });
})();
