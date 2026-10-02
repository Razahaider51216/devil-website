# DEVIL BOT website

A responsive Discord bot homepage with live bot details and member counts for every joined server, Thai legal pages, and a saved blue light/dark theme preference. The bot token is used only by the Node server.

## Run locally

1. Copy `.env.example` to `.env`.
2. Set `DISCORD_BOT_TOKEN` to your bot token and `DISCORD_INVITE_URL` to a permanent server invite. `DISCORD_GUILD_ID` is optional and chooses the server featured in the homepage snapshot; without it, the first joined server is featured.
3. Run `npm start` and open `http://localhost:3000`.

Node.js 20 or newer is required. No package installation is needed.

## Deploy on Vercel

Connect this repository to Vercel. The static pages are served from `public`, while `api/status.js` and `api/bot-avatar.js` run as Vercel Functions. Add `DISCORD_BOT_TOKEN`, `DISCORD_INVITE_URL`, and optionally `DISCORD_GUILD_ID` in the Vercel project's Environment Variables for Production, then redeploy. Values in your local `.env` are not copied to Vercel.

The server requests the current bot user and every joined guild from Discord's REST API, following result pages when needed. Guild member and online values come from Discord's approximate counts, refresh at most once a minute, and can differ from the Discord client. When configuration is missing or Discord is unavailable, the page shows an unavailable state instead of invented numbers.

## Bot online status

The homepage calls `GET /api/bot-status` on this website every 10 seconds. The Vercel Function requests `https://82-26-104-147.sslip.io/health` over HTTPS. That endpoint is served by Caddy on the VPS and reads `client.isReady()` from the running `Devilv2` process. The Vercel Function returns `{ "online": false, "status": "offline", "ping": null }` if the VPS, HTTPS endpoint, or Discord client is unavailable. The browser never receives a bot token or status secret. No CORS configuration is needed because the browser calls its own origin.

`BOT_STATUS_API_URL` in Vercel is optional while the VPS uses this address. Set it if the status hostname or VPS IP changes. `BOT_STATUS_SECRET` is optional for the website's proxy and should only be set if the upstream requires Vercel authentication. The current VPS Caddy proxy injects the secret when it forwards to the loopback health server. Do not put either bot token or status secret in `public/`.

The VPS uses Caddy with a free `sslip.io` hostname and automatically managed TLS certificate. Caddy listens on public TCP ports 80 and 443, then proxies only `/health` to `127.0.0.1:8787`. The bot's health server only listens on loopback and requires `BOT_STATUS_SECRET` in the bot's `.env`. Caddy and the bot must be running for the badge to show online. Restart the public bot with `pm2 restart Devilv2`; restart HTTPS with `Restart-Service DevilStatusTLS` on Windows. Test `https://82-26-104-147.sslip.io/health` and `https://devil-website-amber.vercel.app/api/bot-status`. Stopping `Devilv2` should change the second response to offline, and restarting it should restore online.

Before publishing, review the Privacy Policy and Terms of Service against the bot's actual behavior and add your own support contact if needed.
