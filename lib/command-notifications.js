import { createHash, randomBytes } from 'node:crypto';
const fingerprint = command => createHash('sha256').update(JSON.stringify([command.description, command.options, command.mode, command.scope, command.category])).digest('hex');
export function commandNotifications(previous, next, notifications = []) {
  const publicCommands = rows => rows.filter(c => ['Public', 'VIP'].includes(c.mode));
  const before = new Map(publicCommands(previous).map(c => [c.name, c]));
  const events = publicCommands(next).filter(c => !before.has(c.name) || fingerprint(before.get(c.name)) !== fingerprint(c)).map(c => ({ id: `command-${c.name}-${randomBytes(8).toString('hex')}`, kind: 'command', sourceId: c.name, title: `${before.has(c.name) ? 'อัปเดตคำสั่ง' : 'คำสั่งใหม่'} /${c.name}`, body: c.description || '', href: '/commands', at: new Date().toISOString() }));
  const available = new Set(publicCommands(next).map(c => c.name));
  return [...notifications.filter(n => available.has(n.sourceId)), ...events].slice(-100);
}
