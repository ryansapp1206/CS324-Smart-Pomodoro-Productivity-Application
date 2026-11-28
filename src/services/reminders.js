/* =====================================================================
   REMINDERS (while the page is open; always, in the extension)
   - Deadline reminders: hourly, a notification for open tasks due today or
     tomorrow, at most once per task per day. (When the app opens, the
     same tasks are shown in a banner, see src/app/deadlines.js.)
   - Daily reminder: a notification at the time chosen in Settings.
   ===================================================================== */

import { storage, STORAGE_KEYS } from '../core/storage.js';
import { daysUntil, toDayKey } from '../core/utils.js';
import { t } from '../core/theme-engine.js';
import { getTasks } from '../data/index.js';
import { isSignedIn, loadSettings } from './context.js';
import { showNotification } from './notify.js';
import { scheduler } from '../core/scheduler.js';

const HOUR_MS = 60 * 60000;
let dailyScheduled = false;

scheduler.define('deadlines', () => checkDeadlines());
scheduler.define('daily-reminder', async () => {
  dailyScheduled = false;
  await showDailyReminder();
  scheduleDailyReminder(); // and again tomorrow
});

export function scheduleDeadlineChecks() {
  scheduler.every('deadlines', HOUR_MS);
}

export async function checkDeadlines() {
  if (!(await isSignedIn())) return;
  const settings = await loadSettings();
  if (!settings.deadlineReminders) return;

  let tasks;
  try {
    tasks = await getTasks();
  } catch {
    return; // offline: try again next hour
  }

  const today = toDayKey(new Date());
  const notifiedOn = (await storage.get(STORAGE_KEYS.notifiedOn)) || {};
  const dueSoon = tasks.filter(
    (task) => !task.completed && task.dueDate && [0, 1].includes(daysUntil(task.dueDate)) && notifiedOn[task.id] !== today
  );
  if (!dueSoon.length) return;

  dueSoon.forEach((task) => (notifiedOn[task.id] = today));
  await storage.set(STORAGE_KEYS.notifiedOn, notifiedOn);

  const heading = dueSoon.length === 1 ? t('notif.deadlineOne') : t('notif.deadlineMany', { n: dueSoon.length });
  const lines = dueSoon.map((task) => `${task.title} (${t(daysUntil(task.dueDate) === 0 ? 'notif.dueToday' : 'notif.dueTomorrow')})`);
  showNotification('deadlines', heading, lines.join('\n'));
}

/** Next time the clock shows `time` ('HH:MM'), today or tomorrow. */
export function nextOccurrence(time, now = new Date()) {
  const [hours, minutes] = time.split(':').map(Number);
  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime();
}

export async function scheduleDailyReminder() {
  const settings = (await isSignedIn()) ? await loadSettings() : null;
  if (!settings || !settings.dailyReminder.enabled) {
    scheduler.cancel('daily-reminder');
    dailyScheduled = false;
    return;
  }
  scheduler.at('daily-reminder', nextOccurrence(settings.dailyReminder.time));
  dailyScheduled = true;
}

/** True while a daily reminder is scheduled (used by tests). */
export function dailyReminderScheduled() {
  return dailyScheduled;
}

async function showDailyReminder() {
  if (await isSignedIn()) showNotification('daily', t('notif.dailyTitle'), t('notif.dailyBody'));
}

export function stopReminders() {
  scheduler.cancel('deadlines');
  scheduler.cancel('daily-reminder');
  dailyScheduled = false;
}
