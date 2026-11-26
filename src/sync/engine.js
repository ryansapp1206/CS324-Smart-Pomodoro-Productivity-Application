/* =====================================================================
   SYNC ENGINE: pairing devices and keeping them in step
   Runs where the services run: the extension's background, or the page
   on the website (src/services/index.js). Screens call it through
   syncCommand() and read what it writes to storage:
     STORAGE_KEYS.syncStatus    the service, nearby devices, notices
     STORAGE_KEYS.syncPairing   the pairing in progress (if any)
     STORAGE_KEYS.syncPeers(u)  devices paired with account u, with their keys
     STORAGE_KEYS.syncConfig    { autoSync } for this device
     STORAGE_KEYS.syncDevice    this app's id, name and service token

   Rules that keep data safe:
     - Nothing but the pairing handshake (public keys, nonces, a
       commitment, the account's name and email) is sent before BOTH
       devices have confirmed: the code shown on the other device was typed
       here correctly, AND the other device's user pressed Accept.
     - After that, every message is encrypted and authenticated with the
       pair's own key (src/sync/crypto.js). Anything that doesn't decrypt
       is dropped.
     - Data is only exchanged with devices paired to the account that's
       signed in right now.
   ===================================================================== */

import { storage, STORAGE_KEYS } from '../core/storage.js';
import { IS_EXTENSION } from '../core/platform.js';
import { t } from '../core/theme-engine.js';
import * as data from '../data/index.js';
import { showNotification } from '../services/notify.js';
import { isUiVisible } from '../services/context.js';
import { relay, RelayError } from './relay.js';
import {
  commitmentFor,
  createKeyPair,
  decryptJson,
  derivePairingKey,
  encryptJson,
  randomBase64,
  randomId,
  sameText,
  sha256Base64,
  verificationCode,
} from './crypto.js';
import { canonicalJson, sanitizeSnapshot } from './merge.js';

const PAIRING_TTL_MS = 5 * 60000;
const MAX_CODE_ATTEMPTS = 3;
const RESYNC_EVERY_MS = 10 * 60000; // auto-sync sends at least this often, even with nothing new
export const ACTIVE_STAGES = ['requested', 'waiting-reveal', 'enter-code', 'show-code', 'waiting-accept'];
export const DEFAULT_SYNC_CONFIG = { autoSync: true };

/* ------------------------- One thing at a time ------------------------- */

