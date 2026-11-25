/* =====================================================================
   MOCK BACKEND
   Same functions as firebase-backend.js, but the "cloud" is kept in
   localStorage in this browser. Used for demos, offline development
   and tests. Comes with the demo account (see demo-data.js).
   Switch backends in src/config.js.
   ===================================================================== */

import { storage, STORAGE_KEYS } from '../core/storage.js';
import { makeId, nowIso, wait } from '../core/utils.js';
import { DataError } from './errors.js';
import { DEMO_USER, createDemoData } from './demo-data.js';
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

const LATENCY_MS = 120; // a little delay so loading states are visible

async function hashPassword(password) {
  const bytes = new TextEncoder().encode(`ram-ranch-mock:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/* ----------------------------- The "cloud" ----------------------------- */

async function loadCloud() {
  let cloud = await storage.get(STORAGE_KEYS.mockCloud);
  if (!cloud) {
    cloud = {
      users: {
        [DEMO_USER.email]: {
          id: DEMO_USER.id,
          email: DEMO_USER.email,
          displayName: DEMO_USER.displayName,
          passwordHash: await hashPassword(DEMO_USER.password),
          createdAt: new Date(Date.now() - 40 * 86400000).toISOString(),
        },
      },
      data: { [DEMO_USER.id]: createDemoData() },
    };
    await storage.set(STORAGE_KEYS.mockCloud, cloud);
  }
  return cloud;
}

/** What the app may know about a user (never the password hash). */
function publicUser(user) {
  return { id: user.id, email: user.email, displayName: user.displayName, createdAt: user.createdAt };
}

async function currentUserId() {
  const auth = await storage.get(STORAGE_KEYS.auth);
  if (!auth || auth.backend !== 'mock') throw new DataError('signed-out', 'err.notSignedIn');
  return auth.user.id;
}

/** Run `change(account, cloud)` on the signed-in account, save, and return its result. */
async function withAccount(change, { save = true } = {}) {
  await wait(LATENCY_MS);
  const userId = await currentUserId();
  const cloud = await loadCloud();
  const account = cloud.data[userId];
  if (!account) throw new DataError('signed-out', 'err.notSignedIn');
  const result = await change(account, cloud);
  if (save) await storage.set(STORAGE_KEYS.mockCloud, cloud);
  return structuredClone(result);
}

async function signInAs(user) {
  await storage.set(STORAGE_KEYS.auth, { backend: 'mock', user: publicUser(user) });
  return publicUser(user);
}

/* ------------------------------- Accounts ------------------------------- */

export async function signUp(email, password, displayName) {
  await wait(LATENCY_MS);
  validateSignUp(email, password, displayName);
  const cloud = await loadCloud();
  const key = email.trim().toLowerCase();
  if (cloud.users[key]) throw new DataError('email-taken', 'auth.err.emailTaken');

  const user = {
    id: `u_${makeId()}`,
    email: key,
    displayName: String(displayName || '').trim() || key.split('@')[0],
    passwordHash: await hashPassword(password),
    createdAt: nowIso(),
  };
  cloud.users[key] = user;
  cloud.data[user.id] = { tasks: [], sessions: [], purchases: [], settings: structuredClone(DEFAULT_SETTINGS) };
  await storage.set(STORAGE_KEYS.mockCloud, cloud);
  return signInAs(user);
}

export async function signIn(email, password) {
  await wait(LATENCY_MS);
  const cloud = await loadCloud();
  const user = cloud.users[String(email || '').trim().toLowerCase()];
  if (!user || user.passwordHash !== (await hashPassword(password))) {
    throw new DataError('invalid-credentials', 'auth.err.generic');
  }
  return signInAs(user);
}

export async function signOut() {
  await storage.remove(STORAGE_KEYS.auth);
}

/** Pretends to email a reset link. Never says whether the account exists. */
export async function resetPassword(email) {
  await wait(LATENCY_MS);
  if (!isValidEmail(email)) throw new DataError('invalid-email', 'auth.err.email');
}

/**
 * Mock only: stands in for the page the reset email links to. With Firebase,
 * that page is hosted by Firebase and the app never sees the new password.
 */
export async function confirmPasswordReset(email, newPassword) {
  await wait(LATENCY_MS);
  if (String(newPassword || '').length < PASSWORD_MIN) throw new DataError('weak-password', 'auth.err.pwShort');
  const cloud = await loadCloud();
  const user = cloud.users[String(email || '').trim().toLowerCase()];
  if (user) {
    user.passwordHash = await hashPassword(newPassword);
    await storage.set(STORAGE_KEYS.mockCloud, cloud);
  }
}

export async function getCurrentUser() {
  const auth = await storage.get(STORAGE_KEYS.auth);
  return auth && auth.backend === 'mock' ? auth.user : null;
}

export async function updateProfile({ displayName }) {
  validateDisplayName(displayName);
  return withAccount(async (account, cloud) => {
    const userId = await currentUserId();
    const user = Object.values(cloud.users).find((candidate) => candidate.id === userId);
    user.displayName = String(displayName || '').trim() || user.displayName;
    await storage.set(STORAGE_KEYS.auth, { backend: 'mock', user: publicUser(user) });
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
    const task = prepareTask(input, account.tasks[index]);
    if (index === -1) account.tasks.push(task);
    else account.tasks[index] = task;
    return task;
  });
}

export function deleteTask(id) {
  return withAccount((account) => {
    account.tasks = account.tasks.filter((task) => task.id !== id);
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
