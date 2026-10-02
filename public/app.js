const app = document.querySelector('#app');
const path = window.location.pathname.replace(/\/$/, '') || '/';
const route = { '/': 'home', '/support': 'support', '/privacy': 'privacy', '/terms': 'terms' }[path] || 'home';

const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';

const pages = {
  home: `
    <section class="hero container">
      <div class="hero-copy">
        <div class="eyebrow"><span class="eyebrow-dot"></span> YOUR COMMUNITY'S NEW FAVORITE BOT</div>
        <h1>Make your server <span>feel alive.</span></h1>
        <p class="hero-lead">Meet <strong id="hero-bot-name">DEVIL BOT</strong> — the companion bringing more energy to your Discord community. See who's around, find your people, and jump right in.</p>
        <div class="hero-actions">
          <a class="button button-primary invite-link" href="#join" aria-disabled="true">Join the server ${arrow}</a>
          <a class="button button-secondary" href="/support">Explore support ${arrow}</a>
        </div>
        <div class="hero-note"><span class="tiny-avatars"><span>D</span><span>★</span><span>●</span></span><span>Good conversations start here.</span></div>
      </div>
      <div class="hero-art" aria-label="Bot profile and server activity">
        <div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="orbit orbit-three"></div>
        <span class="orbit-star star-one">✦</span><span class="orbit-star star-two">✧</span><span class="orbit-star star-three">✦</span>
        <div class="orbit-bubble bubble-one"><span class="bubble-status"></span> Online now</div>
        <div class="orbit-bubble bubble-two">✦ &nbsp;Community first</div>
        <div class="bot-portrait"><div class="portrait-glow"></div><div class="bot-avatar" id="hero-avatar"><svg viewBox="0 0 100 100" aria-hidden="true"><path d="M20 30 9 10l2 35a41 41 0 0 0 0 13c3 21 18 33 39 33s36-12 39-33a41 41 0 0 0 0-13l2-35-11 20C72 22 62 18 50 18S28 22 20 30Z" fill="currentColor"/><path d="m25 54 17 5-6 6-11-11Zm50 0-17 5 6 6 11-11Z" fill="#fff"/><path d="M39 73c7 4 15 4 22 0" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg></div></div>
      </div>
    </section>

    <section class="live-section container" aria-labelledby="live-title">
      <div class="section-heading"><div><div class="section-kicker">THE COMMUNITY, RIGHT NOW</div><h2 id="live-title">A place that's always on.</h2></div><div class="live-indicator"><span></span> LIVE SERVER SNAPSHOT</div></div>
      <div class="stats-grid">
        <article class="stat-card"><div class="stat-icon online-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg></div><div class="stat-number" id="online-count">—</div><div class="stat-label">Members online</div><p>People here and ready to chat.</p><span class="stat-corner">↗</span></article>
        <article class="stat-card"><div class="stat-icon members-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M2 20a7 7 0 0 1 14 0M17 5a3 3 0 0 1 0 6m2 3a6 6 0 0 1 3 6"/></svg></div><div class="stat-number" id="member-count">—</div><div class="stat-label">Total members</div><p>One community, endless connections.</p><span class="stat-corner">↗</span></article>
        <article class="stat-card server-card"><div class="stat-icon server-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/></svg></div><div class="server-card-label">YOUR NEXT HANGOUT</div><div class="server-name" id="server-name">Discord server</div><p id="server-description">The door is open. Come say hello.</p><a class="server-join invite-link" href="#join" aria-disabled="true">Join community ${arrow}</a></article>
      </div>
      <p class="data-note" id="data-note" role="status">Connecting to Discord…</p>
    </section>

    <section class="servers-section container" aria-labelledby="servers-title">
      <div class="section-heading"><div><div class="section-kicker">WHERE YOU'LL FIND US</div><h2 id="servers-title">Servers we're part of.</h2></div><span class="server-total" id="server-total" role="status">Loading servers…</span></div>
      <div class="server-list" id="server-list"><p class="server-list-message">Connecting to Discord…</p></div>
    </section>

    <section class="join-section container" id="join"><div class="join-card"><div class="join-decoration">✳</div><div><div class="section-kicker">COME ON IN</div><h2>Your seat is waiting.</h2><p>Join the conversation, meet the community, and make the server your own.</p></div><a class="button button-white invite-link" href="#join" aria-disabled="true">Join the server ${arrow}</a></div></section>
  `,
  support: `
    <section class="inner-hero container"><div class="eyebrow"><span class="eyebrow-dot"></span> WE'RE HERE TO HELP</div><h1>Need a hand? <span>We've got you.</span></h1><p>Find answers to common questions and reach the community for help with DEVIL BOT.</p></section>
    <section class="inner-content container support-layout"><div class="support-intro"><div class="section-kicker">GET SUPPORT</div><h2>Start with the community.</h2><p>For help with the bot or the server, join our Discord and contact the moderators or support team there.</p><a class="button button-primary invite-link" href="#join" aria-disabled="true">Open Discord server ${arrow}</a><p class="small-note">If the invite is unavailable, please check back after the site owner configures it.</p></div><div class="faq-list"><h2>Quick answers</h2><details><summary>How do I join the server?<span>+</span></summary><p>Use any “Join the server” button on this site. It opens the community's Discord invite once an invite is configured.</p></details><details><summary>Why do the member counts look different from Discord?<span>+</span></summary><p>Discord provides approximate online and member counts. This site refreshes them about once a minute, so small differences are normal.</p></details><details><summary>Why aren't the bot or server details loading?<span>+</span></summary><p>Discord may be temporarily unavailable, or the site owner may still need to add the bot token. Try again shortly.</p></details><details><summary>Where can I read the site policies?<span>+</span></summary><p>Visit our <a href="/privacy">Privacy Policy</a> and <a href="/terms">Terms of Service</a>.</p></details></div></section>
  `,
  privacy: `
    <section class="inner-hero container"><div class="eyebrow"><span class="eyebrow-dot"></span> ข้อมูลสำคัญ</div><h1>นโยบาย<span>ความเป็นส่วนตัว</span></h1><p>ข้อมูลเกี่ยวกับการใช้งานและการจัดการข้อมูลเมื่อคุณเยี่ยมชมเว็บไซต์นี้</p></section>
    <article class="legal-content container"><div class="legal-aside"><span>เนื้อหาในหน้านี้</span><a href="#overview">ภาพรวม</a><a href="#information">ข้อมูลที่ใช้</a><a href="#services">บริการภายนอก</a><a href="#choices">ทางเลือกของคุณ</a><a href="#contact">ติดต่อเรา</a></div><div class="legal-body"><p class="legal-updated">ปรับปรุงล่าสุด: 3 ตุลาคม 2569</p><section id="overview"><h2>ภาพรวม</h2><p>เว็บไซต์ DEVIL BOT แสดงข้อมูลเกี่ยวกับบอต Discord และเซิร์ฟเวอร์ที่บอตเข้าร่วม นโยบายนี้ครอบคลุมการใช้งานเว็บไซต์เท่านั้น การทำงานของบอตภายใน Discord อาจมีการใช้ข้อมูลเพิ่มเติม ซึ่งผู้ดูแลบอตควรแจ้งให้ทราบแยกต่างหากก่อนเปิดให้บริการ</p></section><section id="information"><h2>ข้อมูลที่ใช้</h2><p>เว็บไซต์ดึงชื่อและรูปโปรไฟล์ของบอต ชื่อเซิร์ฟเวอร์ จำนวนสมาชิกโดยประมาณ และจำนวนผู้ที่ออนไลน์โดยประมาณจาก Discord แล้วแสดงต่อผู้เข้าชม เว็บไซต์ไม่ขอให้ผู้เข้าชมสร้างบัญชีหรือกรอกข้อมูลส่วนบุคคล</p><p>การเลือกธีมสว่างหรือมืดจะถูกบันทึกไว้ใน local storage ของเบราว์เซอร์ ผู้ให้บริการโฮสต์อาจเก็บบันทึกการเข้าถึงตามการตั้งค่าของระบบ ซึ่งอาจรวมถึงที่อยู่ IP และรายละเอียดคำขอ</p></section><section id="services"><h2>บริการภายนอก</h2><p>Discord เป็นผู้ให้ข้อมูลบอตและเซิร์ฟเวอร์ รวมถึงจัดเก็บรูปโปรไฟล์ หากคุณกดลิงก์เพื่อเข้าร่วมเซิร์ฟเวอร์ การใช้งาน Discord จะอยู่ภายใต้นโยบายของ Discord เบราว์เซอร์ของคุณอาจเชื่อมต่อกับ Google Fonts เพื่อโหลดแบบอักษรที่ใช้บนเว็บไซต์</p></section><section id="choices"><h2>ทางเลือกของคุณ</h2><p>คุณสามารถเปลี่ยนธีมได้ทุกเมื่อด้วยปุ่มในส่วนหัว และลบการตั้งค่าที่บันทึกไว้ได้โดยล้าง local storage ของเบราว์เซอร์ คุณเป็นผู้ตัดสินใจว่าจะเปิดลิงก์เชิญไปยัง Discord หรือไม่</p></section><section id="contact"><h2>ติดต่อเรา</h2><p>หากมีข้อสงสัยเกี่ยวกับเว็บไซต์หรือการใช้ข้อมูลของชุมชน โปรดไปที่ <a href="/support">หน้าช่วยเหลือ</a> และติดต่อทีมงานผ่าน Discord</p></section></div></article>
  `,
  terms: `
    <section class="inner-hero container"><div class="eyebrow"><span class="eyebrow-dot"></span> ข้อมูลสำคัญ</div><h1>ข้อกำหนด<span>การให้บริการ</span></h1><p>เงื่อนไขการใช้เว็บไซต์และลิงก์ไปยังชุมชน Discord</p></section>
    <article class="legal-content container"><div class="legal-aside"><span>เนื้อหาในหน้านี้</span><a href="#acceptance">การยอมรับข้อกำหนด</a><a href="#website">การใช้เว็บไซต์</a><a href="#discord">ชุมชน Discord</a><a href="#availability">ความพร้อมใช้งาน</a><a href="#changes">การเปลี่ยนแปลงและติดต่อ</a></div><div class="legal-body"><p class="legal-updated">ปรับปรุงล่าสุด: 3 ตุลาคม 2569</p><section id="acceptance"><h2>การยอมรับข้อกำหนด</h2><p>เมื่อใช้เว็บไซต์นี้ ถือว่าคุณยอมรับข้อกำหนดดังต่อไปนี้ หากไม่ยอมรับ โปรดหยุดใช้เว็บไซต์</p></section><section id="website"><h2>การใช้เว็บไซต์</h2><p>คุณสามารถใช้เว็บไซต์เพื่อดูข้อมูลเกี่ยวกับ DEVIL BOT กิจกรรมของชุมชน และลิงก์ไปยังเซิร์ฟเวอร์ Discord โปรดอย่าใช้งานเว็บไซต์ในทางที่ผิด รบกวนการทำงานของระบบ หรือพยายามเข้าถึงส่วนที่ไม่ได้รับอนุญาต</p></section><section id="discord"><h2>ชุมชน Discord</h2><p>การเข้าร่วมหรือมีส่วนร่วมในเซิร์ฟเวอร์ Discord ที่เชื่อมโยงอยู่ภายใต้ข้อกำหนดของ Discord และกฎของแต่ละเซิร์ฟเวอร์ เว็บไซต์นี้ไม่ได้ควบคุมบริการของ Discord</p></section><section id="availability"><h2>ความพร้อมใช้งานและความถูกต้อง</h2><p>เราพยายามให้เว็บไซต์พร้อมใช้งานและแสดงข้อมูลล่าสุด แต่อาจมีช่วงที่บริการหยุดชะงัก จำนวนสมาชิกและผู้ที่ออนไลน์เป็นค่าประมาณจาก Discord จึงอาจล่าช้าหรือแตกต่างจากตัวเลขในแอป Discord</p></section><section id="changes"><h2>การเปลี่ยนแปลงและติดต่อ</h2><p>ข้อกำหนดอาจมีการปรับปรุงเมื่อเว็บไซต์เปลี่ยนแปลง วันที่ด้านบนแสดงการแก้ไขล่าสุด หากมีคำถาม โปรดไปที่ <a href="/support">หน้าช่วยเหลือ</a></p></section></div></article>
  `
};

