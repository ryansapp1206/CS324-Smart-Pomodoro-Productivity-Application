/* =====================================================================
   TIMER CLIENT (screen side)
   The timer service (src/services/timer-service.js) owns the timer
   (team rule 3). The screens:
     - send commands with sendTimerCommand()
     - mirror STORAGE_KEYS.timer into app.timer
     - redraw the clock every 250 ms
     - show the session-complete card when the service reports one
   ===================================================================== */

import { storage, STORAGE_KEYS } from '../core/storage.js';
import { formatClock } from '../core/utils.js';
import { t } from '../core/theme-engine.js';
import { REWARDS } from '../shop/progress.js';
import * as rules from '../timer/rules.js';
import { sessionEndMessage } from '../timer/messages.js';
import { checkSessionEnd, handleTimerCommand } from '../services/index.js';
import { updateTabTitle } from '../services/notify.js';
import { mergeSessions, writeCache } from './account.js';

const RING_CIRCUMFERENCE = 2 * Math.PI * 96;
const ALERT_MAX_AGE_MS = 60 * 60000; // show a missed alert when the page opens within an hour
const PENDING_BANNER_DELAY_MS = 3000;

/** command: start | pause | resume | stop | reset | switchMode | setTask */
export async function sendTimerCommand(app, command, arg) {
  app.timer = await handleTimerCommand(command, arg);
  app.render();
}

export function remainingMs(app) {
  return rules.remainingMs(app.timer, app.settings());
}

export function totalMs(app) {
  return rules.totalMs(app.timer, app.settings()) || 1;
}

/* ------------------------------- Clock ------------------------------- */

let finishRequested = false;

export function startClock(app) {
  setInterval(() => {
    if (!app.user || !app.data || app.timer.status !== 'running') return;
    const remaining = remainingMs(app);
    updateTabTitle(app.timer, app.settings());
    if (remaining > 0) return updateTimerDisplay(app, remaining);
    if (!finishRequested) {
      finishRequested = true; // the service finishes the session; we hear back through storage
      checkSessionEnd();
    }
  }, 250);
}

/** Update only the clock text and ring, without re-rendering the screen. */
function updateTimerDisplay(app, remaining) {
  const clock = app.screenHost.querySelector('[data-time]');
  if (clock) clock.textContent = formatClock(remaining);
  const ring = app.screenHost.querySelector('[data-ring]');
  if (ring) ring.setAttribute('stroke-dashoffset', String(RING_CIRCUMFERENCE * (remaining / totalMs(app))));
}

export { RING_CIRCUMFERENCE };

/* --------------------------- Background events --------------------------- */

export function listenToBackground(app) {
  storage.onChange(STORAGE_KEYS.timer, (timer) => {
    finishRequested = false;
    if (!timer || !app.user) return;
    app.timer = timer;
    app.render();
  });

  storage.onChange(STORAGE_KEYS.alert, (alert) => {
    if (alert && !alert.seen && app.user) showSessionAlert(app, alert);
  });

  storage.onChange(STORAGE_KEYS.pendingSessions, (pending) => addPendingSessions(app, pending || []));
}

/** New finished sessions appear in stats right away, even before they're saved. */
function addPendingSessions(app, pending) {
  if (!app.data) return;
  const before = app.achievementIds();
  app.data.sessions = mergeSessions(app.data.sessions, pending);
  // A session is queued for a moment while it's being saved; only show the
  // "waiting to sync" banner if it's still there a few seconds later.
  if (!app.pendingCount && pending.length) {
    app.pendingVisibleAt = Date.now() + PENDING_BANNER_DELAY_MS;
    setTimeout(() => app.render(), PENDING_BANNER_DELAY_MS + 50);
  }
  app.pendingCount = pending.length;
  writeCache(app);
  app.celebrateNewAchievements(before);
  app.render();
}

export async function showUnseenAlert(app) {
  const alert = await storage.get(STORAGE_KEYS.alert);
  if (alert && !alert.seen && Date.now() - alert.at < ALERT_MAX_AGE_MS) showSessionAlert(app, alert);
}

function showSessionAlert(app, alert) {
  const settings = app.settings();
  const { title, body, primaryLabel } = sessionEndMessage(alert);
  const alertsOn = alert.finishedMode === 'focus' ? settings.sessionAlerts : settings.breakAlerts;

  if (alertsOn) {
    const iconName = alert.finishedMode === 'focus' ? 'check' : 'timer';
    app.alert = { id: alert.id, title, body, primaryLabel, icon: iconName, celebrate: alert.finishedMode === 'focus' };
  } else {
    app.toast(`${title} ${body}`);
    markAlertSeen();
  }
  if (alert.finishedMode === 'focus') {
    app.toast(t('currency.earned', { n: REWARDS.focusSession }), 'success', 'coins');
  }
  app.announce(`${title} ${body}`);
  app.renderToasts();
}

export async function markAlertSeen() {
  const alert = await storage.get(STORAGE_KEYS.alert);
  if (alert) await storage.set(STORAGE_KEYS.alert, { ...alert, seen: true });
}
