/* =====================================================================
   SYNC: TALKING TO THE LOCAL SYNC SERVICE
   The sync service (sync-service/pomodoro-sync.mjs) runs on this
   computer at http://127.0.0.1:<port>. It finds other devices on the
   network and passes messages to them. Every call here fails with a
   RelayError whose `code` the engine and screens understand:
     service-offline   nothing answers on the port (not started)
     not-registered    the service doesn't know this app yet (it re-registers)
     unknown-device    the other device isn't on the network right now
     unreachable       the other computer didn't answer (firewall?)
   ===================================================================== */

import { CONFIG } from '../config.js';

export const SYNC_PORT = CONFIG.syncPort || 47821;
const BASE_URL = CONFIG.syncServiceUrl || `http://127.0.0.1:${SYNC_PORT}`;
const TIMEOUT_MS = 8000;

export class RelayError extends Error {
  constructor(code, message = code) {
    super(message);
    this.code = code;
  }
}

async function call(path, { method = 'GET', body, device, timeout = TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const headers = {};
  if (body) headers['content-type'] = 'application/json';
  if (device) {
    headers['x-device-id'] = device.deviceId;
    headers['x-device-token'] = device.token;
  }
  let response;
  try {
    response = await fetch(BASE_URL + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: controller.signal, cache: 'no-store' });
  } catch {
    throw new RelayError('service-offline');
  } finally {
    clearTimeout(timer);
  }
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new RelayError(json.error || `http-${response.status}`);
  return json;
}

export const relay = {
  url: BASE_URL,
  status: () => call('/api/status', { timeout: 2500 }),
  register: (device) =>
    call('/api/register', { method: 'POST', body: { deviceId: device.deviceId, token: device.token, name: device.name, platform: device.platform } }),
  devices: (device) => call('/api/devices', { device }),
  send: (device, to, message) => call('/api/send', { method: 'POST', body: { to, message }, device, timeout: 12000 }),
  inbox: (device) => call('/api/inbox', { device }),
  addPeer: (device, address) => call('/api/add-peer', { method: 'POST', body: { address }, device, timeout: 8000 }),
};
