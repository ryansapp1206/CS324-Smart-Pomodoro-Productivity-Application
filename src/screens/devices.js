/* =====================================================================
   SCREEN: DEVICES (sync over the local network)
   Opened from Settings → Sync and from the header's sync menu.
     - this device: its name, the sync service, auto-sync
     - the pairing in progress: the code to type, or the code to show
     - paired devices: sync now, unpair
     - nearby devices: select one to pair with it
     - add a device by address, and troubleshooting (firewall, doctor)
   Everything shown comes from app.sync (src/app/sync-client.js); buttons
   run sync commands (src/sync/engine.js).
   ===================================================================== */

import { escapeHtml, formatDate } from '../core/utils.js';
import { icon, spinnerHtml } from '../core/icons.js';
import { t } from '../core/theme-engine.js';
import { BASE_COPY } from '../core/copy.js';
import { IS_EXTENSION } from '../core/platform.js';
import { CONFIG } from '../config.js';
import { SYNC_PORT } from '../sync/relay.js';
import { runSync, isPairingActive } from '../app/sync-client.js';
import { actionButton, banner } from '../ui/components.js';

const SCRIPT = 'pomodoro-sync.mjs';

/* ------------------------------ Helpers ------------------------------ */

export function syncErrorText(error) {
  const code = error?.code || 'unknown';
  if (BASE_COPY['sync.err.' + code]) return t('sync.err.' + code);
  return t('sync.err.generic', { code });
}

function whenText(timestamp) {
  if (!timestamp) return t('sync.neverSynced');
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  let when;
  if (minutes < 1) when = t('sync.justNow');
  else if (minutes < 60) when = t('sync.minAgo', { n: minutes });
  else if (minutes < 24 * 60) when = formatDate(timestamp, { hour: 'numeric', minute: '2-digit' });
  else when = formatDate(timestamp, { month: 'short', day: 'numeric' });
  return t('sync.lastSync', { when });
}

const peerName = (peer) => escapeHtml(peer?.name || peer?.host || '?');

/** A command in a box with a Copy button. */
function commandBox(command) {
  return `
    <div class="cmd">
      <code>${escapeHtml(command)}</code>
      ${actionButton('copyCommand', t('sync.copy'), { arg: command, className: 'btn btn-sm', focusId: `copy:${command.slice(0, 40)}` })}
    </div>`;
}

/** How to run the sync script: its real path once the service has told us, the file name before that. */
function scriptCommand(app, args) {
  const script = app.sync.status.serviceInfo?.script;
  const path = app.sync.status.service === 'online' && script ? `"${script}"` : SCRIPT;
  return `node ${path}${args ? ' ' + args : ''}${SYNC_PORT !== 47821 ? ` --port ${SYNC_PORT}` : ''}`;
}

/** The firewall commands for this computer: from the service when it's running, otherwise a best guess from the browser. */
function firewallCommands(app) {
  const plan = app.sync.status.service === 'online' ? app.sync.status.serviceInfo?.firewall : null;
  if (plan) return { name: plan.firewall, commands: plan.commands, note: plan.note };
  const agent = navigator.userAgent;
  const port = SYNC_PORT;
  if (/Windows/.test(agent)) {
    return {
      name: 'Windows Defender Firewall',
      commands: [
        `netsh advfirewall firewall add rule name="Pomodoro Sync (TCP)" dir=in action=allow protocol=TCP localport=${port} profile=private,domain`,
        `netsh advfirewall firewall add rule name="Pomodoro Sync (UDP)" dir=in action=allow protocol=UDP localport=${port} profile=private,domain`,
      ],
    };
  }
  if (/Mac OS X/.test(agent)) {
    return {
      name: 'macOS',
      commands: ['sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add "$(command -v node)"', 'sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp "$(command -v node)"'],
    };
  }
  return {
    name: 'Linux (ufw)',
    commands: [`sudo ufw allow ${port}/tcp`, `sudo ufw allow ${port}/udp`],
    note: `With firewalld: sudo firewall-cmd --permanent --add-port=${port}/tcp --add-port=${port}/udp && sudo firewall-cmd --reload`,
  };
}

/* ------------------------------ Sections ------------------------------ */

function noticeBanner(app) {
  const notice = app.sync.status.notice;
  if (!notice || Date.now() - notice.at > 15000) return '';
  return banner(notice.kind === 'success' ? 'success' : 'info', notice.kind === 'success' ? 'check' : 'info', t(notice.key, notice.params), {
    trailing: actionButton('clearSyncNotice', '', { className: 'icon-btn', icon: 'x', ariaLabel: t('common.close') }),
  });
}

