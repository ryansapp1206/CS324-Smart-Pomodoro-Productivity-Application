/* =====================================================================
   SYNC: MERGING TWO DEVICES
   Pure functions, no storage or network. Two devices that exchange
   snapshots and merge them end up with exactly the same data, whichever
   order the messages arrive in, and merging the same snapshot twice
   changes nothing (so retries and repeats are harmless).

     tasks      the most recent edit (updatedAt) wins. A deletion wins
                over any edit made before it.
     sessions   everything from both sides (each has a unique id)
     purchases  everything from both sides, one per item
     settings   the most recently saved copy wins
     name       the most recently changed name wins
   ===================================================================== */

import { normalizeSettings, prepareSession, prepareTask } from '../data/model.js';

const TOMBSTONE_MAX_AGE_MS = 180 * 86400000; // deleted-task markers are kept for 6 months
const ISO = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/;
const isIso = (value) => typeof value === 'string' && ISO.test(value);
const newer = (a, b) => String(a || '') > String(b || '');

/** Clean up a snapshot from another device: the right shapes, nothing extra, sorted the same way everywhere. */
export function sanitizeSnapshot(input = {}) {
  const tasks = new Map();
  for (const raw of Array.isArray(input.tasks) ? input.tasks : []) {
    if (!raw || typeof raw.id !== 'string' || !raw.id || !isIso(raw.createdAt)) continue;
    let task;
    try {
      task = prepareTask(raw, raw);
    } catch {
      continue; // e.g. no title
    }
    task.updatedAt = isIso(raw.updatedAt) ? raw.updatedAt : task.createdAt;
    const existing = tasks.get(task.id);
    if (!existing || newer(task.updatedAt, existing.updatedAt)) tasks.set(task.id, task);
  }

  const sessions = new Map();
  for (const raw of Array.isArray(input.sessions) ? input.sessions : []) {
    if (!raw || typeof raw.id !== 'string' || !isIso(raw.startedAt)) continue;
    sessions.set(raw.id, prepareSession(raw));
  }

  const purchases = new Map();
  for (const raw of Array.isArray(input.purchases) ? input.purchases : []) {
    if (!raw || typeof raw.itemId !== 'string' || !/^[a-z]+:[\w-]+$/.test(raw.itemId)) continue;
    const purchase = { itemId: raw.itemId, price: Math.max(0, Math.round(Number(raw.price) || 0)), purchasedAt: isIso(raw.purchasedAt) ? raw.purchasedAt : new Date(0).toISOString() };
    const existing = purchases.get(purchase.itemId);
    if (!existing || purchase.purchasedAt < existing.purchasedAt) purchases.set(purchase.itemId, purchase);
  }

  const deletedTasks = {};
  const cutoff = new Date(Date.now() - TOMBSTONE_MAX_AGE_MS).toISOString();
  for (const [id, deletedAt] of Object.entries(input.deletedTasks || {})) {
    if (isIso(deletedAt) && deletedAt > cutoff) deletedTasks[id] = deletedAt;
  }

  const profile = input.profile || {};
  return {
    v: 1,
    profile: {
      displayName: typeof profile.displayName === 'string' ? profile.displayName.trim().slice(0, 40) : '',
      updatedAt: isIso(profile.updatedAt) ? profile.updatedAt : null,
    },
    tasks: [...tasks.values()].sort(byId),
    deletedTasks: sortKeys(deletedTasks),
    sessions: [...sessions.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id)),
    purchases: [...purchases.values()].sort((a, b) => a.itemId.localeCompare(b.itemId)),
    settings: canonical(normalizeSettings(input.settings && typeof input.settings === 'object' ? input.settings : {})),
    settingsUpdatedAt: isIso(input.settingsUpdatedAt) ? input.settingsUpdatedAt : null,
  };
}

/** The merge of two sanitized snapshots. */
export function mergeSnapshots(local, remote) {
  const deletedTasks = { ...local.deletedTasks };
  for (const [id, deletedAt] of Object.entries(remote.deletedTasks)) {
    if (newer(deletedAt, deletedTasks[id])) deletedTasks[id] = deletedAt;
  }

  const tasks = new Map(local.tasks.map((task) => [task.id, task]));
  for (const task of remote.tasks) {
    const mine = tasks.get(task.id);
    if (!mine || newer(task.updatedAt, mine.updatedAt) || (task.updatedAt === mine.updatedAt && JSON.stringify(task) > JSON.stringify(mine))) {
      tasks.set(task.id, task);
    }
  }
  for (const [id, deletedAt] of Object.entries(deletedTasks)) {
    const task = tasks.get(id);
    if (task && !newer(task.updatedAt, deletedAt)) tasks.delete(id);
  }

  const sessions = new Map(local.sessions.map((session) => [session.id, session]));
  for (const session of remote.sessions) if (!sessions.has(session.id)) sessions.set(session.id, session);

  const purchases = new Map(local.purchases.map((purchase) => [purchase.itemId, purchase]));
  for (const purchase of remote.purchases) {
    const mine = purchases.get(purchase.itemId);
    if (!mine || purchase.purchasedAt < mine.purchasedAt) purchases.set(purchase.itemId, purchase);
  }

  const remoteSettingsWin =
    newer(remote.settingsUpdatedAt, local.settingsUpdatedAt) ||
    (remote.settingsUpdatedAt === local.settingsUpdatedAt && JSON.stringify(remote.settings) > JSON.stringify(local.settings));
  const remoteProfileWins =
    remote.profile.displayName &&
    (newer(remote.profile.updatedAt, local.profile.updatedAt) ||
      (remote.profile.updatedAt === local.profile.updatedAt && remote.profile.displayName > local.profile.displayName));

  return sanitizeSnapshot({
    profile: remoteProfileWins ? remote.profile : local.profile,
    tasks: [...tasks.values()],
    deletedTasks,
    sessions: [...sessions.values()],
    purchases: [...purchases.values()],
    settings: remoteSettingsWin ? remote.settings : local.settings,
    settingsUpdatedAt: remoteSettingsWin ? remote.settingsUpdatedAt : local.settingsUpdatedAt,
  });
}

/** JSON with keys in a fixed order, so equal data gives an equal string on every device. */
export function canonicalJson(value) {
  return JSON.stringify(canonical(value));
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return sortKeys(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, canonical(item)])));
  return value;
}

function sortKeys(object) {
  return Object.fromEntries(Object.entries(object).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

function byId(a, b) {
  return a.id.localeCompare(b.id);
}
