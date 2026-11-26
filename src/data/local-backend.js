/* =====================================================================
   LOCAL BACKEND
   Accounts and data are kept on this device: in the extension's storage,
   or in localStorage on the website. Nothing is sent anywhere except to
   devices you pair yourself over your local network (src/sync/).

   Each record carries what syncing needs to merge two devices safely:
     tasks       updatedAt (newest edit wins), and deletedTasks
                 { id: deletedAt } so a deletion spreads instead of the
                 other device bringing the task back
     sessions    kept by id, never edited, so merging is a union
     purchases   kept by itemId (one purchase per item)
     settings    settingsUpdatedAt (newest save wins)
     name        profileUpdatedAt (newest change wins)
   ===================================================================== */

import { storage, STORAGE_KEYS } from '../core/storage.js';
import { makeId, nowIso } from '../core/utils.js';
import { DataError } from './errors.js';
import {
  DEFAULT_SETTINGS,
  PASSWORD_MIN,
  filterSessionsByDays,
  isValidEmail,
  normalizeSettings,
  preparePurchase,
  prepareSession,
  prepareTask,
  sortByStart,
  validateDisplayName,
  validateSettings,
  validateSignUp,
} from './model.js';
import { mergeSnapshots, sanitizeSnapshot } from '../sync/merge.js';

const BACKEND = 'local';
const LEGACY_DEMO_USER_ID = 'u_demo'; // the old built-in demo account, removed on upgrade

