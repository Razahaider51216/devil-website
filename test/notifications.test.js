import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { commandNotifications } from '../lib/command-notifications.js';
const { publicationNotifications } = createRequire(import.meta.url)('../bot-integration/website-notifications.cjs');
test('published CMS changes create persistent events, unchanged saves and drafts do not, re-publication is new', () => {
  const initial = { features: [], updates: [] };
  const draft = { features: [{ id: 'feature', title: 'Feature', body: 'Details', published: false }], updates: [] };
  assert.equal(publicationNotifications(initial, draft).length, 0);
  const published = { ...draft, features: [{ ...draft.features[0], published: true }] };
  const events = publicationNotifications(draft, published); assert.equal(events.length, 1); assert.equal(events[0].href, '/features');
  const saved = { ...published, notifications: events };
  assert.deepEqual(publicationNotifications(saved, { ...published, features: [{ ...published.features[0], date: 'new date', preview: { capturedAt: 'new' } }] }), events);
  const update = { ...saved, updates: [{ id: 'release', title: 'New update', body: 'Release notes', published: true }] };
  assert.equal(publicationNotifications(saved, update).length, 2);
  assert.equal(publicationNotifications(saved, draft).length, 0);
  const republished = publicationNotifications({ ...draft, notifications: [] }, published);
  assert.notEqual(republished[0].id, events[0].id);
});
test('catalog synchronization notifies new or changed Public/VIP commands and omits private commands', () => {
  const command = { name: 'welcome', description: 'Welcome', mode: 'Public', options: [] };
  assert.equal(commandNotifications([command], [{ ...command }]).length, 0);
  const next = [command, { name: 'shop', mode: 'VIP', description: 'Shop' }, { name: 'secret', mode: 'Private' }];
  const events = commandNotifications([command], next); assert.equal(events.length, 1); assert.equal(events[0].sourceId, 'shop');
  assert.equal(commandNotifications(next, [command], events).length, 0);
  assert.equal(commandNotifications([command], [{ ...command, description: 'Updated' }])[0].kind, 'command');
});
