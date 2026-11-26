#!/usr/bin/env node
/* =====================================================================
   POMODORO LOCAL SYNC SERVICE
   A small helper that lets the Pomodoro app (extension or website) on
   this computer find and talk to Pomodoro on other devices on the same
   local network. Browsers can't open network ports themselves, so each
   device runs one of these.

     node pomodoro-sync.mjs                 start the service (port 47821)
     node pomodoro-sync.mjs status          is it running? what has it found?
     node pomodoro-sync.mjs doctor          find out why devices don't appear
     node pomodoro-sync.mjs firewall        show the command that opens the port
     node pomodoro-sync.mjs firewall --apply   …and run it (asks for your password)
     node pomodoro-sync.mjs install         start it automatically when you log in
     node pomodoro-sync.mjs uninstall       stop starting it automatically

   Options: --port <n> (default 47821), --name "<device name>",
            --allow-origin <url> (another website allowed to use it).

   What it does:
     - Discovery: every few seconds it broadcasts a small UDP packet on the
       port, saying "Pomodoro is here" and which apps are connected. Other
       copies answer, and the app lists them as nearby devices.
     - Relay: it passes messages between apps (HTTP on the same port).
       Everything except the pairing handshake is end-to-end encrypted by
       the apps with a key only the paired devices have, and the handshake
       carries nothing but public keys. This service never sees your tasks,
       sessions or settings in readable form, and can't fake them.
     - The app-facing API (/api/…) only answers this computer
       (127.0.0.1) and only the Pomodoro extension or allowed websites.

   Needs Node.js 18 or newer. No packages to install.
   ===================================================================== */

import http from 'node:http';
import dgram from 'node:dgram';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const VERSION = '1.0.0';
export const DEFAULT_PORT = 47821;
const SERVICE = 'pomodoro-sync';
const SCRIPT_PATH = fileURLToPath(import.meta.url);

const ANNOUNCE_EVERY_MS = 5000;
const PEER_EXPIRES_MS = 20000; // a computer that stopped announcing
const MANUAL_PEER_REFRESH_MS = 15000;
const CLIENT_ONLINE_MS = 2 * 60000; // app seen recently = "online"
const CLIENT_FORGET_MS = 30 * 86400000; // app not seen for 30 days is forgotten
const MAILBOX_MAX = 200; // messages kept per app
const MESSAGE_MAX_AGE_MS = 7 * 86400000;
const BODY_LIMIT = 8 * 1024 * 1024; // 8 MB per request
const INBOX_WAIT_MAX_MS = 25000;
const PEER_TIMEOUT_MS = 6000;

/** Websites (besides the extension and localhost) allowed to use the local API. */
const DEFAULT_ALLOWED_ORIGINS = ['https://ryansapp1206.github.io'];

/* ============================ Command line ============================ */

function parseArgs(argv) {
  const options = { command: 'start', port: DEFAULT_PORT, name: null, allowOrigins: [], apply: false, json: false };
  const rest = [...argv];
  if (rest[0] && !rest[0].startsWith('-')) options.command = rest.shift();
  while (rest.length) {
    const arg = rest.shift();
    if (arg === '--port' || arg === '-p') options.port = Number(rest.shift());
    else if (arg === '--name') options.name = rest.shift();
    else if (arg === '--allow-origin') options.allowOrigins.push(String(rest.shift()).replace(/\/$/, ''));
    else if (arg === '--apply') options.apply = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.command = 'help';
    else {
      console.error(`Unknown option: ${arg}`);
      options.command = 'help';
    }
  }
  if (process.env.POMODORO_SYNC_PORT) options.port = Number(process.env.POMODORO_SYNC_PORT);
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) {
    console.error('The port must be a number from 1 to 65535.');
    process.exit(2);
  }
  return options;
}

const HELP = `Pomodoro local sync service ${VERSION}

  node pomodoro-sync.mjs [start]          start the service
  node pomodoro-sync.mjs status           show whether it's running and what it has found
  node pomodoro-sync.mjs doctor           check why other devices don't appear
  node pomodoro-sync.mjs firewall         show the command that opens the port in this computer's firewall
  node pomodoro-sync.mjs firewall --apply open the port (asks for your password / needs an admin terminal)
  node pomodoro-sync.mjs install          start the service automatically when you log in
  node pomodoro-sync.mjs uninstall        undo install

Options:
  --port <n>            port to use (default ${DEFAULT_PORT}; TCP and UDP). Every device must use the same one.
  --name "<name>"       how this computer is shown to other devices (default: its hostname)
  --allow-origin <url>  let another website use the service (the extension and localhost always can)
`;

/* ============================== Storage ============================== */

function configDir() {
  if (process.env.POMODORO_SYNC_HOME) return process.env.POMODORO_SYNC_HOME;
  if (process.platform === 'win32') return path.join(process.env.APPDATA || os.homedir(), 'PomodoroSync');
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'PomodoroSync');
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'pomodoro-sync');
}

function loadState() {
  const file = path.join(configDir(), 'state.json');
  let state = {};
  try {
    state = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    /* first run */
  }
  return {
    daemonId: state.daemonId || `d_${crypto.randomBytes(9).toString('base64url')}`,
    clients: state.clients || {}, // deviceId → { name, platform, tokenHash, lastSeen }
    mailboxes: state.mailboxes || {}, // deviceId → [message]
    manualPeers: state.manualPeers || [], // ["192.168.1.20:47821"]
  };
}

