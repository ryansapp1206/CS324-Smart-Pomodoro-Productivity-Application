/* =====================================================================
   DEADLINE BANNER
   When the app opens, open tasks due today or tomorrow are listed in a
   banner, at most once per task per day. (An hourly notification is also
   sent while the page is open, see src/services/reminders.js.)
   ===================================================================== */

import { storage, STORAGE_KEYS } from '../core/storage.js';
import { daysUntil, toDayKey } from '../core/utils.js';
import { t } from '../core/theme-engine.js';

export async function checkDeadlineBanner(app) {
  if (!app.user || !app.data || !app.settings().deadlineReminders) return;

  const remindedOn = (await storage.get(STORAGE_KEYS.remindedOn)) || {};
  const today = toDayKey(new Date());
  const dueSoon = app
    .tasks()
    .filter(
      (task) => !task.completed && task.dueDate && [0, 1].includes(daysUntil(task.dueDate)) && remindedOn[task.id] !== today
    );
  if (!dueSoon.length) return;

  dueSoon.forEach((task) => (remindedOn[task.id] = today));
  await storage.set(STORAGE_KEYS.remindedOn, remindedOn);

  const items = dueSoon.map((task) => ({
    id: task.id,
    title: task.title,
    when: daysUntil(task.dueDate) === 0 ? 'today' : 'tomorrow',
  }));
  app.ui.deadlineBanner = { items };
  app.announce(items.length === 1 ? t('notif.deadlineOne') : t('notif.deadlineMany', { n: items.length }));
  app.render();
}
