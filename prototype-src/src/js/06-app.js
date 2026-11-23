/* =====================================================================
   APP STATE AND LOGIC
   One PomodoroApp per "device" window. It holds the signed-in user, their
   account data, the timer and all UI state. Rendering lives in the
   screens files; click handling lives in actions.js.
   ===================================================================== */

/** UI state that resets on sign-in and log-out. */
function createFreshUiState() {
  return {
    screen: 'login', // auth screens: login | register | forgot | sent | reset; signed in: main | profile
    tab: 'timer', // timer | tasks | stats | shop | settings
    previousTab: 'timer',
    authForm: { email: '', password: '', password2: '', name: '' },
    errors: {},
    notice: null,
    isBusy: false,
    showPassword: false,
    resetEmail: '',
    resetAccountExists: true,
    taskFilter: 'open', // open | completed
    shopCategory: 'theme', // theme | sound | avatar
    openMenuTaskId: null,
    openPopover: null, // sync | avatar
    openModal: null, // taskForm | taskPicker
    confirmDialog: null,
    taskForm: null,
    settingsDraft: null,
    profileForm: null,
    deadlineBanner: null,
    focusAfterRender: null, // data-focus-id to focus after the next render
    returnFocusId: null, // where focus goes when a dialog closes
    scrollToSelector: null,
  };
}