let saveTimer = null;
function saveStateSoon(state) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveStateNow(state), 300);
}

function saveStateNow(state) {
  const dir = configDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, 'state.json');
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(state), { mode: 0o600 });
  fs.renameSync(temp, file);
}

/* ============================== Network ============================== */

/** This computer's local-network IPv4 addresses, with broadcast addresses. */
export function localAddresses() {
  const result = [];
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family !== 'IPv4' && entry.family !== 4) continue;
      if (entry.internal) continue;
      result.push({ interface: name, address: entry.address, netmask: entry.netmask, broadcast: broadcastOf(entry.address, entry.netmask) });
    }
  }
  return result;
}

function broadcastOf(address, netmask) {
  const a = address.split('.').map(Number);
  const m = netmask.split('.').map(Number);
  if (a.length !== 4 || m.length !== 4) return null;
  return a.map((part, i) => (part | (~m[i] & 255)) >>> 0).join('.');
}

const cleanAddress = (address) => String(address || '').replace(/^::ffff:/, '');
const isLoopback = (address) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);

/** "192.168.1.20" or "192.168.1.20:47821" or "[fe80::1]:47821" → { host, port } */
function parseHostPort(text, defaultPort) {
  const value = String(text || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!value) return null;
  const v6 = value.match(/^\[([^\]]+)\](?::(\d+))?$/);
  if (v6) return { host: v6[1], port: Number(v6[2] || defaultPort) };
  const parts = value.split(':');
  if (parts.length > 2) return { host: value, port: defaultPort }; // bare IPv6
  const port = Number(parts[1] || defaultPort);
  if (!/^[a-zA-Z0-9.-]+$/.test(parts[0]) || !Number.isInteger(port) || port < 1 || port > 65535) return null;
  return { host: parts[0], port };
}

const urlFor = (host, port, pathname) => `http://${host.includes(':') ? `[${host}]` : host}:${port}${pathname}`;

async function fetchJson(url, { method = 'GET', body, timeout = PEER_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(json.error || `HTTP ${response.status}`), { status: response.status, body: json });
    return json;
  } finally {
    clearTimeout(timer);
  }
}

/* ============================== Firewall ============================== */

function commandExists(name) {
  const probe = process.platform === 'win32' ? spawnSync('where', [name], { stdio: 'ignore' }) : spawnSync('sh', ['-c', `command -v ${name}`], { stdio: 'ignore' });
  return probe.status === 0;
}

function quiet(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 4000 });
  return { ok: result.status === 0, out: `${result.stdout || ''}${result.stderr || ''}`.trim() };
}

/**
 * The commands that let other devices reach this port, for this computer's
 * firewall. Returns { firewall, commands: [string], note }.
 */
export function firewallPlan(port) {
  if (process.platform === 'win32') {
    return {
      firewall: 'Windows Defender Firewall',
      admin: 'Run these in a terminal opened with "Run as administrator".',
      commands: [
        `netsh advfirewall firewall add rule name="Pomodoro Sync (TCP)" dir=in action=allow protocol=TCP localport=${port} profile=private,domain`,
        `netsh advfirewall firewall add rule name="Pomodoro Sync (UDP)" dir=in action=allow protocol=UDP localport=${port} profile=private,domain`,
      ],
      note: 'Windows only opens the port on networks marked Private. In Settings → Network & Internet, set your Wi-Fi or Ethernet to "Private network".',
    };
  }
  if (process.platform === 'darwin') {
    const node = process.execPath;
    return {
      firewall: 'macOS Application Firewall',
      admin: 'Asks for your password.',
      commands: [
        `sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add "${node}"`,
        `sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp "${node}"`,
      ],
      note: 'macOS lets apps through rather than ports, so this allows Node.js (which runs the sync service) to accept connections.',
    };
  }
  // Linux and other Unix
  if (commandExists('firewall-cmd') && quiet('firewall-cmd', ['--state']).ok) {
    return {
      firewall: 'firewalld',
      admin: 'Asks for your password.',
      commands: [`sudo firewall-cmd --permanent --add-port=${port}/tcp --add-port=${port}/udp`, 'sudo firewall-cmd --reload'],
      note: '',
    };
  }
  if (commandExists('ufw')) {
    return {
      firewall: 'ufw',
      admin: 'Asks for your password.',
      commands: [`sudo ufw allow ${port}/tcp comment 'Pomodoro sync'`, `sudo ufw allow ${port}/udp comment 'Pomodoro sync'`],
      note: '',
    };
  }
  if (commandExists('nft') && !commandExists('iptables')) {
    return {
      firewall: 'nftables',
      admin: 'Asks for your password. Lasts until restart unless you save your ruleset.',
      commands: [
        `sudo nft add rule inet filter input tcp dport ${port} accept`,
        `sudo nft add rule inet filter input udp dport ${port} accept`,
      ],
      note: 'If your nftables table or chain has another name, adjust "inet filter input".',
    };
  }
  return {
    firewall: 'iptables',
    admin: 'Asks for your password. Lasts until restart unless you save your rules (e.g. iptables-persistent).',
    commands: [`sudo iptables -I INPUT -p tcp --dport ${port} -j ACCEPT`, `sudo iptables -I INPUT -p udp --dport ${port} -j ACCEPT`],
    note: '',
  };
}

