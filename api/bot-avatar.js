import { getBotData } from '../lib/discord.js';

export default async function handler(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }
  try {
    const data = await getBotData();
    response.writeHead(302, { Location: data.bot?.avatarUrl || '/favicon.svg', 'Cache-Control': 'no-cache' });
  } catch (error) {
    console.error('Bot avatar function failed:', error);
    response.writeHead(302, { Location: '/favicon.svg', 'Cache-Control': 'no-cache' });
  }
  response.end();
}