function createFreshTimer() {
  return {
    mode: 'focus', // focus | short | long
    status: 'idle', // idle | running | paused
    endsAt: 0, // real timestamp when a running session ends
    pausedRemainingMs: 0,
    sessionLengthMs: 0,
    sessionMinutes: 0,
    completedInCycle: 0, // focus sessions done since the last long break (0–4)
    taskId: null,
    startedAt: 0,
    justFinishedBreak: false,
  };
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

class PomodoroApp {
  constructor(hostElement, { id, device, label, isStatic = false }) {
    this.id = id; // unique per instance, used to build element ids
    this.device = device; // storage namespace: dev1, dev2, gallery
    this.label = label; // shown on notifications, e.g. "Device 1 · Home laptop"
    this.isStatic = isStatic; // static = screen-gallery snapshot, no events or saving

    this.user = null;
    this.data = null; // { tasks, sessions, purchases, settings }
    this.loadState = 'idle'; // idle | loading | ready | error
    this.syncState = 'synced'; // synced | syncing | offline | failed
    this.hasPendingChanges = false;
    this.saveFailed = false;
    this.showingCachedData = false;
    this.lastSyncedAt = null;

    this.ui = createFreshUiState();
    this.timer = createFreshTimer();
    this.toasts = [];
    this.alert = null;

    hostElement.innerHTML = `
      <div class="app-host" style="height:100%"></div>
      <div class="toast-layer"></div>
      <div class="sr-only" aria-live="polite" data-announcer></div>`;
    this.root = hostElement;
    this.screenHost = hostElement.querySelector('.app-host');
    this.toastHost = hostElement.querySelector('.toast-layer');
    this.announcer = hostElement.querySelector('[data-announcer]');

    if (!isStatic) attachEventHandlers(this);
  }

  /* ----------------------------- Helpers ----------------------------- */

  storageKey(name) {
    return `brp_${name}_${this.device}`;
  }

  settings() {
    return (this.data && this.data.settings) || DEFAULT_SETTINGS;
  }

  minutesFor(mode) {
    const settings = this.settings();
    return { focus: settings.focusMin, short: settings.shortMin, long: settings.longMin }[mode];
  }

  /** Tasks that haven't been deleted. */
  liveTasks() {
    return this.data ? this.data.tasks.filter((task) => !task.deleted) : [];
  }

  findTask(taskId) {
    return this.liveTasks().find((task) => task.id === taskId);
  }

  openTasksSorted() {
    return this.sortTasks(
      this.liveTasks().filter((task) => !task.completed),
      this.settings().taskSort
    );
  }

  sortTasks(tasks, sortBy) {
    const priorityRank = (task) => (task.priority in PRIORITY_ORDER ? PRIORITY_ORDER[task.priority] : 3);
    const dueTime = (task) => (task.dueDate ? fromDayKey(task.dueDate).getTime() : Infinity);
    return [...tasks].sort((a, b) => {
      if (sortBy === 'priority') {
        return priorityRank(a) - priorityRank(b) || dueTime(a) - dueTime(b) || a.createdAt - b.createdAt;
      }
      return dueTime(a) - dueTime(b) || priorityRank(a) - priorityRank(b) || a.createdAt - b.createdAt;
    });
  }

  /** Screen-reader announcement. */
  announce(message) {
    this.announcer.textContent = '';
    setTimeout(() => (this.announcer.textContent = message), 60);
  }

  toast(message, kind = 'info', emoji = '') {
    if (this.isStatic) return;
    const toast = { id: makeId(), message, kind, emoji };
    this.toasts.push(toast);
    if (this.toasts.length > 3) this.toasts.shift();
    this.renderToasts();
    setTimeout(() => {
      this.toasts = this.toasts.filter((other) => other.id !== toast.id);
      this.renderToasts();
    }, 4000);
  }

  /** Toast every achievement unlocked since `before` (a Set of ids). */
  celebrateNewAchievements(before) {
    const after = unlockedAchievementIds(this.data);
    for (const achievement of ACHIEVEMENTS) {
      if (after.has(achievement.id) && !before.has(achievement.id)) {
        const name = t('ach.' + achievement.id);
        const message = `${t('ach.toast', { name })} ${t('aura.earned', { n: AURA_REWARDS.achievement })}`;
        this.toast(message, 'success', achievement.emoji);
      }
    }
  }

  /* ------------------------ Saving and syncing ------------------------ */

  saveTimer() {
    if (!this.isStatic) storage.set(this.storageKey('timer'), this.timer);
  }

  /** Keep a local copy so the app still works when the cloud can't be reached. */
  saveLocalCache() {
    if (this.isStatic || !this.user || !this.data) return;
    storage.set(`brp_cache_${this.device}_${this.user.id}`, { data: this.data, pending: this.hasPendingChanges });
  }

  readLocalCache() {
    return storage.get(`brp_cache_${this.device}_${this.user.id}`, null);
  }

  /** Apply a change to account data, save it locally, then sync it. Returns the sync result. */
  commit(changeFn) {
    changeFn(this.data);
    this.data.updatedAt = Date.now();
    this.hasPendingChanges = true;
    this.saveLocalCache();
    return this.sync();
  }

  /** Push local changes to the cloud. Returns 'ok' | 'offline' | 'failed'. */
  async sync() {
    if (!this.user || this.isStatic) return 'ok';
    this.syncState = 'syncing';
    this.render();

    try {
      const merged = await mockApi.saveAccount(this.user.id, this.data);
      if (!this.user) return 'ok'; // logged out while saving
      this.data = merged;
      this.hasPendingChanges = false;
      this.saveFailed = false;
      this.syncState = 'synced';
      this.lastSyncedAt = Date.now();
      this.saveLocalCache();
      this.render();
      return 'ok';
    } catch (error) {
      if (!this.user) return 'ok';
      const isOffline = error.code === 'offline';
      this.syncState = isOffline ? 'offline' : 'failed';
      this.saveFailed = !isOffline;
      this.saveLocalCache();
      this.render();
      return isOffline ? 'offline' : 'failed';
    }
  }

  /** Load the account from the cloud, falling back to this device's cached copy. */
  async load(showRefreshedToast = false) {
    if (!this.user) return;
    this.loadState = 'loading';
    this.render();

    try {
      const cloudData = await mockApi.loadAccount(this.user.id);
      if (!this.user) return;
      const cache = this.readLocalCache();
      const hasUnsyncedLocalChanges = Boolean(cache && cache.pending);

      this.data = hasUnsyncedLocalChanges ? mergeAccountData(cloudData, cache.data) : cloudData;
      this.hasPendingChanges = hasUnsyncedLocalChanges;
      this.showingCachedData = false;
      this.saveFailed = false;
      this.loadState = 'ready';
      this.syncState = 'synced';
      this.lastSyncedAt = Date.now();
      this.saveLocalCache();
      if (hasUnsyncedLocalChanges) this.sync();
      if (showRefreshedToast) this.toast(t('sync.refreshed'), 'success');
    } catch (error) {
      if (!this.user) return;
      const cache = this.readLocalCache();
      this.syncState = error.code === 'offline' ? 'offline' : 'failed';
      if (cache) {
        this.data = cache.data;
        this.hasPendingChanges = cache.pending;
        this.loadState = 'ready';
        this.showingCachedData = true;
      } else {
        this.loadState = 'error';
      }
    }

    // Device 1 controls the page theme.
    if (this.device === 'dev1' && this.data) {
      applyTheme(this.settings().themeId);
      applyReducedMotion(this.settings().reduceMotion);
    }
    this.render();
    if (this.loadState === 'ready') this.checkDeadlines();
  }

  /* --------------------------- Account session --------------------------- */

  signIn(user) {
    this.user = user;
    storage.set(this.storageKey('session'), user.id);
    this.ui = createFreshUiState();
    this.ui.screen = 'main';
    this.timer = storage.get(this.storageKey('timer'), null) || createFreshTimer();
    this.alert = null;
    this.load();
  }

  logout(silent = false) {
    storage.remove(this.storageKey('session'));
    storage.remove(this.storageKey('timer'));
    Object.assign(this, {
      user: null,
      data: null,
      loadState: 'idle',
      syncState: 'synced',
      hasPendingChanges: false,
      saveFailed: false,
      showingCachedData: false,
      alert: null,
      toasts: [],
      timer: createFreshTimer(),
      ui: createFreshUiState(),
    });
    if (!silent) this.ui.notice = t('logout.notice');
    this.ui.focusAfterRender = 'authForm.email';
    this.render();
    this.renderToasts();
  }

  /** Restore a saved session (stay signed in) or show the login screen. */
  boot() {
    const savedUserId = storage.get(this.storageKey('session'), null);
    const user = savedUserId && mockApi.findUserById(savedUserId);
    if (user) {
      this.user = user;
      this.ui.screen = 'main';
      this.timer = storage.get(this.storageKey('timer'), null) || createFreshTimer();
      this.load();
    } else {
      this.render();
    }
  }

  /** Like reopening the app: pulls the latest data from the cloud. */
  reload() {
    if (this.user) this.load(true);
    else this.render();
  }

  /* -------------------------------- Timer --------------------------------
     Remaining time is calculated from a stored end timestamp (not by counting
     down), so pausing, closing the popup and demo speed all stay accurate.
     simulation.speed scales real time: at 60, one real second = one minute. */

  remainingMs() {
    const timer = this.timer;
    if (timer.status === 'running') return Math.max(0, (timer.endsAt - Date.now()) * simulation.speed);
    if (timer.status === 'paused') return timer.pausedRemainingMs;
    return this.minutesFor(timer.mode) * 60000;
  }

  totalMs() {
    return this.timer.status === 'idle' ? this.minutesFor(this.timer.mode) * 60000 : this.timer.sessionLengthMs;
  }

  startTimer() {
    const timer = this.timer;
    const lengthMs = this.minutesFor(timer.mode) * 60000;
    Object.assign(timer, {
      status: 'running',
      sessionLengthMs: lengthMs,
      sessionMinutes: this.minutesFor(timer.mode),
      startedAt: Date.now(),
      endsAt: Date.now() + lengthMs / simulation.speed,
      justFinishedBreak: false,
    });
    this.saveTimer();
  }

  pauseTimer() {
    this.timer.pausedRemainingMs = this.remainingMs();
    this.timer.status = 'paused';
    this.saveTimer();
  }

  resumeTimer() {
    this.timer.endsAt = Date.now() + this.timer.pausedRemainingMs / simulation.speed;
    this.timer.status = 'running';
    this.saveTimer();
  }

  /** Back to an idle timer (optionally switching mode). The session is not counted. */
  resetTimer(mode = this.timer.mode) {
    Object.assign(this.timer, {
      mode,
      status: 'idle',
      endsAt: 0,
      pausedRemainingMs: 0,
      sessionLengthMs: 0,
      justFinishedBreak: false,
    });
    this.saveTimer();
  }

  toggleTimer() {
    const status = this.timer.status;
    if (status === 'idle') this.startTimer();
    else if (status === 'running') this.pauseTimer();
    else this.resumeTimer();
    this.alert = null;
    this.render();
    this.renderToasts();
  }

  /** Keep a running session's remaining time when the demo speed changes. */
  changeSpeed(newSpeed) {
    if (this.timer.status !== 'running') return;
    const remaining = this.remainingMs();
    this.timer.endsAt = Date.now() + remaining / newSpeed;
    this.saveTimer();
  }

  /** Prototype control: make the current session end in 5 real seconds. */
  jumpToLastSeconds() {
    if (this.timer.status === 'idle') this.startTimer();
    this.timer.status = 'running';
    this.timer.endsAt = Date.now() + 5000;
    this.saveTimer();
    this.render();
  }

  /** Called every 250 ms by the page clock. */
  tick() {
    if (!this.user || !this.data || this.timer.status !== 'running') return;
    const remaining = this.remainingMs();
    if (remaining <= 0) this.completeSession();
    else this.updateTimerDisplay(remaining);
  }

  /** Update only the clock text and ring, without re-rendering the screen. */
  updateTimerDisplay(remainingMs) {
    const clock = this.screenHost.querySelector('[data-time]');
    if (clock) clock.textContent = formatClock(remainingMs);
    const ring = this.screenHost.querySelector('[data-ring]');
    if (ring) {
      const circumference = 2 * Math.PI * 96;
      ring.setAttribute('stroke-dashoffset', String(circumference * (remainingMs / (this.totalMs() || 1))));
    }
  }

  /** A session reached 00:00: record it, move to the next mode and alert the user. */
  completeSession() {
    const timer = this.timer;
    const settings = this.settings();
    const finishedMode = timer.mode;
    const achievementsBefore = unlockedAchievementIds(this.data);
    let nextMode;

    if (finishedMode === 'focus') {
      this.recordFocusSession();
      timer.completedInCycle = Math.min(SESSIONS_PER_LONG_BREAK, timer.completedInCycle + 1);
      nextMode = timer.completedInCycle >= SESSIONS_PER_LONG_BREAK ? 'long' : 'short';
    } else {
      if (finishedMode === 'long') timer.completedInCycle = 0;
      nextMode = 'focus';
    }

    this.resetTimer(nextMode);
    timer.justFinishedBreak = finishedMode !== 'focus';
    if (settings.autoStart) this.startTimer();
    this.saveTimer();

    this.showSessionAlert(finishedMode, nextMode);

    if (finishedMode === 'focus') {
      this.hasPendingChanges = true;
      this.saveLocalCache();
      this.sync();
      this.toast(t('aura.earned', { n: AURA_REWARDS.focusSession }), 'success', themeEmoji('aura'));
      this.celebrateNewAchievements(achievementsBefore);
    }
    this.render();
    this.renderToasts();
  }

  recordFocusSession() {
    const now = Date.now();
    const timer = this.timer;
    this.data.sessions.push({
      id: 's_' + makeId(),
      startedAt: timer.startedAt || now,
      endedAt: now,
      durationMin: timer.sessionMinutes || this.minutesFor('focus'),
      taskId: timer.taskId || null,
    });
    const task = timer.taskId && this.data.tasks.find((candidate) => candidate.id === timer.taskId);
    if (task) {
      task.sessionCount = (task.sessionCount || 0) + 1;
      task.updatedAt = now;
    }
  }

  showSessionAlert(finishedMode, nextMode) {
    const settings = this.settings();
    const minutes = this.minutesFor(nextMode);
    let title;
    let body;
    let primaryLabel = null;

    if (finishedMode === 'focus') {
      title = nextMode === 'long' ? t('alert.focusDoneLong') : t('alert.focusDone');
      body = nextMode === 'long' ? t('alert.toLong', { n: minutes }) : t('alert.toShort', { n: minutes });
      primaryLabel = t('alert.startBreak');
    } else {
      title = t('alert.breakDone');
      body = t('alert.toFocus', { n: minutes });
      primaryLabel = t('alert.startFocus');
    }
    if (settings.autoStart) {
      body += ' ' + t('alert.autoStarted');
      primaryLabel = null; // nothing to start, it already started
    }

    const alertsOn = finishedMode === 'focus' ? settings.sessionAlerts : settings.breakAlerts;
    if (alertsOn) {
      const emoji = finishedMode === 'focus' ? themeEmoji('celebration') : themeEmoji('focus');
      this.alert = { title, body, primaryLabel, emoji };
      showSystemNotification(title, body, this.label);
    } else {
      this.toast(`${title} ${body}`);
    }

    if (settings.alertSound) playAlertSound(finishedMode === 'focus' ? 'sessionEnd' : 'breakEnd', settings.soundPack);
    this.announce(`${title} ${body}`);
  }

  /* --------------------------- Deadline reminders ---------------------------
     Shown on sign-in, when the app opens and hourly. Each task is reminded at most
     once per day unless `force` is true (the prototype "Trigger now" button). */

  checkDeadlines(force = false) {
    if (!this.user || !this.data || this.isStatic) return;
    if (!this.settings().deadlineReminders) {
      if (force) this.toast(t('notif.off'));
      return;
    }

    const logKey = 'brp_remind_' + this.user.id;
    const remindedOn = storage.get(logKey, {});
    const today = toDayKey(new Date());
    const dueSoon = this.liveTasks().filter(
      (task) =>
        !task.completed &&
        task.dueDate &&
        [0, 1].includes(daysUntil(task.dueDate)) &&
        (force || remindedOn[task.id] !== today)
    );

    if (!dueSoon.length) {
      if (force) this.toast(t('notif.noneDue'));
      return;
    }

    dueSoon.forEach((task) => (remindedOn[task.id] = today));
    storage.set(logKey, remindedOn);

    const items = dueSoon.map((task) => ({
      id: task.id,
      title: task.title,
      when: daysUntil(task.dueDate) === 0 ? 'today' : 'tomorrow',
    }));
    this.ui.deadlineBanner = { items };

    const heading = items.length === 1 ? t('notif.deadlineOne') : t('notif.deadlineMany', { n: items.length });
    const lines = items.map(
      (item) => `${escapeHtml(item.title)} (${t(item.when === 'today' ? 'notif.dueToday' : 'notif.dueTomorrow')})`
    );
    showSystemNotification(heading, lines.join('<br>'), this.label);
    this.announce(heading);
    this.render();
  }

  /* ---------------------------- Settings draft ----------------------------
     Settings are edited on a copy (settingsDraft) and only saved on Save. */

  settingsErrors() {
    const draft = this.ui.settingsDraft || {};
    const labels = { focusMin: 'set.focusMin', shortMin: 'set.shortMin', longMin: 'set.longMin' };
    const errors = {};
    for (const [key, [min, max]] of Object.entries(DURATION_LIMITS)) {
      const raw = String(draft[key] ?? '').trim();
      const value = Number(raw);
      if (raw === '' || !Number.isInteger(value) || value < min || value > max) {
        errors[key] = t('set.err.range', { label: t(labels[key]), min, max });
      }
    }
    return errors;
  }

  hasUnsavedSettings() {
    if (!this.ui.settingsDraft) return false;
    const comparable = (settings) => {
      const copy = deepCopy(settings);
      Object.keys(DURATION_LIMITS).forEach((key) => (copy[key] = String(copy[key])));
      delete copy.updatedAt;
      delete copy.taskSort; // saved instantly from the Tasks screen
      return JSON.stringify(copy);
    };
    return comparable(this.ui.settingsDraft) !== comparable(this.settings());
  }

  /** Undo a theme/motion preview when settings are cancelled. */
  revertSettingsPreview() {
    applyTheme(this.settings().themeId);
    applyReducedMotion(this.settings().reduceMotion);
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
        if (destination === 'settings') this.ui.settingsDraft = deepCopy(this.settings());
        this.ui.focusAfterRender = 'tab:' + destination;
      }
      this.render();
    };

    const leavingDirtySettings =
      this.ui.tab === 'settings' &&
      this.ui.screen === 'main' &&
      destination !== 'settings' &&
      this.hasUnsavedSettings();

    if (leavingDirtySettings) {
      this.askConfirm({
        title: t('set.discard.title'),
        body: t('set.discard.body'),
        confirmLabel: t('set.discard.yes'),
        danger: true,
        onConfirm: () => {
          this.revertSettingsPreview();
          this.ui.settingsDraft = null;
          go();
        },
      });
      return;
    }
    go();
  }

  /** Close the task form or picker. Asks first if the task form has unsaved edits. */
  closeModal(force = false) {
    const form = this.ui.taskForm;
    if (!force && this.ui.openModal === 'taskForm' && taskFormSnapshot(form) !== form.originalSnapshot) {
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

  /* ------------------------------ Task form ------------------------------ */

  /** Open the create/edit sheet. Pass a task to edit it, or null to create one. */
  openTaskForm(task, returnFocusId) {
    this.ui.openMenuTaskId = null;
    this.ui.returnFocusId = returnFocusId || null;

    const dueIsTodayOrTomorrow = task && task.dueDate && [0, 1].includes(daysUntil(task.dueDate));
    const form = {
      id: task ? task.id : null,
      isNewTask: !task,
      title: task ? task.title : '',
      description: task ? task.description || '' : '',
      priority: task ? task.priority || 'none' : 'none',
      dueDate: task ? task.dueDate || '' : '',
      showDatePicker: Boolean(task && task.dueDate && !dueIsTodayOrTomorrow),
      showTitleError: false,
      isSaving: false,
      syncFailed: false,
    };
    form.originalSnapshot = taskFormSnapshot(form);

    this.ui.taskForm = form;
    this.ui.openModal = 'taskForm';
    this.ui.focusAfterRender = 'taskForm.title';
    this.render();
  }

  async saveTaskForm() {
    const form = this.ui.taskForm;
    const title = form.title.trim();
    if (!title) {
      form.showTitleError = true;
      this.ui.focusAfterRender = 'taskForm.title';
      this.render();
      return;
    }

    form.isSaving = true;
    form.syncFailed = false;
    this.render();

    const now = Date.now();
    const values = {
      title,
      description: form.description.trim(),
      priority: form.priority === 'none' ? null : form.priority,
      dueDate: form.dueDate || null,
      updatedAt: now,
    };
    const result = await this.commit((data) => {
      if (form.id) {
        Object.assign(
          data.tasks.find((task) => task.id === form.id),
          values
        );
      } else {
        form.id = 't_' + makeId(); // so a retry updates this task instead of adding a copy
        data.tasks.push({
          id: form.id,
          ...values,
          completed: false,
          completedAt: null,
          sessionCount: 0,
          createdAt: now,
          deleted: false,
        });
      }
    });

    if (!this.ui.taskForm) return; // closed while saving
    form.isSaving = false;

    if (result === 'failed') {
      // Keep the form open with the user's input and offer Retry.
      form.syncFailed = true;
      form.originalSnapshot = taskFormSnapshot(form);
      this.render();
      return;
    }

    this.closeModal(true);
    if (result === 'offline') this.toast(t('sync.savedLocal'));
    else this.toast(t('tasks.savedToast'), 'success');
  }
}

/** A string of the task form's fields, used to detect unsaved edits. */
function taskFormSnapshot(form) {
  return JSON.stringify([form.title, form.description, form.priority, form.dueDate]);
}