function pairingCard(app) {
  const pairing = app.sync.pairing;
  if (!pairing) return '';
  const name = peerName(pairing.peer);
  const vars = { name: pairing.peer?.name || pairing.peer?.host || '?' };
  const cancel = (labelKey = 'sync.pair.cancel') => actionButton('cancelPairing', t(labelKey), { className: 'btn btn-sm' });
  const waiting = (textKey, subKey) => `
    <div class="pair-wait">${spinnerHtml()}<div><div class="pair-title">${t(textKey, vars)}</div>${subKey ? `<div class="small muted">${t(subKey, vars)}</div>` : ''}</div></div>
    <div class="pair-actions">${cancel()}</div>`;

  let body = '';
  switch (pairing.stage) {
    case 'requested':
      body = waiting('sync.pair.requested', 'sync.pair.requestedSub');
      break;
    case 'enter-code': {
      const error = app.ui.pairError;
      const left = 3 - (pairing.attempts || 0);
      body = `
        <form data-form="pairCode" novalidate>
          <div class="pair-title">${t('sync.pair.enterCode', vars)}</div>
          <p class="small muted">${t('sync.pair.enterCodeSub', vars)}</p>
          <div class="field">
            <label for="pair-code">${t('sync.pair.codeLabel')}</label>
            <input id="pair-code" class="input code-input${error ? ' invalid' : ''}" inputmode="numeric" autocomplete="one-time-code"
              maxlength="7" placeholder="000000" value="${escapeHtml(app.ui.pairCode)}"
              data-bind="pairCode" data-focus-id="pairCode" ${error ? 'aria-invalid="true" aria-describedby="pair-code-err"' : ''}>
            ${error ? `<div class="err" id="pair-code-err">${icon('alert')}<span>${error}${pairing.attempts ? ' ' + t('sync.pair.attemptsLeft', { n: left }) : ''}</span></div>` : ''}
          </div>
          <div class="pair-actions">
            ${cancel()}
            <button type="submit" class="btn btn-primary btn-sm" data-focus-id="submit-pairCode">${t('sync.pair.confirm')}</button>
          </div>
        </form>`;
      break;
    }
    case 'waiting-accept':
      body = waiting('sync.pair.waitingAccept');
      break;
    case 'waiting-reveal':
      body = waiting('sync.pair.waitingReveal');
      break;
    case 'show-code': {
      const account = pairing.account?.email ? `${pairing.account.name} (${pairing.account.email})` : pairing.account?.name || '?';
      const code = String(pairing.code || '');
      body = `
        <div class="pair-title">${t('sync.pair.incoming', vars)}</div>
        <p class="small muted">${t('sync.pair.incomingFrom', { host: pairing.peer?.host || '?', account })}</p>
        <p class="small" style="margin-top:10px">${t('sync.pair.yourCode', vars)}</p>
        <div class="pair-code" aria-label="${escapeHtml(code.split('').join(' '))}">${escapeHtml(code.slice(0, 3))}<span></span>${escapeHtml(code.slice(3))}</div>
        ${
          pairing.accepted
            ? `<div class="pair-wait">${spinnerHtml()}<div class="small">${t('sync.pair.accepted', vars)}</div></div><div class="pair-actions">${cancel()}</div>`
            : `<p class="small warn-text">${icon('alert')}<span>${t('sync.pair.warning')}</span></p>
               <div class="pair-actions">
                 ${cancel('sync.pair.decline')}
                 ${actionButton('acceptPairing', t('sync.pair.accept'), { className: 'btn btn-primary btn-sm', icon: 'check' })}
               </div>`
        }`;
      break;
    }
    case 'done':
      body = `
        <div class="pair-wait">${icon('check', 'i ok-icon')}<div class="pair-title">${t('sync.pair.done', vars)}</div></div>
        <div class="pair-actions">${actionButton('dismissPairing', t('sync.pair.dismiss'), { className: 'btn btn-sm' })}</div>`;
      break;
    default: {
      const reasonKey = 'sync.pair.reason.' + (pairing.reason || 'cancelled');
      const reason = BASE_COPY[reasonKey] ? t(reasonKey, vars) : pairing.reason && BASE_COPY['sync.err.' + pairing.reason] ? t('sync.err.' + pairing.reason) : t('sync.pair.reason.cancelled');
      body = `
        <div class="pair-title">${t('sync.pair.ended', vars)}</div>
        <p class="small muted">${reason}</p>
        <div class="pair-actions">${actionButton('dismissPairing', t('sync.pair.dismiss'), { className: 'btn btn-sm' })}</div>`;
    }
  }
  return `<section class="card pair-card" aria-live="polite" aria-label="${t('sync.pair.title')}: ${name}">${body}</section>`;
}

