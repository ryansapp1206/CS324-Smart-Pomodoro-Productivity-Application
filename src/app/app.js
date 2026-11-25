/* =====================================================================
   POPUP APP
   One App per page. It holds the signed-in user, their account data, a
   mirror of the timer (owned by src/services/timer-service.js) and all UI state.

   Where things live:
     account.js        sign in / out, loading data, the local cache
     saving.js         saving a change to the backend (with Retry on failure)
     timer-client.js   sending timer commands, the on-screen clock, session alerts
     deadlines.js      the "tasks due soon" banner
     render.js         drawing the screen
     events.js         clicks, typing and keyboard
     ../screens/       one file per screen, each with its render function and actions
   ===================================================================== */

import { t } from '../core/theme-engine.js';
import { makeId, fromDayKey } from '../core/utils.js';
import { DEFAULT_SETTINGS } from '../data/model.js';
import { ACHIEVEMENTS, REWARDS, balanceOf, hasUnlimitedBalance, unlockedAchievementIds } from '../shop/progress.js';
import { createIdleTimer } from '../timer/rules.js';
import { createUiState, taskFormSnapshot } from './state.js';
import { createSettingsDraft, hasUnsavedSettings } from './settings-draft.js';
import { applyAppearance } from './account.js';
import { renderApp, renderToasts } from './render.js';

const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };

export class App {
  constructor(hostElement) {
    this.user = null;
    this.data = null; // { tasks, sessions, purchases, settings }
    this.loadState = 'idle'; // idle | loading | ready | error
    this.syncState = 'synced'; // synced | syncing | offline | failed
    this.failedSave = null; // { message, retry } after a save fails
    this.showingCachedData = false;
    this.lastSyncedAt = null;
    this.pendingCount = 0; // finished sessions waiting to be saved
    this.pendingVisibleAt = 0; // when the "waiting to sync" banner may appear

    this.ui = createUiState();
    this.timer = createIdleTimer();
    this.toasts = [];
    this.alert = null; // session-complete card

    hostElement.innerHTML = `
      <div class="app-host" style="height:100%"></div>
      <div class="toast-layer"></div>
      <div class="sr-only" aria-live="polite" data-announcer></div>`;
    this.root = hostElement;
    this.screenHost = hostElement.querySelector('.app-host');
    this.toastHost = hostElement.querySelector('.toast-layer');
    this.announcer = hostElement.querySelector('[data-announcer]');
  }

  render() {
    renderApp(this);
  }

  renderToasts() {
    renderToasts(this);
  }

  /* ----------------------------- Account data ----------------------------- */

  settings() {
    return (this.data && this.data.settings) || DEFAULT_SETTINGS;
  }

  tasks() {
    return this.data ? this.data.tasks : [];
  }

  findTask(taskId) {
    return this.tasks().find((task) => task.id === taskId);
  }

  /** Focus sessions per task id, worked out from the session history. */
  sessionCounts() {
    const counts = new Map();
    for (const session of this.data ? this.data.sessions : []) {
      if (session.taskId) counts.set(session.taskId, (counts.get(session.taskId) || 0) + 1);
    }
    return counts;
  }

  openTasksSorted() {
    return sortTasks(
      this.tasks().filter((task) => !task.completed),
      this.settings().taskSort
    );
  }

  completedTasks() {
    return this.tasks()
      .filter((task) => task.completed)
      .sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
  }

  /** Currency balance (called points, aura, … depending on the theme). */
  balance() {
    return this.data ? balanceOf(this.data) : 0;
  }

  hasUnlimitedBalance() {
    return Boolean(this.data && hasUnlimitedBalance(this.data));
  }

  /* ------------------------------- Feedback ------------------------------- */

  /** Screen-reader announcement. */
  announce(message) {
    this.announcer.textContent = '';
    setTimeout(() => (this.announcer.textContent = message), 60);
  }