function runFirewall(options) {
  const plan = firewallPlan(options.port);
  console.log(`Firewall: ${plan.firewall}`);
  console.log(`To let other devices reach Pomodoro sync on port ${options.port} (TCP and UDP):\n`);
  for (const command of plan.commands) console.log(`  ${command}`);
  console.log('');
  if (plan.note) console.log(plan.note + '\n');
  if (!options.apply) {
    console.log(`Run them yourself, or run:  node "${SCRIPT_PATH}" firewall --apply${options.port !== DEFAULT_PORT ? ` --port ${options.port}` : ''}`);
    console.log(plan.admin);
    return;
  }
  console.log(`Opening the port. ${plan.admin}\n`);
  let failed = false;
  for (const command of plan.commands) {
    console.log(`> ${command}`);
    const result = spawnSync(command, { shell: true, stdio: 'inherit' });
    if (result.status !== 0) failed = true;
  }
  if (failed) {
    console.log('\nSome commands failed. On Windows, open the terminal with "Run as administrator" and try again.');
    process.exitCode = 1;
  } else {
    console.log('\nDone. Other devices on your network can now reach this one. Run "doctor" on each device if they still don\'t appear.');
  }
}

/* =============================== Service =============================== */

class SyncService {
  constructor(options) {
    this.options = options;
    this.port = options.port;
    // Normally the same number as the TCP port. Only for running two copies on one computer (testing).
    this.discoveryPort = Number(process.env.POMODORO_SYNC_DISCOVERY_PORT) || options.port;
    this.name = (options.name || os.hostname() || 'Computer').slice(0, 60);
    this.state = loadState();
    this.peers = new Map(); // daemonId → { daemonId, name, host, port, devices, lastSeen, manual }
    this.waiters = new Map(); // deviceId → Set<resolve>
    this.allowedOrigins = new Set([...DEFAULT_ALLOWED_ORIGINS, ...options.allowOrigins]);
    this.startedAt = new Date().toISOString();
    this.prune();
  }

  /* ------------------------------ Start ------------------------------ */

  async start() {
    saveStateNow(this.state);
    await this.startHttp();
    await this.startDiscovery();
    for (const peer of this.state.manualPeers) this.addManualPeer(peer).catch(() => {});
    setInterval(() => this.refreshManualPeers(), MANUAL_PEER_REFRESH_MS).unref();
    setInterval(() => this.prune(), 60000).unref();

    const addresses = localAddresses().map((entry) => entry.address);
    console.log(`Pomodoro sync ${VERSION} running as "${this.name}" on port ${this.port} (TCP + UDP).`);
    console.log(addresses.length ? `Other devices can reach this one at: ${addresses.map((a) => `${a}:${this.port}`).join(', ')}` : 'Not connected to a local network yet.');
    console.log('Leave this window open (or run "install" to start it automatically). Ctrl+C stops it.');
    console.log(`If other devices don't see this one, run:  node "${SCRIPT_PATH}" firewall --apply`);
  }

