/* =====================================================================
   STORAGE
   Promise wrapper around the browser's localStorage. Values are saved as
   JSON under "brp:<key>". onChange() reports changes made in this tab and
   in other open tabs of the app, so two tabs stay in step.
   Falls back to memory when localStorage isn't available (Node unit tests,
   some private-browsing modes).
   ===================================================================== */

const PREFIX = 'brp:';
const memory = new Map();
const listeners = new Map(); // key → Set of listeners

const local = (() => {
  try {
    const store = globalThis.localStorage;
    store.setItem(PREFIX + 'test', '1');
    store.removeItem(PREFIX + 'test');
    return store;
  } catch {
    return null;
  }
})();

function read(key) {
  if (!local) return memory.has(key) ? structuredClone(memory.get(key)) : undefined;
  const raw = local.getItem(PREFIX + key);
  if (raw == null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Tell listeners about a change, after the current code finishes. */
function announce(key, value) {
  const set = listeners.get(key);
  if (set) queueMicrotask(() => set.forEach((listener) => listener(value)));
}

export const storage = {
  async get(key, fallback = null) {
    const value = read(key);
    return value === undefined ? fallback : value;
  },

  async set(key, value) {
    if (local) local.setItem(PREFIX + key, JSON.stringify(value));
    else memory.set(key, structuredClone(value));
    announce(key, structuredClone(value));
  },

  async remove(key) {
    if (local) local.removeItem(PREFIX + key);
    else memory.delete(key);
    announce(key, undefined);
  },

  /** Call `listener(newValue)` whenever `key` changes, in this tab or another one. */
  onChange(key, listener) {
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key).add(listener);
  },
};

// Changes made in other tabs.
if (local && typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (!event.key || !event.key.startsWith(PREFIX)) return;
    const key = event.key.slice(PREFIX.length);
    announce(key, event.newValue == null ? undefined : JSON.parse(event.newValue));
  });
}

/** Every key the app stores, in one place. */
export const STORAGE_KEYS = {
  auth: 'auth', // signed-in user (keeps you signed in, req 1.4)
  timer: 'timer', // timer state (src/services/timer-service.js)
  settings: 'settings', // copy of the signed-in user's settings for the timer and reminders
  alert: 'lastAlert', // most recent session-end alert, shown again if the page was closed
  pendingSessions: 'pendingSessions', // sessions that couldn't be saved yet, retried automatically
  remindedOn: 'remindedOn', // deadline banner log: { taskId: 'YYYY-MM-DD' }
  notifiedOn: 'notifiedOn', // deadline notification log: { taskId: 'YYYY-MM-DD' }
  mockCloud: 'mockCloud', // the mock backend's data
  cache: (userId) => `cache:${userId}`, // last data loaded from the backend, shown if loading fails
};
