/* =====================================================================
   DATA MODEL
   Defaults and validation shared by both backends, so the mock and
   Firebase versions accept and return exactly the same shapes.
   See "Data contract" in the team plan.
   ===================================================================== */

import { DEFAULT_MODE, getEcosystem } from '../content/index.js';
import { DEFAULT_ACCENT, findAccent } from '../content/shared.js';
import { findShopItem, ownsItem } from '../shop/catalog.js';
import { balanceOf } from '../shop/progress.js';
import { makeId, nowIso } from '../core/utils.js';
import { DataError } from './errors.js';

export const PRIORITIES = ['Low', 'Medium', 'High'];
export const TITLE_MAX = 100;
export const DESCRIPTION_MAX = 1000;
export const DISPLAY_NAME_MAX = 40;
export const PASSWORD_MIN = 8;
export const SESSIONS_PER_LONG_BREAK = 4;

/** Allowed range (minutes) for each timer length. */
export const DURATION_LIMITS = {
  focus: [1, 120],
  shortBreak: [1, 60],
  longBreak: [1, 90],
};

const DEFAULT_CONTENT = getEcosystem(DEFAULT_MODE).defaults;

export const DEFAULT_SETTINGS = {
  durations: { focus: 25, shortBreak: 5, longBreak: 15 },
  alertSound: false,
  deadlineReminders: true,
  theme: DEFAULT_CONTENT.theme,
  soundPack: DEFAULT_CONTENT.soundPack,
  avatar: DEFAULT_CONTENT.avatar,
  // Additions to the contract (all optional, defaults fill them in):
  accent: DEFAULT_ACCENT, // button color for themes that allow it (ACCENTS in src/content/shared.js)
  mode: DEFAULT_MODE, // 'professional' | 'brainrot': which content ecosystem is active (src/content/)
  sessionAlerts: true,
  breakAlerts: true,
  autoStart: false,
  reduceMotion: false,
  dailyReminder: { enabled: false, time: '09:00' },
  taskSort: 'due', // 'due' | 'priority'
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email) {
  return EMAIL_PATTERN.test(String(email || '').trim());
}

export function validateSignUp(email, password, displayName) {
  if (!isValidEmail(email)) throw new DataError('invalid-email', 'auth.err.email');
  if (String(password || '').length < PASSWORD_MIN) throw new DataError('weak-password', 'auth.err.pwShort');
  if (String(displayName || '').trim().length > DISPLAY_NAME_MAX) throw new DataError('invalid-name', 'auth.err.nameLong');
}

export function validateDisplayName(displayName) {
  if (String(displayName || '').trim().length > DISPLAY_NAME_MAX) throw new DataError('invalid-name', 'auth.err.nameLong');
}

/** Settings with every field present. Unknown or missing values fall back to the defaults. */
export function normalizeSettings(settings = {}) {
  const merged = {
    ...structuredClone(DEFAULT_SETTINGS),
    ...settings,
    durations: { ...DEFAULT_SETTINGS.durations, ...(settings.durations || {}) },
    dailyReminder: { ...DEFAULT_SETTINGS.dailyReminder, ...(settings.dailyReminder || {}) },
  };
  merged.accent = findAccent(merged.accent).id;
  return merged;
}

export function validateSettings(settings) {
  for (const [mode, [min, max]] of Object.entries(DURATION_LIMITS)) {
    const value = settings.durations[mode];
    if (!Number.isInteger(value) || value < min || value > max) throw new DataError('invalid-duration', 'err.duration');
  }
}

/** A task ready to save: trimmed, validated, with id and createdAt filled in. */
export function prepareTask(input, existing) {
  const title = String(input.title || '').trim();
  if (!title) throw new DataError('invalid-task', 'err.taskTitleRequired');
  if (title.length > TITLE_MAX) throw new DataError('invalid-task', 'err.taskTitleLong');

  const completed = Boolean(input.completed);
  return {
    id: input.id || `t_${makeId()}`,
    title,
    description: String(input.description || '').slice(0, DESCRIPTION_MAX),
    priority: PRIORITIES.includes(input.priority) ? input.priority : null,
    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate || '') ? input.dueDate : null,
    completed,
    completedAt: completed ? input.completedAt || (existing && existing.completedAt) || nowIso() : null,
    createdAt: (existing && existing.createdAt) || input.createdAt || nowIso(),
  };
}

export function prepareSession(input) {
  return {
    id: input.id || `s_${makeId()}`,
    startedAt: input.startedAt || nowIso(),
    durationMinutes: Math.max(1, Math.round(Number(input.durationMinutes) || 0)),
    taskId: input.taskId || null,
  };
}

/** Check a purchase against the shop and the balance. Returns the purchase to save. */
export function preparePurchase(itemId, price, account) {
  const [kind, id] = String(itemId || '').split(':');
  const item = findShopItem(kind, id);
  if (!item) throw new DataError('invalid-item', 'err.itemNotFound');
  if (ownsItem(account.purchases, kind, id)) throw new DataError('already-owned', 'err.alreadyOwned');
  if (price !== item.price) throw new DataError('invalid-item', 'err.itemNotFound');
  if (balanceOf(account) < item.price) throw new DataError('not-enough-balance', 'err.notEnoughBalance');
  return { itemId, price: item.price, purchasedAt: nowIso() };
}

/** Only sessions that started in the last `days` days (all of them when days is missing). */
export function filterSessionsByDays(sessions, days) {
  if (!days) return sessions;
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  return sessions.filter((session) => session.startedAt >= cutoff);
}

export function sortByStart(sessions) {
  return [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}
