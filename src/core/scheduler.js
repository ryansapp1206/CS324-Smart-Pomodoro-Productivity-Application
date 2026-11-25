/* =====================================================================
   SCHEDULER
   Named wake-ups for the services (session end, reminders, retries).
     scheduler.define(name, fn)   what to run (call at module load)
     scheduler.at(name, when)     run once at a timestamp
     scheduler.every(name, ms)    run repeatedly
     scheduler.cancel(name)
   On the website these are plain timers. In the extension's background
   (src/extension/background.js calls useAlarms()) they become browser
   alarms, which wake the background up even after the browser has put it
   to sleep. Alarms can't fire sooner than 30 s ahead, so shorter waits
   still use a timer (the background stays awake that long anyway).
   ===================================================================== */

const ALARM_MIN_MS = 30000;
const handlers = new Map(); // name → fn
const timers = new Map(); // name → timeout/interval id
let alarms = null;

function fire(name) {
  const handler = handlers.get(name);
  if (!handler) return;
  Promise.resolve()
    .then(handler)
    .catch((error) => console.warn(`[scheduler] ${name} failed`, error));
}

function clearTimer(name) {
  clearTimeout(timers.get(name)); // also clears intervals
  timers.delete(name);
}

export const scheduler = {
  define(name, handler) {
    handlers.set(name, handler);
  },

  at(name, when) {
    clearTimer(name);
    const delay = Math.max(0, when - Date.now());
    if (alarms && delay >= ALARM_MIN_MS) {
      alarms.create(name, { when });
      return;
    }
    alarms?.clear(name);
    timers.set(
      name,
      setTimeout(() => {
        timers.delete(name);
        fire(name);
      }, delay)
    );
  },

  async every(name, ms) {
    clearTimer(name);
    if (alarms) {
      // Re-creating an alarm restarts its period, and the background restarts
      // often, so keep one that already exists.
      const existing = await alarms.get(name);
      if (!existing) alarms.create(name, { periodInMinutes: Math.max(0.5, ms / 60000) });
      return;
    }
    timers.set(name, setInterval(() => fire(name), ms));
  },

  cancel(name) {
    clearTimer(name);
    alarms?.clear(name);
  },

  /** Extension background only. Must be called while the background script first runs. */
  useAlarms(alarmsApi) {
    alarms = alarmsApi;
    alarms.onAlarm.addListener((alarm) => fire(alarm.name));
  },
};
