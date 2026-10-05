/* First-visit walkthrough. No navigation or account actions run during the tour. */
(() => {
  const storageKey = 'devil-tour-v1';
  const icon = name => window.DevilIcons.render(name);
  const nav = document.querySelector('#navigation');
  const menu = document.querySelector('#menu-toggle');
  let overlay, steps, index = 0, previousFocus, previousScroll, navWasOpen, inertElements = [], frame, started = false;
  const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function hasSeen() { try { return Boolean(localStorage.getItem(storageKey)); } catch { return started; } }
  function buildSteps() {
    const list = [
      { target: '.hero-copy, .page-head, .login-card', symbol: 'logo', title: 'ยินดีต้อนรับสู่ Devil', body: 'มารู้จักส่วนต่าง ๆ ของเว็บกัน ใช้ปุ่มถัดไปเพื่อดูทีละจุด หรือข้ามทั้งหมดเพื่อเริ่มใช้งานได้เลย' },
      { target: '.hero [data-invite-bot], .nav-invite', symbol: 'plus', title: 'เชิญ Devil เข้าชุมชน', body: 'กดเชิญบอทเพื่อเลือกเซิร์ฟเวอร์ใน Discord เมื่อเพิ่ม Devil แล้ว คุณจะตั้งค่าระบบต่าง ๆ ผ่านเว็บได้' },
      { target: '.owner-section .owner-grid, .topbar .brand', symbol: 'crown', title: 'รู้จัก Owner ของ Devil', body: 'หน้าแรกแสดงผู้ดูแลและโปรไฟล์ Discord กดดูโปรไฟล์เพื่อรู้จักคนที่อยู่เบื้องหลัง Devil' },
      { target: '.toolkit-section .grid, #navigation a[href="/features"]', symbol: 'grid', title: 'ระบบสำหรับชุมชนของคุณ', body: 'ดูฟีเจอร์ Welcome, Ticket และความปลอดภัย พร้อมภาพและรายละเอียดของแต่ละระบบ' },
      { target: '#navigation a[href="/commands"]', symbol: 'command', title: 'คำสั่ง Public และ VIP', body: 'ค้นหาคำสั่งตามชื่อหรือหมวด เลือก Public หรือ VIP เพื่อดูรายละเอียดและตัวเลือกของคำสั่งที่ต้องการ' },
      { target: '#navigation a[href="/servers"]', symbol: 'users', title: 'สำรวจชุมชน', body: 'ดูเซิร์ฟเวอร์ที่ใช้ Devil แยกเป็นหมวด พร้อมข้อมูลสมาชิกและสถานะชุมชน' },
      { target: '#account-link', symbol: 'settings', title: 'จัดการเซิร์ฟเวอร์จากเว็บ', body: 'เข้าสู่ระบบ Discord แล้วเลือกเซิร์ฟเวอร์ที่คุณดูแล บอทต้องอยู่ในเซิร์ฟเวอร์ และบัญชีต้องมีสิทธิ์จัดการ จึงจะตั้งค่า Welcome, Ticket และระบบอื่น ๆ ได้' }
    ];
    if (!document.querySelector('#admin-link')?.hidden) list.push({ target: '#admin-link', symbol: 'crown', title: 'เครื่องมือสำหรับ Owner', body: 'Owner เข้าไปจัดการฟีเจอร์ อัปเดต และหมวดชุมชนในหลังบ้าน รวมถึงใช้คำสั่งประกาศ ตั้งสถานะ และ Reload ในเซิร์ฟเวอร์หลักได้' });
    list.push({ target: '#navigation a[href="/updates"]', symbol: 'bell', title: 'พร้อมเริ่มใช้งานแล้ว', body: 'ติดตามข่าวใหม่ได้ที่หน้าอัปเดต กดตกลงเพื่อเริ่มสำรวจเว็บ หรือเปิดตัวแนะนำอีกครั้งจากปุ่ม “แนะนำการใช้งาน” ท้ายเว็บ' });
    return list;
  }
  function targetForStep() {
    let selector = steps[index].target;
    if (window.DevilNavigation?.isMobile) selector = selector.replaceAll('#navigation', '#mobile-navigation').replace('.nav-invite', '#mobile-navigation [data-invite-bot]');
    return [...document.querySelectorAll(selector)].find(node => getComputedStyle(node).display !== 'none') || null;
  }
  function position() {
    if (!overlay) return;
    const panel = overlay.querySelector('.tour-panel'), spotlight = overlay.querySelector('.tour-spotlight');
    const target = targetForStep(), rect = target?.getBoundingClientRect();
    const width = window.innerWidth, height = window.innerHeight;
    const panelWidth = Math.min(380, width - 32), panelHeight = panel.offsetHeight || 280;
    panel.style.width = `${panelWidth}px`;
    if (index === 0 || !rect || !rect.width || !rect.height) {
      spotlight.hidden = true;
      panel.style.left = `${(width - panelWidth) / 2}px`;
      panel.style.top = `${Math.max(16, (height - panelHeight) / 2)}px`;
      overlay.classList.add('tour-centered'); return;
    }
    overlay.classList.remove('tour-centered'); spotlight.hidden = false;
    const left = Math.max(8, rect.left - 7), top = Math.max(8, rect.top - 7);
    const right = Math.min(width - 8, rect.right + 7), bottom = Math.min(height - 8, rect.bottom + 7);
    Object.assign(spotlight.style, { left: `${left}px`, top: `${top}px`, width: `${Math.max(0, right - left)}px`, height: `${Math.max(0, bottom - top)}px` });
    let panelLeft = Math.min(Math.max(16, rect.left), width - panelWidth - 16);
    let panelTop;
    if (width > 900 && rect.right + panelWidth + 30 < width) { panelLeft = rect.right + 18; panelTop = Math.max(16, Math.min(rect.top, height - panelHeight - 16)); }
    else if (bottom + panelHeight + 30 <= height) panelTop = bottom + 14;
    else if (top - panelHeight - 14 >= 16) panelTop = top - panelHeight - 14;
    else panelTop = Math.max(16, height - panelHeight - 16);
    panel.style.left = `${panelLeft}px`; panel.style.top = `${panelTop}px`;
  }
  function schedulePosition() { cancelAnimationFrame(frame); frame = requestAnimationFrame(position); }
  function showStep() {
    const step = steps[index];
    overlay.querySelector('#tour-title').textContent = step.title;
    overlay.querySelector('#tour-description').textContent = step.body;
    overlay.querySelector('.tour-symbol').innerHTML = step.symbol === 'logo' ? '<img src="/bot-avatar?v=original-logo" alt="">' : icon(step.symbol);
    overlay.querySelector('.tour-count').textContent = `${index + 1} / ${steps.length}`;
    overlay.querySelector('.tour-progress').innerHTML = steps.map((_, i) => `<span class="${i === index ? 'current' : i < index ? 'complete' : ''}"></span>`).join('');
    overlay.querySelector('[data-tour-back]').hidden = index === 0;
    overlay.querySelector('[data-tour-next]').innerHTML = index === steps.length - 1 ? `ตกลง ${icon('check')}` : `ถัดไป ${icon('arrow')}`;
    const target = targetForStep();
    if (window.DevilNavigation) {
      if (target && window.DevilNavigation.element.contains(target)) window.DevilNavigation.open({ guided: true });
      else window.DevilNavigation.close({ restoreFocus: false });
    } else if (target && nav.contains(target) && getComputedStyle(nav).display === 'none') {
      nav.classList.add('open'); menu.setAttribute('aria-expanded', 'true');
    }
    target?.scrollIntoView?.({ behavior: reducedMotion() ? 'instant' : 'smooth', block: 'center' });
    position(); schedulePosition();
    overlay.querySelector('[data-tour-next]').focus({ preventScroll: true });
  }
  function finish(outcome) {
    if (!overlay) return;
    try { localStorage.setItem(storageKey, outcome); } catch {}
    cancelAnimationFrame(frame);
    overlay.remove(); overlay = null;
    inertElements.forEach(([element, value]) => { element.inert = value; });
    if (window.DevilNavigation) { window.DevilNavigation.close({ restoreFocus: false }); if (navWasOpen) window.DevilNavigation.open(); }
    else if (!navWasOpen) { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); }
    window.removeEventListener('resize', schedulePosition); window.removeEventListener('scroll', schedulePosition);
    window.visualViewport?.removeEventListener('resize', schedulePosition);
    document.removeEventListener('keydown', onKey);
    window.scrollTo({ top: previousScroll, behavior: reducedMotion() ? 'instant' : 'smooth' });
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
  function onKey(event) {
    if (event.key === 'Escape') { event.preventDefault(); finish('skipped'); }
    if (event.key !== 'Tab' || !overlay) return;
    const buttons = [...overlay.querySelectorAll('button')].filter(button => !button.hidden);
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  function begin() {
    if (overlay) return;
    started = true; observer.disconnect();
    steps = buildSteps(); index = 0; previousFocus = document.activeElement; previousScroll = window.scrollY; navWasOpen = window.DevilNavigation ? window.DevilNavigation.isOpen : nav.classList.contains('open');
    window.DevilNavigation?.close({ restoreFocus: false });
    overlay = document.createElement('div'); overlay.className = 'tour-overlay tour-centered';
    overlay.innerHTML = `<div class="tour-spotlight" hidden></div><section class="tour-panel" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-description"><div class="tour-top"><span class="tour-wordmark">DEVIL · QUICK TOUR</span><span class="tour-count"></span></div><div class="tour-symbol"></div><div class="tour-copy" aria-live="polite"><h2 id="tour-title"></h2><p id="tour-description"></p></div><div class="tour-progress" aria-hidden="true"></div><div class="tour-controls"><button type="button" class="tour-skip" data-tour-skip>ข้ามทั้งหมด</button><div><button type="button" class="tour-back" data-tour-back>ย้อนกลับ</button><button type="button" class="button primary" data-tour-next>ถัดไป</button></div></div></section>`;
    document.body.append(overlay);
    inertElements = [...document.querySelectorAll('header.topbar, #app, body>footer')].map(element => [element, element.inert]);
    inertElements.forEach(([element]) => { element.inert = true; });
    overlay.querySelector('[data-tour-next]').onclick = () => { if (index === steps.length - 1) finish('finished'); else { index++; showStep(); } };
    overlay.querySelector('[data-tour-back]').onclick = () => { if (index > 0) { index--; showStep(); } };
    overlay.querySelector('[data-tour-skip]').onclick = () => finish('skipped');
    document.addEventListener('keydown', onKey); window.addEventListener('resize', schedulePosition); window.addEventListener('scroll', schedulePosition, { passive: true });
    window.visualViewport?.addEventListener('resize', schedulePosition);
    showStep();
  }
  function ready() {
    if (hasSeen() || started) { observer.disconnect(); return; }
    if (document.querySelector('#app .hero, #app .page-head, #app .login-card')) begin();
  }
  const observer = new MutationObserver(ready);
  document.querySelectorAll('[data-start-tour]').forEach(button => button.addEventListener('click', begin));
  observer.observe(document.querySelector('#app'), { childList: true, subtree: true });
  ready();
})();
