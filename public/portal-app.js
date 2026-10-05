const app = document.querySelector('#app');
const icon = (name, cls = '') => window.DevilIcons.render(name, cls);
const systemIcon = name => ({ welcome: 'welcome', ticket: 'ticket', spam: 'shield', safe: 'shield', rank: 'rank', shop: 'shop', 'shop-status': 'shop', chat: 'chat', verify: 'shield', 'verify-not': 'users', province: 'globe', giveaway: 'crown', announce: 'bell', search: 'search' }[name] || 'settings');
const commandIcon = name => /welcom/.test(name) ? 'welcome' : /ticket/.test(name) ? 'ticket' : /spam|safe|ban|verify/.test(name) ? 'shield' : /rank/.test(name) ? 'rank' : /shop|buy/.test(name) ? 'shop' : /chat/.test(name) ? 'chat' : /province/.test(name) ? 'globe' : /giveaway/.test(name) ? 'crown' : 'command';
function mountIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(node => { const name = node.dataset.icon; node.removeAttribute('data-icon'); node.innerHTML = icon(name); }); }
mountIcons();
new MutationObserver(() => mountIcons(app)).observe(app, { childList: true, subtree: true });
const route = location.pathname.replace(/\/$/, '') || '/';
const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const safeUrl = value => { try { return new URL(value).protocol === 'https:' ? escape(value) : ''; } catch { return ''; } };
const img = (url, cls, alt = '') => safeUrl(url) ? `<img class="${cls}" src="${safeUrl(url)}" alt="${escape(alt)}" loading="lazy" referrerpolicy="no-referrer">` : '';
const number = value => Number.isFinite(value) ? new Intl.NumberFormat('th-TH').format(value) : '—';
const empty = text => `<div class="empty">${icon('grid')}<p>${escape(text)}</p></div>`;
const head = (eyebrow, title, subtitle) => `<div class="page-head"><div class="section-label">${eyebrow}</div><h1>${title}</h1><p>${subtitle}</p></div>`;
const sectionHead = (label, title, subtitle, href, link = 'ดูทั้งหมด <span data-icon="external"></span>') => `<div class="section-heading"><div><div class="section-label">${label}</div><h2>${title}</h2><p>${subtitle}</p></div>${href ? `<a href="${href}">${link}</a>` : ''}</div>`;
let session = { user: null }, catalog = { commands: [] }, content = { features: [], updates: [], serverCategories: [] }, status = { servers: null }, ownerProfiles = [];
async function api(action, body, query = {}) {
  const response = await fetch(`/api/portal?${new URLSearchParams({ action, ...query })}`, { headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrf || '' }, ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error || 'ไม่สามารถโหลดข้อมูล'); return result;
}
let toastTimer;
function toast(text) { const node = document.querySelector('#toast'); node.textContent = text; node.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { node.hidden = true; }, 6000); }
document.querySelector('#year').textContent = new Date().getFullYear();
document.querySelectorAll('#navigation a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === route));
try { document.documentElement.dataset.theme = localStorage.getItem('devil-portal-theme') || 'dark'; } catch {}
const themeButton = document.querySelector('#theme-toggle');
function updateThemeButton() {
  const dark = document.documentElement.dataset.theme !== 'light';
  const label = dark ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด';
  themeButton.setAttribute('aria-label', label);
  themeButton.title = label;
  document.querySelector('meta[name="theme-color"]').content = dark ? '#0a1018' : '#f5f9fd';
}
updateThemeButton();
themeButton.onclick = () => { const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme; updateThemeButton(); try { localStorage.setItem('devil-portal-theme', theme); } catch {} };
const dialog = document.querySelector('#profile-dialog');
dialog.querySelector('button').onclick = () => dialog.close();
dialog.onclick = event => { if (event.target === dialog) dialog.close(); };
function profileCard(owner, expanded = false) {
  return `<div class="owner-header"><span class="owner-insignia">${icon('crown')}</span><span>THE PEOPLE BEHIND DEVIL</span></div><div class="owner-content"><div class="profile-avatar">${img(owner.avatarUrl, 'avatar', owner.name)}${img(owner.decorationUrl, 'decoration')}</div><span class="badge owner-badge">${icon('crown')} OWNER</span><h3>${escape(owner.name)}</h3><p>@${escape(owner.username)}</p>${expanded ? `<div class="profile-detail"><small>DISCORD ID</small><div>${escape(owner.id)}</div></div><a class="button primary" href="${safeUrl(owner.profileUrl)}" target="_blank" rel="noopener noreferrer">เปิดโปรไฟล์ Discord ${icon('external')}</a>` : `<button class="button ghost" data-profile="${escape(owner.id)}">ดูโปรไฟล์ ${icon('external')}</button>`}</div>`;
}
function bindProfiles() { document.querySelectorAll('[data-profile]').forEach(button => button.onclick = () => { const owner = ownerProfiles.find(o => o.id === button.dataset.profile); if (owner) { document.querySelector('#profile-content').innerHTML = profileCard(owner, true); dialog.showModal(); } }); }
function ownerHomeCard(owner) {
  return `<article class="owner-card owner-home-card"><div class="profile-avatar">${img(owner.avatarUrl, 'avatar', owner.name)}${img(owner.decorationUrl, 'decoration')}</div><div class="owner-home-copy"><span class="badge owner-badge">${icon('crown')} OWNER</span><h3>${escape(owner.name)}</h3><p>@${escape(owner.username)}</p></div><button class="button ghost" data-profile="${escape(owner.id)}">ดูโปรไฟล์ Discord ${icon('external')}</button></article>`;
}
function featureCard(f) {
  return `<article class="card feature-card">${f.imageUrl ? img(f.imageUrl, 'card-image', f.title) : `<div class="feature-art"><div class="feature-orbit"></div>${icon(commandIcon(f.command || ''), 'feature-symbol')}<span class="feature-art-caption">DEVIL / ${escape(f.command || 'feature')}</span></div>`}<div class="card-top"><span class="badge ${f.mode === 'VIP' ? 'vip' : 'public'}">${f.mode === 'VIP' ? icon('vip') : icon('check')}${escape(f.mode || 'Public')}</span>${f.command ? `<span class="command-tag">/${escape(f.command)}</span>` : ''}</div><h3>${escape(f.title)}</h3><p>${escape(f.body)}</p></article>`;
}
function serverCard(g) { return `<article class="card"><div class="card-top">${img(g.iconUrl, 'server-icon', g.name) || `<span class="server-icon">${escape(g.name?.slice(0, 1))}</span>`}<h3>${escape(g.name)}</h3></div><span class="badge public">DEVIL COMMUNITY</span><div class="server-info"><span>${number(g.members)} สมาชิก</span><span><i class="dot"></i> ${number(g.online)} ออนไลน์</span></div></article>`; }
function updateCard(u, index = 0) {
  const date = new Date(u.date);
  const validDate = Number.isFinite(date.getTime());
  const dateLabel = validDate ? date.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'long', year: 'numeric' }) : 'ข่าวจากทีมงาน';
  return `<article class="card update-card">
    <div class="update-header"><div class="update-publisher"><img src="/bot-avatar?v=original-logo" alt="" loading="lazy"><div><b>DEVIL BOT</b><span>ข่าวจากทีม Devil</span></div></div><span class="update-label ${index === 0 ? 'latest' : ''}">${icon('bell')}${index === 0 ? 'อัปเดตล่าสุด' : 'อัปเดต'}</span></div>
    <h3>${escape(u.title)}</h3>${img(u.imageUrl, 'card-image', u.title)}<p class="update-body">${escape(u.body)}</p>
    <div class="update-footer">${icon('calendar')}<time${validDate ? ` datetime="${escape(date.toISOString())}"` : ''}>${escape(dateLabel)}</time><span>DEVIL UPDATES</span></div>
  </article>`;
}
function homepage() {
  const servers = status.servers || [];
  const members = servers.length && servers.every(g => Number.isFinite(g.members)) ? servers.reduce((sum, g) => sum + g.members, 0) : null;
  const features = content.features.length ? content.features.slice(0, 3) : [
    { title: 'Welcome & Goodbye', body: 'เลือกช่องต้อนรับและอำลา พร้อมรูปภาพและลิงก์ของชุมชน', mode: 'Public', command: 'set-welcom' },
    { title: 'Ticket, simplified.', body: 'สร้างแผง Ticket ปรับข้อความ ปุ่ม และคำตอบอัตโนมัติจากเว็บ', mode: 'Public', command: 'set-ticket' },
    { title: 'Protection, always.', body: 'จัดการลิงก์เชิญ สแปม และภาพหลอกลวง เลือกช่องที่ต้องการตรวจสอบ', mode: 'Public', command: 'set-spam' }
  ];
  app.innerHTML = `<div class="container">
    <section class="hero"><div class="hero-copy"><div class="eyebrow"><span class="live-pill"><span class="dot"></span> DEVIL FOR DISCORD</span><span>YOUR COMMUNITY, UPGRADED</span></div>
      <h1>เซิร์ฟเวอร์ของคุณ<br><span>เป็นได้มากกว่า.</span></h1><p>สร้างชุมชนในแบบของคุณ ให้ Devil ดูแลการต้อนรับ Ticket และความปลอดภัย จัดการทุกอย่างได้จากที่เดียว</p>
      <div class="actions"><a class="button primary" href="/dashboard">${icon('settings')} จัดการเซิร์ฟเวอร์ ${icon('external')}</a><a class="button ghost" href="/commands">สำรวจคำสั่ง ${icon('arrow')}</a><a class="invite-button" data-invite-bot href="/api/portal?action=invite" target="_blank" rel="noopener noreferrer"><span class="invite-logo"><img src="/bot-avatar?v=original-logo" alt=""></span><span class="invite-copy"><b>เชิญ Devil เข้าเซิร์ฟเวอร์</b><small>เริ่มสร้างชุมชนของคุณไปด้วยกัน</small></span><span class="invite-arrow">${icon('external')}</span></a></div>
      <div class="hero-foot"><span class="hero-benefit">${icon('shield')} ตั้งค่าได้เอง</span><span class="hero-benefit">${icon('vip')} Public & VIP</span><span class="hero-benefit">${icon('globe')} พร้อมสำหรับทุกชุมชน</span></div>
    </div><div class="hero-visual"><div class="visual-glow"></div><div class="visual-grid"></div>
      <div class="console-board"><div class="console-title"><span class="console-brand"><img src="/bot-avatar?v=original-logo" alt=""> Devil workspace</span><span class="badge">PREVIEW</span></div>
        <div class="console-body"><div class="console-rail">${icon('grid')}${icon('users')}${icon('shield')}${icon('settings')}</div><div class="console-main"><div class="console-greeting"><span>YOUR SERVER, YOUR RULES.</span><h3>พื้นที่ของชุมชนคุณ</h3></div>
        <div class="console-system"><span class="console-icon">${icon('welcome')}</span><div><b>Welcome & Goodbye</b><small>เริ่มต้นบทสนทนาที่ดี</small></div>${icon('arrow')}</div>
        <div class="console-system"><span class="console-icon">${icon('ticket')}</span><div><b>Support tickets</b><small>ช่วยเหลือสมาชิกอย่างเป็นระบบ</small></div>${icon('arrow')}</div>
        <div class="console-system"><span class="console-icon">${icon('shield')}</span><div><b>Server protection</b><small>ชุมชนปลอดภัย สบายใจทุกวัน</small></div>${icon('arrow')}</div>
        <div class="console-bottom">${icon('command')} คำสั่งพร้อมใช้ <span>Public <i></i> VIP</span></div></div></div></div>
      <div class="visual-float">${icon('shield')}<div><b>Built around your people.</b><small>ให้ทุกคนรู้สึกเป็นส่วนหนึ่ง</small></div></div>
      <div class="visual-stamp"><img class="community-logo" src="/bot-avatar?v=original-logo" alt="" loading="lazy"> MADE FOR COMMUNITY</div>
    </div></section>
    <section class="stats-bar"><div class="stat"><span class="stat-icon">${icon('server')}</span><div><div class="metric">${status.servers ? number(servers.length) : '—'}</div><p>เซิร์ฟเวอร์ที่ใช้ Devil</p></div></div><div class="stat"><span class="stat-icon">${icon('users')}</span><div><div class="metric">${number(members)}</div><p>สมาชิกในชุมชน</p></div></div><div class="stat"><span class="stat-icon">${icon('command')}</span><div><div class="metric">${number(catalog.commands.length)}</div><p>คำสั่ง Public & VIP</p></div></div><div class="stat"><span class="stat-icon">${icon('activity')}</span><div><div id="live-status" class="metric status">กำลังตรวจสอบ</div><p id="live-ping">สถานะบอทแบบสด</p></div></div></section>
    <section class="section owner-section">${sectionHead('THE PEOPLE BEHIND DEVIL', 'Meet the Owner', 'รู้จักผู้ดูแลที่อยู่เบื้องหลังชุมชนของคุณ')}<div class="owner-grid">${ownerProfiles.map(ownerHomeCard).join('')}</div>${ownerProfiles.length ? '' : empty('ยังไม่มีโปรไฟล์ Owner ที่พร้อมแสดง')}</section>
    <section class="section toolkit-section">${sectionHead('THE COMMUNITY TOOLKIT', 'รายละเอียดเล็ก ๆ ที่ทำให้ชุมชนดีขึ้น', 'จากวันแรกที่เข้าร่วม จนถึงทุกวันที่เติบโตไปด้วยกัน', '/features')}<div class="grid">${features.map(featureCard).join('')}</div></section>
    <section class="section">${sectionHead('PART OF SOMETHING BIGGER', 'ชุมชนที่เติบโตไปกับ Devil', 'พบกับเซิร์ฟเวอร์ที่ให้ Devil เป็นส่วนหนึ่งของทุกวัน', '/servers')}<div class="grid">${servers.slice(0, 3).map(serverCard).join('')}</div>${servers.length ? '' : empty('ยังไม่สามารถโหลดข้อมูลเซิร์ฟเวอร์ได้')}</section>
    ${content.updates.length ? `<section class="section">${sectionHead('FRESH FROM DEVIL', 'อัปเดตล่าสุด', 'ติดตามสิ่งใหม่จากทีม Devil', '/updates')}<div class="timeline">${content.updates.slice().reverse().slice(0, 2).map(updateCard).join('')}</div></section>` : ''}
    <section class="cta-strip"><div class="cta-emblem"><img class="community-logo" src="/bot-avatar?v=original-logo" alt="" loading="lazy"></div><div><div class="section-label">NEXT CHAPTER STARTS HERE</div><h2>ชุมชนในแบบของคุณ เริ่มที่นี่.</h2><p>เชื่อมต่อ Discord แล้วให้ Devil ช่วยดูแลส่วนที่เหลือ</p></div><a class="button primary" href="/dashboard">เริ่มต้นใช้งาน ${icon('external')}</a></section>
  </div>`;
  bindProfiles(); refreshLive();
}
async function refreshLive() { try { const result = await fetch('/api/bot-status').then(r => r.json()); const badge = document.querySelector('#live-status'); if (badge) { badge.innerHTML = `<span class="status-dot ${result.online ? 'online' : ''}"></span>${result.online ? 'Online' : 'Offline'}`; badge.style.color = result.online ? 'var(--green)' : 'var(--muted)'; document.querySelector('#live-ping').textContent = result.ping != null ? `Discord latency · ${result.ping} ms` : 'สถานะบอทแบบสด'; } } catch {} }
function commandPage() {
  app.innerHTML = `<div class="container">${head('COMMAND DIRECTORY', 'คำสั่งทั้งหมด', 'แยก Public และ VIP ตามโค้ดบอท ค้นหาคำสั่งที่ต้องการได้ทันที')}<div class="toolbar"><div class="tabs" id="mode-tabs"><button class="selected" data-mode="Public">Public</button><button data-mode="VIP">VIP <span data-icon="vip"></span></button></div><input class="search" id="command-search" placeholder="ค้นหาชื่อคำสั่งหรือรายละเอียด" aria-label="ค้นหาคำสั่ง"><select id="command-category" style="width:auto" aria-label="หมวดคำสั่ง"><option value="">ทุกหมวด</option>${[...new Set(catalog.commands.map(c => c.category))].map(c => `<option>${escape(c)}</option>`).join('')}</select></div><div id="command-list" class="grid"></div></div>`;
  let mode = 'Public';
  function render() {
    const q = document.querySelector('#command-search').value.toLowerCase(); const category = document.querySelector('#command-category').value;
    const rows = catalog.commands.filter(c => c.mode === mode && (!category || c.category === category) && `${c.name} ${c.description}`.toLowerCase().includes(q));
    document.querySelector('#command-list').innerHTML = rows.map(c => `<article class="card command-card"><div class="command-icon">${icon(commandIcon(c.name))}</div><div class="card-top"><span class="badge ${c.mode === 'VIP' ? 'vip' : 'public'}">${c.mode === 'VIP' ? icon('vip') : icon('check')}${c.mode}</span><span class="badge">${escape(c.category)}</span></div><h3 class="command-name">/${escape(c.name)}</h3><p>${escape(c.description)}</p>${c.scope !== 'global' ? '<p>ใช้เฉพาะเซิร์ฟเวอร์ที่กำหนด</p>' : ''}<div class="command-options">${(c.options || []).map(o => `<code title="${escape(o.description)}">${escape(o.name)}${o.required ? ' *' : ''}</code>`).join('')}</div>${c.options?.length ? `<details><summary class="muted">รายละเอียดตัวเลือก</summary>${c.options.map(o => `<p><b>${escape(o.name)}</b> — ${escape(o.description)}${o.options ? o.options.map(v => `<br>${escape(v.name)}: ${escape(v.description)}`).join('') : ''}</p>`).join('')}</details>` : ''}</article>`).join('') || empty('ไม่พบคำสั่งที่ค้นหา');
  }
  document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { mode = b.dataset.mode; document.querySelectorAll('[data-mode]').forEach(v => v.classList.toggle('selected', v === b)); render(); });
  document.querySelector('#command-search').oninput = render; document.querySelector('#command-category').onchange = render; render();
}
function serverPage() {
  const previousQuery = document.querySelector('#server-search')?.value || '';
  const previousCategory = document.querySelector('#server-category')?.value || '';
  app.innerHTML = `<div class="container">${head('DEVIL COMMUNITIES', 'เซิร์ฟเวอร์', 'แสดงชุมชนเป็นหมวด พร้อมจำนวนสมาชิกจาก Discord')}<div class="toolbar"><input id="server-search" class="search" placeholder="ค้นหาเซิร์ฟเวอร์" aria-label="ค้นหาเซิร์ฟเวอร์"><select id="server-category" style="width:auto" aria-label="หมวดเซิร์ฟเวอร์"><option value="">ทุกเซิร์ฟเวอร์</option>${content.serverCategories.map(g => `<option value="${escape(g.id)}">${escape(g.title)}</option>`).join('')}<option value="other">ทั่วไป</option></select></div><div id="server-groups"></div></div>`;
  function render() {
    const q = document.querySelector('#server-search').value.toLowerCase(), selected = document.querySelector('#server-category').value;
    const assigned = new Set(content.serverCategories.flatMap(g => g.guildIds));
    const groups = [...content.serverCategories, { id: 'other', title: 'ทั่วไป', body: 'ชุมชนที่ใช้ Devil', guildIds: (status.servers || []).filter(g => !assigned.has(g.id)).map(g => g.id) }];
    document.querySelector('#server-groups').innerHTML = groups.filter(g => !selected || g.id === selected).map(g => { const rows = (status.servers || []).filter(s => g.guildIds.includes(s.id) && s.name.toLowerCase().includes(q)); return rows.length ? `<section class="section">${sectionHead('COMMUNITY', escape(g.title), escape(g.body))}<div class="grid">${rows.map(serverCard).join('')}</div></section>` : ''; }).join('') || empty(status.servers === null ? 'ไม่สามารถโหลดข้อมูลเซิร์ฟเวอร์ได้' : 'ไม่พบเซิร์ฟเวอร์ในหมวดนี้');
  }
  document.querySelector('#server-search').value = previousQuery;
  document.querySelector('#server-category').value = previousCategory;
  document.querySelector('#server-search').oninput = render; document.querySelector('#server-category').onchange = render; render();
  if (status.servers === null) document.querySelector('#server-groups').innerHTML = `<div class="notice">${icon('server')} ไม่สามารถโหลดข้อมูลเซิร์ฟเวอร์ได้ในขณะนี้ <button class="button small" id="retry-servers">ลองโหลดใหม่ ${icon('update')}</button></div>`;
  document.querySelector('#retry-servers')?.addEventListener('click', async event => { event.currentTarget.disabled = true; try { status = await fetchStatus(); } catch (e) { toast(e.message); } serverPage(); });
}
async function fetchStatus() {
  const response = await fetch('/api/status', { cache: 'no-store' });
  if (!response.ok) throw new Error('ยังไม่สามารถเชื่อมต่อข้อมูล Discord ได้');
  const data = await response.json();
  const servers = Array.isArray(data.servers) ? data.servers : data.server?.id ? [data.server] : null;
  return { ...data, servers: servers?.filter(g => g && typeof g.id === 'string' && typeof g.name === 'string') ?? null };
}
function loginRequired() { app.innerHTML = `<div class="container"><section class="card login-card"><div class="card-icon">${icon('lock')}</div><h2>เชื่อมต่อ Discord ของคุณ</h2><p>เข้าสู่ระบบเพื่อเลือกเซิร์ฟเวอร์และตั้งค่าบอท คุณต้องมีสิทธิ์จัดการเซิร์ฟเวอร์และมี Devil อยู่ในเซิร์ฟเวอร์นั้น</p>${new URLSearchParams(location.search).has('error') ? '<div class="error">เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง</div>' : ''}<div class="actions"><a class="button primary" href="/api/portal?action=login">เข้าสู่ระบบด้วย Discord <span data-icon="external"></span></a></div></section></div>`; }
const option = (value, label, selected) => `<option value="${escape(value)}" ${selected ? 'selected' : ''}>${escape(label)}</option>`;
function fieldHtml(f, value, data) {
  const name = `name="${escape(f.key)}"`, label = escape(f.label);
  if (f.type === 'boolean') return `<label class="check"><input ${name} type="checkbox" ${value ? 'checked' : ''}>${label}</label>`;
  let control;
  if (['channel', 'channels', 'role', 'roles'].includes(f.type)) {
    const multiple = ['channels', 'roles'].includes(f.type); const rows = f.type.startsWith('channel') ? data.channels.filter(c => f.types.includes(c.type)) : data.roles;
    control = `<select ${name} ${multiple ? 'multiple' : ''}>${multiple ? '' : option('', '— ไม่เลือก —', !value)}${rows.map(r => option(r.id, `${f.type.startsWith('channel') ? '#' : '@'}${r.name}`, multiple ? (value || []).includes(r.id) : value === r.id)).join('')}</select>`;
  } else if (f.type === 'choice') control = `<select ${name}>${f.choices.map(v => option(v, v, v === value)).join('')}</select>`;
  else if (['products', 'rewards', 'responses'].includes(f.type)) control = `<div data-collection="${escape(f.key)}" data-type="${f.type}"></div>`;
  else if (f.type === 'lines' || (f.type === 'text' && (!f.max || f.max > 256))) control = `<textarea ${name} maxlength="${f.max || 10000}">${escape(Array.isArray(value) ? value.join('\n') : value)}</textarea>`;
  else control = `<input ${name} type="${({ number: 'number', color: 'text', url: 'url', time: 'time' })[f.type] || 'text'}" value="${escape(value)}" ${f.type === 'number' ? `min="${f.min}" max="${f.max}"` : ''} ${f.max ? `maxlength="${f.max}"` : ''} ${f.type === 'url' ? 'placeholder="https://…"' : ''}>`;
  return `<label class="${['products', 'rewards', 'responses', 'lines'].includes(f.type) ? 'wide' : ''}">${label}${control}${['channels', 'roles'].includes(f.type) ? '<small>เลือกหลายรายการ: Ctrl / ⌘ + คลิก</small>' : ''}</label>`;
}
function bindCollections(form, system, data) {
  const readRows = {};
  form.querySelectorAll('[data-collection]').forEach(container => {
    const key = container.dataset.collection, type = container.dataset.type;
    const initial = system.values[key] || (type === 'responses' ? [] : {});
    let rows = type === 'responses' ? structuredClone(initial) : Object.entries(initial).map(([id, v]) => ({ ...v, id }));
    function render() {
      container.innerHTML = rows.map((r, i) => `<div class="row-editor" data-row="${i}"><div class="row-fields">${type === 'responses' ? `<label>ข้อความ<textarea data-key="content">${escape(r.content)}</textarea></label><label>รูปภาพ<input data-key="imageUrl" type="url" value="${escape(r.imageUrl)}"></label>` : `${type === 'products' ? `<label>ID<input data-key="id" value="${escape(r.id)}"></label><label>ชื่อสินค้า<input data-key="name" value="${escape(r.name)}"></label><label>ราคา<input type="number" min="0.01" max="10000000" step="0.01" data-key="price" value="${escape(r.price)}"></label><label>รายละเอียด<textarea data-key="description">${escape(r.description)}</textarea></label><label>จำนวนเดือน (ว่าง = ถาวร)<input type="number" min="1" max="120" data-key="durationMonths" value="${escape(r.durationMonths)}"></label>` : `<label>Level<input type="number" data-key="id" min="0" value="${escape(r.id)}"></label><label>โหมด<select data-key="mode">${option('permanent', 'ถาวร', r.mode !== 'rental')}${option('rental', 'เช่า / ชั่วคราว', r.mode === 'rental')}</select></label><label>ระยะเวลา (มิลลิวินาที)<input type="number" min="0" data-key="durationMs" value="${escape(r.durationMs || 0)}"></label>`}<label>ยศ<select data-key="roleId">${option('', 'ไม่เลือกยศ', !r.roleId)}${data.roles.map(role => option(role.id, role.name, role.id === r.roleId)).join('')}</select></label>`}</div><button type="button" class="button small danger" data-remove="${i}">ลบรายการ</button></div>`).join('') + `<button type="button" class="button small" data-add>+ เพิ่มรายการ</button>`;
      container.querySelectorAll('[data-key]').forEach(input => input.oninput = () => { const r = rows[Number(input.closest('[data-row]').dataset.row)]; r[input.dataset.key] = input.type === 'number' ? (input.value === '' ? null : Number(input.value)) : input.value; });
      container.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => { rows.splice(Number(b.dataset.remove), 1); render(); });
      container.querySelector('[data-add]').onclick = () => { rows.push(type === 'responses' ? { content: '', imageUrl: '' } : type === 'products' ? { id: `p_${Date.now()}`, name: '', price: 1, roleId: '' } : { id: '', mode: 'permanent', durationMs: 0, roleId: '' }); render(); };
    }
    render(); readRows[key] = () => { if (type === 'responses') return rows; if (new Set(rows.map(r => r.id)).size !== rows.length) throw new Error('ID / Level ซ้ำ'); return Object.fromEntries(rows.map(({ id, ...r }) => [id, r])); };
  });
  return readRows;
}
async function dashboard() {
  if (!session.user) return loginRequired();
  const result = await api('guilds');
  app.innerHTML = `<div class="container">${head('SERVER DASHBOARD', 'จัดการเซิร์ฟเวอร์', 'เลือกเซิร์ฟเวอร์ แล้วตั้งค่าระบบที่ต้องการ')}<div class="toolbar"><select id="guild-select" aria-label="เลือกเซิร์ฟเวอร์">${option('', 'เลือกเซิร์ฟเวอร์ของคุณ', true)}${result.guilds.map(g => option(g.id, `${g.name}${g.vip ? ' · VIP' : ''}${g.botPresent ? '' : ' · ยังไม่มีบอท'}`, false)).join('')}</select></div><div id="settings-content">${empty(result.guilds.length ? 'เลือกเซิร์ฟเวอร์เพื่อเริ่มต้น' : 'ไม่พบเซิร์ฟเวอร์ที่คุณมีสิทธิ์จัดการ')}</div></div>`;
  const select = document.querySelector('#guild-select');
  let requestId = 0;
  select.onchange = async () => {
    const currentRequest = ++requestId; const target = document.querySelector('#settings-content'); const guild = result.guilds.find(g => g.id === select.value);
    if (!guild) { target.innerHTML = empty('เลือกเซิร์ฟเวอร์เพื่อเริ่มต้น'); return; }
    if (!guild.botPresent) { target.innerHTML = `<div class="notice">ต้องเพิ่ม Devil เข้าเซิร์ฟเวอร์ก่อน จึงจะตั้งค่าผ่านเว็บได้${result.inviteUrl ? `<div class="actions"><a class="button primary" href="${safeUrl(result.inviteUrl)}&guild_id=${guild.id}" target="_blank" rel="noopener noreferrer">เพิ่มบอทเข้าเซิร์ฟเวอร์ <span data-icon="external"></span></a></div>` : ''}</div>`; return; }
    target.innerHTML = '<div class="loading">กำลังโหลดค่าจากบอท…</div>';
    try {
      const data = await api('settings', undefined, { guildId: guild.id }); if (currentRequest !== requestId) return;
      target.innerHTML = `<div class="dashboard-layout"><aside class="sidebar">${data.systems.map(s => `<button data-system="${s.id}">${icon(systemIcon(s.id))}<span>${escape(s.label)}</span>${s.vip ? icon('vip') : ''}</button>`).join('')}</aside><section id="system-form" class="card"></section></div>`;
      function choose(id) {
        const system = data.systems.find(s => s.id === id); document.querySelectorAll('[data-system]').forEach(b => b.classList.toggle('selected', b.dataset.system === id));
        const node = document.querySelector('#system-form');
        if (system.locked) { node.innerHTML = `<span class="badge vip">${icon('vip')}VIP ONLY</span><h2>VIP Shop</h2><p>เซิร์ฟเวอร์นี้ยังไม่มีสิทธิ์ Premium กรุณาติดต่อ Owner</p>`; return; }
        node.innerHTML = `<div class="settings-head"><h3>${escape(system.label)}</h3><span class="badge ${system.vip ? 'vip' : 'public'}">/${escape(system.command)}</span></div><form><div class="form-grid">${system.fields.map(f => fieldHtml(f, system.values[f.key], data)).join('')}</div><div class="form-actions"><button class="button primary" type="submit">บันทึกการตั้งค่า</button>${system.publish ? `<button class="button ghost" type="submit" name="publish" value="yes">${system.id === 'safe' ? 'สร้างห้องดักสแปม' : 'บันทึกและเผยแพร่แผง'}</button>` : ''}<button type="button" class="button small" id="reload-settings">โหลดใหม่</button></div><div class="form-result" role="status"></div></form>`;
        const form = node.querySelector('form'); const collections = bindCollections(form, system, data);
        node.querySelector('#reload-settings').onclick = () => select.onchange();
        form.onsubmit = async event => {
          event.preventDefault(); const publish = event.submitter?.name === 'publish'; const buttons = [...form.querySelectorAll('button')]; buttons.forEach(b => b.disabled = true);
          try {
            const values = {}; for (const f of system.fields) { const input = form.elements.namedItem(f.key); values[f.key] = collections[f.key] ? collections[f.key]() : f.type === 'boolean' ? input.checked : ['channels', 'roles'].includes(f.type) ? [...input.selectedOptions].map(o => o.value) : f.type === 'number' ? Number(input.value) : f.type === 'lines' ? input.value.split('\n').filter(v => v.trim()) : input.value; }
            const saved = await api('settings', { system: system.id, revision: system.revision, values, publish }, { guildId: guild.id }); system.revision = saved.revision; system.values = saved.values;
            const message = saved.publishError ? `บันทึกแล้ว แต่เผยแพร่ไม่สำเร็จ: ${saved.publishError}` : publish ? 'บันทึกและเผยแพร่เรียบร้อยแล้ว' : 'บันทึกการตั้งค่าเรียบร้อยแล้ว'; form.querySelector('.form-result').textContent = message; toast(message);
          } catch (e) { form.querySelector('.form-result').textContent = e.message; toast(e.message); } finally { buttons.forEach(b => b.disabled = false); }
        };
      }
      target.querySelectorAll('[data-system]').forEach(b => b.onclick = () => choose(b.dataset.system)); if (data.systems.length) choose(data.systems[0].id);
    } catch (e) { if (currentRequest === requestId) target.innerHTML = `<div class="error">${escape(e.message)}</div>`; }
  };
}
async function ownerPage() {
  if (!session.user) return loginRequired();
  if (!session.owner) { app.innerHTML = `<div class="container">${head('OWNER AREA', 'คำสั่ง Owner', 'สำหรับ Owner ของ Devil')}${empty('บัญชีนี้ไม่มีสิทธิ์ใช้คำสั่ง Owner')}</div>`; return; }
  const initial = await api('owner');
  app.innerHTML = `<div class="container">${head('OWNER COMMANDS', 'คำสั่ง Owner', 'จัดการประกาศ สถานะ และระบบบอท Public จากที่เดียว')}<div class="toolbar"><a class="button ghost small" href="/admin">${icon('grid')} จัดการเว็บไซต์</a><label class="owner-guild-label">เซิร์ฟเวอร์หลัก<select id="owner-guild">${option('', '— เลือกเซิร์ฟเวอร์ —', true)}${initial.guilds.map(g => option(g.id, g.name, false)).join('')}</select></label><button id="owner-refresh" class="button small">${icon('update')} โหลดการตั้งค่าใหม่</button></div><p id="owner-result" role="status" class="form-result"></p><div id="owner-tools">${empty(initial.guilds.length ? 'เลือกเซิร์ฟเวอร์หลักเพื่อใช้คำสั่ง Owner' : 'บอทยังไม่ได้อยู่ในเซิร์ฟเวอร์หลักที่ตั้งไว้')}</div></div>`;
  const guildSelect = document.querySelector('#owner-guild');
  const target = document.querySelector('#owner-tools');
  const result = document.querySelector('#owner-result');
  let data, selected = initial.commands[0]?.id, generation = 0, executing = false;
  const choices = { new: 'ส่งประกาศใหม่', edit: 'แก้ไขประกาศล่าสุดในช่องนี้', stats: 'จำนวนเซิร์ฟเวอร์และสมาชิก', custom: 'ข้อความที่กำหนดเอง', none: 'ไม่แจ้งเตือน', everyone: '@everyone', here: '@here', role: 'แจ้งเตือนยศที่เลือก', '': 'ทุกระบบที่ Reload ได้' };
  function choose(id) {
    selected = id;
    target.querySelectorAll('[data-owner-command]').forEach(button => button.classList.toggle('selected', button.dataset.ownerCommand === id));
    const command = data.commands.find(c => c.id === id);
    const values = data.values[id] || {};
    target.querySelector('#owner-form-area').innerHTML = `<form id="owner-command-form" class="card owner-command-card"><div class="settings-head"><div><h3>${icon(command.icon)} ${escape(command.label)}</h3><p>${escape(command.description)}</p></div><span class="badge owner-badge">${icon('crown')} Owner</span></div><div class="form-grid">${command.fields.map(f => f.type === 'choice' ? `<label>${escape(f.label)}<select name="${escape(f.key)}">${f.choices.map(v => option(v, choices[v] || v, v === values[f.key])).join('')}</select></label>` : fieldHtml(f, values[f.key] ?? '', data)).join('')}</div><div class="form-actions"><button class="button primary" type="submit">${icon(command.icon)} ${id === 'announe-panel' ? 'เผยแพร่ใน Discord' : id === 'reload' ? 'Reload ระบบที่เลือก' : 'บันทึกสถานะ'}</button></div></form>`;
    const form = target.querySelector('#owner-command-form');
    let requestId = crypto.randomUUID();
    form.oninput = () => { requestId = crypto.randomUUID(); };
    form.onsubmit = async event => {
      event.preventDefault(); if (executing) return;
      executing = true;
      const buttons = [...document.querySelectorAll('#owner-tools button, #owner-refresh')];
      buttons.forEach(button => button.disabled = true); guildSelect.disabled = true;
      result.textContent = id === 'reload' ? 'กำลัง Reload ระบบบอท…' : 'กำลังดำเนินคำสั่ง…';
      try {
        const values = Object.fromEntries(command.fields.map(f => [f.key, form.elements.namedItem(f.key).value]));
        const response = await api('owner', { command: id, values, revision: data.revision, requestId }, { guildId: guildSelect.value });
        result.textContent = response.message; toast(response.message);
        await load();
      } catch (error) { result.textContent = error.message; toast(error.message); }
      finally { executing = false; buttons.forEach(button => button.disabled = false); guildSelect.disabled = false; }
    };
  }
  async function load() {
    const current = ++generation;
    if (!guildSelect.value) { target.innerHTML = empty('เลือกเซิร์ฟเวอร์หลักเพื่อใช้คำสั่ง Owner'); return; }
    target.innerHTML = '<div class="loading">กำลังโหลดคำสั่ง Owner…</div>';
    try {
      const response = await api('owner', undefined, { guildId: guildSelect.value });
      if (current !== generation) return;
      data = response;
      target.innerHTML = `<div class="dashboard-layout"><aside class="sidebar" aria-label="คำสั่ง Owner">${data.commands.map(c => `<button type="button" data-owner-command="${escape(c.id)}">${icon(c.icon)}<span>${escape(c.label)}</span></button>`).join('')}</aside><div id="owner-form-area"></div></div>`;
      target.querySelectorAll('[data-owner-command]').forEach(button => button.onclick = () => choose(button.dataset.ownerCommand));
      choose(data.commands.some(c => c.id === selected) ? selected : data.commands[0].id);
    } catch (error) { if (current === generation) target.innerHTML = `<div class="error">${escape(error.message)}</div>`; }
  }
  guildSelect.onchange = () => { result.textContent = ''; load(); };
  document.querySelector('#owner-refresh').onclick = () => { if (!executing) load(); };
}
async function admin() {
  if (!session.user) return loginRequired();
  if (!session.owner) { app.innerHTML = `<div class="container">${head('OWNER AREA', 'หลังบ้าน', 'สำหรับ Owner เท่านั้น')}${empty('บัญชีนี้ไม่มีสิทธิ์เข้าหลังบ้าน')}</div>`; return; }
  let data = await api('admin'); let current = 'features';
  app.innerHTML = `<div class="container">${head('OWNER CONTROL CENTER', 'จัดการเว็บไซต์', 'เพิ่มฟีเจอร์ ข่าวอัปเดต และหมวดเซิร์ฟเวอร์ แก้ไขได้ทุกเมื่อ')}<div class="toolbar"><div class="tabs">${[['features', 'ฟีเจอร์'], ['updates', 'อัปเดต'], ['serverCategories', 'หมวดเซิร์ฟเวอร์']].map(([key, label]) => `<button data-cms-tab="${key}">${label}</button>`).join('')}</div><a class="button ghost small" href="/owner">${icon('crown')} คำสั่ง Owner</a><button id="add-content" class="button small">+ เพิ่มรายการ</button><button id="save-content" class="button primary">บันทึกทั้งหมด</button></div><div id="cms-list"></div><details><summary>ประวัติการจัดการล่าสุด</summary><div class="audit" id="audit-log"></div></details></div>`;
  function render() {
    document.querySelectorAll('[data-cms-tab]').forEach(b => b.classList.toggle('selected', b.dataset.cmsTab === current));
    document.querySelector('#audit-log').textContent = (data.audit || []).slice().reverse().map(a => `${a.at} · ${a.userId} · ${a.action}${a.guildId ? ` · ${a.guildId}` : ''}${a.system ? ` · ${a.system}` : ''}${a.command ? ` · /${a.command}` : ''}`).join('\n');
    document.querySelector('#cms-list').innerHTML = data[current].map((row, i) => `<article class="card cms-item" data-index="${i}"><div class="card-top"><span class="badge">${escape(row.id)}</span><button class="button small danger" data-delete="${i}">ลบรายการ</button></div><div class="form-grid"><label>หัวข้อ<input data-key="title" maxlength="256" value="${escape(row.title)}"></label><label class="check"><input type="checkbox" data-key="published" ${row.published ? 'checked' : ''}>เผยแพร่บนเว็บ</label><label class="wide">รายละเอียด<textarea data-key="body" maxlength="10000">${escape(row.body)}</textarea></label>${current !== 'serverCategories' ? `<label>รูปภาพ (HTTPS URL)<input data-key="imageUrl" type="url" value="${escape(row.imageUrl)}"></label>${current === 'features' ? `<label>คำสั่ง<select data-key="command">${option('', 'ไม่ระบุคำสั่ง', !row.command)}${catalog.commands.map(c => option(c.name, `/${c.name}`, c.name === row.command)).join('')}</select></label><label>หมวด<select data-key="mode">${option('Public', 'Public', row.mode !== 'VIP')}${option('VIP', 'VIP', row.mode === 'VIP')}</select></label>` : ''}<div class="wide" data-preview>${img(row.imageUrl, 'card-image', row.title)}</div>` : `<label class="wide">เซิร์ฟเวอร์ในหมวด<select data-key="guildIds" multiple>${(status.servers || []).map(g => option(g.id, g.name, (row.guildIds || []).includes(g.id))).join('')}</select><small>เลือกหลายรายการ: Ctrl / ⌘ + คลิก</small></label>`}</div></article>`).join('') || empty('ยังไม่มีรายการ กด “เพิ่มรายการ” เพื่อเริ่มต้น');
    document.querySelectorAll('[data-index] [data-key]').forEach(input => input.oninput = () => { const row = data[current][Number(input.closest('[data-index]').dataset.index)]; row[input.dataset.key] = input.type === 'checkbox' ? input.checked : input.multiple ? [...input.selectedOptions].map(o => o.value) : input.value; if (input.dataset.key === 'imageUrl') input.closest('[data-index]').querySelector('[data-preview]').innerHTML = img(row.imageUrl, 'card-image', row.title); });
    document.querySelectorAll('[data-delete]').forEach(b => b.onclick = () => { data[current].splice(Number(b.dataset.delete), 1); render(); });
  }
  document.querySelectorAll('[data-cms-tab]').forEach(b => b.onclick = () => { current = b.dataset.cmsTab; render(); });
  document.querySelector('#add-content').onclick = () => { data[current].push({ id: crypto.randomUUID(), title: '', body: '', imageUrl: '', published: false, command: '', mode: 'Public', guildIds: [] }); render(); };
  document.querySelector('#save-content').onclick = async event => { event.target.disabled = true; try { data = await api('admin', { revision: data.revision, features: data.features, updates: data.updates, serverCategories: data.serverCategories }); toast('บันทึกเว็บไซต์เรียบร้อยแล้ว'); render(); } catch (e) { toast(e.message); } finally { event.target.disabled = false; } }; render();
}
async function start() {
  // Static information pages remain available even if Discord or the CMS is down.
  if (window.DevilInformation?.render(route, app)) return;
  if (route === '/features') {
    app.innerHTML = `<div class="container">${head('EXPLORE DEVIL', 'ฟีเจอร์', 'ทดลอง Welcome, Ticket, Verify และ Shop ในรูปแบบข้อความ Discord')}<div id="feature-demo-root"></div><section class="section"><div class="section-heading"><div><div class="section-label">MORE FROM DEVIL</div><h2>ฟีเจอร์และรายละเอียด</h2><p>ระบบต่าง ๆ และข้อมูลจากทีม Devil</p></div></div><div class="grid" id="published-features"><div class="loading">กำลังโหลดรายละเอียด…</div></div></section></div>`;
    window.DevilFeatureDemos.mount(document.querySelector('#feature-demo-root'));
    api('content').then(data => {
      const features = Array.isArray(data.features) ? data.features.filter(f => f && f.mode !== 'Private') : [];
      document.querySelector('#published-features').innerHTML = features.map(featureCard).join('') || empty('ทีมงานยังไม่ได้เผยแพร่รายละเอียดเพิ่มเติม');
    }).catch(() => { document.querySelector('#published-features').innerHTML = empty('ยังโหลดรายละเอียดเพิ่มเติมไม่ได้ แต่ทดลองระบบด้านบนได้เลย'); });
    return;
  }
  // The server directory does not depend on login, Owner profiles or the CMS.
  if (route === '/servers') {
    app.innerHTML = '<div class="container"><div class="loading">กำลังโหลดเซิร์ฟเวอร์จาก Discord…</div></div>';
    fetchStatus().then(data => { status = data; serverPage(); }).catch(() => serverPage());
    api('content').then(data => { content = { features: Array.isArray(data.features) ? data.features : [], updates: Array.isArray(data.updates) ? data.updates : [], serverCategories: Array.isArray(data.serverCategories) ? data.serverCategories.filter(c => c && Array.isArray(c.guildIds)) : [] }; if (status.servers !== null) serverPage(); }).catch(() => {});
    window.DevilAccount.ready.then(data => { session = data; });
    return;
  }
  const requests = await Promise.allSettled([window.DevilAccount.ready, api('catalog'), api('content'), fetchStatus(), api('owners')]);
  if (requests[0].status === 'fulfilled') session = requests[0].value;
  if (requests[1].status === 'fulfilled') catalog = requests[1].value;
  if (requests[2].status === 'fulfilled') content = requests[2].value;
  if (requests[3].status === 'fulfilled') status = requests[3].value;
  if (requests[4].status === 'fulfilled') ownerProfiles = requests[4].value.owners;
  if (session.user) { document.querySelector('#account-link').href = '/dashboard'; document.querySelector('#account-link').textContent = `${session.user.name} · Dashboard`; document.querySelector('#logout').hidden = false; document.querySelector('#admin-link').hidden = !session.owner; }
  try {
    if (route === '/commands') commandPage(); else if (route === '/servers') serverPage(); else if (route === '/dashboard') await dashboard(); else if (route === '/admin') await admin(); else if (route === '/owner') await ownerPage(); else if (route === '/features') app.innerHTML = `<div class="container">${head('EXPLORE DEVIL', 'ฟีเจอร์', 'ระบบและคำสั่งต่าง ๆ ของ Devil พร้อมภาพและรายละเอียด')}<div class="grid">${content.features.map(featureCard).join('')}</div>${content.features.length ? '' : empty(requests[2].status === 'rejected' ? 'ยังไม่สามารถโหลดฟีเจอร์ได้' : 'ทีมงานยังไม่ได้เผยแพร่ฟีเจอร์')}</div>`; else if (route === '/updates') app.innerHTML = `<div class="container">${head('DEVIL CHANGELOG', 'ข่าวอัปเดต', 'ติดตามเวอร์ชันใหม่ ฟีเจอร์ และประกาศจากทีมงาน')}<div class="timeline">${content.updates.slice().reverse().map(updateCard).join('')}</div>${content.updates.length ? '' : empty(requests[2].status === 'rejected' ? 'ยังไม่สามารถโหลดข่าวอัปเดตได้' : 'ยังไม่มีข่าวอัปเดต')}</div>`; else homepage();
  } catch (e) { app.innerHTML = `<div class="container">${head('DEVIL BOT', 'ไม่สามารถโหลดข้อมูล', 'กรุณาลองอีกครั้ง')}<div class="error">${escape(e.message)}</div><button class="button primary" onclick="location.reload()">ลองใหม่</button></div>`; }
}
start(); if (route === '/') setInterval(refreshLive, 10000);
