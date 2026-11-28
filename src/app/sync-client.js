/* =====================================================================
   SYNC CLIENT (screen side)
   The sync engine (src/sync/engine.js) runs with the services. The
   screens:
     - mirror what it writes to storage into app.sync
     - ask it to check in often while the Devices screen is open or a
       pairing is in progress (every 2 s), and now and then otherwise
     - reload the account quietly when another device's changes arrive
   app.sync = { status, pairing, peers: [], config, device }
   ===================================================================== */

import { storage, STORAGE_KEYS } from '../core/storage.js';
import { ACTIVE_STAGES, DEFAULT_SYNC_CONFIG } from '../sync/engine.js';
import { syncCommand } from '../services/index.js';
import { loadAccount } from './account.js';

const FAST_MS = 2000;
const SLOW_MS = 20000;

export function emptySyncView() {
  return { status: { service: 'unknown', nearby: [] }, pairing: null, peers: [], config: { ...DEFAULT_SYNC_CONFIG }, device: null };
}

/** The pairing as the screens may see it: no keys, and the code only on the device that shows it. */
function publicPairing(pairing) {
  if (!pairing) return null;
  const { id, role, stage, peer, account, attempts, accepted, confirmed, reason, expiresAt } = pairing;
  return { id, role, stage, peer, account, attempts: attempts || 0, accepted, confirmed, reason, expiresAt, code: role === 'responder' ? pairing.code : undefined };
}

/** Paired devices, without their keys. */
function publicPeers(peers) {
  return Object.values(peers || {})
    .map(({ deviceId, name, host, pairedAt, lastSyncAt, lastError }) => ({ deviceId, name, host, pairedAt, lastSyncAt, lastError }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export function isPairingActive(app) {
  const pairing = app.sync.pairing;
  return Boolean(pairing && ACTIVE_STAGES.includes(pairing.stage));
}

async function readAll(app) {
  const [status, pairing, config, device, peers] = await Promise.all([
    storage.get(STORAGE_KEYS.syncStatus),
    storage.get(STORAGE_KEYS.syncPairing),
    storage.get(STORAGE_KEYS.syncConfig),
    storage.get(STORAGE_KEYS.syncDevice),
    app.user ? storage.get(STORAGE_KEYS.syncPeers(app.user.id)) : null,
  ]);
  app.sync = {
    status: status || emptySyncView().status,
    pairing: publicPairing(pairing),
    config: { ...DEFAULT_SYNC_CONFIG, ...(config || {}) },
    device: device ? { deviceId: device.deviceId, name: device.name } : null,
    peers: publicPeers(peers),
  };
}

/** Only redraw when something on screen would change (not while it's mid-typing for nothing). */
function redraw(app, before) {
  if (JSON.stringify(app.sync) === before) return;
  app.render();
}

let lastDataChangeSeen = 0;
const watchedPeerKeys = new Set();

function watchPeers(app) {
  if (!app.user) return;
  const key = STORAGE_KEYS.syncPeers(app.user.id);
  if (watchedPeerKeys.has(key)) return;
  watchedPeerKeys.add(key);
  storage.onChange(key, (peers) => {
    if (!app.user || STORAGE_KEYS.syncPeers(app.user.id) !== key) return;
    const before = JSON.stringify(app.sync);
    app.sync.peers = publicPeers(peers);
    redraw(app, before);
  });
}

/** Call once at start-up, and again after signing in (for that account's paired devices). */
export async function listenToSync(app) {
  await readAll(app);
  lastDataChangeSeen = app.sync.status.dataChangedAt || 0;
  watchPeers(app);
  if (listenToSync.started) return;
  listenToSync.started = true;

  storage.onChange(STORAGE_KEYS.syncStatus, (status) => {
    const before = JSON.stringify(app.sync);
    app.sync.status = status || emptySyncView().status;
    // Another device's changes were merged in: reload, without the loading screen.
    const changedAt = app.sync.status.dataChangedAt || 0;
    if (changedAt > lastDataChangeSeen) {
      lastDataChangeSeen = changedAt;
      if (app.user && app.data) loadAccount(app, { quiet: true });
    }
    redraw(app, before);
  });
  storage.onChange(STORAGE_KEYS.syncPairing, (pairing) => {
    const before = JSON.stringify(app.sync);
    const wasActive = isPairingActive(app);
    app.sync.pairing = publicPairing(pairing);
    // A new request while the Devices screen is open: put the cursor where it's needed.
    if (!wasActive && isPairingActive(app) && app.sync.pairing.stage === 'enter-code') app.ui.focusAfterRender = 'pairCode';
    if (app.sync.pairing?.stage === 'enter-code' && before.includes('"stage":"requested"')) app.ui.focusAfterRender = 'pairCode';
    redraw(app, before);
  });
  storage.onChange(STORAGE_KEYS.syncConfig, (config) => {
    const before = JSON.stringify(app.sync);
    app.sync.config = { ...DEFAULT_SYNC_CONFIG, ...(config || {}) };
    redraw(app, before);
  });
  storage.onChange(STORAGE_KEYS.syncDevice, (device) => {
    const before = JSON.stringify(app.sync);
    app.sync.device = device ? { deviceId: device.deviceId, name: device.name } : null;
    redraw(app, before);
  });
  startPolling(app);
}

/** Check in with the sync service: fast while pairing or on the Devices screen. */
function startPolling(app) {
  let lastCheck = 0;
  let checking = false;
  setInterval(async () => {
    if (!app.user || checking) return;
    const fast = app.ui.screen === 'devices' || isPairingActive(app);
    if (document.hidden && !isPairingActive(app)) return;
    if (Date.now() - lastCheck < (fast ? FAST_MS : SLOW_MS)) return;
    lastCheck = Date.now();
    checking = true;
    try {
      await syncCommand('tick');
    } catch {
      /* the status in storage says what went wrong */
    }
    checking = false;
  }, 500);
}

/** Run a sync command from a button; returns { ok, value } or { ok: false, error }. */
export async function runSync(command, ...args) {
  try {
    return { ok: true, value: await syncCommand(command, ...args) };
  } catch (error) {
    return { ok: false, error };
  }
}