function serviceLine(app) {
  const status = app.sync.status;
  if (status.service === 'online') {
    const info = status.serviceInfo || {};
    return `<div class="svc svc-on">${icon('cloudCheck')}<span>${t('sync.service.online', { host: info.name || '?', port: info.port || SYNC_PORT })}</span></div>`;
  }
  if (status.service === 'unknown') return `<div class="svc">${spinnerHtml()}<span>${t('sync.service.unknown')}</span></div>`;
  const downloadUrl = IS_EXTENSION || !location.protocol.startsWith('http') ? CONFIG.syncDownloadUrl : `downloads/${SCRIPT}`;
  const message = status.service === 'error' ? t('sync.service.error', { code: status.serviceError || '?' }) : t('sync.service.offline');
  return `
    <div class="svc svc-off">${icon('cloudOff')}<span>${message}</span></div>
    <p class="small muted">${t('sync.service.offlineBody')}</p>
    ${commandBox(`node ${SCRIPT}`)}
    <p class="small"><a class="btn-link" href="${escapeHtml(downloadUrl)}" download target="_blank" rel="noopener">${t('sync.service.download')}</a></p>
    <p class="small muted">${t('sync.service.autostart')}</p>
    ${commandBox(`node ${SCRIPT} install`)}`;
}

function thisDeviceCard(app) {
  const name = app.ui.deviceName ?? app.sync.device?.name ?? '';
  return `
    <section class="card">
      <div class="small" style="font-weight:600;margin-bottom:6px">${t('sync.thisDevice')}</div>
      <form class="inline-form" data-form="deviceName" novalidate>
        <label class="sr-only" for="device-name">${t('sync.deviceName')}</label>
        <input id="device-name" class="input" maxlength="40" value="${escapeHtml(name)}" data-bind="deviceName" data-focus-id="deviceName">
        <button type="submit" class="btn btn-sm" data-focus-id="submit-deviceName">${t('sync.deviceNameSave')}</button>
      </form>
      ${serviceLine(app)}
      <div class="sw-row">
        <div class="sw-txt"><label for="sync-auto">${t('sync.auto')}</label><div class="sub" id="sync-auto-d">${t('sync.autoSub')}</div></div>
        <input type="checkbox" role="switch" class="switch" id="sync-auto" ${app.sync.config.autoSync ? 'checked' : ''}
          data-live="autoSync" data-focus-id="sync.autoSync" aria-describedby="sync-auto-d">
      </div>
    </section>`;
}

function pairedCard(app) {
  const nearbyIds = new Set((app.sync.status.nearby || []).map((device) => device.deviceId));
  const rows = app.sync.peers
    .map((peer) => {
      const reachable = nearbyIds.has(peer.deviceId);
      const state = reachable ? whenText(peer.lastSyncAt) : `${whenText(peer.lastSyncAt)} · ${t('sync.unreachable')}`;
      return `
        <li class="dev-row">
          <span class="dot ${reachable ? 'dot-on' : ''}" aria-hidden="true"></span>
          <div class="dev-txt">
            <div class="dev-name">${peerName(peer)}</div>
            <div class="small muted">${peer.host ? t('sync.nearbyOn', { host: peer.host }) + ' · ' : ''}${state}</div>
          </div>
          ${actionButton('syncPeer', t('sync.syncOne'), { arg: peer.deviceId, className: 'btn btn-sm', icon: 'refresh', disabled: app.sync.status.service !== 'online' })}
          ${actionButton('unpairDevice', '', { arg: peer.deviceId, className: 'icon-btn', icon: 'trash', ariaLabel: t('sync.unpairTitle', { name: peer.name || '' }) })}
        </li>`;
    })
    .join('');
  return `
    <div class="sec-label">${t('sync.paired')}</div>
    <section class="card">
      ${rows ? `<ul class="dev-list">${rows}</ul>` : `<p class="small muted">${t('sync.pairedNone')}</p>`}
    </section>`;
}

