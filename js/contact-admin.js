(() => {
  const cfg = window.CHABOS_CONFIG || { apiBase: '' };

  document.addEventListener('DOMContentLoaded', () => {
    const trigger = document.getElementById('adminTrigger');
    const modal = document.getElementById('adminLoginModal');
    const form = document.getElementById('adminLoginForm');
    const close = document.getElementById('adminLoginClose');
    const status = document.getElementById('adminLoginStatus');

    if (!trigger || !modal || !form) return;

    const open = () => {
      modal.hidden = false;
      document.body.classList.add('admin-modal-open');
      setTimeout(() => form.querySelector('input[name="password"]')?.focus(), 30);
    };

    const shut = () => {
      modal.hidden = true;
      document.body.classList.remove('admin-modal-open');
      status.textContent = '';
      form.reset();
    };

    trigger.addEventListener('click', open);
    close?.addEventListener('click', shut);
    modal.addEventListener('click', event => {
      if (event.target === modal) shut();
    });
    addEventListener('keydown', event => {
      if (event.key === 'Escape' && !modal.hidden) shut();
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      status.textContent = 'ANMELDUNG WIRD GEPRÜFT …';

      const password = new FormData(form).get('password')?.toString() || '';

      // Local development preview only.
      if ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') && password === 'admin') {
        sessionStorage.setItem('chabos_admin_token', 'local-dev');
        location.href = 'admin.html';
        return;
      }

      try {
        const base = (cfg.apiBase || '').replace(/\/$/, '');
        const response = await fetch(`${base}/api/admin?action=login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ password })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.token) throw new Error(payload.error || 'Login fehlgeschlagen');

        sessionStorage.setItem('chabos_admin_token', payload.token);
        location.href = 'admin.html';
      } catch (error) {
        status.textContent = error.message || 'LOGIN FEHLGESCHLAGEN';
      }
    });
  });
})();
