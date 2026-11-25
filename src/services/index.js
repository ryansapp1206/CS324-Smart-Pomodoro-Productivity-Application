/* =====================================================================
   SERVICES (start-up and wiring)
   Things that run alongside the screens while the page is open:
     timer-service.js   the timer and session end
     session-queue.js   saving finished sessions, with retry
     reminders.js       deadline and daily reminders
     notify.js          notifications, tab title
     sound.js           playSound(event): every sound effect goes through here
   ===================================================================== */

import { storage, STORAGE_KEYS } from '../core/storage.js';
import { checkSessionEnd, handleTimerCommand } from './timer-service.js';
import { flushPendingSessions } from './session-queue.js';
import { checkDeadlines, scheduleDailyReminder, scheduleDeadlineChecks, stopReminders } from './reminders.js';

export { handleTimerCommand, checkSessionEnd } from './timer-service.js';
export { flushPendingSessions } from './session-queue.js';
export { requestNotificationPermission } from './notify.js';
export { playSound } from './sound.js';

/** Call once when the page loads. */
export function startServices() {
  checkSessionEnd(); // a session may have ended while the page was closed
  flushPendingSessions();
  scheduleDeadlineChecks();
  checkDeadlines();
  scheduleDailyReminder();

  // Settings saved: the daily reminder time may have changed.
  storage.onChange(STORAGE_KEYS.settings, () => scheduleDailyReminder());

  // Signed in: start reminders. Logged out: clear everything that belongs to the account.
  storage.onChange(STORAGE_KEYS.auth, async (auth) => {
    if (auth) {
      scheduleDeadlineChecks();
      scheduleDailyReminder();
      flushPendingSessions();
      return;
    }
    stopReminders();
    await handleTimerCommand('clear');
    await storage.remove(STORAGE_KEYS.pendingSessions);
    await storage.remove(STORAGE_KEYS.settings);
    await storage.remove(STORAGE_KEYS.alert);
  });

  // Browsers slow down timers in background tabs, so check again when the tab comes back.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkSessionEnd();
  });
  window.addEventListener('online', () => flushPendingSessions());
}
