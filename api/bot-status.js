import { getBotStatus } from '../lib/bot-status.js';

export default async function handler(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }
  const body = JSON.stringify(await getBotStatus());
  response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(request.method === 'HEAD' ? undefined : body);
}
