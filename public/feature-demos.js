/* Local-only examples based on Devil's ticket, verify and shop handlers.
 * Emoji IDs come from verify-system.js and shop.js. No Discord mutations here. */
(() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = name => window.DevilIcons.render(name);
  const emojiTags = {
    product: '<:emoji_14:1537885070898237450>', price: '<:emoji_19:1538411631900491786>',
    promptpay: '<:emoji_16:1538411050280685639>', truemoney: '<:emoji_27:1540984153892458546>',
    success: '<a:emoji_20:1538599895093747792>', protection: '<:devildiscord:1549887042752614561>', tick: '<:tickgreen:1549887079658299392>'
  };
  function richText(value) {
    const source = String(value ?? '');
    const expression = /<(a?):([a-zA-Z0-9_]+):(\d{17,20})>/g;
    let result = '', cursor = 0;
    for (const match of source.matchAll(expression)) {
      result += esc(source.slice(cursor, match.index));
      const [, animated, name, id] = match;
      result += `<span class="demo-emoji-wrap"><img class="demo-emoji" src="https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'png'}?size=48" alt=":${esc(name)}:" loading="lazy"><span class="demo-emoji-fallback" hidden>${esc(name)}</span></span>`;
      cursor = match.index + match[0].length;
    }
    return (result + esc(source.slice(cursor))).replace(/\n/g, '<br>');
  }
  const emoji = key => richText(emojiTags[key]);
  const modes = [
    { id: 'welcome', name: 'Welcome', subtitle: 'ต้อนรับและอำลาสมาชิก', icon: 'welcome', command: 'set-welcom', title: 'Welcome / Goodbye', description: 'เริ่มต้นชุมชนด้วยข้อความต้อนรับ พร้อมรูปภาพและข้อมูลสมาชิก', color: '#167aca' },
    { id: 'ticket', name: 'Ticket', subtitle: 'เปิดห้องติดต่อทีมงาน', icon: 'ticket', command: 'set-ticket', title: 'Ticket', description: 'กดปุ่มด้านล่างเพื่อสร้าง Ticket', label: 'Create Ticket', color: '#ff0000' },
    { id: 'verify', name: 'Verify', subtitle: 'กดปุ่มหรือ Reaction รับยศ', icon: 'shield', command: 'set-verify', title: 'Verify', description: 'กดปุ่มด้านล่างเพื่อยืนยันรับยศ', label: 'รับยศ', color: '#000000' },
    { id: 'shop', name: 'Shop', subtitle: 'เลือกสินค้าและช่องทางชำระ', icon: 'shop', command: 'set-shop', title: 'Devil Shop', description: 'เลือกสินค้าที่ต้องการสั่งซื้อจากเมนูด้านล่าง', color: '#167aca', vip: true }
  ];
  const sampleProducts = [
    { id: 'member', name: 'Member Plus', price: 99, role: 'Member Plus', duration: 'ถาวร' },
    { id: 'vip', name: 'VIP 1 เดือน', price: 199, role: 'VIP', duration: '1 เดือน' },
    { id: 'premium', name: 'Premium 3 เดือน', price: 499, role: 'Premium', duration: '3 เดือน' }
  ];
  let mounts = 0;
  function mount(root, { preview = null, card = false } = {}) {
    const uid = `feature-demo-${++mounts}`;
    let active = preview && modes.some(mode => mode.id === preview.system) ? preview.system : 'welcome';
    const products = preview?.products || sampleProducts;
    const fresh = mode => ({ ...mode, buttonEmoji: '', welcomeEvent: 'join', enabled: true, ticketOpen: false, closing: false, verifyMode: 'button', claimed: [], product: '', payment: '', paid: false });
    const states = Object.fromEntries(modes.map(mode => [mode.id, fresh(mode)]));
    if (preview) Object.assign(states[active], preview, { color: /^#[0-9a-f]{6}$/i.test(preview.color || '') ? preview.color : '#167aca' });
    root.innerHTML = `<section class="feature-playground" aria-labelledby="demo-heading"><div class="demo-heading"><div><div class="section-label">TRY DEVIL LIVE</div><h2 id="demo-heading">ลองกด แล้วดูว่า Devil ทำอะไรได้</h2><p>ตัวอย่างจำลองจากระบบบอท เปลี่ยนการตั้งค่าและกดเล่นได้เลย</p></div><span class="badge demo-badge">${icon('grid')} INTERACTIVE DEMO</span></div><div class="demo-tabs" role="tablist" aria-label="เลือกระบบตัวอย่าง">${modes.map(m => `<button type="button" role="tab" id="demo-tab-${m.id}" data-demo-tab="${m.id}" aria-controls="demo-workspace" aria-selected="${m.id === active}" tabindex="${m.id === active ? 0 : -1}">${icon(m.icon)}<span>${m.name}</span>${m.vip ? '<small>VIP</small>' : ''}</button>`).join('')}</div><div id="demo-workspace" class="demo-workspace" role="tabpanel" aria-labelledby="demo-tab-welcome"><aside class="demo-settings"></aside><div class="demo-preview"><div class="demo-channel"><span>${icon('chat')}<b data-demo-channel></b></span><small>เซิร์ฟเวอร์ตัวอย่าง</small></div><div class="demo-messages"><div class="demo-message"><img class="demo-avatar" src="/bot-avatar?v=original-logo" alt="โลโก้ Devil"><div class="demo-message-content"><div class="demo-author"><b>Devil</b><span>APP ${icon('check')}</span><time>วันนี้ เวลา 12:00</time></div><div data-demo-stage></div></div></div></div><div class="demo-preview-footer"><span class="demo-status-dot"></span>โหมดจำลอง · ไม่ส่งข้อความหรือทำรายการจริง</div></div></div><div class="demo-bottom"><p data-demo-hint aria-live="polite"></p><button type="button" class="button small ghost" data-demo-action="reset">${icon('reload')} เริ่มใหม่</button></div></section>`;
    const ids = new Map();
    root.querySelectorAll('[id]').forEach(element => { ids.set(element.id, `${uid}-${element.id}`); element.id = ids.get(element.id); });
    root.querySelectorAll('[aria-controls], [aria-labelledby]').forEach(element => { for (const attribute of ['aria-controls', 'aria-labelledby']) if (element.hasAttribute(attribute)) element.setAttribute(attribute, element.getAttribute(attribute).split(' ').map(id => ids.get(id) || id).join(' ')); });
    if (card) {
      root.classList.add('feature-preview-card');
      root.querySelectorAll('.demo-heading, .demo-tabs, .demo-settings, .demo-bottom').forEach(element => { element.hidden = true; });
    }
    const settings = root.querySelector('.demo-settings'), stage = root.querySelector('[data-demo-stage]');
    const button = (action, text, style = 'primary', extra = '') => `<button type="button" class="discord-button ${style}" data-demo-action="${action}" ${extra}>${text}</button>`;
    const embed = (title, body, extra = '', image = '') => {
      const configured = states[active].imageUrl;
      let imageUrl = image ? `/demo-assets/${image}` : '';
      try { if (configured && new URL(configured).protocol === 'https:') imageUrl = configured; } catch {}
      return `<div class="demo-embed" style="--embed-color:${states[active].color}"><h3>${richText(title)}</h3><div class="demo-embed-body">${body}</div>${imageUrl ? `<img class="demo-banner" src="${esc(imageUrl)}" alt="ตัวอย่างภาพ ${esc(active)} ของ Devil" loading="lazy">` : ''}${extra}<div class="demo-embed-footer">DEVIL · ${esc(modes.find(m => m.id === active).name)}</div></div>`;
    };
    const notice = body => `<div class="demo-result" role="status"><div>${icon('lock')} เฉพาะคุณเท่านั้นที่เห็นข้อความนี้ · ตัวอย่าง</div><div class="demo-result-text">${body}</div></div>`;
    function renderSettings() {
      if (card) return;
      const s = states[active];
      settings.innerHTML = `<div class="demo-config-heading"><span>${icon(s.icon)}</span><div><h3>${s.name}</h3><p>${esc(s.subtitle)}</p></div></div><code>/${s.command}</code>${active === 'welcome' ? `<label class="check"><input type="checkbox" data-demo-field="enabled" ${s.enabled ? 'checked' : ''}>เปิดระบบตัวอย่าง</label><label>เหตุการณ์<select data-demo-field="welcomeEvent"><option value="join" ${s.welcomeEvent === 'join' ? 'selected' : ''}>สมาชิกเข้าเซิร์ฟเวอร์</option><option value="leave" ${s.welcomeEvent === 'leave' ? 'selected' : ''}>สมาชิกออกจากเซิร์ฟเวอร์</option></select></label>` : `<label>หัวข้อ<input data-demo-field="title" maxlength="100" value="${esc(s.title)}"></label><label>ข้อความ<textarea data-demo-field="description" maxlength="1000">${esc(s.description)}</textarea></label>`}<label>สีข้อความ / Embed<input type="color" data-demo-field="color" value="${s.color}"></label>${['ticket', 'verify'].includes(active) ? `<label>ข้อความปุ่ม<input data-demo-field="label" maxlength="80" value="${esc(s.label)}"></label><label>อิโมจิปุ่ม<input data-demo-field="buttonEmoji" maxlength="100" value="${esc(s.buttonEmoji)}" placeholder="✅ หรือ &lt;:name:ID&gt;"></label>` : ''}${active === 'verify' ? `<label>รูปแบบรับยศ<select data-demo-field="verifyMode"><option value="button" ${s.verifyMode === 'button' ? 'selected' : ''}>ปุ่มกด</option><option value="emoji" ${s.verifyMode === 'emoji' ? 'selected' : ''}>อิโมจิ Reaction</option></select></label>` : ''}<a class="demo-dashboard-link" href="/dashboard">ตั้งค่าเซิร์ฟเวอร์จริง ${icon('external')}</a>`;
    }
    function renderPreview() {
      const s = states[active];
      root.querySelector('[data-demo-channel]').textContent = s.ticketOpen ? 'ticket-demo-001' : s.channelName || { welcome: 'welcome', ticket: 'support', verify: 'verify', shop: 'devil-shop' }[active];
      if (s.guildName) root.querySelector('.demo-channel small').textContent = s.guildName;
      root.querySelector('[data-demo-hint]').textContent = { welcome: 'ลองเปลี่ยนเหตุการณ์เพื่อดูข้อความ Welcome และ Goodbye', ticket: 'ลองเปิด Ticket แล้วกดปิดห้องเพื่อดูขั้นตอนยืนยัน', verify: 'ทดลองรับยศ Member / VIP หรือเปลี่ยนเป็นโหมด Reaction', shop: 'เลือกสินค้าจากเมนู แล้วลองกดช่องทางชำระเงิน' }[active];
      if (active === 'welcome') {
        const joining = s.welcomeEvent === 'join';
        stage.innerHTML = s.enabled ? embed(preview ? s.title : joining ? 'ยินดีต้อนรับสู่ Devil Community' : 'แล้วพบกันใหม่', `<span class="demo-mention">@สมาชิกตัวอย่าง</span><p>${richText(preview ? s.description : joining ? 'ยินดีต้อนรับสมาชิกใหม่ ขอให้สนุกกับชุมชนของเรา!' : 'ขอบคุณที่เป็นส่วนหนึ่งของชุมชน ขอให้โชคดีครับ')}</p><div class="demo-fields"><div><small>สมาชิกในเซิร์ฟเวอร์</small><b>${joining ? '2,235' : '2,234'} คน</b></div><div><small>ชุมชน</small><b>${esc(s.guildName || 'Devil Community')}</b></div></div>`, '', 'welcome-embed-image.png') : notice('ปิดระบบแล้ว จึงไม่มีข้อความต้อนรับหรืออำลาในตัวอย่าง');
      } else if (active === 'ticket') {
        if (!s.ticketOpen) stage.innerHTML = embed(s.title, richText(s.description), `<div class="discord-actions">${button('ticket-open', `${richText(s.buttonEmoji)} ${esc(s.label)}`, s.buttonStyle || 'primary')}</div>`, 'ticket-card-v2.png');
        else stage.innerHTML = embed('Ticket #demo-001', `<span class="demo-mention">@สมาชิกตัวอย่าง</span><p>${richText(s.autoReplies?.join('\n') || 'แจ้งเรื่องที่ต้องการติดต่อไว้ได้เลย ทีมงานจะเข้ามาดูแลครับ')}</p>`, `<div class="discord-actions">${button('ticket-close', `${icon('lock')} ปิด Ticket`, 'danger')}</div>`) + (s.closing ? notice(`ต้องการปิด Ticket นี้หรือไม่?<div class="discord-actions">${button('ticket-confirm', 'ยืนยันปิด Ticket', 'danger')}${button('ticket-cancel', 'ยกเลิก', 'secondary')}</div>`) : notice('สร้างห้อง Ticket ตัวอย่างแล้ว'));
      } else if (active === 'verify') {
        const roles = s.roles || [{ name: 'Member', emoji: '1️⃣' }, { name: 'VIP', emoji: '2️⃣' }];
        const actions = roles.map(({ name: role, emoji: reaction }) => s.verifyMode === 'emoji' ? button('verify-role', `${richText(reaction)} <span>${esc(role)}</span> ${s.claimed.includes(role) ? '1' : '0'}`, 'reaction', `data-role="${esc(role)}" aria-pressed="${s.claimed.includes(role)}" aria-label="${esc((s.claimed.includes(role) ? 'ถอดยศ ' : 'รับยศ ') + role)}"`) : button('verify-role', `${richText(s.buttonEmoji)} ${esc(s.label)} · ${esc(role)}`, 'primary', `data-role="${esc(role)}"`)).join('');
        const body = `${richText(s.description)}<div class="discord-actions">${actions}</div>`;
        stage.innerHTML = (s.verifyMode === 'emoji' ? `<div class="demo-reaction-message"><h3>${richText(s.title)}</h3>${body}</div>` : embed(s.title, body)) + (s.claimed.length ? notice(`${emoji('success')} ${s.successMessage ? richText(s.successMessage) : `ได้รับยศ ${s.claimed.map(role => `<span class="demo-mention">@${esc(role)}</span>`).join(' ')} เรียบร้อยแล้ว`}<br>${emoji('protection')} Protection by Devil · ${emoji('tick')} Verified`) : '');
      } else {
        const product = products.find(p => p.id === s.product);
        const menu = `<div class="demo-select"><button type="button" class="demo-select-trigger" data-demo-action="shop-menu" aria-expanded="false" aria-controls="${uid}-shop-options" aria-haspopup="listbox">${emoji('product')}<span>${product ? esc(product.name) : 'เลือกสินค้าที่ต้องการสั่งซื้อ'}</span>${icon('chevron')}</button><div class="demo-select-options" id="${uid}-shop-options" role="listbox" aria-label="สินค้า" hidden>${products.map(p => `<button type="button" role="option" data-demo-action="shop-product" data-product="${esc(p.id)}" aria-selected="${p.id === s.product}">${emoji('product')}<span><b>${esc(p.name)}</b><small>฿${Number(p.price).toFixed(2)} · @${esc(p.role)} · ${esc(p.duration)}</small></span>${p.id === s.product ? icon('check') : ''}</button>`).join('')}<button type="button" role="option" data-demo-action="shop-product" data-product="" aria-selected="${!s.product}">ล้างตัวเลือก</button></div></div>`;
        stage.innerHTML = embed(s.title, richText(s.description), menu, 'devil-shop-banner.png');
        if (product) stage.innerHTML += `<div class="demo-product">${embed(product.name, `<div class="demo-fields"><div><small>${emoji('price')} ราคา</small><b>฿${Number(product.price).toFixed(2)}</b></div><div><small>ยศที่จะได้รับ</small><b class="demo-mention">@${esc(product.role)}</b></div><div><small>ระยะเวลา</small><b>${esc(product.duration)}</b></div></div>`, `<div class="discord-actions">${button('pay-promptpay', `${emoji('promptpay')} พร้อมเพย์ / โอนเงิน`, 'success')}${button('pay-truemoney', `${emoji('truemoney')} TrueMoney`, 'success')}</div>`)}</div>`;
        if (product && s.payment) stage.innerHTML += notice(s.paid ? `${emoji('success')} ชำระเงินตัวอย่างสำเร็จ · ได้รับยศ <span class="demo-mention">@${esc(product.role)}</span>` : `<b>ออเดอร์ตัวอย่าง · ${esc(product.name)}</b><br>ช่องทาง: ${s.payment === 'promptpay' ? 'พร้อมเพย์ / โอนเงิน' : 'TrueMoney'}<br>ยอดรวม ฿${Number(product.price).toFixed(2)}<div class="discord-actions">${button('pay-complete', 'จำลองชำระสำเร็จ', 'success')}${button('pay-cancel', 'ยกเลิก', 'secondary')}</div>`);
      }
      stage.querySelectorAll('.demo-emoji').forEach(image => image.addEventListener('error', () => { image.hidden = true; image.nextElementSibling.hidden = false; }, { once: true }));
    }
    function activate(id) {
      active = id;
      root.querySelectorAll('[data-demo-tab]').forEach(tab => { const selected = tab.dataset.demoTab === id; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1; });
      root.querySelector('.demo-workspace').setAttribute('aria-labelledby', `${uid}-demo-tab-${id}`);
      renderSettings(); renderPreview();
    }
    function closeMenu(restoreFocus = false) {
      const menu = stage.querySelector('.demo-select-options'), trigger = stage.querySelector('.demo-select-trigger');
      if (!menu || menu.hidden) return;
      menu.hidden = true; trigger.setAttribute('aria-expanded', 'false');
      if (restoreFocus) trigger.focus({ preventScroll: true });
    }
    root.addEventListener('input', event => {
      const field = event.target.dataset.demoField;
      if (!field) return;
      states[active][field] = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
      renderPreview();
    });
    root.addEventListener('click', event => {
      const tab = event.target.closest('[data-demo-tab]');
      if (tab) { activate(tab.dataset.demoTab); return; }
      const control = event.target.closest('[data-demo-action]');
      if (!control) { if (!event.target.closest('.demo-select')) closeMenu(); return; }
      const action = control.dataset.demoAction, s = states[active];
      if (action === 'shop-menu') {
        const menu = stage.querySelector('.demo-select-options');
        menu.hidden = !menu.hidden; control.setAttribute('aria-expanded', String(!menu.hidden));
        if (!menu.hidden) ((s.product && menu.querySelector('[aria-selected="true"]')) || menu.querySelector('button')).focus({ preventScroll: true });
        return;
      }
      if (action === 'reset') { states[active] = fresh(modes.find(m => m.id === active)); renderSettings(); }
      else if (action === 'ticket-open') s.ticketOpen = true;
      else if (action === 'ticket-close') s.closing = true;
      else if (action === 'ticket-cancel') s.closing = false;
      else if (action === 'ticket-confirm') { s.ticketOpen = false; s.closing = false; }
      else if (action === 'verify-role') { const role = control.dataset.role; s.claimed = s.claimed.includes(role) ? (s.verifyMode === 'emoji' ? s.claimed.filter(r => r !== role) : s.claimed) : [...s.claimed, role]; }
      else if (action === 'shop-product') { s.product = control.dataset.product; s.payment = ''; s.paid = false; }
      else if (action.startsWith('pay-')) { s.payment = action === 'pay-cancel' ? '' : action === 'pay-complete' ? s.payment : action.slice(4); s.paid = action === 'pay-complete'; }
      renderPreview();
      if (action === 'shop-product') stage.querySelector('.demo-select-trigger').focus({ preventScroll: true });
      else if (action.startsWith('ticket-') || action === 'verify-role' || action.startsWith('pay-')) {
        const next = stage.querySelector(`[data-demo-action="${action}"]`) || stage.querySelector('button');
        next?.focus({ preventScroll: true });
      }
    });
    root.addEventListener('keydown', event => {
      const tab = event.target.closest('[data-demo-tab]');
      if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const current = modes.findIndex(m => m.id === active), next = event.key === 'Home' ? 0 : event.key === 'End' ? modes.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + modes.length) % modes.length;
        activate(modes[next].id); root.querySelector(`[data-demo-tab="${active}"]`).focus(); return;
      }
      const menu = stage.querySelector('.demo-select-options');
      if (!menu || menu.hidden) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeMenu(true); }
      else if (event.key === 'Tab') closeMenu();
      else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); const options = [...menu.querySelectorAll('button')], current = options.indexOf(document.activeElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
        options[next].focus();
      }
    });
    activate(active);
  }
  window.DevilFeatureDemos = { mount, richText };
})();