  /** A short message at the bottom. iconName is from src/core/icons.js. */
  toast(message, kind = 'info', iconName = '') {
    const toast = { id: makeId(), message, kind, iconName };
    this.toasts.push(toast);
    if (this.toasts.length > 3) this.toasts.shift();
    this.renderToasts();
    setTimeout(() => {
      this.toasts = this.toasts.filter((other) => other.id !== toast.id);
      this.renderToasts();
    }, 4000);
  }

  achievementIds() {
    return this.data ? unlockedAchievementIds(this.data) : new Set();
  }

  /** Toast every achievement unlocked since `before` (a Set of ids). */
  celebrateNewAchievements(before) {
    const after = this.achievementIds();
    for (const achievement of ACHIEVEMENTS) {
      if (after.has(achievement.id) && !before.has(achievement.id)) {
        const name = t('ach.' + achievement.id);
        const message = `${t('ach.toast', { name })} ${t('currency.earned', { n: REWARDS.achievement })}`;
        this.toast(message, 'success', achievement.icon);
      }
    }
  }

  /* -------------------------- Navigation and dialogs -------------------------- */

  /** Ask for confirmation. dialog = { title, body, confirmLabel, cancelLabel?, danger?, onConfirm }. */
  askConfirm(dialog) {
    dialog.returnFocusId = document.activeElement?.dataset?.focusId || null;
    this.ui.confirmDialog = dialog;
    this.ui.focusAfterRender = 'confirmCancel:';
    this.render();
  }

  navigate(destination) {
    const go = () => {
      this.ui.openMenuTaskId = null;
      this.ui.openPopover = null;
      if (destination === 'profile') {
        if (this.ui.screen !== 'profile') this.ui.previousTab = this.ui.tab;
        this.ui.screen = 'profile';
        this.ui.profileForm = { displayName: this.user.displayName, error: null, isBusy: false };
        this.ui.focusAfterRender = 'goBack:';
      } else {
        this.ui.screen = 'main';
        this.ui.tab = destination;
        if (destination === 'settings') this.ui.settingsDraft = createSettingsDraft(this.settings());
        this.ui.focusAfterRender = 'tab:' + destination;
      }
      this.render();
    };

    const leavingDirtySettings =
      this.ui.tab === 'settings' && this.ui.screen === 'main' && destination !== 'settings' && hasUnsavedSettings(this);

    if (!leavingDirtySettings) return go();
    this.askConfirm({
      title: t('set.discard.title'),
      body: t('set.discard.body'),
      confirmLabel: t('set.discard.yes'),
      danger: true,
      onConfirm: () => {
        applyAppearance(this); // undo a previewed theme
        this.ui.settingsDraft = null;
        go();
      },
    });
  }

  /** Close the task form or picker. Asks first if the task form has unsaved edits. */
  closeModal(force = false) {
    const form = this.ui.taskForm;
    if (!force && this.ui.openModal === 'taskForm' && form && taskFormSnapshot(form) !== form.originalSnapshot) {
      this.askConfirm({
        title: t('form.discard.title'),
        body: t('form.discard.body'),
        confirmLabel: t('form.discard.yes'),
        cancelLabel: t('form.discard.no'),
        danger: true,
        onConfirm: () => this.closeModal(true),
      });
      return;
    }
    this.ui.openModal = null;
    this.ui.taskForm = null;
    this.ui.focusAfterRender = this.ui.returnFocusId;
    this.render();
  }
}

/** Sort open tasks by due date or by priority, with the other as a tie-breaker. */
export function sortTasks(tasks, sortBy) {
  const priorityRank = (task) => (task.priority in PRIORITY_ORDER ? PRIORITY_ORDER[task.priority] : 3);
  const dueTime = (task) => (task.dueDate ? fromDayKey(task.dueDate).getTime() : Infinity);
  const created = (a, b) => String(a.createdAt).localeCompare(String(b.createdAt));
  return [...tasks].sort((a, b) => {
    if (sortBy === 'priority') return priorityRank(a) - priorityRank(b) || dueTime(a) - dueTime(b) || created(a, b);
    return dueTime(a) - dueTime(b) || priorityRank(a) - priorityRank(b) || created(a, b);
  });
}
