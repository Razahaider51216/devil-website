/* First-visit walkthrough. No navigation or account actions run during the tour. */
(() => {
  const storageKey = 'devil-tour-v1';
  const icon = name => window.DevilIcons.render(name);
  const nav = document.querySelector('#navigation');
  const menu = document.querySelector('#menu-toggle');
  let overlay, steps, index = 0, previousFocus, previousScroll, navWasOpen, inertElements = [], frame, resizeObserver, started = false;
  const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function hasSeen() { try { return Boolean(localStorage.getItem(storageKey)); } catch { return started; } }
  function buildSteps() {
    const list = [
      { target: '#account-link', symbol: 'logo', title: 'เข้าสู่ระบบ Discord', body: 'กดปุ่มเข้าสู่ระบบ Discord เพื่อเชื่อมบัญชีของคุณ แล้วเลือกเซิร์ฟเวอร์ที่ต้องการจัดการ ใช้ปุ่มถัดไปเพื่อดูส่วนอื่น ๆ ของเว็บ หรือข้ามทั้งหมดเพื่อเริ่มใช้งานได้เลย' },
      { target: '.hero [data-invite-bot], .nav-invite', symbol: 'plus', title: 'เชิญ Devil เข้าชุมชน', body: 'กดเชิญบอทเพื่อเลือกเซิร์ฟเวอร์ใน Discord เมื่อเพิ่ม Devil แล้ว คุณจะตั้งค่าระบบต่าง ๆ ผ่านเว็บได้' },
      { target: '.owner-section .owner-home-card:first-child, .owner-section .section-heading', symbol: 'crown', title: 'รู้จัก Owner ของ Devil', body: 'หน้าแรกแสดงผู้ดูแลและโปรไฟล์ Discord กดดูโปรไฟล์เพื่อรู้จักคนที่อยู่เบื้องหลัง Devil' },
      { target: '.toolkit-section .feature-card:first-child h3, #navigation a[href="/features"]', symbol: 'grid', title: 'ระบบสำหรับชุมชนของคุณ', body: 'ดูฟีเจอร์ Welcome, Ticket และความปลอดภัย พร้อมภาพและรายละเอียดของแต่ละระบบ' },
      { target: '#navigation a[href="/commands"]', symbol: 'command', title: 'คำสั่ง Public และ VIP', body: 'ค้นหาคำสั่งตามชื่อหรือหมวด เลือก Public หรือ VIP เพื่อดูรายละเอียดและตัวเลือกของคำสั่งที่ต้องการ' },
      { target: '#navigation a[href="/servers"]', symbol: 'users', title: 'สำรวจชุมชน', body: 'ดูเซิร์ฟเวอร์ที่ใช้ Devil แยกเป็นหมวด พร้อมข้อมูลสมาชิกและสถานะชุมชน' },
      { target: '#navigation a[href="/dashboard"], .hero a[href="/dashboard"], footer a[href="/dashboard"]', symbol: 'settings', title: 'จัดการเซิร์ฟเวอร์จากเว็บ', body: 'เปิดเมนูจัดการเซิร์ฟเวอร์ แล้วเลือกเซิร์ฟเวอร์ที่คุณดูแล เพื่อตั้งค่า Welcome, Ticket ช่องแจ้งเตือน และระบบความปลอดภัย บอทต้องอยู่ในเซิร์ฟเวอร์ และบัญชีของคุณต้องมีสิทธิ์จัดการ' }
    ];
    if (!document.querySelector('.owner-section')) list.splice(2, 1);
    if (!document.querySelector('#admin-link')?.hidden) list.push({ target: '#admin-link', symbol: 'crown', title: 'เครื่องมือสำหรับ Owner', body: 'Owner เข้าไปจัดการฟีเจอร์ อัปเดต และหมวดชุมชนในหลังบ้าน รวมถึงใช้คำสั่งประกาศ ตั้งสถานะ และ Reload ในเซิร์ฟเวอร์หลักได้' });
    list.push({ target: '#navigation a[href="/updates"]', symbol: 'bell', title: 'พร้อมเริ่มใช้งานแล้ว', body: 'ติดตามข่าวใหม่ได้ที่หน้าอัปเดต กดตกลงเพื่อเริ่มสำรวจเว็บ หรือเปิดตัวแนะนำอีกครั้งจากปุ่ม “แนะนำการใช้งาน” ท้ายเว็บ' });
    return list;
  }
  function targetForStep() {
    let selector = steps[index].target;
    if (window.DevilNavigation?.isMobile) selector = selector.replaceAll('#navigation', '#mobile-navigation').replace('.nav-invite', '#mobile-navigation [data-invite-bot]');
    // Prefer the first matching selector, rather than the first node in document order.
    for (const part of selector.split(',')) {
      const node = [...document.querySelectorAll(part.trim())].find(element => getComputedStyle(element).display !== 'none');
      if (node) return node;
    }
    return null;
  }
  function viewport() {
    const visual = window.visualViewport;
    return { left: visual?.offsetLeft || 0, top: visual?.offsetTop || 0, width: visual?.width || window.innerWidth, height: visual?.height || window.innerHeight };
  }
  function alignTarget(target, top, bottom) {
    if (!target || bottom <= top) return;
    const scrollArea = target.closest('.drawer-links');
    if (scrollArea) {
      const area = scrollArea.getBoundingClientRect();
      top = Math.max(top, area.top + 6); bottom = Math.min(bottom, area.bottom - 6);
    }
    if (bottom <= top) return;
    const rect = target.getBoundingClientRect();
    if (rect.top >= top && rect.bottom <= bottom) return;
    const delta = rect.top + Math.min(rect.height, bottom - top) / 2 - (top + bottom) / 2;
    if (Math.abs(delta) < 1) return;
    if (scrollArea) scrollArea.scrollTop += delta;
    else if (!window.DevilNavigation?.element.contains(target) && rect.width && rect.height) window.scrollBy({ top: delta, behavior: 'instant' });
  }
  function position(align = false) {
    if (!overlay) return;
    const panel = overlay.querySelector('.tour-panel'), spotlight = overlay.querySelector('.tour-spotlight');
    const target = targetForStep(), view = viewport(), gap = 14;
    const rightEdge = view.left + view.width, bottomEdge = view.top + view.height;
    const panelWidth = Math.min(380, view.width - 32);
    panel.style.width = `${panelWidth}px`;
    panel.classList.toggle('tour-docked', index > 0 && view.width <= 760);
    panel.style.maxHeight = `${index > 0 && view.width <= 760 ? Math.min(300, view.height * .46) : view.height - 32}px`;
    const panelHeight = panel.offsetHeight || 240;
    let rect = target?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) {
      spotlight.hidden = true;
      overlay.classList.add('tour-centered');
      const origin = overlay.getBoundingClientRect();
      panel.style.left = `${view.left + (view.width - panelWidth) / 2 - origin.left}px`;
      panel.style.top = `${view.top + Math.max(16, (view.height - panelHeight) / 2) - origin.top}px`;
      return;
    }
    let panelLeft = Math.min(Math.max(view.left + 16, rect.left), rightEdge - panelWidth - 16);
    let panelTop;
    if (view.width > 760) {
      const sideTop = Math.max(view.top + 16, Math.min(rect.top, bottomEdge - panelHeight - 16));
      if (rect.right + gap + panelWidth <= rightEdge - 16) { panelLeft = rect.right + gap; panelTop = sideTop; }
      else if (rect.left - gap - panelWidth >= view.left + 16) { panelLeft = rect.left - gap - panelWidth; panelTop = sideTop; }
      else if (rect.bottom + gap + panelHeight <= bottomEdge - 16) panelTop = rect.bottom + gap;
      else if (rect.top - gap - panelHeight >= view.top + 16) panelTop = rect.top - gap - panelHeight;
    }
    // Reserve separate space for the guide when there is no room beside the target.
    const docked = panelTop === undefined;
    panel.classList.toggle('tour-docked', docked);
    if (docked) {
      panelTop = bottomEdge - panelHeight - 16;
      panelLeft = view.left + (view.width - panelWidth) / 2;
      const drawer = window.DevilNavigation?.element;
      if (drawer?.classList.contains('is-guided')) {
        drawer.style.setProperty('--tour-menu-height', `${Math.max(0, panelTop - view.top - gap)}px`);
        drawer.style.setProperty('--tour-menu-top', `${view.top}px`);
      }
      if (align) alignTarget(target, view.top + 16, panelTop - gap - 7);
      rect = target.getBoundingClientRect();
    }
    overlay.classList.remove('tour-centered'); spotlight.hidden = false;
    // Absolute children share the measured overlay origin. Safari can move the
    // fixed overlay when its browser controls or visual viewport change.
    const origin = overlay.getBoundingClientRect();
    const left = Math.max(view.left + 8, rect.left - 7), top = Math.max(view.top + 8, rect.top - 7);
    const right = Math.min(rightEdge - 8, rect.right + 7), bottom = Math.min(docked ? panelTop - gap : bottomEdge - 8, rect.bottom + 7);
    Object.assign(spotlight.style, { left: `${left - origin.left}px`, top: `${top - origin.top}px`, width: `${Math.max(0, right - left)}px`, height: `${Math.max(0, bottom - top)}px` });
    panel.style.left = `${panelLeft - origin.left}px`; panel.style.top = `${panelTop - origin.top}px`;
  }
  function schedulePosition() { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => position()); }
  function onResize() { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => position(true)); }
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
    target?.scrollIntoView?.({ behavior: 'instant', block: 'center' });
    resizeObserver?.disconnect();
    position(true); schedulePosition();
    if (target) resizeObserver?.observe(target);
    resizeObserver?.observe(overlay.querySelector('.tour-panel'));
    overlay.querySelector('[data-tour-next]').focus({ preventScroll: true });
  }
  function finish(outcome) {
    if (!overlay) return;
    try { localStorage.setItem(storageKey, outcome); } catch {}
    cancelAnimationFrame(frame);
    resizeObserver?.disconnect();
    overlay.remove(); overlay = null;
    inertElements.forEach(([element, value]) => { element.inert = value; });
    if (window.DevilNavigation) { window.DevilNavigation.close({ restoreFocus: false }); if (navWasOpen) window.DevilNavigation.open(); }
    else if (!navWasOpen) { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); }
    window.removeEventListener('resize', onResize); window.removeEventListener('scroll', schedulePosition);
    window.visualViewport?.removeEventListener('resize', onResize);
    window.visualViewport?.removeEventListener('scroll', schedulePosition);
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
    if (window.ResizeObserver) resizeObserver = new ResizeObserver(onResize);
    document.addEventListener('keydown', onKey); window.addEventListener('resize', onResize); window.addEventListener('scroll', schedulePosition, { passive: true });
    window.visualViewport?.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('scroll', schedulePosition);
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
