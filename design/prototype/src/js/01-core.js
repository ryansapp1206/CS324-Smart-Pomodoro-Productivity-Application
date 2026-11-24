'use strict';

/* =====================================================================
   CORE UTILITIES
   Small helpers used everywhere: DOM lookup, HTML escaping, ids,
   dates, formatting and safe browser storage.
   ===================================================================== */

/** Shorthand for querySelector. */
const $ = (selector, root = document) => root.querySelector(selector);

/** Escape text so it can be safely inserted into HTML. */
function escapeHtml(value) {
  const replacements = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, (char) => replacements[char]);
}

/** Short random id, good enough for a prototype. */
function makeId() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

/** Deep copy of plain data (no functions). */
function deepCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Mock network latency: 300–800 ms. */
function fakeNetworkDelay() {
  return wait(300 + Math.random() * 500);
}

/** Read a nested value with a dotted path, e.g. getByPath(ui, 'taskForm.title'). */
function getByPath(object, path) {
  return path.split('.').reduce((current, key) => (current == null ? current : current[key]), object);
}

/** Write a nested value with a dotted path, creating objects along the way. */
function setByPath(object, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const parent = keys.reduce((current, key) => (current[key] ??= {}), object);
  parent[lastKey] = value;
}

/** NOT real security. The real app uses Firebase Auth, which hashes passwords server-side. */
function fakeHash(text) {
  let hash = 5381;
  for (const char of text) hash = ((hash << 5) + hash + char.charCodeAt(0)) | 0;
  return 'mockhash$' + (hash >>> 0).toString(16);
}

/* ----------------------------- Dates ----------------------------- */

const ONE_DAY_MS = 86400000;

function startOfDay(date = new Date()) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Midnight N days from today (negative = past). */
function daysFromNow(days) {
  const date = startOfDay();
  date.setDate(date.getDate() + days);
  return date;
}

/** 'YYYY-MM-DD' key for a date (local time). Used for due dates and grouping. */
function toDayKey(date) {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function fromDayKey(dayKey) {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Whole days from today until the given day key (0 = today, -1 = yesterday). */
function daysUntil(dayKey) {
  return Math.round((fromDayKey(dayKey) - startOfDay()) / ONE_DAY_MS);
}

function formatDate(date, options = { month: 'short', day: 'numeric' }) {
  return new Date(date).toLocaleDateString('en-US', options);
}

/** 95 → "1h 35m", 40 → "40m". */
function formatDuration(totalMinutes) {
  const minutes = Math.round(totalMinutes);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

/** Milliseconds → "mm:ss" (rounded up so the timer never shows 00:00 early). */
function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

/* ---------------------------- Storage ----------------------------
   Uses localStorage when available and falls back to memory
   (some preview windows block localStorage). All keys start with "brp_". */

const memoryStore = {};

const storage = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) return JSON.parse(raw);
    } catch (error) {
      /* localStorage blocked: use memory */
    }
    return key in memoryStore ? deepCopy(memoryStore[key]) : fallback;
  },
  set(key, value) {
    memoryStore[key] = deepCopy(value);
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      /* memory copy is enough */
    }
  },
  remove(key) {
    delete memoryStore[key];
    try {
      localStorage.removeItem(key);
    } catch (error) {
      /* ignore */
    }
  },
  clearAll() {
    Object.keys(memoryStore).forEach((key) => delete memoryStore[key]);
    try {
      Object.keys(localStorage)
        .filter((key) => key.startsWith('brp_'))
        .forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      /* ignore */
    }
  },
};

/* ----------------------------- Icons -----------------------------
   Inline SVG paths (Lucide-style line icons). icon('play') returns the SVG markup. */

const ICON_PATHS = {
  play: '<polygon points="7 4 20 12 7 20 7 4"/>',
  pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  more: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M10 2h4"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 16v-4M12 16V8M17 16v-7"/>',
  bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  volume: '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  cloudCheck: '<path d="M17.5 19H7a5 5 0 1 1 1.6-9.7A6 6 0 0 1 20 11a4 4 0 0 1-2.5 8Z"/><path d="m9 14 2 2 4-4"/>',
  cloudOff: '<path d="m2 2 20 20"/><path d="M5.8 9.2A5 5 0 0 0 7 19h10.5M20.7 17A4 4 0 0 0 17 11a6 6 0 0 0-8.3-5.2"/>',
  refresh:
    '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/>',
  alert:
    '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:
    '<path d="m2 2 20 20"/><path d="M6.7 6.7C3.9 8.5 2 12 2 12s3.5 7 10 7c2 0 3.7-.6 5.2-1.6M10.6 5.1C11 5 11.5 5 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.3 3.2"/><path d="M14.1 14.1a3 3 0 0 1-4.2-4.2"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
};

function icon(name, className = 'i') {
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICON_PATHS[name] || ''}</svg>`;
}

/** App logo: an original tomato with clock hands. */
const TOMATO_LOGO = `
  <svg class="tomato" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="12" cy="13.5" r="8.5" fill="#e0483a"/>
    <path fill="#2f9e44" d="M12 5.6c-1.2-1.8-3.4-2.3-5-1.6 1.4.3 2.6 1.2 3.2 2.3-1.6-.2-3.2.4-4 1.6 2-.3 3.9 0 5.8.8 1.9-.8 3.8-1.1 5.8-.8-.8-1.2-2.4-1.8-4-1.6.6-1.1 1.8-2 3.2-2.3-1.6-.7-3.8-.2-5 1.6Z"/>
    <path d="M12 14V10.6M12 14l2.4 1.5" stroke="#fff" stroke-width="1.7" stroke-linecap="round" fill="none"/>
  </svg>`;

function spinnerHtml(large = false) {
  return `<span class="spinner${large ? ' lg' : ''}" aria-hidden="true"></span>`;
}