  startHttp() {
    this.server = http.createServer((req, res) => this.handle(req, res).catch((error) => this.fail(res, 500, error.message || 'error')));
    this.server.keepAliveTimeout = 30000;
    this.server.requestTimeout = 60000;
    return new Promise((resolve, reject) => {
      this.server.once('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`Port ${this.port} is already in use. Pomodoro sync may already be running (check with "status"), or pick another port with --port.`);
        }
        reject(error);
      });
      this.server.listen(this.port, '0.0.0.0', resolve);
    });
  }

  startDiscovery() {
    this.udp = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    this.udp.on('message', (buffer, rinfo) => this.onDatagram(buffer, rinfo));
    this.udp.on('error', (error) => console.warn('[discovery]', error.message));
    return new Promise((resolve) => {
      this.udp.bind(this.discoveryPort, () => {
        try {
          this.udp.setBroadcast(true);
        } catch {
          /* some systems refuse; unicast still works */
        }
        this.announce('query');
        setInterval(() => this.announce('announce'), ANNOUNCE_EVERY_MS).unref();
        resolve();
      });
    });
  }

  /* ---------------------------- Discovery ---------------------------- */

  announcement(kind) {
    return Buffer.from(
      JSON.stringify({ t: SERVICE, v: 1, kind, daemonId: this.state.daemonId, name: this.name, port: this.port, devices: this.publicDevices() })
    );
  }

  announce(kind) {
    const packet = this.announcement(kind);
    const targets = new Set(['255.255.255.255']);
    for (const entry of localAddresses()) if (entry.broadcast) targets.add(entry.broadcast);
    for (const target of targets) this.udp.send(packet, this.discoveryPort, target, () => {});
  }

  onDatagram(buffer, rinfo) {
    let message;
    try {
      message = JSON.parse(buffer.toString('utf8'));
    } catch {
      return;
    }
    if (message?.t !== SERVICE) return;
    // A troubleshooting probe ("doctor") or another service asking who's here: answer it directly.
    if (message.kind === 'query' || message.kind === 'probe') {
      this.udp.send(this.announcement('announce'), rinfo.port, rinfo.address, () => {});
    }
    if (!message.daemonId || message.daemonId === this.state.daemonId || message.kind === 'probe') return;
    this.rememberPeer({
      daemonId: String(message.daemonId),
      name: String(message.name || 'Computer').slice(0, 60),
      host: rinfo.address,
      port: Number(message.port) || this.port,
      devices: Array.isArray(message.devices) ? message.devices : [],
    });
  }

  rememberPeer({ daemonId, name, host, port, devices, manual = false }) {
    const existing = this.peers.get(daemonId);
    const cleanDevices = (devices || [])
      .filter((device) => device && typeof device.deviceId === 'string')
      .slice(0, 50)
      .map((device) => ({
        deviceId: device.deviceId.slice(0, 80),
        name: String(device.name || 'Pomodoro').slice(0, 60),
        platform: String(device.platform || '').slice(0, 40),
        lastSeen: Number(device.lastSeen) || 0,
      }));
    this.peers.set(daemonId, {
      daemonId,
      name,
      host,
      port,
      devices: cleanDevices,
      lastSeen: Date.now(),
      manual: manual || Boolean(existing?.manual),
    });
  }

  async addManualPeer(text) {
    const target = parseHostPort(text, this.port);
    if (!target) throw Object.assign(new Error('bad-address'), { status: 400 });
    const hello = await fetchJson(urlFor(target.host, target.port, '/peer/hello'), { timeout: 4000 });
    if (hello.service !== SERVICE) throw Object.assign(new Error('not-pomodoro'), { status: 502 });
    if (hello.daemonId === this.state.daemonId) throw Object.assign(new Error('this-computer'), { status: 400 });
    this.rememberPeer({ daemonId: hello.daemonId, name: hello.name, host: target.host, port: target.port, devices: hello.devices, manual: true });
    const key = `${target.host}:${target.port}`;
    if (!this.state.manualPeers.includes(key)) {
      this.state.manualPeers.push(key);
      saveStateSoon(this.state);
    }
    return this.peers.get(hello.daemonId);
  }

  refreshManualPeers() {
    for (const peer of this.state.manualPeers) this.addManualPeer(peer).catch(() => {});
  }

  /* ----------------------------- Clients ----------------------------- */

  publicDevices() {
    return Object.entries(this.state.clients).map(([deviceId, client]) => ({
      deviceId,
      name: client.name,
      platform: client.platform,
      lastSeen: client.lastSeen,
    }));
  }

  hashToken(token) {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
  }

  /** The app making a local request, checked by its id and secret token. */
  authClient(req) {
    const deviceId = String(req.headers['x-device-id'] || '');
    const token = String(req.headers['x-device-token'] || '');
    const client = this.state.clients[deviceId];
    if (!client || !token) return null;
    const expected = Buffer.from(client.tokenHash, 'hex');
    const actual = Buffer.from(this.hashToken(token), 'hex');
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
    client.lastSeen = Date.now();
    return { deviceId, ...client };
  }

  register({ deviceId, token, name, platform }) {
    if (typeof deviceId !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(deviceId)) throw Object.assign(new Error('bad-device-id'), { status: 400 });
    if (typeof token !== 'string' || token.length < 16) throw Object.assign(new Error('bad-token'), { status: 400 });
    const existing = this.state.clients[deviceId];
    const tokenHash = this.hashToken(token);
    if (existing && existing.tokenHash !== tokenHash) throw Object.assign(new Error('device-token-mismatch'), { status: 403 });
    this.state.clients[deviceId] = {
      name: String(name || 'Pomodoro').slice(0, 60),
      platform: String(platform || '').slice(0, 40),
      tokenHash,
      lastSeen: Date.now(),
      registeredAt: existing?.registeredAt || Date.now(),
    };
    saveStateSoon(this.state);
  }

  /** Every device an app here could pair or sync with. */
  nearbyDevices(selfId) {
    const now = Date.now();
    const list = [];
    for (const device of this.publicDevices()) {
      if (device.deviceId === selfId) continue;
      list.push({ ...device, host: this.name, daemonId: this.state.daemonId, address: '127.0.0.1', local: true, online: now - device.lastSeen < CLIENT_ONLINE_MS });
    }
    for (const peer of this.peers.values()) {
      for (const device of peer.devices) {
        if (device.deviceId === selfId) continue;
        list.push({
          ...device,
          host: peer.name,
          daemonId: peer.daemonId,
          address: `${peer.host}:${peer.port}`,
          local: false,
          online: now - device.lastSeen < CLIENT_ONLINE_MS + ANNOUNCE_EVERY_MS,
        });
      }
    }
    return list.sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
  }

  peerList() {
    return [...this.peers.values()].map((peer) => ({
      daemonId: peer.daemonId,
      name: peer.name,
      address: `${peer.host}:${peer.port}`,
      devices: peer.devices.length,
      manual: peer.manual,
      lastSeen: peer.lastSeen,
    }));
  }

  /* ----------------------------- Mailboxes ----------------------------- */

  deliverLocal(to, envelope) {
    if (!this.state.clients[to]) return false;
    const box = (this.state.mailboxes[to] ||= []);
    box.push({ id: crypto.randomBytes(8).toString('hex'), at: Date.now(), ...envelope });
    if (box.length > MAILBOX_MAX) box.splice(0, box.length - MAILBOX_MAX);
    saveStateSoon(this.state);
    const waiting = this.waiters.get(to);
    if (waiting) {
      this.waiters.delete(to);
      for (const resolve of waiting) resolve();
    }
    return true;
  }

  takeInbox(deviceId) {
    const box = this.state.mailboxes[deviceId] || [];
    if (box.length) {
      this.state.mailboxes[deviceId] = [];
      saveStateSoon(this.state);
    }
    return box;
  }

  waitForMail(deviceId, ms) {
    return new Promise((resolve) => {
      const set = this.waiters.get(deviceId) || new Set();
      this.waiters.set(deviceId, set);
      const done = () => {
        clearTimeout(timer);
        set.delete(done);
        resolve();
      };
      const timer = setTimeout(done, ms);
      set.add(done);
    });
  }

  /** Send to an app here or on another computer. */
  async route(from, to, message) {
    const envelope = { from: from.deviceId, fromName: from.name, fromHost: this.name, fromDaemon: this.state.daemonId, message };
    if (this.state.clients[to]) {
      this.deliverLocal(to, envelope);
      return { delivered: 'local' };
    }
    const peer = [...this.peers.values()].find((candidate) => candidate.devices.some((device) => device.deviceId === to));
    if (!peer) throw Object.assign(new Error('unknown-device'), { status: 404 });
    try {
      await fetchJson(urlFor(peer.host, peer.port, '/peer/deliver'), { method: 'POST', body: { to, fromPort: this.port, ...envelope } });
    } catch (error) {
      throw Object.assign(new Error(error.status === 404 ? 'unknown-device' : 'unreachable'), { status: error.status === 404 ? 404 : 502 });
    }
    return { delivered: 'remote' };
  }

  prune() {
    const now = Date.now();
    for (const [deviceId, client] of Object.entries(this.state.clients)) {
      if (now - client.lastSeen > CLIENT_FORGET_MS) {
        delete this.state.clients[deviceId];
        delete this.state.mailboxes[deviceId];
      }
    }
    for (const [deviceId, box] of Object.entries(this.state.mailboxes)) {
      this.state.mailboxes[deviceId] = box.filter((message) => now - message.at < MESSAGE_MAX_AGE_MS);
    }
    for (const [daemonId, peer] of this.peers) {
      if (!peer.manual && now - peer.lastSeen > PEER_EXPIRES_MS) this.peers.delete(daemonId);
    }
  }

  /* ------------------------------- HTTP ------------------------------- */

  originAllowed(origin) {
    if (!origin) return true; // not a browser page (curl, this script)
    if (/^(chrome|moz|safari-web)-extension:\/\//.test(origin)) return true;
    if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin)) return true;
    return this.allowedOrigins.has(origin);
  }

  /** The local API is for this computer only, and refuses pages that just pretend to be localhost (DNS rebinding). */
  checkLocal(req) {
    if (!isLoopback(req.socket.remoteAddress)) return 'local-only';
    const host = String(req.headers.host || '').replace(/:\d+$/, '');
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(host)) return 'bad-host';
    if (!this.originAllowed(req.headers.origin)) return 'origin-not-allowed';
    return null;
  }

  corsHeaders(req) {
    const origin = req.headers.origin;
    if (!origin || !this.originAllowed(origin)) return {};
    return {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type, x-device-id, x-device-token',
      'access-control-allow-private-network': 'true', // Chrome's Private Network Access
      'access-control-max-age': '600',
      vary: 'Origin',
    };
  }

  send(res, status, body, extraHeaders = {}) {
    if (res.headersSent) return;
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...extraHeaders });
    res.end(JSON.stringify(body));
  }

  fail(res, status, error, extraHeaders) {
    this.send(res, status, { ok: false, error }, extraHeaders);
  }

  readBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      req.on('data', (chunk) => {
        size += chunk.length;
        if (size > BODY_LIMIT) {
          reject(Object.assign(new Error('too-large'), { status: 413 }));
          req.destroy();
        } else chunks.push(chunk);
      });
      req.on('end', () => {
        if (!chunks.length) return resolve({});
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch {
          reject(Object.assign(new Error('bad-json'), { status: 400 }));
        }
      });
      req.on('error', reject);
    });
  }

  status() {
    return {
      ok: true,
      service: SERVICE,
      version: VERSION,
      daemonId: this.state.daemonId,
      name: this.name,
      port: this.port,
      platform: process.platform,
      addresses: localAddresses().map((entry) => entry.address),
      peers: this.peers.size,
      startedAt: this.startedAt,
      script: SCRIPT_PATH,
      firewall: firewallPlan(this.port),
    };
  }

  async handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const route = `${req.method} ${url.pathname}`;

    /* ---- Other computers ---- */
    if (url.pathname.startsWith('/peer/')) {
      if (route === 'GET /peer/hello') {
        return this.send(res, 200, { service: SERVICE, version: VERSION, daemonId: this.state.daemonId, name: this.name, port: this.port, devices: this.publicDevices() });
      }
      if (route === 'POST /peer/deliver') {
        const body = await this.readBody(req);
        if (typeof body.to !== 'string' || typeof body.from !== 'string' || !body.message) return this.fail(res, 400, 'bad-message');
        // So the reply finds its way back even if broadcasts don't get through.
        if (body.fromDaemon && body.fromDaemon !== this.state.daemonId) {
          const known = this.peers.get(body.fromDaemon);
          const devices = known ? [...known.devices] : [];
          if (!devices.some((device) => device.deviceId === body.from)) devices.push({ deviceId: body.from, name: body.fromName, lastSeen: Date.now() });
          this.rememberPeer({
            daemonId: String(body.fromDaemon),
            name: String(body.fromHost || known?.name || 'Computer').slice(0, 60),
            host: cleanAddress(req.socket.remoteAddress),
            port: Number(body.fromPort) || this.port,
            devices,
          });
        }
        const envelope = {
          from: String(body.from).slice(0, 80),
          fromName: String(body.fromName || '').slice(0, 60),
          fromHost: String(body.fromHost || '').slice(0, 60),
          fromDaemon: String(body.fromDaemon || '').slice(0, 80),
          message: body.message,
        };
        if (!this.deliverLocal(body.to, envelope)) return this.fail(res, 404, 'unknown-device');
        return this.send(res, 200, { ok: true });
      }
      return this.fail(res, 404, 'not-found');
    }

    /* ---- Apps on this computer ---- */
    if (url.pathname.startsWith('/api/')) {
      const cors = this.corsHeaders(req);
      const refused = this.checkLocal(req);
      if (refused) return this.fail(res, 403, refused, cors);
      if (req.method === 'OPTIONS') {
        res.writeHead(204, cors);
        return res.end();
      }

      if (route === 'GET /api/status') return this.send(res, 200, this.status(), cors);
      if (route === 'GET /api/peers') return this.send(res, 200, { ok: true, peers: this.peerList() }, cors);

      if (route === 'POST /api/register') {
        this.register(await this.readBody(req));
        return this.send(res, 200, this.status(), cors);
      }

      const client = this.authClient(req);
      if (!client) return this.fail(res, 401, 'not-registered', cors);

      if (route === 'GET /api/devices') {
        return this.send(res, 200, { ok: true, devices: this.nearbyDevices(client.deviceId), peers: this.peerList() }, cors);
      }
      if (route === 'POST /api/send') {
        const body = await this.readBody(req);
        if (typeof body.to !== 'string' || !body.message) return this.fail(res, 400, 'bad-message', cors);
        if (body.to === client.deviceId) return this.fail(res, 400, 'this-device', cors);
        try {
          return this.send(res, 200, { ok: true, ...(await this.route(client, body.to, body.message)) }, cors);
        } catch (error) {
          return this.fail(res, error.status || 502, error.message, cors);
        }
      }
      if (route === 'GET /api/inbox') {
        const wait = Math.min(INBOX_WAIT_MAX_MS, Math.max(0, Number(url.searchParams.get('wait')) * 1000 || 0));
        if (wait && !(this.state.mailboxes[client.deviceId] || []).length) {
          await this.waitForMail(client.deviceId, wait);
          if (req.destroyed) return;
        }
        return this.send(res, 200, { ok: true, messages: this.takeInbox(client.deviceId) }, cors);
      }
      if (route === 'POST /api/add-peer') {
        const body = await this.readBody(req);
        try {
          const peer = await this.addManualPeer(body.address);
          return this.send(res, 200, { ok: true, peer: { name: peer.name, address: `${peer.host}:${peer.port}`, devices: peer.devices.length } }, cors);
        } catch (error) {
          const code = ['bad-address', 'not-pomodoro', 'this-computer'].includes(error.message) ? error.message : 'unreachable';
          return this.fail(res, error.status || 502, code, cors);
        }
      }
      return this.fail(res, 404, 'not-found', cors);
    }

    if (route === 'GET /') {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end(`Pomodoro sync ${VERSION} is running on "${this.name}". Open the Pomodoro app to pair devices.\n`);
    }
    return this.fail(res, 404, 'not-found');
  }
}

