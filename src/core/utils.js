/* =====================================================================
   CORE UTILITIES
   Small pure helpers used everywhere: HTML escaping, ids, dates and
   formatting. No DOM or browser storage here, so Node tests can import it.
   ===================================================================== */


/** Escape text so it can be safely inserted into HTML. */
export function escapeHtml(value) {
  const replacements = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, (char) => replacements[char]);
}

/** Short random id, good enough for a prototype. */
export function makeId() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

/** Deep copy of plain data (no functions). */
export function deepCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Read a nested value with a dotted path, e.g. getByPath(ui, 'taskForm.title'). */
export function getByPath(object, path) {
  return path.split('.').reduce((current, key) => (current == null ? current : current[key]), object);
}

/** Write a nested value with a dotted path, creating objects along the way. */
export function setByPath(object, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const parent = keys.reduce((current, key) => (current[key] ??= {}), object);
  parent[lastKey] = value;
}

/* ----------------------------- Dates ----------------------------- */

export const ONE_DAY_MS = 86400000;

export function startOfDay(date = new Date()) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Midnight N days from today (negative = past). */
export function daysFromNow(days) {
  const date = startOfDay();
  date.setDate(date.getDate() + days);
  return date;
}

/** 'YYYY-MM-DD' key for a date (local time). Used for due dates and grouping. */
export function toDayKey(date) {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export function fromDayKey(dayKey) {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Whole days from today until the given day key (0 = today, -1 = yesterday). */
export function daysUntil(dayKey) {
  return Math.round((fromDayKey(dayKey) - startOfDay()) / ONE_DAY_MS);
}

export function formatDate(date, options = { month: 'short', day: 'numeric' }) {
  return new Date(date).toLocaleDateString('en-US', options);
}

/** 95 → "1h 35m", 40 → "40m". */
export function formatDuration(totalMinutes) {
  const minutes = Math.round(totalMinutes);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

/** Milliseconds → "mm:ss" (rounded up so the timer never shows 00:00 early). */
export function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}


/** Current time as an ISO 8601 string (UTC). */
export function nowIso() {
  return new Date().toISOString();
}