app.innerHTML = pages[route];
document.title = ({ home: 'DEVIL BOT — Your server, more alive', support: 'Support — DEVIL BOT', privacy: 'นโยบายความเป็นส่วนตัว — DEVIL BOT', terms: 'ข้อกำหนดการให้บริการ — DEVIL BOT' })[route];
document.querySelector('#year').textContent = new Date().getFullYear();
document.querySelector(`[data-nav="${route}"]`)?.setAttribute('aria-current', 'page');
const isThaiPage = route === 'privacy' || route === 'terms';
if (isThaiPage) {
  document.documentElement.lang = 'th';
  document.body.classList.add('legal-page');
  const labels = { '/': 'หน้าแรก', '/support': 'ช่วยเหลือ', '/privacy': 'ความเป็นส่วนตัว', '/terms': 'ข้อกำหนด' };
  document.querySelectorAll('.desktop-nav a, .mobile-nav a, .footer-links a').forEach(link => {
    link.textContent = labels[link.getAttribute('href')] || link.textContent;
  });
  document.querySelector('.header-cta').firstChild.textContent = 'เข้าร่วมเซิร์ฟเวอร์ ';
  document.querySelector('.footer-inner p').textContent = 'สร้างมาเพื่อชุมชนที่ไม่เคยหลับใหล';
  document.querySelector('.footer-bottom > span:last-child').textContent = 'Devil';
  document.querySelector('.menu-toggle').setAttribute('aria-label', 'เปิดเมนู');
}