/* ============================== status ============================== */

async function runStatus(options) {
  try {
    const status = await fetchJson(urlFor('127.0.0.1', options.port, '/api/status'), { timeout: 2000 });
    const { peers } = await fetchJson(urlFor('127.0.0.1', options.port, '/api/peers'), { timeout: 2000 });
    if (options.json) return console.log(JSON.stringify({ status, peers }, null, 2));
    console.log(`Running: "${status.name}", version ${status.version}, port ${status.port}`);
    console.log(`Addresses: ${status.addresses.join(', ') || 'none (not on a network)'}`);
    console.log(peers.length ? 'Other computers found:' : 'No other computers found yet.');
    for (const peer of peers) console.log(`  ${peer.name} at ${peer.address} · ${peer.devices} app(s) connected${peer.manual ? ' · added by address' : ''}`);
  } catch {
    console.log(`Not running on port ${options.port}. Start it with:  node "${SCRIPT_PATH}"`);
    process.exitCode = 1;
  }
}

/* ============================== doctor ============================== */

async function runDoctor(options) {
  const port = options.port;
  const ok = (text) => console.log(`  [ok]   ${text}`);
  const warn = (text) => console.log(`  [!]    ${text}`);
  const info = (text) => console.log(`         ${text}`);
  const fixes = [];
  console.log(`Pomodoro sync doctor (port ${port})\n`);

  // 1. Node
  const major = Number(process.versions.node.split('.')[0]);
  if (major >= 18) ok(`Node.js ${process.versions.node}`);
  else {
    warn(`Node.js ${process.versions.node} is too old. Install Node.js 18 or newer.`);
    fixes.push('Install Node.js 18 or newer from https://nodejs.org');
  }

  // 2. Service running?
  let status = null;
  try {
    status = await fetchJson(urlFor('127.0.0.1', port, '/api/status'), { timeout: 2000 });
    ok(`The service is running on this computer as "${status.name}".`);
  } catch {
    warn('The service is not running on this computer.');
    fixes.push(`Start it:  node "${SCRIPT_PATH}"   (or "install" to start it at login)`);
  }

  // 3. Network
  const addresses = localAddresses();
  if (!addresses.length) {
    warn('This computer has no local network address. Connect to Wi-Fi or Ethernet.');
    fixes.push('Connect to the same Wi-Fi or wired network as your other devices.');
  } else {
    ok(`Network addresses: ${addresses.map((entry) => `${entry.address} (${entry.interface})`).join(', ')}`);
    const vpn = addresses.filter((entry) => /^(tun|tap|wg|utun|ppp|tailscale|zt)/i.test(entry.interface));
    if (vpn.length) {
      warn(`A VPN looks active (${vpn.map((entry) => entry.interface).join(', ')}). VPNs often block local devices.`);
      fixes.push('Turn off the VPN, or allow "local network access" in its settings.');
    }
    const docker = addresses.filter((entry) => /^(docker|br-|veth|virbr|vmnet|vboxnet)/i.test(entry.interface));
    if (docker.length === addresses.length) warn('Only virtual network adapters were found (Docker / VMs).');
  }

  // 4. Firewall
  const plan = firewallPlan(port);
  const firewallOpen = checkFirewall(port, plan);
  if (firewallOpen === true) ok(`${plan.firewall}: port ${port} is open.`);
  else if (firewallOpen === false) {
    warn(`${plan.firewall}: port ${port} looks blocked, so other devices can't reach this one.`);
    fixes.push(`Open the port:  node "${SCRIPT_PATH}" firewall --apply${port !== DEFAULT_PORT ? ` --port ${port}` : ''}`);
  } else {
    info(`${plan.firewall}: couldn't check without admin rights. If other devices can't see this one, open the port:`);
    info(`node "${SCRIPT_PATH}" firewall --apply${port !== DEFAULT_PORT ? ` --port ${port}` : ''}`);
  }
  if (plan.note) info(plan.note);

  // 5. Who answers on the network?
  console.log('\n  Looking for Pomodoro on other devices (3 seconds)…');
  const found = await probeNetwork(Number(process.env.POMODORO_SYNC_DISCOVERY_PORT) || port, status?.daemonId);
  if (found.length) for (const peer of found) ok(`Found "${peer.name}" at ${peer.address} with ${peer.devices} app(s) connected.`);
  else {
    warn('No other device answered.');
    fixes.push('On every other device: start the service and open its firewall port the same way (the "firewall --apply" command).');
    fixes.push('Make sure all devices are on the same network. Guest Wi-Fi and "AP / client isolation" on the router block devices from seeing each other.');
    fixes.push('If broadcasts are blocked, add the other device by its address in the app (Devices → Add by address), e.g. 192.168.1.20.');
  }

  // 6. Already known to the service
  if (status) {
    try {
      const { peers } = await fetchJson(urlFor('127.0.0.1', port, '/api/peers'), { timeout: 2000 });
      if (peers.length) for (const peer of peers) info(`The service knows "${peer.name}" at ${peer.address}.`);
    } catch {
      /* ignore */
    }
  }

  console.log('');
  if (!fixes.length) console.log('Everything looks fine. Open Pomodoro → Settings → Devices on each device to pair them.');
  else {
    console.log('What to try:');
    [...new Set(fixes)].forEach((fix, index) => console.log(`  ${index + 1}. ${fix}`));
  }
}