function nearbyCard(app) {
  const status = app.sync.status;
  const pairedIds = new Set(app.sync.peers.map((peer) => peer.deviceId));
  const busy = isPairingActive(app);
  const devices = (status.nearby || []).filter((device) => !pairedIds.has(device.deviceId));
  let content;
  if (status.service !== 'online') content = `<p class="small muted">${t('sync.nearbyOffline')}</p>`;
  else if (!devices.length) content = `<div class="pair-wait">${spinnerHtml()}<p class="small muted">${t('sync.nearbyNone')}</p></div>`;
  else {
    content = `<ul class="dev-list">${devices
      .map((device) => {
        const where = device.local ? t('sync.nearbySameComputer') : device.host;
        return `
          <li>
            <button type="button" class="dev-pick" data-action="pairDevice" data-arg="${escapeHtml(device.deviceId)}"
              data-focus-id="pairDevice:${escapeHtml(device.deviceId)}" ${busy ? 'disabled' : ''}
              aria-label="${t('sync.pairWith', { name: device.name })}">
              <span class="dot ${device.online ? 'dot-on' : ''}" aria-hidden="true"></span>
              <span class="dev-txt">
                <span class="dev-name">${escapeHtml(device.name)}</span>
                <span class="small muted">${t('sync.nearbyOn', { host: where })} · ${t(device.online ? 'sync.online' : 'sync.idle')}</span>
              </span>
              <span class="dev-go">${t('sync.pairWith', { name: '' }).trim()}${icon('chevronDown', 'i chev-right')}</span>
            </button>
          </li>`;
      })
      .join('')}</ul>`;
  }
  const empty = (status.otherComputers || []).filter((computer) => !computer.devices);
  const emptyNotes = empty.map((computer) => `<p class="small muted">${icon('info')} ${t('sync.emptyComputer', { name: computer.name, address: computer.address })}</p>`).join('');
  return `
    <div class="sec-label">${t('sync.nearby')}</div>
    <section class="card">
      <p class="small muted" style="margin-bottom:8px">${t('sync.nearbySub')}</p>
      ${content}
      ${emptyNotes}
    </section>`;
}

function addByAddressCard(app) {
  return `
    <section class="card">
      <div class="small" style="font-weight:600">${t('sync.addTitle')}</div>
      <p class="small muted" style="margin:4px 0 8px">${t('sync.addSub')}</p>
      <form class="inline-form" data-form="peerAddress" novalidate>
        <label class="sr-only" for="peer-address">${t('sync.addLabel')}</label>
        <input id="peer-address" class="input" inputmode="decimal" placeholder="192.168.1.20" value="${escapeHtml(app.ui.peerAddress)}"
          data-bind="peerAddress" data-focus-id="peerAddress" ${app.sync.status.service !== 'online' ? 'disabled' : ''}>
        <button type="submit" class="btn btn-sm" data-focus-id="submit-peerAddress" ${app.sync.status.service !== 'online' ? 'disabled' : ''}>${t('sync.addButton')}</button>
      </form>
    </section>`;
}

function troubleshootingCard(app) {
  const firewall = firewallCommands(app);
  const addresses = app.sync.status.serviceInfo?.addresses || [];
  const isOpen = Boolean(app.ui.troubleOpen);
  const toggle = `
    <button type="button" class="trouble-toggle" data-action="toggleTroubleshooting" data-focus-id="toggleTroubleshooting"
      aria-expanded="${isOpen}" aria-controls="sync-trouble">
      ${icon('alert')}<span>${t('sync.trouble')}</span>${icon('chevronDown', isOpen ? 'i chev-open' : 'i')}
    </button>`;
  if (!isOpen) return `<section class="card trouble">${toggle}</section>`;
  return `
    <section class="card trouble">
      ${toggle}
      <div id="sync-trouble">
      <p class="small">${t('sync.trouble.firewall')}</p>
      ${commandBox(scriptCommand(app, 'firewall --apply'))}
      <p class="small muted">${t('sync.trouble.firewallManual', { firewall: firewall.name })}</p>
      ${firewall.commands.map(commandBox).join('')}
      ${firewall.note ? `<p class="small muted">${escapeHtml(firewall.note)}</p>` : ''}
      <p class="small">${t('sync.trouble.doctor')}</p>
      ${commandBox(scriptCommand(app, 'doctor'))}
      <p class="small">${t('sync.trouble.same')}</p>
      ${addresses.length ? `<p class="small muted">${t('sync.trouble.addresses', { addresses: addresses.join(', ') })}</p>` : ''}
      </div>
    </section>`;
}

/* ------------------------------ Screen ------------------------------ */

export function devicesScreen(app) {
  return `
    <div class="sub-hdr">
      ${actionButton('goBack', t('sync.devicesBack'), { className: 'btn btn-ghost btn-sm', icon: 'chevronLeft' })}
      <h1>${t('sync.devicesTitle')}</h1>
    </div>
    ${noticeBanner(app)}
    ${pairingCard(app)}
    ${thisDeviceCard(app)}
    ${pairedCard(app)}
    ${nearbyCard(app)}
    ${addByAddressCard(app)}
    ${troubleshootingCard(app)}`;
}