/** PBKDF2, so a copied storage file is slow to guess passwords from. */
async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(String(password)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: 150000 }, key, 256);
  return [...new Uint8Array(bits)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function legacyHash(password) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`ram-ranch-mock:${password}`));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function newSalt() {
  return [...crypto.getRandomValues(new Uint8Array(16))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/* ------------------------------ The store ------------------------------ */

function emptyAccount() {
  return {
    tasks: [],
    sessions: [],
    purchases: [],
    settings: structuredClone(DEFAULT_SETTINGS),
    settingsUpdatedAt: null,
    deletedTasks: {},
    profileUpdatedAt: null,
  };
}

/** Older saves (from the prototype's mock backend) are moved over once, without its demo account. */
async function migrateLegacy() {
  const legacy = await storage.get(STORAGE_KEYS.legacyMockCloud);
  if (!legacy) return null;
  const store = { users: {}, data: {} };
  for (const [email, user] of Object.entries(legacy.users || {})) {
    if (user.id === LEGACY_DEMO_USER_ID) continue;
    store.users[email] = { ...user, legacyHash: true };
    store.data[user.id] = { ...emptyAccount(), ...(legacy.data || {})[user.id] };
  }
  await storage.set(STORAGE_KEYS.localStore, store);
  await storage.remove(STORAGE_KEYS.legacyMockCloud);
  const auth = await storage.get(STORAGE_KEYS.auth);
  if (auth && auth.backend === 'mock') {
    if (auth.user && store.data[auth.user.id]) await storage.set(STORAGE_KEYS.auth, { backend: BACKEND, user: auth.user });
    else await storage.remove(STORAGE_KEYS.auth);
  }
  return store;
}

async function loadStore() {
  const store = (await storage.get(STORAGE_KEYS.localStore)) || (await migrateLegacy()) || { users: {}, data: {} };
  return store;
}

/** What the app may know about a user (never the password hash). */
function publicUser(user) {
  return { id: user.id, email: user.email, displayName: user.displayName, createdAt: user.createdAt };
}

async function currentUserId() {
  const auth = await storage.get(STORAGE_KEYS.auth);
  if (!auth || auth.backend !== BACKEND) throw new DataError('signed-out', 'err.notSignedIn');
  return auth.user.id;
}

/** Run `change(account, store, user)` on the signed-in account, save, and return its result. */
async function withAccount(change, { save = true } = {}) {
  const userId = await currentUserId();
  const store = await loadStore();
  const account = store.data[userId];
  const user = Object.values(store.users).find((candidate) => candidate.id === userId);
  if (!account || !user) throw new DataError('signed-out', 'err.notSignedIn');
  const result = await change(account, store, user);
  if (save) await storage.set(STORAGE_KEYS.localStore, store);
  return structuredClone(result);
}

async function signInAs(user) {
  await storage.set(STORAGE_KEYS.auth, { backend: BACKEND, user: publicUser(user) });
  return publicUser(user);
}

/* ------------------------------- Accounts ------------------------------- */

export async function signUp(email, password, displayName) {
  validateSignUp(email, password, displayName);
  const store = await loadStore();
  const key = email.trim().toLowerCase();
  if (store.users[key]) throw new DataError('email-taken', 'auth.err.emailTaken');

  const salt = newSalt();
  const user = {
    id: `u_${makeId()}`,
    email: key,
    displayName: String(displayName || '').trim() || key.split('@')[0],
    salt,
    passwordHash: await hashPassword(password, salt),
    createdAt: nowIso(),
  };
  store.users[key] = user;
  store.data[user.id] = emptyAccount();
  await storage.set(STORAGE_KEYS.localStore, store);
  return signInAs(user);
}

async function passwordMatches(user, password) {
  if (user.legacyHash) return user.passwordHash === (await legacyHash(password));
  return user.passwordHash === (await hashPassword(password, user.salt));
}

export async function signIn(email, password) {
  const store = await loadStore();
  const user = store.users[String(email || '').trim().toLowerCase()];
  if (!user || !(await passwordMatches(user, password))) {
    throw new DataError('invalid-credentials', 'auth.err.generic');
  }
  if (user.legacyHash) {
    // Upgrade the old password hash now that we know the password.
    user.salt = newSalt();
    user.passwordHash = await hashPassword(password, user.salt);
    delete user.legacyHash;
    await storage.set(STORAGE_KEYS.localStore, store);
  }
  return signInAs(user);
}

export async function signOut() {
  await storage.remove(STORAGE_KEYS.auth);
}

/**
 * Accounts live on this device, so there's no email to send. This checks
 * that the account exists here; the app then asks for the new password.
 */
export async function resetPassword(email) {
  if (!isValidEmail(email)) throw new DataError('invalid-email', 'auth.err.email');
  const store = await loadStore();
  if (!store.users[String(email).trim().toLowerCase()]) throw new DataError('not-found', 'auth.err.noLocalAccount');
}

export async function confirmPasswordReset(email, newPassword) {
  if (String(newPassword || '').length < PASSWORD_MIN) throw new DataError('weak-password', 'auth.err.pwShort');
  const store = await loadStore();
  const user = store.users[String(email || '').trim().toLowerCase()];
  if (!user) throw new DataError('not-found', 'auth.err.noLocalAccount');
  user.salt = newSalt();
  user.passwordHash = await hashPassword(newPassword, user.salt);
  delete user.legacyHash;
  await storage.set(STORAGE_KEYS.localStore, store);
}

export async function getCurrentUser() {
  const auth = await storage.get(STORAGE_KEYS.auth);
  if (auth && auth.backend === BACKEND) return auth.user;
  if (auth && auth.backend === 'mock') {
    await loadStore(); // moves the old data over and updates the sign-in
    const upgraded = await storage.get(STORAGE_KEYS.auth);
    return upgraded && upgraded.backend === BACKEND ? upgraded.user : null;
  }
  return null;
}

export async function updateProfile({ displayName }) {
  validateDisplayName(displayName);
  return withAccount(async (account, store, user) => {
    user.displayName = String(displayName || '').trim() || user.displayName;
    account.profileUpdatedAt = nowIso();
    await storage.set(STORAGE_KEYS.auth, { backend: BACKEND, user: publicUser(user) });
    return publicUser(user);
  });
}

/* -------------------------------- Tasks -------------------------------- */

export function getTasks() {
  return withAccount((account) => account.tasks, { save: false });
}

export function saveTask(input) {
  return withAccount((account) => {
    const index = input.id ? account.tasks.findIndex((task) => task.id === input.id) : -1;
    if (input.id && index === -1) throw new DataError('not-found', 'err.taskNotFound');
    const task = { ...prepareTask(input, account.tasks[index]), updatedAt: nowIso() };
    if (index === -1) account.tasks.push(task);
    else account.tasks[index] = task;
    return task;
  });
}

export function deleteTask(id) {
  return withAccount((account) => {
    account.tasks = account.tasks.filter((task) => task.id !== id);
    account.deletedTasks = { ...(account.deletedTasks || {}), [id]: nowIso() };
  });
}

/* ------------------------------- Sessions ------------------------------- */

/** Saving the same session id twice keeps one copy, so retries are safe. */
export function recordSession(input) {
  return withAccount((account) => {
    const session = prepareSession(input);
    account.sessions = account.sessions.filter((existing) => existing.id !== session.id);
    account.sessions.push(session);
    return session;
  });
}

export function getSessions({ days } = {}) {
  return withAccount((account) => sortByStart(filterSessionsByDays(account.sessions, days)), { save: false });
}

/* ------------------------------- Settings ------------------------------- */

export function getSettings() {
  return withAccount((account) => normalizeSettings(account.settings), { save: false });
}

export async function saveSettings(settings) {
  const normalized = normalizeSettings(settings);
  validateSettings(normalized);
  return withAccount((account) => {
    account.settings = normalized;
    account.settingsUpdatedAt = nowIso();
    return normalized;
  });
}

/* ------------------------------- Purchases ------------------------------- */

export function getPurchases() {
  return withAccount((account) => account.purchases, { save: false });
}

export function purchase(itemId, price) {
  return withAccount((account) => {
    const saved = preparePurchase(itemId, price, account);
    account.purchases.push(saved);
    return saved;
  });
}

/* --------------------------- Device sync (LAN) --------------------------- */

function snapshotOf(account, user) {
  return sanitizeSnapshot({
    v: 1,
    profile: { displayName: user.displayName, updatedAt: account.profileUpdatedAt || null },
    tasks: account.tasks,
    deletedTasks: account.deletedTasks || {},
    sessions: account.sessions,
    purchases: account.purchases,
    settings: normalizeSettings(account.settings),
    settingsUpdatedAt: account.settingsUpdatedAt || null,
  });
}

/** Everything the signed-in account has, in the form devices exchange. */
export function exportSnapshot() {
  return withAccount((account, store, user) => snapshotOf(account, user), { save: false });
}

/**
 * Merge another device's snapshot into the signed-in account.
 * Returns { snapshot: the merged result, changed: whether anything here changed }.
 */
export function importSnapshot(remote) {
  return withAccount(async (account, store, user) => {
    const local = snapshotOf(account, user);
    const merged = mergeSnapshots(local, sanitizeSnapshot(remote));
    const changed = JSON.stringify(merged) !== JSON.stringify(local);
    if (changed) {
      account.tasks = merged.tasks;
      account.deletedTasks = merged.deletedTasks;
      account.sessions = merged.sessions;
      account.purchases = merged.purchases;
      account.settings = merged.settings;
      account.settingsUpdatedAt = merged.settingsUpdatedAt;
      account.profileUpdatedAt = merged.profile.updatedAt;
      if (merged.profile.displayName && merged.profile.displayName !== user.displayName) {
        user.displayName = merged.profile.displayName;
        await storage.set(STORAGE_KEYS.auth, { backend: BACKEND, user: publicUser(user) });
      }
    }
    return { snapshot: merged, changed };
  });
}
