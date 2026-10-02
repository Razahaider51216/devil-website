# DEVIL BOT website

A responsive Discord bot homepage with live bot details and member counts for every joined server, Thai legal pages, and a saved blue light/dark theme preference. The bot token is used only by the Node server.

## Run locally

1. Copy `.env.example` to `.env`.
2. Set `DISCORD_BOT_TOKEN` to your bot token and `DISCORD_INVITE_URL` to a permanent server invite. `DISCORD_GUILD_ID` is optional and chooses the server featured in the homepage snapshot; without it, the first joined server is featured.
3. Run `npm start` and open `http://localhost:3000`.

Node.js 20 or newer is required. No package installation is needed.

The server requests the current bot user and every joined guild from Discord's REST API, following result pages when needed. Guild member and online values come from Discord's approximate counts, refresh at most once a minute, and can differ from the Discord client. When configuration is missing or Discord is unavailable, the page shows an unavailable state instead of invented numbers.

Before publishing, review the Privacy Policy and Terms of Service against the bot's actual behavior and add your own support contact if needed.
