import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getBotData } from './lib/discord.js';
import { getBotStatus } from './lib/bot-status.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, 'public');
const port = Number(process.env.PORT || 3000);
const staticFiles = {
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/favicon.svg': ['favicon.svg', 'image/svg+xml']
};

export const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url || '/', 'http://localhost').pathname;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }
  if (pathname === '/api/status') {
    const body = JSON.stringify(await getBotData());
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : body);
    return;
  }
  if (pathname === '/api/bot-status') {
    const body = JSON.stringify(await getBotStatus());
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : body);
    return;
  }
  if (pathname === '/bot-avatar' || pathname === '/favicon.ico') {
    const data = await getBotData();
    response.writeHead(302, {
      Location: data.bot?.avatarUrl || '/favicon.svg',
      'Cache-Control': 'no-cache'
    });
    response.end();
    return;
  }
  const isPage = ['/', '/privacy', '/terms', '/support'].includes(pathname);
  const file = isPage ? ['index.html', 'text/html; charset=utf-8'] : staticFiles[pathname];
  if (!file) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  try {
    const body = await readFile(path.join(publicDir, file[0]));
    response.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-cache' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(500);
    response.end('Unable to load page');
  }
});

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  server.listen(port, () => console.log(`DEVIL BOT website running at http://localhost:${port}`));
}
