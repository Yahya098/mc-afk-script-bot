/**
 * Minecraft 24/7 AFK Bot
 * Designed for standard and GitHub Actions environments.
 * Automatically connects to the server, avoids AFK detection,
 * and reconnects after 1 minute if disconnected or if the server goes offline.
 */

const mineflayer = require('mineflayer');
const fs = require('fs');
const path = require('path');

// Load config.json if available
let fileConfig = {};
const configPath = path.resolve(__dirname, 'config.json');
if (fs.existsSync(configPath)) {
  try {
    fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    console.warn(`[WARN] Could not parse config.json, using defaults: ${err.message}`);
  }
}

// Configuration options with environment variable overrides
const CONFIG = {
  host: process.env.SERVER_HOST || fileConfig.serverHost || 'coldhot.aternos.me',
  port: parseInt(process.env.SERVER_PORT || fileConfig.serverPort || '50668', 10),
  username: process.env.BOT_USERNAME || fileConfig.botUsername || 'ShadowCrafter',
  version: process.env.BOT_VERSION || fileConfig.botVersion || '26.1.2',
  auth: process.env.BOT_AUTH || fileConfig.botAuth || 'offline',
  viewDistance: parseInt(process.env.BOT_CHUNK || fileConfig.botChunk || '2', 10),
  reconnectDelayMs: parseInt(process.env.RECONNECT_DELAY_MS || fileConfig.reconnectDelayMs || '60000', 10),
  authPassword: process.env.AUTH_PASSWORD || fileConfig.authPassword || '',
  maxRunTimeMinutes: parseInt(process.env.MAX_RUN_TIME_MINUTES || fileConfig.maxRunTimeMinutes || '345', 10),
};

function getTimestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function log(level, message) {
  console.log(`[${getTimestamp()}] [${level}] ${message}`);
}

let bot = null;
let isReconnecting = false;
let reconnectTimer = null;
let antiAfkInterval = null;
let isShuttingDown = false;

/**
 * Clears any active movement or AFK intervals
 */
function stopAfkActivity() {
  if (antiAfkInterval) {
    clearInterval(antiAfkInterval);
    antiAfkInterval = null;
  }
}

/**
 * Safe Anti-AFK routine:
 * Rotates view smoothly and swings arm periodically.
 * Does NOT move XYZ coordinates or jump, preventing 'invalid_player_movement' kicks.
 */
function startAfkActivity() {
  stopAfkActivity();

  if (!bot || !bot.entity) return;

  antiAfkInterval = setInterval(() => {
    if (!bot || !bot.entity) return;

    try {
      // Natural slight head rotation (evades AFK checks without moving coordinates)
      const currentYaw = bot.entity.yaw || 0;
      const currentPitch = bot.entity.pitch || 0;
      const newYaw = currentYaw + (Math.random() * 0.6 - 0.3);
      const newPitch = Math.max(-0.4, Math.min(0.4, currentPitch + (Math.random() * 0.2 - 0.1)));
      bot.look(newYaw, newPitch, true).catch(() => {});

      // Periodic arm swing animation
      if (Math.random() > 0.3) {
        bot.swingArm('right');
      }
    } catch (err) {
      log('DEBUG', `AFK routine tick error: ${err.message}`);
    }
  }, 3500);
}

/**
 * Schedules a reconnection attempt after the configured delay (default 60 seconds)
 */
function scheduleReconnect(reason) {
  if (isShuttingDown || isReconnecting) return;
  isReconnecting = true;

  stopAfkActivity();

  if (bot) {
    try {
      bot.removeAllListeners();
      bot.end();
    } catch (_) {}
    bot = null;
  }

  const delaySec = Math.round(CONFIG.reconnectDelayMs / 1000);
  log('RECONNECT', `Server or connection went offline (${reason}). Waiting ${delaySec} seconds before reconnecting...`);

  if (reconnectTimer) clearTimeout(reconnectTimer);

  reconnectTimer = setTimeout(() => {
    isReconnecting = false;
    log('RECONNECT', 'Attempting to reconnect now...');
    createBot();
  }, CONFIG.reconnectDelayMs);
}

/**
 * Initializes and connects the Mineflayer bot
 */