/** true = open, false = blocked, null = couldn't tell. */
function checkFirewall(port, plan) {
  try {
    if (plan.firewall === 'firewalld') {
      const tcp = quiet('firewall-cmd', [`--query-port=${port}/tcp`]);
      if (/yes/.test(tcp.out)) return true;
      if (/no/.test(tcp.out)) return false;
      return null;
    }
    if (plan.firewall === 'ufw') {
      const result = quiet('ufw', ['status']);
      if (!result.ok) return null;
      if (/Status: inactive/i.test(result.out)) return true;
      return new RegExp(`\\b${port}(/tcp)?\\b.*ALLOW`, 'i').test(result.out);
    }
    if (plan.firewall === 'Windows Defender Firewall') {
      const result = quiet('netsh', ['advfirewall', 'firewall', 'show', 'rule', 'name=Pomodoro Sync (TCP)']);
      return result.ok && /Pomodoro Sync/.test(result.out);
    }
    if (plan.firewall === 'macOS Application Firewall') {
      const state = quiet('/usr/libexec/ApplicationFirewall/socketfilterfw', ['--getglobalstate']);
      if (/disabled|State = 0/i.test(state.out)) return true;
      const app = quiet('/usr/libexec/ApplicationFirewall/socketfilterfw', ['--getappblocked', process.execPath]);
      if (/permitted|is not blocked/i.test(app.out)) return true;
      if (/blocked/i.test(app.out)) return false;
      return null;
    }
  } catch {
    /* fall through */
  }
  return null;
}

