/* =====================================================================
   DATA LAYER: the only door to the backend
   Screens, the app and the services import data from here and
   nowhere else (team rule 1). This file picks the backend named in
   src/config.js and re-exports its functions.

   To plug in the real backend:
     1. add src/data/<name>-backend.js with every function below
     2. add it to BACKENDS
     3. set CONFIG.backend to '<name>'
   Every function returns a Promise and throws { code, message } on failure.
   ===================================================================== */

import { CONFIG } from '../config.js';
import * as mockBackend from './mock-backend.js';

const BACKENDS = {
  mock: mockBackend,
};

const backend = BACKENDS[CONFIG.backend] || mockBackend;

/** 'mock' shows the demo-account hint and the in-app "set a new password" step. */
export const backendKind = BACKENDS[CONFIG.backend] ? CONFIG.backend : 'mock';

// Accounts
export const signUp = (email, password, displayName) => backend.signUp(email, password, displayName);
export const signIn = (email, password) => backend.signIn(email, password);
export const signOut = () => backend.signOut();
export const resetPassword = (email) => backend.resetPassword(email);
export const getCurrentUser = () => backend.getCurrentUser();
export const updateProfile = (changes) => backend.updateProfile(changes);

/** Mock only: stands in for the page the reset email links to. */
export const confirmPasswordReset = (email, newPassword) =>
  backend.confirmPasswordReset ? backend.confirmPasswordReset(email, newPassword) : Promise.resolve();

// Tasks
export const getTasks = () => backend.getTasks();
export const saveTask = (task) => backend.saveTask(task);
export const deleteTask = (id) => backend.deleteTask(id);

// Focus sessions
export const recordSession = (session) => backend.recordSession(session);
export const getSessions = (options = {}) => backend.getSessions(options);

// Settings
export const getSettings = () => backend.getSettings();
export const saveSettings = (settings) => backend.saveSettings(settings);

// Shop
export const getPurchases = () => backend.getPurchases();
export const purchase = (itemId, price) => backend.purchase(itemId, price);
