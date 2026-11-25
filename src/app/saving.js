/* =====================================================================
   SAVING CHANGES
   Every change follows the same steps:
     1. apply()   update the screen straight away
     2. remote()  save it through src/data/
     3. success → "Synced"; failure → revert(), show the error with Retry (req 6.5)
   ===================================================================== */

import { writeCache, logout } from './account.js';

/**
 * options:
 *   remote   () => Promise    the data call, e.g. () => data.saveTask(task)
 *   apply    () => void       optional local change shown before the save finishes
 *   revert   () => void       optional undo of apply() if the save fails
 *   quiet    true             don't show the red banner (the caller shows the error itself)
 * Returns { ok: true, value } or { ok: false, error }.
 */
export async function saveChange(app, options) {
  const { remote, apply, revert, quiet = false } = options;
  if (apply) apply();
  app.syncState = 'syncing';
  app.render();

  try {
    const value = await remote();
    app.syncState = 'synced';
    app.lastSyncedAt = Date.now();
    app.failedSave = null;
    await writeCache(app);
    app.render();
    return { ok: true, value };
  } catch (error) {
    if (revert) revert();
    if (error.code === 'signed-out') {
      await logout(app, { notice: error.message });
      return { ok: false, error };
    }
    app.syncState = error.code === 'network' ? 'offline' : 'failed';
    if (!quiet) app.failedSave = { message: error.message, retry: () => saveChange(app, options) };
    app.render();
    return { ok: false, error };
  }
}
