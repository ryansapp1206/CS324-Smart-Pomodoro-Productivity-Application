/* =====================================================================
   SERVICES (start-up and wiring)
   Things that run alongside the screens:
     timer-service.js   the timer and session end
     session-queue.js   saving finished sessions, with retry
     reminders.js       deadline and daily reminders
     notify.js          notifications, tab title
     sound.js           playSound(event): every sound effect goes through here
     ../sync/engine.js  pairing and syncing with your other devices (LAN)

   Website: they run inside the page, while it's open.
   Extension: they run in the extension's background
   (src/extension/background.js calls startBackgroundServices()), so the
   timer, alerts and reminders work with the popup closed. The screens'
   timer commands are sent to the background as messages; the screens
   still hear every change through storage, exactly as on the website.
   ===================================================================== */

import { storage, STORAGE_KEYS } from '../core/storage.js';
import { ext, IS_EXTENSION } from '../core/platform.js';
import * as timerService from './timer-service.js';
import * as sessionQueue from './session-queue.js';
import { checkDeadlines, scheduleDailyReminder, scheduleDeadlineChecks, stopReminders } from './reminders.js';
import { scheduler } from '../core/scheduler.js';
import { SYNC_COMMANDS } from '../sync/engine.js';

const SYNC_CHECK_MS = 30000;

export { requestNotificationPermission } from './notify.js';
export { playSound, setSoundOutput } from './sound.js';
export { onSettingsLoaded, setUiVisibility } from './context.js';

/* ----------------------- Calls the screens make ----------------------- */

/** Extension pages: run a service call in the background and return its result. */
async function inBackground(type, payload = {}) {
  const reply = await ext.runtime.sendMessage({ target: 'background', type, ...payload });
  if (!reply) throw new Error(`No reply from the background for "${type}"`);
  if (!reply.ok) throw Object.assign(new Error(reply.error.message), reply.error);
  return reply.value;
}

/** command: start | pause | resume | stop | reset | switchMode | setTask | clear (+ setSpeed, endNow). Returns the new timer. */
export function handleTimerCommand(command, arg) {
  if (IS_EXTENSION) return inBackground('timerCommand', { command, arg });
  return timerService.handleTimerCommand(command, arg);
}

export function checkSessionEnd() {
  if (IS_EXTENSION) return inBackground('checkSessionEnd');
  return timerService.checkSessionEnd();
}

export function flushPendingSessions() {
  if (IS_EXTENSION) return inBackground('flushPendingSessions');
  return sessionQueue.flushPendingSessions();
}

/** Device sync: command is a name in SYNC_COMMANDS (src/sync/engine.js). */
export function syncCommand(command, ...args) {
  if (IS_EXTENSION) return inBackground('syncCommand', { command, args });
  return runSyncCommand(command, args);
}

function runSyncCommand(command, args = []) {
  const run = SYNC_COMMANDS[command];
  if (!run) throw new Error(`Unknown sync command "${command}"`);
  return run(...args);
}

/** What the background answers (src/extension/background.js). */
export const BACKGROUND_CALLS = {
  timerCommand: ({ command, arg }) => timerService.handleTimerCommand(command, arg),
  checkSessionEnd: () => timerService.checkSessionEnd(),
  flushPendingSessions: () => sessionQueue.flushPendingSessions(),
  syncCommand: ({ command, args }) => runSyncCommand(command, args),
};

/* ---------------------------- Device sync ---------------------------- */

scheduler.define('syncCheck', () => SYNC_COMMANDS.tick());

/* ------------------------------ Start-up ------------------------------ */

/** The part that's the same on the website and in the extension's background. */
function startCore() {
  timerService.checkSessionEnd(); // a session may have ended while nothing was running
  sessionQueue.flushPendingSessions();
  scheduleDeadlineChecks();
  checkDeadlines();
  scheduleDailyReminder();
  // Device sync: check in with the local sync service (pairing requests, changes from other devices).
  scheduler.every('syncCheck', SYNC_CHECK_MS);
  SYNC_COMMANDS.tick().catch(() => {});

  // Settings saved: the daily reminder time may have changed.
  storage.onChange(STORAGE_KEYS.settings, () => scheduleDailyReminder());

  // Signed in: start reminders. Logged out: clear everything that belongs to the account.
  storage.onChange(STORAGE_KEYS.auth, async (auth) => {
    if (auth) {
      scheduleDeadlineChecks();
      scheduleDailyReminder();
      sessionQueue.flushPendingSessions();
      SYNC_COMMANDS.tick().catch(() => {});
      return;
    }
    stopReminders();
    await timerService.handleTimerCommand('clear');
    await storage.remove(STORAGE_KEYS.pendingSessions);
    await storage.remove(STORAGE_KEYS.settings);
    await storage.remove(STORAGE_KEYS.alert);
    SYNC_COMMANDS.cancelPairing().catch(() => {});
  });

  globalThis.addEventListener?.('online', () => sessionQueue.flushPendingSessions());
}

/** Call once when the page loads. */
export function startServices() {
  if (IS_EXTENSION) connectToBackground();
  else startCore();
  // Browsers slow down timers in background tabs, so check again when the tab comes back.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkSessionEnd().catch(() => {});
  });
}

/** Extension background only. */
export function startBackgroundServices() {
  startCore();
}

/**
 * Extension pages: keep a connection open so the background knows the app
 * is on screen (it then skips the notification, since the session-complete
 * card shows instead). Reconnects if the background restarts.
 */
function connectToBackground() {
  const port = ext.runtime.connect({ name: 'ui' });
  const report = () => port.postMessage({ visible: !document.hidden });
  report();
  document.addEventListener('visibilitychange', report);
  port.onDisconnect.addListener(() => {
    document.removeEventListener('visibilitychange', report);
    setTimeout(connectToBackground, 1000);
  });
}