let queue = Promise.resolve();
function exclusive(task) {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

/* ------------------------------ Identity ------------------------------ */

function describeBrowser() {
  const agent = globalThis.navigator?.userAgent || '';
  const browser = /Firefox\//.test(agent)
    ? 'Firefox'
    : /Edg\//.test(agent)
      ? 'Edge'
      : globalThis.navigator?.brave
        ? 'Brave'
        : /OPR\//.test(agent)
          ? 'Opera'
          : /Chrome\//.test(agent)
            ? 'Chrome'
            : /Safari\//.test(agent)
              ? 'Safari'
              : 'Browser';
  const system = /Windows/.test(agent)
    ? 'Windows'
    : /Android/.test(agent)
      ? 'Android'
      : /iPhone|iPad/.test(agent)
        ? 'iOS'
        : /Mac OS X/.test(agent)
          ? 'macOS'
          : /CrOS/.test(agent)
            ? 'ChromeOS'
            : /Linux/.test(agent)
              ? 'Linux'
              : '';
  return { browser, system };
}

function defaultDevice() {
  const { browser, system } = describeBrowser();
  return {
    deviceId: randomId('a_', 12),
    token: randomBase64(24),
    name: system ? `${browser} on ${system}` : browser,
    platform: `${browser}${IS_EXTENSION ? ' extension' : ' web'}`,
  };
}

async function getDevice() {
  let device = await storage.get(STORAGE_KEYS.syncDevice);
  if (!device || !device.deviceId || !device.token) {
    device = defaultDevice();
    await storage.set(STORAGE_KEYS.syncDevice, device);
  }
  return device;
}

/* ------------------------------ Storage ------------------------------ */

export async function getConfig() {
  return { ...DEFAULT_SYNC_CONFIG, ...((await storage.get(STORAGE_KEYS.syncConfig)) || {}) };
}

async function getStatus() {
  return (await storage.get(STORAGE_KEYS.syncStatus)) || { service: 'unknown', nearby: [], serviceInfo: null, notice: null, dataChangedAt: 0 };
}

/** Only writes when something changed, so the screens don't redraw for nothing. */
async function updateStatus(changes) {
  const current = await getStatus();
  const next = { ...current, ...changes };
  if (JSON.stringify(next) !== JSON.stringify(current)) await storage.set(STORAGE_KEYS.syncStatus, next);
  return next;
}

/** A short message for the screens (and a notification when the app isn't on screen). */
async function notice(kind, key, params = {}, { notify = false } = {}) {
  await updateStatus({ notice: { kind, key, params, at: Date.now() } });
  if (notify && !isUiVisible()) showNotification(`sync-${key}`, t('sync.title'), t(key, params));
}

async function getPairing() {
  return (await storage.get(STORAGE_KEYS.syncPairing)) || null;
}

async function setPairing(pairing) {
  if (pairing) await storage.set(STORAGE_KEYS.syncPairing, pairing);
  else await storage.remove(STORAGE_KEYS.syncPairing);
}

const isActive = (pairing) => Boolean(pairing && ACTIVE_STAGES.includes(pairing.stage) && Date.now() < pairing.expiresAt);

/** A finished or failed pairing, without anything secret. */
function endedPairing(pairing, stage, reason = null) {
  return { id: pairing.id, role: pairing.role, stage, reason, peer: pairing.peer, account: pairing.account || null, endedAt: Date.now(), expiresAt: Date.now() + 60000 };
}

async function getPeers(userId) {
  return (await storage.get(STORAGE_KEYS.syncPeers(userId))) || {};
}

async function savePeers(userId, peers) {
  await storage.set(STORAGE_KEYS.syncPeers(userId), peers);
}

async function updatePeer(userId, deviceId, changes) {
  const peers = await getPeers(userId);
  if (!peers[deviceId]) return null;
  peers[deviceId] = { ...peers[deviceId], ...changes };
  await savePeers(userId, peers);
  return peers[deviceId];
}

async function requireUser() {
  const user = await data.getCurrentUser();
  if (!user) throw new RelayError('signed-out');
  return user;
}

/* ------------------------------ Messages ------------------------------ */

function send(device, to, type, fields = {}) {
  return relay.send(device, to, { app: 'pomodoro', v: 1, type, ...fields });
}

/** Encryption context: binds a message to its purpose and to who sent it to whom. */
const context = (purpose, pairId, from, to) => `${purpose}|${pairId || ''}|${from}>${to}`;

async function register(device) {
  try {
    return await relay.register(device);
  } catch (error) {
    // Someone else holds this id at the service (e.g. the service's data was copied): start fresh.
    if (error.code !== 'device-token-mismatch') throw error;
    await storage.remove(STORAGE_KEYS.syncDevice);
    const fresh = await getDevice();
    return relay.register(fresh);
  }
}

function serviceSummary(info) {
  return {
    name: info.name,
    version: info.version,
    port: info.port,
    platform: info.platform,
    addresses: info.addresses || [],
    firewall: info.firewall || null,
    script: info.script || null,
  };
}

/* ================================ Tick ================================ */

/**
 * Check in with the sync service: refresh nearby devices, handle any
 * messages, and (with auto-sync on) send changes to paired devices.
 * Runs every 30 s in the background, and every few seconds while the
 * Devices screen is open.
 */
export function tick() {
  return exclusive(async () => {
    let device = await getDevice();
    let info;
    try {
      info = await register(device);
      device = await getDevice();
    } catch (error) {
      await updateStatus({ service: error.code === 'service-offline' ? 'offline' : 'error', serviceError: error.code, nearby: [] });
      await expirePairing();
      return { service: 'offline' };
    }

    let devicesReply;
    let inboxReply;
    try {
      [devicesReply, inboxReply] = await Promise.all([relay.devices(device), relay.inbox(device)]);
    } catch (error) {
      await updateStatus({ service: error.code === 'service-offline' ? 'offline' : 'error', serviceError: error.code });
      return { service: 'offline' };
    }
    for (const envelope of inboxReply.messages || []) {
      try {
        await handleMessage(device, envelope);
      } catch (error) {
        console.warn('[sync] message failed', envelope?.message?.type, error);
      }
    }
    await expirePairing();
    const config = await getConfig();
    if (config.autoSync) await syncPeers(device, { onlyChanged: true });

    const peers = devicesReply.peers || [];
    await updateStatus({
      service: 'online',
      serviceError: null,
      serviceInfo: serviceSummary(info),
      nearby: devicesReply.devices || [],
      otherComputers: peers.map((peer) => ({ name: peer.name, address: peer.address, devices: peer.devices })),
      deviceName: device.name,
    });
    return { service: 'online' };
  });
}

async function expirePairing() {
  const pairing = await getPairing();
  if (!pairing) return;
  if (ACTIVE_STAGES.includes(pairing.stage) && Date.now() >= pairing.expiresAt) await setPairing(endedPairing(pairing, 'cancelled', 'expired'));
  else if (!ACTIVE_STAGES.includes(pairing.stage) && Date.now() >= pairing.expiresAt) await setPairing(null);
}

/* =============================== Pairing =============================== */

/** Start pairing with a nearby device. `target` = { deviceId, name, host }. */
export function startPairing(target) {
  return exclusive(async () => {
    const user = await requireUser();
    const device = await getDevice();
    const current = await getPairing();
    if (isActive(current)) throw new RelayError('pairing-busy');
    if (!target || typeof target.deviceId !== 'string') throw new RelayError('unknown-device');
    if (target.deviceId === device.deviceId) throw new RelayError('this-device');

    const keys = await createKeyPair();
    const nonce = randomBase64(16);
    const pairing = {
      id: randomId('p_', 12),
      role: 'initiator',
      stage: 'requested',
      peer: { deviceId: target.deviceId, name: String(target.name || '').slice(0, 60), host: String(target.host || '').slice(0, 60) },
      createdAt: Date.now(),
      expiresAt: Date.now() + PAIRING_TTL_MS,
      keys,
      nonce,
      attempts: 0,
    };
    await setPairing(pairing);
    try {
      await send(device, target.deviceId, 'pair-request', {
        pairId: pairing.id,
        commit: await commitmentFor(keys.publicKey, nonce),
        device: { name: device.name },
        account: { name: user.displayName, email: user.email },
      });
    } catch (error) {
      await setPairing(endedPairing(pairing, 'failed', error.code));
      throw error;
    }
    return { stage: pairing.stage };
  });
}

/** The code shown on the other device, typed here. */
export function submitPairingCode(code) {
  return exclusive(async () => {
    const device = await getDevice();
    const pairing = await getPairing();
    if (!isActive(pairing) || pairing.role !== 'initiator' || pairing.stage !== 'enter-code') throw new RelayError('no-pairing');

    const typed = String(code || '').replace(/\D/g, '');
    if (!sameText(typed, pairing.code)) {
      pairing.attempts += 1;
      if (pairing.attempts >= MAX_CODE_ATTEMPTS) {
        await send(device, pairing.peer.deviceId, 'pair-cancel', { pairId: pairing.id, reason: 'wrong-code' }).catch(() => {});
        await setPairing(endedPairing(pairing, 'cancelled', 'wrong-code'));
        throw new RelayError('wrong-code-final');
      }
      await setPairing(pairing);
      throw Object.assign(new RelayError('wrong-code'), { attemptsLeft: MAX_CODE_ATTEMPTS - pairing.attempts });
    }

    const proof = await encryptJson(pairing.key, { pairId: pairing.id, role: 'initiator' }, context('confirm', pairing.id, device.deviceId, pairing.peer.deviceId));
    await send(device, pairing.peer.deviceId, 'pair-confirm', { pairId: pairing.id, proof });
    pairing.stage = 'waiting-accept';
    await setPairing(pairing);
    return { stage: pairing.stage };
  });
}

/** The other device asked to pair and this user agrees. */
export function acceptPairing() {
  return exclusive(async () => {
    const device = await getDevice();
    const pairing = await getPairing();
    if (!isActive(pairing) || pairing.role !== 'responder' || pairing.stage !== 'show-code') throw new RelayError('no-pairing');
    pairing.accepted = true;
    await setPairing(pairing);
    if (pairing.confirmed) await finishResponder(device, pairing);
    return { stage: (await getPairing())?.stage };
  });
}

/** Stop the pairing in progress (or decline a request). */
export function cancelPairing() {
  return exclusive(async () => {
    const device = await getDevice();
    const pairing = await getPairing();
    if (!pairing) return;
    if (isActive(pairing)) {
      const reason = pairing.role === 'responder' ? 'declined' : 'cancelled';
      await send(device, pairing.peer.deviceId, 'pair-cancel', { pairId: pairing.id, reason }).catch(() => {});
    }
    await setPairing(null);
  });
}

export function dismissPairing() {
  return exclusive(async () => {
    const pairing = await getPairing();
    if (pairing && !isActive(pairing)) await setPairing(null);
  });
}

async function finishResponder(device, pairing) {
  const user = await requireUser();
  const peers = await getPeers(user.id);
  peers[pairing.peer.deviceId] = { deviceId: pairing.peer.deviceId, name: pairing.peer.name, host: pairing.peer.host, key: pairing.key, pairedAt: Date.now(), lastSyncAt: null };
  await savePeers(user.id, peers);
  const proof = await encryptJson(pairing.key, { pairId: pairing.id, role: 'responder' }, context('done', pairing.id, device.deviceId, pairing.peer.deviceId));
  await send(device, pairing.peer.deviceId, 'pair-done', { pairId: pairing.id, proof }).catch(() => {});
  await setPairing(endedPairing(pairing, 'done'));
  await notice('success', 'sync.pair.done', { name: pairing.peer.name });
}

/** A pairing message from the device we're pairing with (anything else is ignored). */
function fromPairedPeer(pairing, envelope, message, { role, stage }) {
  return (
    isActive(pairing) &&
    pairing.id === message.pairId &&
    pairing.role === role &&
    (!stage || [].concat(stage).includes(pairing.stage)) &&
    pairing.peer.deviceId === envelope.from
  );
}

const PAIRING_HANDLERS = {
  /** B: someone wants to pair. Reply with our key; the code appears once they reveal theirs. */
  async 'pair-request'(device, envelope, message) {
    const user = await data.getCurrentUser();
    if (typeof message.pairId !== 'string' || typeof message.commit !== 'string') return;
    if (!user) return send(device, envelope.from, 'pair-cancel', { pairId: message.pairId, reason: 'signed-out' }).catch(() => {});
    const current = await getPairing();
    if (isActive(current) && current.id !== message.pairId) {
      return send(device, envelope.from, 'pair-cancel', { pairId: message.pairId, reason: 'busy' }).catch(() => {});
    }
    const keys = await createKeyPair();
    const pairing = {
      id: message.pairId.slice(0, 40),
      role: 'responder',
      stage: 'waiting-reveal',
      peer: {
        deviceId: envelope.from,
        name: String(message.device?.name || envelope.fromName || '').slice(0, 60),
        host: String(envelope.fromHost || '').slice(0, 60),
      },
      account: { name: String(message.account?.name || '').slice(0, 40), email: String(message.account?.email || '').slice(0, 120) },
      commit: message.commit,
      createdAt: Date.now(),
      expiresAt: Date.now() + PAIRING_TTL_MS,
      keys,
      nonce: randomBase64(16),
    };
    await setPairing(pairing);
    await send(device, envelope.from, 'pair-response', { pairId: pairing.id, publicKey: keys.publicKey, nonce: pairing.nonce });
    if (!isUiVisible()) {
      showNotification('sync-pair', t('sync.pair.notifTitle'), t('sync.pair.notifBody', { name: pairing.peer.name || pairing.peer.host }));
    }
  },

  /** A: they answered. Reveal our key and work out the code; the user types what B shows. */
  async 'pair-response'(device, envelope, message) {
    const pairing = await getPairing();
    if (!fromPairedPeer(pairing, envelope, message, { role: 'initiator', stage: 'requested' })) return;
    if (typeof message.publicKey !== 'string' || typeof message.nonce !== 'string') return;
    const exchange = { initiatorKey: pairing.keys.publicKey, responderKey: message.publicKey, initiatorNonce: pairing.nonce, responderNonce: message.nonce };
    try {
      pairing.key = await derivePairingKey({ privateJwk: pairing.keys.privateJwk, peerPublicKey: message.publicKey, ...exchange });
    } catch {
      return; // not a valid key
    }
    pairing.code = await verificationCode(exchange);
    pairing.stage = 'enter-code';
    pairing.keys = { publicKey: pairing.keys.publicKey }; // the private key isn't needed any more
    await setPairing(pairing);
    await send(device, envelope.from, 'pair-reveal', { pairId: pairing.id, publicKey: exchange.initiatorKey, nonce: pairing.nonce });
  },

  /** B: check their key matches what they committed to, then show the code. */
  async 'pair-reveal'(device, envelope, message) {
    const pairing = await getPairing();
    if (!fromPairedPeer(pairing, envelope, message, { role: 'responder', stage: 'waiting-reveal' })) return;
    if (typeof message.publicKey !== 'string' || typeof message.nonce !== 'string') return;
    if ((await commitmentFor(message.publicKey, message.nonce)) !== pairing.commit) {
      await send(device, envelope.from, 'pair-cancel', { pairId: pairing.id, reason: 'bad-key' }).catch(() => {});
      return setPairing(endedPairing(pairing, 'cancelled', 'bad-key'));
    }
    const exchange = { initiatorKey: message.publicKey, responderKey: pairing.keys.publicKey, initiatorNonce: message.nonce, responderNonce: pairing.nonce };
    try {
      pairing.key = await derivePairingKey({ privateJwk: pairing.keys.privateJwk, peerPublicKey: message.publicKey, ...exchange });
    } catch {
      return setPairing(endedPairing(pairing, 'cancelled', 'bad-key'));
    }
    pairing.code = await verificationCode(exchange);
    pairing.stage = 'show-code';
    pairing.keys = { publicKey: pairing.keys.publicKey };
    await setPairing(pairing);
  },

  /** B: the right code was typed on A (only A's copy of the key can produce this). */
  async 'pair-confirm'(device, envelope, message) {
    const pairing = await getPairing();
    if (!fromPairedPeer(pairing, envelope, message, { role: 'responder', stage: 'show-code' })) return;
    try {
      const proof = await decryptJson(pairing.key, message.proof, context('confirm', pairing.id, envelope.from, device.deviceId));
      if (proof.pairId !== pairing.id || proof.role !== 'initiator') throw new Error('mismatch');
    } catch {
      await send(device, envelope.from, 'pair-cancel', { pairId: pairing.id, reason: 'bad-key' }).catch(() => {});
      return setPairing(endedPairing(pairing, 'cancelled', 'bad-key'));
    }
    pairing.confirmed = true;
    await setPairing(pairing);
    if (pairing.accepted) await finishResponder(device, pairing);
  },

  /** A: B accepted. Save the pairing and send our data. */
  async 'pair-done'(device, envelope, message) {
    const pairing = await getPairing();
    if (!fromPairedPeer(pairing, envelope, message, { role: 'initiator', stage: 'waiting-accept' })) return;
    try {
      const proof = await decryptJson(pairing.key, message.proof, context('done', pairing.id, envelope.from, device.deviceId));
      if (proof.pairId !== pairing.id || proof.role !== 'responder') throw new Error('mismatch');
    } catch {
      return setPairing(endedPairing(pairing, 'cancelled', 'bad-key'));
    }
    const user = await requireUser();
    const peers = await getPeers(user.id);
    peers[pairing.peer.deviceId] = { deviceId: pairing.peer.deviceId, name: pairing.peer.name, host: pairing.peer.host, key: pairing.key, pairedAt: Date.now(), lastSyncAt: null };
    await savePeers(user.id, peers);
    await setPairing(endedPairing(pairing, 'done'));
    await notice('success', 'sync.pair.done', { name: pairing.peer.name });
    await pushTo(device, user, peers[pairing.peer.deviceId], { reply: true }).catch(() => {});
  },

  async 'pair-cancel'(device, envelope, message) {
    const pairing = await getPairing();
    if (!isActive(pairing) || pairing.id !== message.pairId || pairing.peer.deviceId !== envelope.from) return;
    const reason = ['declined', 'cancelled', 'busy', 'signed-out', 'wrong-code', 'bad-key'].includes(message.reason) ? message.reason : 'cancelled';
    await setPairing(endedPairing(pairing, 'cancelled', reason));
  },
};

/* ================================ Sync ================================ */

async function digestOf(snapshot) {
  return sha256Base64(canonicalJson(snapshot));
}

/** Send this account's data to one paired device. */
async function pushTo(device, user, peer, { reply }) {
  const snapshot = await data.exportSnapshot();
  const box = await encryptJson(peer.key, { kind: 'sync', snapshot, reply, sentAt: Date.now() }, context('sync', '', device.deviceId, peer.deviceId));
  try {
    await send(device, peer.deviceId, 'sync', { box });
  } catch (error) {
    await updatePeer(user.id, peer.deviceId, { lastError: error.code, lastErrorAt: Date.now() });
    throw error;
  }
  await updatePeer(user.id, peer.deviceId, { lastSentDigest: await digestOf(snapshot), lastSentAt: Date.now(), lastError: null });
}

/** Send to every paired device (or only those that are missing something). */
async function syncPeers(device, { onlyChanged = false, deviceId = null } = {}) {
  const user = await data.getCurrentUser();
  if (!user) return { sent: 0, failed: 0 };
  const peers = Object.values(await getPeers(user.id)).filter((peer) => !deviceId || peer.deviceId === deviceId);
  if (!peers.length) return { sent: 0, failed: 0 };
  const digest = onlyChanged ? await digestOf(await data.exportSnapshot()) : null;
  let sent = 0;
  let failed = 0;
  for (const peer of peers) {
    if (onlyChanged && peer.lastSentDigest === digest && Date.now() - (peer.lastSentAt || 0) < RESYNC_EVERY_MS) continue;
    // Don't keep knocking on a device that's away: retry it once a minute.
    if (onlyChanged && peer.lastError && Date.now() - (peer.lastErrorAt || 0) < 60000) continue;
    try {
      await pushTo(device, user, peer, { reply: true });
      sent += 1;
    } catch {
      failed += 1;
    }
  }
  return { sent, failed };
}

/** "Sync now": send to every paired device (or one) straight away. Their replies arrive on the next check. */
export function syncNow(deviceId = null) {
  return exclusive(async () => {
    const device = await getDevice();
    await register(device);
    return syncPeers(await getDevice(), { deviceId });
  });
}

async function handleSync(device, envelope, message) {
  const user = await data.getCurrentUser();
  if (!user || !message.box) return;
  const peers = await getPeers(user.id);
  const peer = peers[envelope.from];
  if (!peer) return; // not paired with this account: ignored
  let payload;
  try {
    payload = await decryptJson(peer.key, message.box, context('sync', '', envelope.from, device.deviceId));
  } catch {
    return updatePeer(user.id, peer.deviceId, { lastError: 'bad-message', lastErrorAt: Date.now() });
  }
  if (payload.kind !== 'sync' || !payload.snapshot) return;
  const stale = Number(payload.sentAt) <= Number(peer.lastReceivedSentAt || 0);
  const { snapshot: merged, changed } = await data.importSnapshot(payload.snapshot);
  const mergedDigest = await digestOf(merged);
  const theirDigest = await digestOf(sanitizeSnapshot(payload.snapshot));
  const changes = {
    lastSyncAt: Date.now(),
    lastReceivedSentAt: Math.max(Number(payload.sentAt) || 0, Number(peer.lastReceivedSentAt || 0)),
    lastError: null,
    name: String(envelope.fromName || peer.name).slice(0, 60),
  };
  if (mergedDigest === theirDigest) Object.assign(changes, { lastSentDigest: mergedDigest, lastSentAt: Date.now() }); // they already have everything
  const updated = await updatePeer(user.id, peer.deviceId, changes);
  if (changed) await updateStatus({ dataChangedAt: Date.now() });
  if (payload.reply && !stale) await pushTo(device, user, updated, { reply: false }).catch(() => {});
}

async function handleUnpair(device, envelope, message) {
  const user = await data.getCurrentUser();
  if (!user || !message.box) return;
  const peers = await getPeers(user.id);
  const peer = peers[envelope.from];
  if (!peer) return;
  try {
    const payload = await decryptJson(peer.key, message.box, context('unpair', '', envelope.from, device.deviceId));
    if (payload.kind !== 'unpair') return;
  } catch {
    return;
  }
  delete peers[envelope.from];
  await savePeers(user.id, peers);
  await notice('info', 'sync.unpaired', { name: peer.name });
}

async function handleMessage(device, envelope) {
  const message = envelope?.message;
  if (!message || message.app !== 'pomodoro' || typeof envelope.from !== 'string') return;
  if (PAIRING_HANDLERS[message.type]) return PAIRING_HANDLERS[message.type](device, envelope, message);
  if (message.type === 'sync') return handleSync(device, envelope, message);
  if (message.type === 'unpair') return handleUnpair(device, envelope, message);
}

/* ============================== Settings ============================== */

/** Forget a paired device here, and tell it to forget this one. */
export function unpair(deviceId) {
  return exclusive(async () => {
    const user = await requireUser();
    const device = await getDevice();
    const peers = await getPeers(user.id);
    const peer = peers[deviceId];
    if (!peer) return;
    const box = await encryptJson(peer.key, { kind: 'unpair' }, context('unpair', '', device.deviceId, deviceId));
    await send(device, deviceId, 'unpair', { box }).catch(() => {});
    delete peers[deviceId];
    await savePeers(user.id, peers);
  });
}

/** For networks where broadcasts don't get through: reach a computer by its IP address. */
export function addPeerByAddress(address) {
  return exclusive(async () => {
    const device = await getDevice();
    await register(device);
    return relay.addPeer(await getDevice(), address);
  });
}

export async function setAutoSync(isOn) {
  const config = await getConfig();
  await storage.set(STORAGE_KEYS.syncConfig, { ...config, autoSync: Boolean(isOn) });
  if (isOn) tick().catch(() => {});
}

export function renameDevice(name) {
  return exclusive(async () => {
    const clean = String(name || '').trim().slice(0, 40);
    if (!clean) throw new RelayError('bad-name');
    const device = await getDevice();
    await storage.set(STORAGE_KEYS.syncDevice, { ...device, name: clean });
    await updateStatus({ deviceName: clean });
    await relay.register({ ...device, name: clean }).catch(() => {});
  });
}

export async function clearNotice() {
  await updateStatus({ notice: null });
}

/** Every command the screens can run (through syncCommand in src/services/index.js). */
export const SYNC_COMMANDS = {
  tick,
  startPairing,
  submitPairingCode,
  acceptPairing,
  cancelPairing,
  dismissPairing,
  syncNow,
  unpair,
  addPeerByAddress,
  setAutoSync,
  renameDevice,
  clearNotice,
};
