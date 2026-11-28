/* =====================================================================
   FINISHED-SESSION QUEUE
   A finished focus session is put in a queue first, then saved. If saving
   fails (offline, server down) it stays queued and is retried every few
   minutes and when the browser comes back online, so a session is never
   lost. The app shows the queue as "N finished sessions are waiting to
   sync" with a Retry button.
   ===================================================================== */

import { storage, STORAGE_KEYS } from '../core/storage.js';
import { recordSession } from '../data/index.js';
import { scheduler } from '../core/scheduler.js';

const RETRY_MS = 5 * 60000;
scheduler.define('session-retry', () => flushPendingSessions());

export async function pendingSessions() {
  return (await storage.get(STORAGE_KEYS.pendingSessions)) || [];
}

export async function queueSession(session) {
  const queue = await pendingSessions();
  if (!queue.some((queued) => queued.id === session.id)) queue.push(session);
  await storage.set(STORAGE_KEYS.pendingSessions, queue);
  return flushPendingSessions();
}

let flushing = null;

/** Try to save every queued session. Returns how many are still waiting. */
export function flushPendingSessions() {
  flushing ??= (async () => {
    try {
      for (const session of await pendingSessions()) {
        try {
          await recordSession(session);
          const remaining = (await pendingSessions()).filter((queued) => queued.id !== session.id);
          await storage.set(STORAGE_KEYS.pendingSessions, remaining);
        } catch (error) {
          if (error.code !== 'signed-out') console.warn('[sessions] save failed, will retry', error);
          break; // probably offline: stop and retry later
        }
      }
      const left = (await pendingSessions()).length;
      if (left) scheduler.at('session-retry', Date.now() + RETRY_MS);
      else scheduler.cancel('session-retry');
      return left;
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}
