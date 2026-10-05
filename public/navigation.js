/* Original mobile drawer and animated three-line menu control. */
(() => {
  const trigger = document.querySelector('#menu-toggle');
  const icon = name => window.DevilIcons.render(name);
  const route = location.pathname.replace(/\/$/, '') || '/';
  const routes = [
    ['/', 'หน้าหลัก', 'พื้นที่ของชุมชนคุณ', 'home'],
    ['/commands', 'สำรวจคำสั่ง', 'คำสั่ง Public และ VIP', 'command'],
    ['/servers', 'ชุมชน', 'เซิร์ฟเวอร์ที่เติบโตไปกับ Devil', 'users'],
    ['/features', 'ฟีเจอร์และระบบ', 'รู้จักทุกระบบของ Devil', 'grid'],
    ['/updates', 'ข่าวอัปเดต', 'สิ่งใหม่จากทีม Devil', 'bell'],
    ['/dashboard', 'จัดการเซิร์ฟเวอร์', 'ตั้งค่า Welcome, Ticket และความปลอดภัย', 'settings'],
    ['/admin', 'หลังบ้าน Owner', 'จัดการเนื้อหาและหมวดชุมชน', 'crown', true],
    ['/owner', 'คำสั่ง Owner', 'ประกาศ สถานะ และ Reload', 'lock', true]
  ];
  trigger.innerHTML = '<span class="menu-glyph" aria-hidden="true"><span></span><span></span><span></span></span>';
  trigger.setAttribute('aria-controls', 'mobile-navigation');
  const drawer = document.createElement('div');
  drawer.id = 'mobile-navigation'; drawer.className = 'mobile-navigation'; drawer.inert = true; drawer.setAttribute('aria-hidden', 'true');
  drawer.innerHTML = `<button class="menu-backdrop" type="button" data-menu-close tabindex="-1" aria-label="ปิดเมนู"></button><section class="menu-panel" role="dialog" aria-labelledby="drawer-title"><div class="menu-panel-header"><a class="drawer-brand" href="/"><img src="/bot-avatar?v=original-logo" alt=""><span>DEVIL<span class="muted">BOT</span><small>YOUR COMMUNITY SPACE</small></span></a><button class="drawer-close" type="button" data-menu-close aria-label="ปิดเมนู">${icon('close')}</button></div><div class="drawer-heading"><span>EXPLORE DEVIL</span><h2 id="drawer-title">ไปที่ไหนดี?</h2></div><nav class="drawer-links" aria-label="เมนูมือถือ">${routes.map(([href, label, description, symbol, owner], i) => `<a class="drawer-link ${route === href ? 'active' : ''}" href="${href}" style="--menu-order:${i}" ${route === href ? 'aria-current="page"' : ''} ${owner ? 'data-owner-menu hidden' : ''}><span class="drawer-icon">${icon(symbol)}</span><span class="drawer-link-copy"><b>${label}</b><small>${description}</small></span><span class="drawer-link-arrow">${icon('arrow')}</span></a>`).join('')}</nav><div class="drawer-bottom"><a class="invite-button" data-invite-bot href="/api/portal?action=invite" target="_blank" rel="noopener noreferrer"><span class="invite-logo"><img src="/bot-avatar?v=original-logo" alt=""></span><span class="invite-copy"><b>เชิญ Devil เข้าเซิร์ฟเวอร์</b><small>เริ่มต้นชุมชนของคุณ</small></span><span class="invite-arrow">${icon('external')}</span></a><span class="drawer-signoff"><i class="dot"></i> MADE FOR YOUR COMMUNITY</span></div></section>`;
  document.body.append(drawer);
  const panel = drawer.querySelector('.menu-panel');
  const breakpoint = window.matchMedia?.('(max-width: 760px)');
  const isMobile = () => breakpoint ? breakpoint.matches : window.innerWidth <= 760;
  let open = false, guided = false, previousFocus, inertElements = [], savedOverflow;
  function setTrigger() { trigger.classList.toggle('is-open', open); trigger.setAttribute('aria-expanded', String(open)); trigger.setAttribute('aria-label', open ? 'ปิดเมนู' : 'เปิดเมนู'); }
  function close({ restoreFocus = true } = {}) {
    if (!open) return;
    const wasGuided = guided;
    open = false; guided = false;
    drawer.classList.remove('is-open', 'is-guided'); drawer.inert = true; drawer.setAttribute('aria-hidden', 'true'); panel.removeAttribute('aria-modal');
    setTrigger();
    if (!wasGuided) {
      document.body.style.overflow = savedOverflow;
      inertElements.forEach(([element, value]) => { element.inert = value; });
      document.removeEventListener('keydown', onKey);
      if (restoreFocus && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    }
  }
  function show({ guided: preview = false } = {}) {
    if (!isMobile()) return;
    if (open && guided === preview) return;
    if (open) close({ restoreFocus: false });
    guided = preview; open = true;
    drawer.classList.toggle('is-guided', guided); drawer.classList.add('is-open'); drawer.inert = guided; drawer.setAttribute('aria-hidden', String(guided)); setTrigger();
    if (guided) return;
    previousFocus = document.activeElement;
    savedOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    inertElements = [...document.querySelectorAll('header.topbar, #app, body>footer')].map(element => [element, element.inert]);
    inertElements.forEach(([element]) => { element.inert = true; });
    panel.setAttribute('aria-modal', 'true');
    document.addEventListener('keydown', onKey);
    drawer.querySelector('.drawer-close').focus({ preventScroll: true });
  }
  function onKey(event) {
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (event.key !== 'Tab') return;
    const controls = [...panel.querySelectorAll('a, button')].filter(element => !element.hidden);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  trigger.addEventListener('click', () => open ? close() : show());
  drawer.querySelectorAll('[data-menu-close]').forEach(button => button.addEventListener('click', () => close()));
  drawer.querySelectorAll('a').forEach(link => link.addEventListener('click', () => close({ restoreFocus: false })));
  window.addEventListener('resize', () => { if (!isMobile()) close(); });
  breakpoint?.addEventListener('change', () => { if (!isMobile()) close(); });
  window.DevilAccount.ready.then(session => { drawer.querySelectorAll('[data-owner-menu]').forEach(link => { link.hidden = !session.owner; }); });
  window.DevilNavigation = { open: show, close, element: drawer, get isOpen() { return open; }, get isMobile() { return isMobile(); } };
})();