function createBot() {
  if (isShuttingDown) return;

  log('INFO', `Connecting to Minecraft server: ${CONFIG.host}:${CONFIG.port} as '${CONFIG.username}' (MC ${CONFIG.version})...`);

  try {
    bot = mineflayer.createBot({
      host: CONFIG.host,
      port: CONFIG.port,
      username: CONFIG.username,
      version: CONFIG.version || undefined,
      auth: CONFIG.auth,
      viewDistance: CONFIG.viewDistance,
      checkTimeoutInterval: 45000,
    });
  } catch (err) {
    log('ERROR', `Failed to initialize bot: ${err.message}`);
    scheduleReconnect(`Initialization error: ${err.message}`);
    return;
  }

  // Protocol Fix for modern MC (1.21.3+ / 26.x):
  // Servers kick clients that send redundant stationary 'position' packets every 1000ms.
  // We intercept and convert stationary position packets into standard 'flying' packets.
  let hasSpawned = false;
  let lastX = null, lastY = null, lastZ = null;

  const originalWrite = bot._client.write.bind(bot._client);
  bot._client.write = function(name, params) {
    if (hasSpawned && (name === 'position' || name === 'position_look')) {
      if (lastX !== null && params.x === lastX && params.y === lastY && params.z === lastZ) {
        return originalWrite('flying', {
          onGround: params.flags ? params.flags.onGround : (params.onGround ?? true),
          flags: params.flags || { onGround: true }
        });
      }
      lastX = params.x;
      lastY = params.y;
      lastZ = params.z;
    }
    return originalWrite(name, params);
  };

  bot.once('login', () => {
    log('SUCCESS', `Bot '${CONFIG.username}' has successfully logged into ${CONFIG.host}:${CONFIG.port}!`);
  });

  bot.on('spawn', () => {
    hasSpawned = true;
    if (bot.entity && bot.entity.position) {
      lastX = bot.entity.position.x;
      lastY = bot.entity.position.y;
      lastZ = bot.entity.position.z;
    }

    log('SUCCESS', `Bot spawned in world! Starting anti-AFK activity.`);

    // If server requires AuthMe /login or /register
    if (CONFIG.authPassword) {
      setTimeout(() => {
        if (!bot) return;
        log('AUTH', 'Sending authentication commands (/register and /login)...');
        bot.chat(`/register ${CONFIG.authPassword} ${CONFIG.authPassword}`);
        setTimeout(() => {
          if (bot) bot.chat(`/login ${CONFIG.authPassword}`);
        }, 1500);
      }, 2000);
    }

    startAfkActivity();
  });

  bot.on('death', () => {
    log('WARN', 'Bot died in-game. Respawning in 2 seconds...');
    stopAfkActivity();
    setTimeout(() => {
      if (bot) {
        try {
          bot.respawn();
          log('INFO', 'Bot respawn triggered.');
          startAfkActivity();
        } catch (err) {
          log('ERROR', `Respawn failed: ${err.message}`);
        }
      }
    }, 2000);
  });

  bot.on('kicked', (reason) => {
    let reasonText = reason;
    try {
      reasonText = typeof reason === 'object' ? JSON.stringify(reason) : reason;
    } catch (_) {}
    log('WARN', `Kicked from server: ${reasonText}`);
    scheduleReconnect(`Kicked: ${reasonText}`);
  });

  bot.on('error', (err) => {
    log('ERROR', `Socket / Connection error: ${err.message}`);
    scheduleReconnect(`Error: ${err.message}`);
  });

  bot.on('end', (reason) => {
    log('WARN', `Disconnected from server (${reason || 'Connection closed'}).`);
    scheduleReconnect(reason || 'Disconnected');
  });

  bot.on('message', (message) => {
    const text = message.toString().trim();
    if (text) {
      log('CHAT', text);
    }
  });
}

// Graceful termination handling (e.g. for GitHub Actions runner cancellation or manual stop)
function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  log('INFO', `Received ${signal}. Shutting down bot gracefully...`);

  if (reconnectTimer) clearTimeout(reconnectTimer);
  stopAfkActivity();

  if (bot) {
    try {
      bot.quit('Bot shutting down');
    } catch (_) {}
  }

  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Prevent unhandled errors from terminating the Node process
process.on('uncaughtException', (err) => {
  log('ERROR', `Uncaught Exception: ${err.message}\n${err.stack}`);
  scheduleReconnect(`Uncaught Exception: ${err.message}`);
});

process.on('unhandledRejection', (reason) => {
  log('ERROR', `Unhandled Rejection: ${reason}`);
  scheduleReconnect(`Unhandled Rejection`);
});

// GitHub Actions runner timeout handler:
// Standard GitHub Actions jobs have a 6-hour (360 minutes) hard execution limit.
// We gracefully exit before reaching the limit (e.g. 345 mins) so that GitHub Actions
// can finish cleanly and trigger or be triggered by the next scheduled run.
if (process.env.GITHUB_ACTIONS === 'true' && CONFIG.maxRunTimeMinutes > 0) {
  const maxMs = CONFIG.maxRunTimeMinutes * 60 * 1000;
  log('INFO', `GitHub Actions environment detected. Runner will run for up to ${CONFIG.maxRunTimeMinutes} minutes before clean rotation.`);
  setTimeout(() => {
    log('INFO', `Max run time (${CONFIG.maxRunTimeMinutes} mins) reached. Exiting cleanly for next GitHub Actions run.`);
    shutdown('MAX_RUN_TIME');
  }, maxMs);
}

// Start the bot
createBot();
