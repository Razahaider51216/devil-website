/* Publication inbox. Reading an individual message clears its unread badge. */
(() => {
  const host = document.querySelector('.account');
  if (!host) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = name => window.DevilIcons.render(name);
  const trigger = document.createElement('button');
  trigger.id = 'notification-toggle'; trigger.className = 'notification-toggle'; trigger.type = 'button';
  trigger.setAttribute('aria-label', 'การแจ้งเตือน'); trigger.setAttribute('aria-haspopup', 'dialog'); trigger.setAttribute('aria-expanded', 'false');
  trigger.innerHTML = `${icon('bell')}<span class="notification-count" aria-live="polite" hidden></span>`;
  host.prepend(trigger);
  const dialog = document.createElement('dialog'); dialog.id = 'notification-dialog'; dialog.className = 'notification-dialog'; dialog.setAttribute('aria-labelledby', 'notification-title');
  dialog.innerHTML = `<div class="notification-head"><div class="notification-heading-icon">${icon('bell')}</div><div><span>DEVIL INBOX</span><h2 id="notification-title">การแจ้งเตือน</h2></div><button type="button" data-notification-close aria-label="ปิดการแจ้งเตือน">${icon('close')}</button></div><div class="notification-content"></div><div class="notification-foot"><span>ข่าวใหม่จากทีม Devil</span><button type="button" data-notification-refresh>${icon('reload')} รีเฟรช</button></div>`;
  document.body.append(dialog);
  const content = dialog.querySelector('.notification-content'), badge = trigger.querySelector('.notification-count');
  let rows = [], read = new Set(), storageKey = 'devil-notifications-read:guest', selected = null, loading = false, unavailable = false, loaded = false;
  const loadRead = () => { try { const saved = JSON.parse(localStorage.getItem(storageKey) || '[]'); read = new Set(Array.isArray(saved) ? saved.filter(id => typeof id === 'string') : []); } catch { read = new Set(); } };
  const saveRead = () => { try { localStorage.setItem(storageKey, JSON.stringify([...read].slice(-1000))); } catch {} };
  const date = at => Number.isFinite(Date.parse(at)) ? new Date(at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }) : '';
  const type = kind => ({ update: ['bell', 'อัปเดต'], feature: ['grid', 'ฟีเจอร์'], command: ['command', 'คำสั่ง'] }[kind] || ['bell', 'ข่าวใหม่']);
  function render() {
    const unread = rows.filter(row => !read.has(row.id));
    badge.textContent = unread.length > 99 ? '99+' : String(unread.length); badge.hidden = !unread.length;
    trigger.setAttribute('aria-label', `การแจ้งเตือน ${unread.length} รายการที่ยังไม่อ่าน`);
    if (selected) {
      const row = selected, [symbol, label] = type(row.kind);
      const href = ['/updates', '/features', '/commands'].includes(row.href) ? row.href : '/';
      content.innerHTML = `<button class="notification-back" type="button" data-notification-back>${icon('arrow')} กลับไปกล่องแจ้งเตือน</button><article class="notification-detail"><span class="notification-kind">${icon(symbol)} ${label}</span><h3>${esc(row.title)}</h3><time>${esc(date(row.at))}</time><div class="notification-body">${window.DevilFeatureDemos?.richText ? window.DevilFeatureDemos.richText(row.body) : esc(row.body)}</div><a class="button primary" href="${href}">ดู${label} ${icon('external')}</a></article>`;
    } else {
      content.innerHTML = `${unavailable ? '<p class="notification-unavailable" role="status">ยังโหลดข่าวบางส่วนไม่ได้ กดรีเฟรชเพื่อลองอีกครั้ง</p>' : ''}${unread.length ? `<div class="notification-list">${unread.map(row => { const [symbol, label] = type(row.kind); return `<button class="notification-item" type="button" data-notification-id="${esc(row.id)}"><span class="notification-item-icon">${icon(symbol)}</span><span class="notification-item-copy"><small>${label}</small><b>${esc(row.title)}</b><span>${esc(row.body.slice(0, 120))}</span><time>${esc(date(row.at))}</time></span><i class="notification-unread-dot" aria-label="ยังไม่อ่าน"></i></button>`; }).join('')}</div>` : `<div class="notification-empty">${icon(loaded ? 'check' : 'bell')}<h3>${loaded ? 'อ่านครบแล้ว' : 'กำลังโหลดแจ้งเตือน…'}</h3><p>${loaded ? 'เมื่อมีอัปเดต ฟีเจอร์ หรือคำสั่งใหม่ จะแสดงที่นี่' : 'รอสักครู่'}</p></div>`}`;
    }
  }
  async function refresh() {
    if (loading) return; loading = true;
    try {
      const response = await fetch('/api/portal?action=notifications', { cache: 'no-store' });
      if (!response.ok) throw new Error('unavailable');
      const data = await response.json();
      if (!Array.isArray(data.notifications)) throw new Error('invalid feed');
      unavailable = data.unavailable === true;
      const next = data.notifications.filter(row => row && typeof row.id === 'string' && typeof row.title === 'string').map(row => ({ ...row, body: String(row.body || '') }));
      rows = unavailable ? [...new Map([...rows, ...next].map(row => [row.id, row])).values()] : next;
      rows.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
      if (selected && !rows.some(row => row.id === selected.id)) selected = null;
      loaded = true;
    } catch { unavailable = true; loaded = true; }
    finally { loading = false; render(); }
  }
  const close = () => dialog.close();
  trigger.addEventListener('click', () => { selected = null; render(); dialog.showModal(); trigger.setAttribute('aria-expanded', 'true'); refresh(); });
  dialog.addEventListener('close', () => { trigger.setAttribute('aria-expanded', 'false'); trigger.focus({ preventScroll: true }); });
  dialog.querySelector('[data-notification-close]').addEventListener('click', close);
  dialog.querySelector('[data-notification-refresh]').addEventListener('click', refresh);
  dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
  content.addEventListener('click', event => {
    const spoiler = event.target.closest('.demo-spoiler');
    if (spoiler) { spoiler.setAttribute('aria-expanded', String(spoiler.getAttribute('aria-expanded') !== 'true')); return; }
    if (event.target.closest('[data-notification-back]')) { selected = null; render(); return; }
    const item = event.target.closest('[data-notification-id]');
    if (!item) return;
    const row = rows.find(row => row.id === item.dataset.notificationId); if (!row) return;
    read.add(row.id); saveRead(); selected = row; render();
    content.scrollTop = 0; content.querySelector('[data-notification-back]')?.focus();
  });
  content.addEventListener('error', event => {
    if (event.target.matches?.('.demo-emoji')) { event.target.hidden = true; if (event.target.nextElementSibling) event.target.nextElementSibling.hidden = false; }
  }, true);
  window.addEventListener('storage', event => { if (event.key === storageKey) { loadRead(); render(); } });
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
  Promise.resolve(window.DevilAccount?.ready).then(session => { storageKey = `devil-notifications-read:${session?.user?.id || 'guest'}`; loadRead(); render(); refresh(); });
  setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 60000);
})();
