/* Shared Discord account controls for the portal and the policy/support pages. */
(() => {
  let session = { user: null };
  const buttons = [...document.querySelectorAll('[data-logout]')];
  buttons.forEach(button => {
    button.innerHTML = `${window.DevilIcons.render('logout')}<span>ออกจากระบบ</span>`;
    button.addEventListener('click', async () => {
      buttons.forEach(node => { node.disabled = true; });
      try {
        const response = await fetch('/api/portal?action=logout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrf || '' }, body: '{}' });
        if (!response.ok && response.status !== 401) {
          const result = await response.json(); throw new Error(result.error || 'ออกจากระบบไม่สำเร็จ กรุณาลองใหม่');
        }
        window.location.replace('/');
      } catch (error) {
        buttons.forEach(node => { node.disabled = false; });
        let notice = document.querySelector('#account-error');
        if (!notice) { notice = document.createElement('p'); notice.id = 'account-error'; notice.setAttribute('role', 'alert'); document.querySelector('header').after(notice); }
        notice.textContent = error.message;
      }
    });
  });
  const ready = (async () => {
    try {
      const response = await fetch('/api/portal?action=session', { cache: 'no-store' });
      if (response.ok) session = await response.json();
    } catch { /* Keep the sign-in link available when Discord is unavailable. */ }
    buttons.forEach(button => { button.hidden = !session.user; });
    const link = document.querySelector('#account-link');
    if (session.user && link) { link.href = '/dashboard'; link.textContent = `${session.user.name} · Dashboard`; }
    const adminLink = document.querySelector('#admin-link');
    if (adminLink) adminLink.hidden = !session.owner;
    return session;
  })();
  window.DevilAccount = { ready };
})();