/** A pairing request while the user is elsewhere in the app. */
export function pairingRequestBanner(app) {
  const pairing = app.sync.pairing;
  if (app.ui.screen === 'devices' || !pairing || pairing.role !== 'responder' || !['waiting-reveal', 'show-code'].includes(pairing.stage)) return '';
  return banner('info', 'bell', `<div>${t('sync.pair.banner', { name: pairing.peer?.name || pairing.peer?.host || '?' })}</div>`, {
    trailing: actionButton('openDevices', t('sync.pair.view'), { className: 'btn btn-sm', focusId: 'openDevices:banner' }),
  });
}

/* ------------------------------ Actions ------------------------------ */

async function run(app, command, args, { success, onError } = {}) {
  const result = await runSync(command, ...args);
  if (!result.ok) {
    if (onError) onError(result.error);
    else app.toast(syncErrorText(result.error), 'danger', 'alert');
  } else if (success) app.toast(typeof success === 'function' ? success(result.value) : success, 'success');
  app.render();
  return result;
}

export const actions = {
  openDevices(app) {
    app.ui.openPopover = null;
    app.navigate('devices');
    runSync('tick');
  },

  pairDevice(app, deviceId) {
    const device = (app.sync.status.nearby || []).find((candidate) => candidate.deviceId === deviceId);
    if (!device) return;
    app.ui.pairCode = '';
    app.ui.pairError = null;
    app.ui.focusAfterRender = 'cancelPairing:';
    run(app, 'startPairing', [{ deviceId: device.deviceId, name: device.name, host: device.local ? '' : device.host }]);
  },

  acceptPairing(app) {
    run(app, 'acceptPairing', []);
  },

  cancelPairing(app) {
    app.ui.pairCode = '';
    app.ui.pairError = null;
    run(app, 'cancelPairing', []);
  },

  dismissPairing(app) {
    run(app, 'dismissPairing', []);
  },

  clearSyncNotice(app) {
    run(app, 'clearNotice', []);
  },

  async syncPeer(app, deviceId) {
    await run(app, 'syncNow', [deviceId], {
      success: (value) => (value.failed ? syncErrorText({ code: 'unknown-device' }) : t('sync.sent', { n: value.sent })),
    });
  },

  unpairDevice(app, deviceId) {
    const peer = app.sync.peers.find((candidate) => candidate.deviceId === deviceId);
    if (!peer) return;
    app.askConfirm({
      title: t('sync.unpairTitle', { name: peer.name }),
      body: t('sync.unpairBody', { name: peer.name }),
      confirmLabel: t('sync.unpair'),
      danger: true,
      onConfirm: () => run(app, 'unpair', [deviceId], { success: t('sync.unpaired', { name: peer.name }) }),
    });
  },

  toggleTroubleshooting(app) {
    app.ui.troubleOpen = !app.ui.troubleOpen;
    app.render();
  },

  async copyCommand(app, command) {
    try {
      await navigator.clipboard.writeText(command);
      app.toast(t('sync.copied'), 'success');
    } catch {
      app.toast(t('sync.copyFailed'), 'info');
    }
  },
};

export const forms = {
  async pairCode(app) {
    const code = String(app.ui.pairCode || '').replace(/\D/g, '');
    if (code.length !== 6) {
      app.ui.pairError = t('sync.err.wrong-code');
      app.ui.focusAfterRender = 'pairCode';
      return app.render();
    }
    app.ui.pairError = null;
    await run(app, 'submitPairingCode', [code], {
      onError: (error) => {
        app.ui.pairCode = '';
        if (error.code === 'wrong-code') {
          app.ui.pairError = syncErrorText(error);
          app.ui.focusAfterRender = 'pairCode';
        } else {
          app.ui.pairError = null;
          app.toast(syncErrorText(error), 'danger', 'alert');
        }
      },
    });
  },

  async deviceName(app) {
    if (app.ui.deviceName == null || app.ui.deviceName.trim() === app.sync.device?.name) return;
    await run(app, 'renameDevice', [app.ui.deviceName], { success: t('sync.deviceRenamed') });
    app.ui.deviceName = null;
    app.render();
  },

  async peerAddress(app) {
    const address = String(app.ui.peerAddress || '').trim();
    if (!address) return;
    const result = await run(app, 'addPeerByAddress', [address], { success: (value) => t('sync.addDone', { name: value.peer?.name || address }) });
    if (result.ok) {
      app.ui.peerAddress = '';
      runSync('tick');
    }
    app.render();
  },
};

export const liveUpdates = {
  autoSync(app, isOn) {
    app.sync.config = { ...app.sync.config, autoSync: isOn };
    runSync('setAutoSync', isOn);
  },
};
