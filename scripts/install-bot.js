import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const botRoot = path.resolve(process.argv[2] || '../Devil');
await mkdir('bot-integration', { recursive: true });
for (const name of ['website-dashboard.js', 'website-settings-schema.cjs', 'website-owner-tools.cjs', 'website-feature-previews.cjs', 'website-preview-images.cjs', 'website-feature-message.cjs', 'website-province-regions.json', 'website-default-content.json', 'qr-config.cjs', 'qr-system.js']) {
  await copyFile(path.join('bot-integration', name), path.join(botRoot, name));
}
const entry = path.join(botRoot, 'index.js');
let source = await readFile(entry, 'utf8');
const hooks = await readFile('bot-integration/website-hooks.cjs', 'utf8');
if (!source.includes('// BEGIN WEBSITE DASHBOARD')) {
  const anchor = 'if (IS_PUBLIC_BOT) startBotStatusServer(client);';
  if (!source.includes(anchor)) throw new Error('Unsupported bot version: status server anchor missing');
  await copyFile(entry, `${entry}.before-website-dashboard.bak`);
  source = source.replace(anchor, `${anchor}\n\n// BEGIN WEBSITE DASHBOARD\n${hooks}\n// END WEBSITE DASHBOARD`);
  await writeFile(entry, source);
} else {
  source = source.replace(/\/\/ BEGIN WEBSITE DASHBOARD[\s\S]*?\/\/ END WEBSITE DASHBOARD/, `// BEGIN WEBSITE DASHBOARD\n${hooks}\n// END WEBSITE DASHBOARD`);
  await writeFile(entry, source);
}
const verifyPath = path.join(botRoot, 'verify-system.js');
let verify = await readFile(verifyPath, 'utf8');
verify = verify.replace(/\r\n/g, '\n');
if (!verify.includes('    createPanel,\n')) {
  if (!verify.includes('  return {\n    handleButton,')) throw new Error('Unsupported verify module');
  await copyFile(verifyPath, `${verifyPath}.before-website-dashboard.bak`);
  verify = verify.replace('  return {\n    handleButton,', '  return {\n    createPanel,\n    handleButton,');
  await writeFile(verifyPath, verify);
}
console.log('Bot dashboard installed. Restart the public bot after configuring its environment.');
