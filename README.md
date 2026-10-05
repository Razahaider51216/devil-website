# DEVIL BOT website

A Thai Discord portal with separate Public and VIP command catalogs, categorized communities, live Owner profiles, Discord OAuth login, a server dashboard, and an Owner CMS. Private commands are excluded. Existing support, privacy and terms pages remain available. Secrets are used only on the server.

## New portal setup

### ตั้งค่า Owner

เปิด Discord → User Settings → Advanced → Developer Mode แล้วคลิกขวาที่บัญชีที่ต้องการและเลือก Copy User ID ([คู่มือ Discord](https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID)) ใช้ User ID ของบัญชี ไม่ใช่ชื่อผู้ใช้, Server ID หรือ Application ID

ใส่ใน `.env` ของเว็บและ `.env` ของบอท Public ด้วยค่าเดียวกัน:

```dotenv
OWNER_IDS=123456789012345678
# หลายคน: OWNER_IDS=123456789012345678,987654321098765432
```

ถ้าเว็บอยู่บน Vercel ให้เพิ่ม `OWNER_IDS` ใน Project Settings → Environment Variables และ redeploy ด้วย หลังแก้ `.env` ให้รีสตาร์ตเว็บที่รันในเครื่องและบอท ค่าเหล่านี้กำหนดทั้งการ์ด Owner และสิทธิ์หลังบ้าน `/admin` การ์ดแสดงรูปกับกรอบโปรไฟล์และมงกุฎที่วาดเอง โดยไม่แสดง banner ของ Discord

### Interface

The interface uses original SVG icons in `public/icons.js`, while the website logo and favicon use your existing Discord bot avatar; no icon library or external icon font is loaded. Owner crowns and the VIP insignia are separate drawings. The server directory fetches Discord independently from OAuth and the CMS, supports retry, and can show the featured guild if the full list is temporarily unavailable. Previously fetched guild lists are marked stale on a temporary Discord failure.

บนมือถือ ปุ่มสามขีดเปิดเมนูเลื่อนจากด้านขวา พร้อมไอคอนและคำอธิบายแต่ละหมวด ปิดด้วยปุ่มปิด พื้นหลัง หรือ Escape ได้ เมนู Owner แสดงเฉพาะบัญชี Owner และตัวแนะนำการใช้งานจะเปิดเมนูเพื่อไฮไลต์หมวดที่อธิบาย การ์ด Owner หน้าแรกใช้เต็มความกว้างเพื่อไม่เหลือพื้นที่ว่างด้านข้างเมื่อมี Owner คนเดียว

หน้าแรกแสดง Owner ก่อน THE COMMUNITY TOOLKIT ปุ่มเชิญบอทบนหน้าแรกและเมนูใช้ `DISCORD_CLIENT_ID` เพื่อเปิดหน้าเชิญใน Discord ตัวแนะนำการใช้งานจะเปิดเมื่อเข้าเว็บครั้งแรก มีไฮไลต์จุดที่แนะนำ ปุ่มย้อนกลับ/ถัดไป/ข้ามทั้งหมด และตกลงเมื่อจบ โดยจำการดูหรือข้ามไว้ในเบราว์เซอร์ เปิดซ้ำได้ที่ปุ่ม “แนะนำการใช้งาน” ท้ายเว็บ ตัวแนะนำไม่ส่งคำสั่งหรือเปลี่ยนการตั้งค่าบอท

The frontend and APIs are in this repository. The dashboard runs next to the **public** Devil bot so configuration changes update the bot's live in-memory data through its existing `saveData()` function. Do not write directly to `data-public.json` from the website: the running bot could overwrite it. Website content and audit records persist in `website-content.json` on the bot host, rather than an ephemeral Vercel filesystem.

1. Run `npm ci` in the website folder. Copy `.env.example` to `.env` if needed and keep your existing bot token.
2. Set `DISCORD_CLIENT_ID` to the **public** bot application ID and `DISCORD_CLIENT_SECRET` to its OAuth2 client secret. Set `APP_URL` to the exact website origin without a trailing slash (for local development: `http://localhost:3000`).
3. In the Discord Developer Portal, add the exact redirect URL: `http://localhost:3000/api/portal?action=callback` locally, and `https://YOUR-DOMAIN/api/portal?action=callback` in production. Login requests only `identify` and `guilds` scopes.
4. Set `SESSION_SECRET` to at least 32 random characters. Set `OWNER_IDS` to comma-separated Discord **user IDs**. These IDs control both homepage cards and CMS access. Never paste tokens into website forms.
5. Set `BOT_DASHBOARD_SECRET` to a separate random secret of at least 32 characters. Use the **same value** in website and public-bot environments. Configure `OWNER_IDS` identically on both sides. Add the bot environment keys from `bot-integration/.env.example` without overwriting existing bot settings.
6. Install the bridge with `npm run install:bot -- "C:\Users\Administrator\Documents\Devil"`. This copies the bridge and settings schema, backs up `index.js` and `verify-system.js` on first installation, adds the dashboard hook, and exposes the existing Verify publisher. Re-running updates the hook. Restart the public bot using your existing process manager; installing files does not restart it.
7. For local hosting use `BOT_DASHBOARD_API_URL=http://127.0.0.1:8788/dashboard`. For Vercel expose `/dashboard` over HTTPS using the example in `bot-integration/Caddyfile.example`, and set `BOT_DASHBOARD_API_URL=https://YOUR-BOT-HOST/dashboard`. Preserve the client's Authorization header; do **not** reuse the health endpoint's secret-injection behavior for this route.
8. Run `npm start`. In production set all website environment variables in Vercel, including `APP_URL`, then redeploy. Local `.env` values are not uploaded by Git.

