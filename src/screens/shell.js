/* =====================================================================
   SIGNED-IN SHELL
   Everything around the current tab: header (sync status + account menu),
   status banners, the tab bar, loading and error screens, and the
   session-complete card's buttons.
   ===================================================================== */

import { escapeHtml } from '../core/utils.js';
import { icon, spinnerHtml, TOMATO_LOGO } from '../core/icons.js';
import { t, decoration } from '../core/theme-engine.js';
import { loadAccount, logout } from '../app/account.js';
import { markAlertSeen, sendTimerCommand } from '../app/timer-client.js';
import { flushPendingSessions } from '../services/index.js';
import { actionButton, avatarHtml, banner, closeBannerButton, lastSyncedText, SYNC_ICONS } from '../ui/components.js';
import { confirmDialog } from '../ui/confirm-dialog.js';
import { TAB_SCREENS } from './tabs.js';
import { profileScreen } from './profile.js';
import { taskFormSheet } from './task-form.js';
import { taskPickerDialog } from './task-picker.js';
import { unsavedSettingsBar } from './settings.js';

/* ------------------------------ Header ------------------------------ */

function appHeader(app, { minimal = false } = {}) {
  const state = app.syncState;
  const syncButton = `
    <button type="button" class="sync-ind sync-${state}" data-action="togglePopover" data-arg="sync"
      data-focus-id="togglePopover:sync" aria-haspopup="dialog" aria-expanded="${app.ui.openPopover === 'sync'}"
      aria-label="${t('sync.title')}: ${t('sync.' + state)}">
      ${icon(SYNC_ICONS[state], state === 'syncing' ? 'i spin' : 'i')}<span>${t('sync.' + state)}</span>
    </button>`;
  const accountButton = `
    <button type="button" class="avatar" data-action="togglePopover" data-arg="avatar"
      data-focus-id="togglePopover:avatar" aria-haspopup="menu" aria-expanded="${app.ui.openPopover === 'avatar'}"
      aria-label="${t('menu.account')}: ${escapeHtml(app.user.displayName)}">${avatarHtml(app.user, app.settings().avatar)}</button>`;

  return `
    <header class="hdr">
      ${decoration('header-accent')}
      <div class="logo">${TOMATO_LOGO}<span>${t('app.name')}</span></div>
      ${minimal ? '' : syncButton}
      ${accountButton}
    </header>`;
}

function openPopover(app) {
  if (app.ui.openPopover === 'sync') {
    const state = app.syncState;
    return `
      <div class="popover" role="dialog" aria-label="${t('sync.title')}">
        <div class="pop-title">${icon(SYNC_ICONS[state])}${t('sync.' + state)}</div>
        <p class="muted small" style="margin-bottom:6px">${t('sync.' + state + 'Body')}</p>
        <p class="small" style="margin-bottom:10px">${lastSyncedText(app)}</p>
        ${actionButton('syncNow', t('sync.now'), { className: 'btn btn-sm btn-block', icon: 'refresh', disabled: state === 'syncing' })}
      </div>`;
  }
  if (app.ui.openPopover === 'avatar') {
    const menuItem = (action, label, iconName, className = '', focusId) =>
      actionButton(action, label, { className: 'mi ' + className, icon: iconName, attributes: 'role="menuitem"', focusId });
    return `
      <div class="popover menu-pop" role="menu" aria-label="${t('menu.account')}">
        <div class="pop-head">
          <div style="font-weight:700">${escapeHtml(app.user.displayName)}</div>
          <div class="muted small">${escapeHtml(app.user.email)}</div>
        </div>
        ${menuItem('openProfile', t('menu.profile'), 'user')}
        ${menuItem('openSettings', t('menu.settings'), 'gear')}
        ${menuItem('logout', t('menu.logout'), 'logout', 'danger', 'logout:menu')}
      </div>`;
  }
  return '';
}

/* ------------------------------ Banners ------------------------------ */

