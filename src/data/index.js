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
import * as localBackend from './local-backend.js';

const BACKENDS = {
  local: localBackend,
};

const backend = BACKENDS[CONFIG.backend] || localBackend;

/** 'local' resets passwords on this device (there's no email to send). */
export const backendKind = BACKENDS[CONFIG.backend] ? CONFIG.backend : 'local';

// Accounts
export const signUp = (email, password, displayName) => backend.signUp(email, password, displayName);
export const signIn = (email, password) => backend.signIn(email, password);
export const signOut = () => backend.signOut();
export const resetPassword = (email) => backend.resetPassword(email);
export const getCurrentUser = () => backend.getCurrentUser();
export const updateProfile = (changes) => backend.updateProfile(changes);

/** Local backend: sets the new password straight away (a server backend emails a link instead). */
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

// Device sync (src/sync/): this account's data in the form devices exchange, and merging another device's copy in
export const exportSnapshot = () => backend.exportSnapshot();
export const importSnapshot = (snapshot) => backend.importSnapshot(snapshot);