`npm run sync:catalog -- "C:\Users\Administrator\Documents\Devil"` re-extracts all command names, descriptions, options and public scope restrictions from the actual command builders. The VIP list comes from `PREMIUM_SHOP_COMMANDS` in `shop.js`: `setbuy`, `set-shop`, `shop`. Run this after bot command changes, then run `install:bot` when the settings schema changes.

### Dashboard and CMS behavior

Only servers the logged-in user can manage appear in the picker. The website verifies Discord guild permissions on each read/write; the bridge independently fetches the member and checks permissions again. The bot must be a member. Welcome and Ticket accept Manage Server; the other systems require Administrator. VIP Shop uses the bot's existing `PREMIUM_GUILD_IDS` / `PREMIUM_SERVER_IDS` allowlist. Chat and Discord announcements remain restricted to their configured guilds.

The dashboard supports Welcome/Goodbye, Ticket text/buttons/automatic replies, spam filtering with channel/category selects and punishment settings, Rank/XP/role rewards, shop schedules, script-search channels, Verify panels/roles, Verify-not channels, province panels, Giveaway creation, VIP products/payments/purchase channels, and restricted Chat/announcement settings. Use **Save and publish** to create or update Discord panels. A failed publish reports that the settings were saved, together with the publish error; it never claims a panel succeeded when Discord rejected it. Changes are checked against the version read from the bot; reload after a conflict.

The Owner CMS creates, edits, removes and publishes feature cards (text/image/command), website update posts, and server categories. Drafts are excluded from the public content API. Deleted entries are removed when Save all succeeds; edits before saving are local to the page. The bot host stores a bounded audit log. Owner IDs and credentials are environment configuration, not editable through public endpoints.

หน้า `/admin` มีปุ่ม **คำสั่ง Owner** ไปที่ `/owner` ใช้ `/announe-panel` ส่งประกาศใหม่หรือแก้ไขประกาศล่าสุดในช่องที่เลือก, `/setstaus` ตั้งสถานะจำนวนเซิร์ฟเวอร์/สมาชิกหรือข้อความกำหนดเอง และ `/reload` โหลดระบบที่อนุญาตหรือ `.env` ตามโค้ดบอท Public คำสั่งเหล่านี้ใช้เฉพาะบัญชีใน `OWNER_IDS` ที่มีสิทธิ์ Administrator ในเซิร์ฟเวอร์หลัก (`PUBLIC_MAIN_GUILD_ID`) และบอทต้องอยู่ในเซิร์ฟเวอร์ด้วย ต้องติดตั้งตัวเชื่อมเวอร์ชันใหม่ด้วย `npm run install:bot` และรีสตาร์ตบอท Public หนึ่งครั้งก่อนใช้งาน การส่งประกาศต้องมีสิทธิ์ส่งข้อความและสิทธิ์ Mention Everyone เมื่อเลือก `@everyone` ระบบเก็บประวัติคำสั่งในหลังบ้านและป้องกันการส่งซ้ำเมื่อ retry คำขอเดิม ไม่มีการเรียกคำสั่ง Owner จาก API สาธารณะ