const themeButton = document.querySelector('.theme-toggle');
function updateThemeButton() {
  const isDark = document.documentElement.dataset.theme === 'dark';
  themeButton.setAttribute('aria-label', isThaiPage ? `เปลี่ยนเป็นโหมด${isDark ? 'สว่าง' : 'มืด'}` : `Switch to ${isDark ? 'light' : 'dark'} mode`);
  document.querySelector('meta[name="theme-color"]').content = isDark ? '#0b1224' : '#f6f9ff';
}
updateThemeButton();
let themeAnimating = false;
themeButton.addEventListener('click', async () => {
  if (themeAnimating) return;
  const root = document.documentElement;
  const current = root.dataset.theme;
  const next = current === 'dark' ? 'light' : 'dark';
  const applyTheme = () => {
    root.dataset.theme = next;
    localStorage.setItem('devil-theme', next);
    updateThemeButton();
  };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !Element.prototype.animate) {
    applyTheme();
    return;
  }

  const bounds = themeButton.getBoundingClientRect();
  const x = bounds.left + bounds.width / 2;
  const y = bounds.top + bounds.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 32;
  const circle = size => `circle(${size}px at ${x}px ${y}px)`;
  const shell = document.querySelector('.site-shell');
  const snapshot = theme => {
    const layer = document.createElement('div');
    layer.className = 'theme-snapshot';
    layer.dataset.themeSnapshot = theme;
    layer.setAttribute('aria-hidden', 'true');
    layer.inert = true;
    layer.style.width = `${document.documentElement.clientWidth}px`;
    const scene = shell.cloneNode(true);
    scene.style.transform = `translateY(-${window.scrollY}px)`;
    layer.append(scene);
    document.body.append(layer);
    return layer;
  };

  themeAnimating = true;
  themeButton.disabled = true;
  root.classList.add('theme-reveal-active');
  let veil;
  let oldScene;
  let newScene;
  try {
    veil = document.createElement('div');
    veil.className = 'theme-transition-veil';
    veil.dataset.nextTheme = next;
    veil.setAttribute('aria-hidden', 'true');
    document.body.append(veil);
    newScene = snapshot(next);
    oldScene = snapshot(current);
    oldScene.classList.add('leaving');
    newScene.classList.add('entering');
    const closing = oldScene.animate(
      [{ clipPath: circle(radius) }, { clipPath: circle(0) }],
      { duration: 430, easing: 'cubic-bezier(.7,0,.88,.4)', fill: 'forwards' }
    );
    const opening = newScene.animate(
      [{ clipPath: circle(0) }, { clipPath: circle(radius) }],
      { duration: 660, delay: 340, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' }
    );
    await Promise.allSettled([closing.finished, opening.finished]);
    applyTheme();
  } catch {
    applyTheme();
  } finally {
    oldScene?.remove();
    newScene?.remove();
    veil?.remove();
    root.classList.remove('theme-reveal-active');
    themeButton.disabled = false;
    themeAnimating = false;
  }
});

