/* =====================================================================
   ACCOUNT: start-up, sign in / out and loading data
   Data is loaded from the backend each time the page opens. A copy is
   cached on this computer and shown (with a Retry banner) if loading fails.
   ===================================================================== */

import { storage, STORAGE_KEYS } from '../core/storage.js';
import { applyReducedMotion, applyTheme, setAccent, setMode, t } from '../core/theme-engine.js';
import { DEFAULT_MODE } from '../content/index.js';
import * as data from '../data/index.js';
import { createIdleTimer } from '../timer/rules.js';
import { createUiState } from './state.js';
import { checkDeadlineBanner } from './deadlines.js';
import { listenToBackground, showUnseenAlert, startClock } from './timer-client.js';
import { listenToSync } from './sync-client.js';

/** Mode (content ecosystem), theme, button color and reduced motion from the saved settings (also undoes a Settings preview). */
export function applyAppearance(app) {
  setMode(app.settings().mode);
  setAccent(app.settings().accent);
  applyTheme(app.settings().theme);
  applyReducedMotion(app.settings().reduceMotion);
}

/** Keep a copy of the settings for the timer and reminders (src/services/). */
export async function shareSettings(settings) {
  await storage.set(STORAGE_KEYS.settings, settings);
}

export async function writeCache(app) {
  if (app.user && app.data) await storage.set(STORAGE_KEYS.cache(app.user.id), app.data);
}

/** Sessions from the backend plus any still waiting in the queue (no duplicates). */
export function mergeSessions(saved, pending) {
  const byId = new Map(saved.map((session) => [session.id, session]));
  for (const session of pending) if (!byId.has(session.id)) byId.set(session.id, session);
  return [...byId.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

/** Page opened: restore the timer and the signed-in user (stay signed in, req 1.4). */
export async function boot(app) {
  const savedSettings = await storage.get(STORAGE_KEYS.settings);
  setMode(savedSettings ? savedSettings.mode : DEFAULT_MODE);
  setAccent(savedSettings && savedSettings.accent);
  applyTheme(savedSettings && savedSettings.theme); // the user's theme, or the default when signed out
  app.timer = (await storage.get(STORAGE_KEYS.timer)) || createIdleTimer();
  listenToBackground(app);
  startClock(app);

  const user = await data.getCurrentUser();
  if (!user) return app.render();
  app.user = user;
  app.ui.screen = 'main';
  await listenToSync(app);
  await loadAccount(app);
  await showUnseenAlert(app);
}

export async function signIn(app, user) {
  app.user = user;
  app.ui = createUiState();
  app.ui.screen = 'main';
  app.alert = null;
  await listenToSync(app);
  await loadAccount(app);
}

export async function logout(app, { notice = null } = {}) {
  await data.signOut(); // src/services/index.js clears the timer when it sees this
  Object.assign(app, {
    user: null,
    data: null,
    loadState: 'idle',
    syncState: 'synced',
    failedSave: null,
    showingCachedData: false,
    pendingCount: 0,
    alert: null,
    toasts: [],
    timer: createIdleTimer(),
    ui: createUiState(),
  });
  setMode(DEFAULT_MODE); // back to the professional look
  setAccent();
  applyTheme();
  applyReducedMotion(false);
  app.ui.notice = notice || t('logout.notice'); // after the theme switch, so it's in the default theme's words
  app.ui.focusAfterRender = 'authForm.email';
  app.render();
  app.renderToasts();
}

/**
 * Load everything for the signed-in account. Falls back to the cached copy.
 * quiet: reload in place without the loading screen (another device's changes arrived).
 */
export async function loadAccount(app, { showToast = false, quiet = false } = {}) {
  if (!app.user) return;
  if (!quiet) {
    app.loadState = 'loading';
    app.render();
  }

  try {
    const [tasks, sessions, settings, purchases] = await Promise.all([
      data.getTasks(),
      data.getSessions(),
      data.getSettings(),
      data.getPurchases(),
    ]);
    const pending = (await storage.get(STORAGE_KEYS.pendingSessions)) || [];
    app.data = { tasks, sessions: mergeSessions(sessions, pending), settings, purchases };
    if (quiet) app.user = (await data.getCurrentUser()) || app.user; // the name may have changed on another device
    app.pendingCount = pending.length;
    Object.assign(app, { loadState: 'ready', syncState: 'synced', showingCachedData: false, failedSave: null });
    app.lastSyncedAt = Date.now();
    await writeCache(app);
    await shareSettings(settings);
    if (showToast) app.toast(t('sync.refreshed'), 'success');
  } catch (error) {
    if (error.code === 'signed-out') return logout(app, { notice: error.message });
    const cached = await storage.get(STORAGE_KEYS.cache(app.user.id));
    app.syncState = error.code === 'network' ? 'offline' : 'failed';
    if (cached) {
      app.data = cached;
      app.loadState = 'ready';
      app.showingCachedData = true;
    } else {
      app.loadState = 'error';
    }
  }

  // A quiet reload leaves a Settings preview alone until it's saved or cancelled.
  if (app.data && !(quiet && app.ui.tab === 'settings')) applyAppearance(app);
  app.render();
  if (app.loadState === 'ready') await checkDeadlineBanner(app);
}
