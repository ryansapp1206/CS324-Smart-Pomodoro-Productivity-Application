/* =====================================================================
   EXTENSION BACKGROUND
   Runs the services (src/services/) for the extension, so the timer,
   session-end alerts, sounds and reminders work with the popup closed.
     Chrome / Edge / Brave: a service worker (no page, no audio: sounds
                            play through offscreen.html)
     Firefox:               a background page (plays audio itself)
   Both are put to sleep when idle; browser alarms (src/core/scheduler.js)
   wake them for the session end and the reminders.
   Also: the toolbar badge (minutes left), "Open in a tab" on the
   toolbar icon's right-click menu, and opening the app from a
   notification. Only used by the extension builds (scripts/build.mjs).
   ===================================================================== */

import { ext } from '../core/platform.js';
import { scheduler } from '../core/scheduler.js';
import { storage, STORAGE_KEYS } from '../core/storage.js';
import { applyTheme, setAccent, setMode } from '../core/theme-engine.js';
import * as rules from '../timer/rules.js';
import { loadSettings } from '../services/context.js';
import {
  BACKGROUND_CALLS,
  onSettingsLoaded,
  setSoundOutput,
  setUiVisibility,
  startBackgroundServices,
} from '../services/index.js';

const APP_PAGE = 'index.html';

// Must happen while this script first runs, or the browser drops the alarm
// that woke the background before anyone listens for it.
scheduler.useAlarms(ext.alarms);

/* ----------------- Wording and sounds follow the user's mode ----------------- */

onSettingsLoaded((settings) => {
  setMode(settings.mode);
  setAccent(settings.accent);
  applyTheme(settings.theme);
});

/* -------------------------- Is the app on screen? -------------------------- */

const openPages = new Map(); // port → visible

ext.runtime.onConnect.addListener((port) => {
  if (port.name !== 'ui') return;
  openPages.set(port, true);
  port.onMessage.addListener((message) => openPages.set(port, Boolean(message?.visible)));
  port.onDisconnect.addListener(() => openPages.delete(port));
});

setUiVisibility(() => [...openPages.values()].some(Boolean));

/* ------------------------- Calls from the screens ------------------------- */

ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target !== 'background') return false;
  const call = BACKGROUND_CALLS[message.type];
  if (!call) return false;
  Promise.resolve()
    .then(() => call(message))
    .then(
      (value) => sendResponse({ ok: true, value }),
      (error) => sendResponse({ ok: false, error: { code: error.code, copyKey: error.copyKey, message: String(error.message || error) } })
    );
  return true; // the reply comes later
});

/* ------------------------- Sound (Chrome only) ------------------------- */

// A service worker can't play audio, so Chrome plays it in an offscreen page.
if (typeof AudioContext === 'undefined' && ext.offscreen) {
  setSoundOutput(async (packId, event, mode) => {
    const contexts = await ext.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
    if (contexts.length) {
      ext.runtime.sendMessage({ target: 'offscreen', type: 'play', packId, event, mode }).catch(() => {});
      return;
    }
    // Not open yet: it plays the sound named in its address once it loads.
    const query = new URLSearchParams({ packId, event, mode });
    await ext.offscreen
      .createDocument({
        url: `src/extension/offscreen.html?${query}`,
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Plays the session-end sound while the popup is closed.',
      })
      .catch((error) => console.warn('[sound] offscreen page failed', error));
  });
}

/* ------------------------------ Toolbar badge ------------------------------ */

const BADGE_COLORS = { focus: '#d64545', short: '#2f9e5b', long: '#2f7fd6' };

async function updateBadge() {
  const timer = await storage.get(STORAGE_KEYS.timer);
  if (!timer || timer.status === 'idle') {
    scheduler.cancel('badge');
    return ext.action.setBadgeText({ text: '' });
  }
  const minutesLeft = Math.ceil(rules.remainingMs(timer, await loadSettings()) / 60000);
  await ext.action.setBadgeBackgroundColor({ color: BADGE_COLORS[timer.mode] || BADGE_COLORS.focus });
  await ext.action.setBadgeText({ text: timer.status === 'paused' ? 'II' : `${minutesLeft}m` });
  if (timer.status === 'running') scheduler.every('badge', 60000);
  else scheduler.cancel('badge');
}

scheduler.define('badge', updateBadge);
storage.onChange(STORAGE_KEYS.timer, () => updateBadge());

/* ------------------------- Opening the app in a tab ------------------------- */

function openAppTab() {
  return ext.tabs.create({ url: ext.runtime.getURL(APP_PAGE) });
}

ext.notifications?.onClicked.addListener((id) => {
  ext.notifications.clear(id);
  openAppTab();
});

ext.runtime.onInstalled.addListener(async () => {
  if (!ext.contextMenus) return;
  await ext.contextMenus.removeAll();
  ext.contextMenus.create({ id: 'open-tab', title: 'Open in a tab', contexts: ['action'] });
});

ext.contextMenus?.onClicked.addListener((info) => {
  if (info.menuItemId === 'open-tab') openAppTab();
});

/* -------------------------------- Start -------------------------------- */

startBackgroundServices();
updateBadge();
