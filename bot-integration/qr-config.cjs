const DEFAULTS = {
  content: '', title: 'สแกน QR Code', description: 'สแกน QR ด้านล่างได้เลย 📱',
  footer: '', color: '#5865F2', imageUrl: '', buttonLabel: 'เปิดรูป QR', buttonEmoji: '📱', autoDeleteMinutes: 0
};

function validateQrConfig(config) {
  const result = { ...DEFAULTS, ...config };
  for (const [key, max] of Object.entries({ content: 2000, title: 256, description: 4000, footer: 1000, buttonLabel: 80, buttonEmoji: 100 })) {
    if (typeof result[key] !== 'string' || result[key].length > max) throw new Error(`ข้อความ ${key} ต้องไม่เกิน ${max} ตัวอักษร`);
  }
  result.color = result.color.trim() || DEFAULTS.color;
  if (!/^#[\da-f]{6}$/i.test(result.color)) throw new Error('สีต้องเป็น HEX 6 หลัก เช่น #5865F2');
  result.imageUrl = imageUrl(result.imageUrl);
  result.buttonLabel = result.buttonLabel.trim();
  result.buttonEmoji = result.buttonEmoji.trim();
  buttonEmoji(result.buttonEmoji);
  if (!Number.isInteger(result.autoDeleteMinutes) || result.autoDeleteMinutes < 0 || result.autoDeleteMinutes > 1440) throw new Error('เวลาลบต้องเป็นจำนวนเต็ม 0–1440 นาที (0 = ไม่ลบอัตโนมัติ)');
  if (!result.title && !result.description && !result.footer && !result.imageUrl) throw new Error('กรุณาใส่หัวข้อ คำอธิบาย ข้อความท้าย หรือรูป QR อย่างน้อยหนึ่งอย่าง');
  const textLength = result.content.length + result.title.length + (result.title ? 3 : 0) + result.description.length + result.footer.length + (result.footer ? 3 : 0) + (result.autoDeleteMinutes ? 140 : 0);
  if (textLength > 4000) throw new Error('ข้อความรวมในการ์ด Components V2 ต้องไม่เกิน 4000 ตัวอักษร รวมส่วนแสดงเวลาชำระเงิน');
  return result;
}

function imageUrl(value) {
  const raw = value.trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && raw.length <= 512) return url.href;
  } catch {}
  throw new Error('กรุณาใส่ลิงก์รูป QR แบบ http:// หรือ https:// ไม่เกิน 512 ตัวอักษร');
}

function buttonEmoji(value) {
  const raw = value.trim();
  if (!raw) return null;
  const custom = raw.match(/^<(a?):([\w]+):(\d{17,20})>$/);
  if (custom) return { animated: Boolean(custom[1]), name: custom[2], id: custom[3] };
  const parts = [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(raw)];
  if (parts.length === 1 && /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(raw)) return { name: raw };
  throw new Error('ใส่อิโมจิ 1 ตัว หรืออิโมจิเซิร์ฟเวอร์แบบ <:name:id> / <a:name:id>');
}


module.exports = { DEFAULTS, validateQrConfig, imageUrl, buttonEmoji };