const menuButton = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('.mobile-nav');
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', isThaiPage ? (open ? 'ปิดเมนู' : 'เปิดเมนู') : (open ? 'Close menu' : 'Open menu'));
  mobileNav.hidden = !open;
});

function setInvite(url) {
  if (!url) return;
  document.querySelectorAll('.invite-link').forEach(link => {
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.removeAttribute('aria-disabled');
  });
}

function renderServers(servers) {
  const list = document.querySelector('#server-list');
  const total = document.querySelector('#server-total');
  list.replaceChildren();
  if (!servers) {
    total.textContent = 'Unavailable';
    const message = document.createElement('p');
    message.className = 'server-list-message';
    message.textContent = 'The server list is temporarily unavailable.';
    list.append(message);
    return;
  }
  total.textContent = `${servers.length.toLocaleString()} ${servers.length === 1 ? 'server' : 'servers'}`;
  if (servers.length === 0) {
    const message = document.createElement('p');
    message.className = 'server-list-message';
    message.textContent = 'No joined servers to show yet.';
    list.append(message);
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const server of servers) {
    const card = document.createElement('article');
    card.className = 'joined-server';
    const icon = document.createElement('span');
    icon.className = 'joined-server-icon';
    if (server.iconUrl) {
      const image = document.createElement('img');
      image.src = server.iconUrl;
      image.alt = '';
      icon.append(image);
    } else {
      icon.textContent = server.name?.slice(0, 1).toUpperCase() || 'S';
    }
    const details = document.createElement('div');
    details.className = 'joined-server-details';
    const name = document.createElement('h3');
    name.textContent = server.name || 'Discord server';
    const count = document.createElement('p');
    count.textContent = server.members === null ? 'Member count unavailable' : `${server.members.toLocaleString()} members`;
    details.append(name, count);
    card.append(icon, details);
    fragment.append(card);
  }
  list.append(fragment);
}