function probeNetwork(port, ownDaemonId) {
  return new Promise((resolve) => {
    const found = new Map();
    const socket = dgram.createSocket('udp4');
    socket.on('message', (buffer, rinfo) => {
      try {
        const message = JSON.parse(buffer.toString('utf8'));
        if (message.t !== SERVICE || !message.daemonId || message.daemonId === ownDaemonId) return;
        found.set(message.daemonId, { name: message.name, address: `${rinfo.address}:${message.port}`, devices: (message.devices || []).length });
      } catch {
        /* not ours */
      }
    });
    socket.on('error', () => {});
    socket.bind(0, () => {
      try {
        socket.setBroadcast(true);
      } catch {
        /* ignore */
      }
      const packet = Buffer.from(JSON.stringify({ t: SERVICE, v: 1, kind: 'probe' }));
      const targets = new Set(['255.255.255.255', ...localAddresses().map((entry) => entry.broadcast).filter(Boolean)]);
      const send = () => targets.forEach((target) => socket.send(packet, port, target, () => {}));
      send();
      setTimeout(send, 1000);
      setTimeout(() => {
        socket.close();
        resolve([...found.values()]);
      }, 3000);
    });
  });
}

/* ========================= install / uninstall ========================= */

function serviceArgs(options) {
  const args = [SCRIPT_PATH, 'start'];
  if (options.port !== DEFAULT_PORT) args.push('--port', String(options.port));
  if (options.name) args.push('--name', options.name);
  for (const origin of options.allowOrigins) args.push('--allow-origin', origin);
  return args;
}