function deadlineBanner(app) {
  const deadline = app.ui.deadlineBanner;
  if (!deadline) return '';
  const items = deadline.items;
  const heading = items.length === 1 ? t('notif.deadlineOne') : t('notif.deadlineMany', { n: items.length });

  if (app.ui.tab === 'timer' && app.ui.screen === 'main') {
    // Compact one-line version so the Start button stays visible.
    const titles = escapeHtml(items.map((item) => item.title).join(', '));
    return banner('warn', 'bell', `<b>${heading}</b> <span class="muted">· ${titles}</span>`, {
      extraClass: 'banner-compact',
      trailing: actionButton('viewDueTasks', t('notif.view'), { className: 'btn btn-sm btn-ghost' }) + closeBannerButton('deadline'),
    });
  }
  const list = items
    .map((item) => `<li>${escapeHtml(item.title)} <span class="muted">· ${t(item.when === 'today' ? 'notif.dueToday' : 'notif.dueTomorrow')}</span></li>`)
    .join('');
  const content = `
    <div class="b-title">${heading}</div>
    <ul class="b-list">${list}</ul>
    <div class="banner-actions">${actionButton('viewDueTasks', t('notif.view'), { className: 'btn btn-sm' })}</div>`;
  return banner('warn', 'bell', content, { trailing: closeBannerButton('deadline') });
}

/** Deadline reminder, failed save, finished sessions waiting to sync, and "showing cached data". */
function statusBanners(app) {
  let html = deadlineBanner(app);

  if (app.failedSave) {
    const retry = actionButton('retrySave', t('sync.retry'), { className: 'btn btn-sm', icon: 'refresh', disabled: app.syncState === 'syncing' });
    html += banner('danger', 'alert', `<div>${t('sync.failedBody')}</div><div class="small">${app.failedSave.message}</div><div class="banner-actions">${retry}</div>`, {
      role: 'alert',
      trailing: closeBannerButton('failedSave'),
    });
  }

  if (app.pendingCount && Date.now() >= app.pendingVisibleAt) {
    const text = app.pendingCount === 1 ? t('pending.one') : t('pending.many', { n: app.pendingCount });
    const retry = actionButton('retryPending', t('sync.retry'), { className: 'btn btn-sm', icon: 'refresh' });
    html += banner('info', 'cloudOff', `<div>${text}</div><div class="banner-actions">${retry}</div>`);
  }

  if (app.showingCachedData) {
    const retry = actionButton('retryLoad', t('sync.retry'), { className: 'btn btn-sm', icon: 'refresh', focusId: 'retryLoad:banner' });
    html += banner('info', 'info', `<div>${t('load.cached')}</div><div class="banner-actions">${retry}</div>`, {
      trailing: closeBannerButton('cache'),
    });
  }
  return html;
}

/* ------------------------------ Tab bar ------------------------------ */

const TABS = [
  { id: 'timer', icon: 'timer' },
  { id: 'tasks', icon: 'list' },
  { id: 'stats', icon: 'chart' },
  { id: 'shop', icon: 'bag' },
  { id: 'settings', icon: 'gear' },
];

function tabBar(app, { disabled = false } = {}) {
  const tabs = TABS.map((tab) => {
    const isCurrent = app.ui.tab === tab.id && app.ui.screen === 'main';
    return `
      <button type="button" class="tab" data-action="goToTab" data-arg="${tab.id}" data-focus-id="tab:${tab.id}"
        ${disabled ? 'disabled' : ''} ${isCurrent ? 'aria-current="page"' : ''}>
        ${icon(tab.icon)}<span>${t('tab.' + tab.id)}</span>
      </button>`;
  }).join('');
  return `<nav class="tabbar" aria-label="${t('tab.nav')}">${tabs}</nav>`;
}

/* ------------------------------ Layout ------------------------------ */