document.querySelectorAll('.invite-link').forEach(link => {
  link.addEventListener('click', event => {
    if (link.getAttribute('aria-disabled') === 'true') event.preventDefault();
  });
});

async function loadStatus() {
  try {
    const response = await fetch('/api/status');
    if (!response.ok) throw new Error('Status request failed');
    const data = await response.json();
    setInvite(data.inviteUrl);
    if (route !== 'home') return;
    renderServers(data.servers);
    if (data.bot) {
      document.querySelector('#hero-bot-name').textContent = data.bot.name;
      if (data.bot.avatarUrl) {
        const avatar = document.createElement('img');
        avatar.src = data.bot.avatarUrl;
        avatar.alt = `${data.bot.name} profile image`;
        document.querySelector('#hero-avatar').replaceChildren(avatar);
      }
    }
    if (data.server) {
      document.querySelector('#server-name').textContent = data.server.name;
      if (data.server.online !== null) document.querySelector('#online-count').textContent = data.server.online.toLocaleString();
      if (data.server.members !== null) document.querySelector('#member-count').textContent = data.server.members.toLocaleString();
    }
    document.querySelector('#data-note').textContent = !data.configured
      ? 'Live details will appear when the bot token is configured.'
      : data.bot && data.server ? 'Approximate counts from Discord · Updated about every minute' : 'Some live details are temporarily unavailable. Please try again soon.';
  } catch {
    if (route === 'home') {
      renderServers(null);
      document.querySelector('#data-note').textContent = 'Live details are temporarily unavailable. Please try again soon.';
    }
  }
}
loadStatus();
if (route === 'home') setInterval(loadStatus, 60_000);
