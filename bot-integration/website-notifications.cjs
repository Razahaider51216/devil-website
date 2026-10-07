const { createHash, randomBytes } = require('node:crypto');
const fingerprint = row => createHash('sha256').update(JSON.stringify([row.title, row.body, row.imageUrl, row.command, row.mode, row.previewSource, row.hidePreviewImages])).digest('hex').slice(0, 20);
function publicationNotifications(previous, next) {
  const notifications = [...(previous.notifications || [])];
  for (const group of ['updates', 'features']) {
    const before = new Map((previous[group] || []).map(row => [row.id, row]));
    for (const row of next[group] || []) {
      const old = before.get(row.id);
      if (!row.published || (old?.published && fingerprint(old) === fingerprint(row))) continue;
      notifications.push({ id: `${group}-${row.id}-${randomBytes(8).toString('hex')}`, kind: group === 'updates' ? 'update' : 'feature', sourceId: row.id, title: row.title, body: row.body || '', href: group === 'updates' ? '/updates' : '/features', at: new Date().toISOString() });
    }
  }
  // Unpublishing or deleting a source also removes its public notification.
  const published = new Set(['updates', 'features'].flatMap(group => (next[group] || []).filter(row => row.published).map(row => `${group === 'updates' ? 'update' : 'feature'}:${row.id}`)));
  return [...new Map(notifications.filter(row => published.has(`${row.kind}:${row.sourceId}`)).map(row => [row.id, row])).values()].slice(-200);
}
module.exports = { publicationNotifications };