export function renderSignedIn(app) {
  if (app.loadState === 'loading' || (!app.data && app.loadState !== 'error')) {
    return `
      <div class="app">
        ${appHeader(app, { minimal: true })}
        <div class="content center-col" role="status">${spinnerHtml(true)}<p class="muted">${t('load.loading')}</p></div>
        ${tabBar(app, { disabled: true })}
      </div>`;
  }

  if (app.loadState === 'error') {
    return `
      <div class="app">
        ${appHeader(app)}
        ${openPopover(app)}
        <div class="content center-col">
          <div class="state-icon danger">${icon('alert')}</div>
          <h2 style="font-size:17px">${t('load.err.title')}</h2>
          <p class="muted">${t('load.err.body')}</p>
          ${actionButton('retryLoad', t('sync.retry'), { className: 'btn btn-primary', icon: 'refresh' })}
        </div>
        ${tabBar(app, { disabled: true })}
      </div>`;
  }

  const onProfile = app.ui.screen === 'profile';
  const screenKey = onProfile ? 'profile' : app.ui.tab;
  const screenHtml = onProfile ? profileScreen(app) : TAB_SCREENS[app.ui.tab](app);
  const settingsBar = !onProfile && app.ui.tab === 'settings' ? unsavedSettingsBar(app) : '';
  let overlay = '';
  if (app.ui.openModal === 'taskForm') overlay = taskFormSheet(app);
  if (app.ui.openModal === 'taskPicker') overlay = taskPickerDialog(app);

  return `
    <div class="app">
      ${appHeader(app)}
      ${openPopover(app)}
      <main class="content" data-scroll-key="${screenKey}">${statusBanners(app)}${screenHtml}</main>
      ${settingsBar}
      ${tabBar(app)}
      ${overlay}
      ${app.ui.confirmDialog ? confirmDialog(app) : ''}
    </div>`;
}

/* ------------------------------ Actions ------------------------------ */

export const actions = {
  goToTab(app, tab) {
    app.navigate(tab);
  },
  togglePopover(app, popover) {
    app.ui.openPopover = app.ui.openPopover === popover ? null : popover;
    if (app.ui.openPopover === 'avatar') app.ui.focusAfterRender = 'openProfile:';
    else if (app.ui.openPopover === 'sync') app.ui.focusAfterRender = 'syncNow:';
    else app.ui.focusAfterRender = 'togglePopover:' + popover;
    app.render();
  },
  openProfile(app) {
    app.navigate('profile');
  },
  openSettings(app) {
    app.navigate('settings');
  },
  logout(app) {
    logout(app);
  },

  /* Sync and banners */
  syncNow(app) {
    app.ui.openPopover = null;
    flushPendingSessions();
    loadAccount(app, { showToast: true });
  },
  retryLoad(app) {
    loadAccount(app, { showToast: true });
  },
  retrySave(app) {
    if (app.failedSave) app.failedSave.retry();
  },
  async retryPending(app) {
    if ((await flushPendingSessions()) === 0) app.toast(t('sync.done'), 'success');
  },
  dismissBanner(app, which) {
    if (which === 'deadline') app.ui.deadlineBanner = null;
    if (which === 'failedSave') app.failedSave = null;
    if (which === 'cache') app.showingCachedData = false;
    app.render();
  },
  viewDueTasks(app) {
    app.ui.deadlineBanner = null;
    app.ui.taskFilter = 'open';
    app.navigate('tasks');
  },

  /* Session-complete card and toasts */
  alertPrimaryAction(app) {
    app.alert = null;
    markAlertSeen();
    Object.assign(app.ui, { screen: 'main', tab: 'timer', focusAfterRender: 'pauseTimer:' });
    app.renderToasts();
    sendTimerCommand(app, 'start');
  },
  dismissAlert(app) {
    app.alert = null;
    markAlertSeen();
    app.renderToasts();
  },
  closeModal(app) {
    app.closeModal();
  },
  closeToast(app, toastId) {
    app.toasts = app.toasts.filter((toast) => toast.id !== toastId);
    app.renderToasts();
  },
};
