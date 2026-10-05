# 🤖 24/7 Minecraft AFK Bot (GitHub Actions & Mineflayer)

A robust, cloud-ready Minecraft Java AFK Bot powered by [Mineflayer](https://github.com/PrismarineJS/mineflayer). Engineered to run automatically 24/7 via **GitHub Actions** or locally, stay online as long as possible, avoid AFK kicks, and automatically reconnect after **1 minute** if disconnected or if the server goes offline.

Pre-configured to join **`coldhot.aternos.me:50668`** (Minecraft **`26.1.2`**).

---

## ✨ Features

- **🚀 GitHub Actions Powered**: Run 24/7 without needing your own server, VPS, or keeping your computer on.
- **🔄 Instant Auto-Reconnect**: If the server goes offline, restarts, or the bot is kicked/disconnected, it immediately reconnects to get back online as fast as possible.
- **⏳ Longest Possible Uptime**: Handles GitHub Actions' 6-hour runner limit with graceful runner rotation and scheduled cron triggers (`0 */5 * * *`).
- **🛡️ Concurrency Safeguard**: Prevents multiple bot instances with the same username from colliding and kicking each other out.
- **🏃 Smart Anti-AFK Routine**: Natural head rotation and periodic arm swings to safely evade AFK kick plugins.
- **💀 Instant Auto-Respawn**: Automatically respawns immediately upon death if killed by mobs or hazards.
- **🔐 AuthMe Support**: Optional `/register` and `/login` automated execution for offline/cracked servers.
- **⚙️ Dual Configuration**: Configure via `config.json` or seamlessly through GitHub Secrets / Environment Variables.

---

## 🚀 Setting Up on GitHub Actions

### 1. Push or Fork this Repository to GitHub

Ensure all files (including `.github/workflows/afk-bot.yml`, `bot.js`, `package.json`, and `config.json`) are committed to your GitHub repository on `main` or `master`.

### 2. (Optional) Configure Repository Secrets

If you want to customize values without modifying code or protect sensitive data (e.g., in-game passwords), go to your GitHub repository:
**Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Secret Name | Description | Default if omitted |
|-------------|-------------|--------------------|
| `SERVER_HOST` | Server host / address | `coldhot.aternos.me` |
| `SERVER_PORT` | Server port | `50668` |
| `BOT_USERNAME` | Bot in-game username | `ShadowCrafter` |
| `BOT_VERSION` | Minecraft version | `26.1.2` |
| `AUTH_PASSWORD` | In-game password for `/login` & `/register` | *(None)* |
| `PAT_TOKEN` | Personal Access Token (`actions:write`) for instant re-dispatch | *(Uses GITHUB_TOKEN / Cron)* |

### 3. Enable Workflows and Run

1. Go to the **Actions** tab in your GitHub repository.
2. If prompted, click **"I understand my workflows, go ahead and enable them"**.
3. Select **"Minecraft AFK Bot"** from the left sidebar.
4. Click **Run workflow** (you can optionally override the host, port, username, or version in the modal).
5. The bot will automatically start and stay online! The workflow also runs on a scheduled cron (`0 */5 * * *`) to maintain continuous uptime.

---

## 💻 Running Locally

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Settings

Edit [`config.json`](config.json):

```json
{
  "serverHost": "coldhot.aternos.me",
  "serverPort": 50668,
  "botUsername": "ShadowCrafter",
  "botVersion": "26.1.2",
  "botChunk": 2,
  "reconnectDelayMs": 1000,
  "authPassword": ""
}
```

### 3. Start the Bot

```bash
npm start
```

Or:

```bash
node bot.js
```

---

## ⚙️ Configuration Reference

| Option | Env Variable | Default | Description |
|---|---|---|---|
| `serverHost` | `SERVER_HOST` | `coldhot.aternos.me` | Server IP or hostname |
| `serverPort` | `SERVER_PORT` | `50668` | Minecraft server port |
| `botUsername` | `BOT_USERNAME` | `ShadowCrafter` | Display name of the bot |
| `botVersion` | `BOT_VERSION` | `26.1.2` | Minecraft version (e.g. `26.1.2`) |
| `reconnectDelayMs` | `RECONNECT_DELAY_MS` | `1000` | Reconnect cooldown (1000ms = 1s instant) |
| `botChunk` | `BOT_CHUNK` | `2` | View distance chunk radius |
| `authPassword` | `AUTH_PASSWORD` | `""` | Password sent to `/register` and `/login` |
| `maxRunTimeMinutes` | `MAX_RUN_TIME_MINUTES` | `345` | Minutes to run before clean exit in GH Actions |

---

## 🔄 How the Auto-Reconnect Works

1. When the server drops, restarts, or kicks the bot, Mineflayer detects the disconnection (`kicked`, `error`, or `end` event).
2. The bot logs the event:
   ```
   [RECONNECT] Server or connection went offline (Disconnected). Reconnecting immediately (1s)...
   ```
3. All previous listeners and intervals are cleanly reset.
4. The bot immediately attempts to reconnect to `coldhot.aternos.me:50668`. If the server is still offline, it retries immediately until the server is back online.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
