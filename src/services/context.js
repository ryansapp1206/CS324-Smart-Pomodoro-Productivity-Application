/* =====================================================================
   SERVICE CONTEXT
   The timer and reminders read the signed-in user's settings from a copy
   in storage (STORAGE_KEYS.settings), written whenever settings load or
   save, so they never have to wait for the backend.
   ===================================================================== */

import { storage, STORAGE_KEYS } from '../core/storage.js';
import { normalizeSettings } from '../data/model.js';
import { getCurrentUser } from '../data/index.js';

export async function loadSettings() {
  return normalizeSettings((await storage.get(STORAGE_KEYS.settings)) || {});
}

export async function isSignedIn() {
  return Boolean(await getCurrentUser());
}