function runInstall(options) {
  const args = serviceArgs(options);
  if (process.platform === 'linux') {
    const dir = path.join(os.homedir(), '.config', 'systemd', 'user');
    fs.mkdirSync(dir, { recursive: true });
    const quoted = [process.execPath, ...args].map((part) => `"${part.replace(/"/g, '\\"')}"`).join(' ');
    fs.writeFileSync(
      path.join(dir, 'pomodoro-sync.service'),
      `[Unit]\nDescription=Pomodoro local network sync\nAfter=network-online.target\n\n[Service]\nExecStart=${quoted}\nRestart=on-failure\nRestartSec=5\n\n[Install]\nWantedBy=default.target\n`
    );
    spawnSync('systemctl', ['--user', 'daemon-reload'], { stdio: 'inherit' });
    const result = spawnSync('systemctl', ['--user', 'enable', '--now', 'pomodoro-sync.service'], { stdio: 'inherit' });
    if (result.status === 0) console.log('Installed. Pomodoro sync now starts when you log in (systemd user service "pomodoro-sync").');
    else console.log(`Couldn't start it with systemd. The unit is in ${dir}.`);
  } else if (process.platform === 'darwin') {
    const file = path.join(os.homedir(), 'Library', 'LaunchAgents', 'app.pomodoro.sync.plist');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const items = [process.execPath, ...args].map((part) => `    <string>${escape(part)}</string>`).join('\n');
    fs.writeFileSync(
      file,
      `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>\n  <key>Label</key><string>app.pomodoro.sync</string>\n  <key>ProgramArguments</key><array>\n${items}\n  </array>\n  <key>RunAtLoad</key><true/>\n  <key>KeepAlive</key><true/>\n</dict></plist>\n`
    );
    spawnSync('launchctl', ['unload', file], { stdio: 'ignore' });
    const result = spawnSync('launchctl', ['load', '-w', file], { stdio: 'inherit' });
    console.log(result.status === 0 ? 'Installed. Pomodoro sync now starts when you log in.' : `Couldn't load it with launchctl. The file is ${file}.`);
  } else if (process.platform === 'win32') {
    const startup = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
    const file = path.join(startup, 'pomodoro-sync.vbs');
    const command = [process.execPath, ...args].map((part) => `""${part}""`).join(' ');
    fs.writeFileSync(file, `CreateObject("WScript.Shell").Run "${command}", 0, False\r\n`);
    spawnSync('wscript', [file], { stdio: 'ignore', detached: true });
    console.log(`Installed. Pomodoro sync now starts (hidden) when you log in. To undo, run "uninstall" or delete ${file}.`);
  } else {
    console.log(`Automatic start isn't set up for ${process.platform}. Run:  ${process.execPath} ${args.join(' ')}`);
  }
}

function runUninstall() {
  if (process.platform === 'linux') {
    spawnSync('systemctl', ['--user', 'disable', '--now', 'pomodoro-sync.service'], { stdio: 'inherit' });
    fs.rmSync(path.join(os.homedir(), '.config', 'systemd', 'user', 'pomodoro-sync.service'), { force: true });
    spawnSync('systemctl', ['--user', 'daemon-reload'], { stdio: 'ignore' });
  } else if (process.platform === 'darwin') {
    const file = path.join(os.homedir(), 'Library', 'LaunchAgents', 'app.pomodoro.sync.plist');
    spawnSync('launchctl', ['unload', '-w', file], { stdio: 'ignore' });
    fs.rmSync(file, { force: true });
  } else if (process.platform === 'win32') {
    fs.rmSync(path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'pomodoro-sync.vbs'), { force: true });
  }
  console.log('Pomodoro sync no longer starts automatically.');
}

/* ================================ Main ================================ */

const isMain = process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH;
if (isMain) {
  const options = parseArgs(process.argv.slice(2));
  const commands = {
    start: async () => {
      const service = new SyncService(options);
      await service.start();
      const stop = () => {
        try {
          saveStateNow(service.state);
        } catch {
          /* ignore */
        }
        process.exit(0);
      };
      process.on('SIGINT', stop);
      process.on('SIGTERM', stop);
    },
    status: () => runStatus(options),
    doctor: () => runDoctor(options),
    firewall: () => runFirewall(options),
    install: () => runInstall(options),
    uninstall: () => runUninstall(options),
    help: () => console.log(HELP),
  };
  const command = commands[options.command];
  if (!command) {
    console.log(HELP);
    process.exitCode = 2;
  } else {
    Promise.resolve(command()).catch((error) => {
      console.error(error.message || error);
      process.exitCode = 1;
    });
  }
}

export { SyncService, parseArgs };