Owner avatars, banners and avatar decorations are rendered only when returned by Discord's [official User API](https://docs.discord.com/developers/resources/user). Unsupported profile effects are not fabricated. Login follows Discord's [OAuth2 authorization code flow](https://docs.discord.com/developers/topics/oauth2), uses a short-lived state cookie, and stores the access token in an encrypted HttpOnly session cookie (maximum one hour). All mutations require an origin check and session CSRF token. Logout removes the browser session; an already copied cookie remains valid until its short expiry or until `SESSION_SECRET` rotates.

Run `npm test` to check OAuth state/session protection, role and guild access, VIP enforcement, live bot writes, stale configuration rejection, publish failures, CMS persistence, catalog filtering, and interactive DOM behavior. Full Discord OAuth and live panel publication require real environment credentials and a running bot. Browser visual QA requires an available Browser connection.

## Run locally

1. Copy `.env.example` to `.env`.
2. Set `DISCORD_BOT_TOKEN` to your bot token and `DISCORD_INVITE_URL` to a permanent server invite. `DISCORD_GUILD_ID` is optional and chooses the server featured in the homepage snapshot; without it, the first joined server is featured.
3. Run `npm start` and open `http://localhost:3000`.

Node.js 20 or newer is required. Runtime code uses Node built-ins; `npm ci` installs the DOM test dependency.

## Deploy on Vercel

Connect this repository to Vercel. The static pages are served from `public`, while `api/status.js` and `api/bot-avatar.js` run as Vercel Functions. Add `DISCORD_BOT_TOKEN`, `DISCORD_INVITE_URL`, and optionally `DISCORD_GUILD_ID` in the Vercel project's Environment Variables for Production, then redeploy. Values in your local `.env` are not copied to Vercel.

The server requests the current bot user and every joined guild from Discord's REST API, following result pages when needed. Guild member and online values come from Discord's approximate counts, refresh at most once a minute, and can differ from the Discord client. When configuration is missing or Discord is unavailable, the page shows an unavailable state instead of invented numbers.

## Bot online status

The homepage calls `GET /api/bot-status` on this website every 10 seconds. The Vercel Function requests `https://82-26-104-147.sslip.io/health` over HTTPS. That endpoint is served by Caddy on the VPS and reads `client.isReady()` from the running `Devilv2` process. The Vercel Function returns `{ "online": false, "status": "offline", "ping": null }` if the VPS, HTTPS endpoint, or Discord client is unavailable. The browser never receives a bot token or status secret. No CORS configuration is needed because the browser calls its own origin.

`BOT_STATUS_API_URL` in Vercel is optional while the VPS uses this address. Set it if the status hostname or VPS IP changes. `BOT_STATUS_SECRET` is optional for the website's proxy and should only be set if the upstream requires Vercel authentication. The current VPS Caddy proxy injects the secret when it forwards to the loopback health server. Do not put either bot token or status secret in `public/`.

The VPS uses Caddy with a free `sslip.io` hostname and automatically managed TLS certificate. Caddy listens on public TCP ports 80 and 443, then proxies only `/health` to `127.0.0.1:8787`. The bot's health server only listens on loopback and requires `BOT_STATUS_SECRET` in the bot's `.env`. Caddy and the bot must be running for the badge to show online. Restart the public bot with `pm2 restart Devilv2`; restart HTTPS with `Restart-Service DevilStatusTLS` on Windows. Test `https://82-26-104-147.sslip.io/health` and `https://devil-website-amber.vercel.app/api/bot-status`. Stopping `Devilv2` should change the second response to offline, and restarting it should restore online.

Before publishing, review the Privacy Policy and Terms of Service against the bot's actual behavior and add your own support contact if needed.

## Feature previews from configured Discord channels

In `/admin`, open **ฟีเจอร์**, add or edit a feature, and select **ตัวอย่างโต้ตอบจากระบบ Discord**. Choose the source server, system (Welcome, Ticket, Verify or VIP Shop), and a configured channel. Click **โหลดตัวอย่างจากบอท**, check the result, then **บันทึกฟีเจอร์นี้**. This saves only that feature, even when another draft is incomplete. Enable **เผยแพร่บนเว็บ** to display it publicly. Use **ไม่แสดงรูปในตัวอย่างนี้** to remove Discord preview images; clearing the image URL saves an empty value in image mode. **บันทึกทั้งหมด** remains available for bulk edits and removing entire records.

Previews copy the bot's published message: Markdown, embeds and fields, V2 containers/sections/media, buttons, emoji, select menus and image attachments. Supported actions run locally as demonstrations. The bridge refreshes expired Discord attachment URLs from accessible source messages and stores image bytes beside its CMS content in `website-preview-images`; back up this directory with `website-content.json`. If an original attachment has been deleted permanently, replace it in Discord and reload the example. Install the bridge with `npm run install:bot` and restart the public bot after updating these modules.

The source picker requires a website Owner who also manages the source server and can view the channel. Saving rebuilds a display-only snapshot from the bot's stored configuration. Public data excludes source IDs, payment accounts, orders and member records. Preview buttons simulate actions locally. Published snapshots remain stable until the Owner saves again; editing a Discord panel does not automatically republish its contents to the website.

Deploy the updated bridge with `npm run install:bot` and restart `Devilv2` after updating its files. The source module is `bot-integration/website-feature-previews.cjs`; it reads configured panel channels and does not scrape arbitrary messages.
