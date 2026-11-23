/* =====================================================================
   ACTIONS AND EVENTS
   Buttons in the markup say what they do with data attributes:
     data-action="startTimer"   → runs ACTIONS.startTimer(app, arg, element, event)
     data-arg="..."             → the argument (a task id, a mode, …)
     data-focus-id="..."        → stable id used to restore keyboard focus after re-rendering
   Inputs use data-bind="path.in.app.ui" to write straight into UI state, and
   data-live to choose what refreshes while typing.
   Forms use data-form="login" etc. and are handled by FORM_HANDLERS
   (never by native submission, which some preview windows block).
   ===================================================================== */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ---------------------------- Form handlers ---------------------------- */

const FORM_HANDLERS = {
  async login(app) {
    const form = app.ui.authForm;
    const email = form.email.trim().toLowerCase();
    app.ui.errors = {};
    app.ui.notice = null;

    if (!email || !form.password) {
      app.ui.errors.form = t('auth.err.empty');
      app.ui.focusAfterRender = 'authForm.email';
      app.render();
      return;
    }

    app.ui.isBusy = true;
    app.render();
    try {
      const user = await mockApi.login(email, form.password);
      app.ui.isBusy = false;
      app.signIn(user);
    } catch (error) {
      app.ui.isBusy = false;
      // One generic message: never reveal whether the email or the password was wrong.
      app.ui.errors.form = error.code === 'offline' ? t('auth.err.offline') : t('auth.err.generic');
      form.password = '';
      app.ui.focusAfterRender = 'authForm.password';
      app.render();
    }
  },

  async register(app) {
    const form = app.ui.authForm;
    const email = form.email.trim().toLowerCase();
    const name = form.name.trim();
    const errors = {};
    if (name.length > 40) errors.name = t('auth.err.nameLong');
    if (!EMAIL_PATTERN.test(email)) errors.email = t('auth.err.email');
    if (form.password.length < 8) errors.password = t('auth.err.pwShort');

    app.ui.errors = errors;
    if (Object.keys(errors).length) {
      app.ui.focusAfterRender = 'authForm.' + Object.keys(errors)[0];
      app.render();
      return;
    }

    app.ui.isBusy = true;
    app.render();
    try {
      const user = await mockApi.register(name, email, form.password);
      app.ui.isBusy = false;
      app.signIn(user);
    } catch (error) {
      app.ui.isBusy = false;
      if (error.code === 'taken') {
        app.ui.errors.email = t('auth.err.emailTaken');
        app.ui.errors.emailTaken = true;
        app.ui.focusAfterRender = 'authForm.email';
      } else {
        app.ui.errors.form = t('auth.err.offline');
      }
      app.render();
    }
  },

  async forgot(app) {
    const email = app.ui.authForm.email.trim().toLowerCase();
    app.ui.errors = {};
    if (!EMAIL_PATTERN.test(email)) {
      app.ui.errors.email = t('auth.err.email');
      app.ui.focusAfterRender = 'authForm.email';
      app.render();
      return;
    }

    app.ui.isBusy = true;
    app.render();
    try {
      app.ui.resetAccountExists = await mockApi.requestPasswordReset(email);
      app.ui.resetEmail = email;
      app.ui.screen = 'sent';
      app.ui.focusAfterRender = 'openResetLink:';
    } catch (error) {
      app.ui.errors.form = t('auth.err.offline');
    }
    app.ui.isBusy = false;
    app.render();
  },

  async reset(app) {
    const form = app.ui.authForm;
    const errors = {};
    if (form.password.length < 8) errors.password = t('auth.err.pwShort');
    else if (form.password !== form.password2) errors.password2 = t('auth.err.pwMatch');

    app.ui.errors = errors;
    if (Object.keys(errors).length) {
      app.ui.focusAfterRender = 'authForm.' + Object.keys(errors)[0];
      app.render();
      return;
    }

    app.ui.isBusy = true;
    app.render();
    try {
      await mockApi.resetPassword(app.ui.resetEmail, form.password);
      app.ui.screen = 'login';
      app.ui.authForm = { email: app.ui.resetEmail, password: '', password2: '', name: '' };
      app.ui.notice = t('auth.reset.done');
      app.ui.focusAfterRender = 'authForm.password';
    } catch (error) {
      app.ui.errors.form = t('auth.err.offline');
    }
    app.ui.isBusy = false;
    app.render();
  },

  task(app) {
    app.saveTaskForm();
  },

  async profile(app) {
    const form = app.ui.profileForm;
    const name = form.displayName.trim();
    form.error = null;
    if (!name || name.length > 40) {
      form.error = t('profile.err.name');
      app.ui.focusAfterRender = 'profileForm.displayName';
      app.render();
      return;
    }

    form.isBusy = true;
    app.render();
    try {
      app.user = await mockApi.updateDisplayName(app.user.id, name);
      form.displayName = app.user.displayName;
      app.toast(t('profile.saved'), 'success');
    } catch (error) {
      form.error = t('profile.err.network');
    }
    form.isBusy = false;
    app.render();
  },
};

/* ------------------------------- Actions ------------------------------- */

const ACTIONS = {
  /* ---- Auth screens ---- */
  goToAuthScreen(app, screen) {
    app.ui.screen = screen;
    app.ui.errors = {};
    app.ui.notice = null;
    app.ui.showPassword = false;
    app.ui.focusAfterRender = screen === 'register' ? 'authForm.name' : 'authForm.email';
    app.render();
  },
  togglePasswordVisibility(app) {
    app.ui.showPassword = !app.ui.showPassword;
    app.render();
  },
  fillDemoAccount(app) {
    app.ui.authForm.email = DEMO_USER.email;
    app.ui.authForm.password = DEMO_USER.password;
    app.ui.errors = {};
    app.ui.focusAfterRender = 'submit-login';
    app.render();
  },
  openResetLink(app) {
    app.ui.screen = 'reset';
    app.ui.authForm.password = '';
    app.ui.authForm.password2 = '';
    app.ui.errors = {};
    app.ui.focusAfterRender = 'authForm.password';
    app.render();
  },

  /* ---- Navigation, header and account ---- */
  goToTab(app, tab) {
    app.navigate(tab);
  },
  goBack(app) {
    app.navigate(app.ui.previousTab || 'timer');
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
    app.logout();
  },

  /* ---- Sync and banners ---- */
  syncNow(app) {
    app.ui.openPopover = null;
    if (app.loadState === 'error' || app.showingCachedData) {
      app.load(true);
      return;
    }
    app.sync().then((result) => {
      if (result === 'ok') app.toast(t('sync.done'), 'success');
    });
  },
  retrySync(app) {
    app.sync().then((result) => {
      if (result === 'ok') app.toast(t('sync.done'), 'success');
    });
  },
  retryLoad(app) {
    app.load(true);
  },
  dismissBanner(app, banner) {
    if (banner === 'deadline') app.ui.deadlineBanner = null;
    else app.showingCachedData = false;
    app.render();
  },
  viewDueTasks(app) {
    app.ui.deadlineBanner = null;
    app.ui.taskFilter = 'open';
    app.navigate('tasks');
  },

  /* ---- Timer ---- */
  switchMode(app, mode) {
    const timer = app.timer;
    if (mode === timer.mode && timer.status === 'idle') return;

    const doSwitch = () => {
      app.resetTimer(mode);
      app.ui.focusAfterRender = 'switchMode:' + mode;
      app.render();
    };
    if (timer.status === 'idle') {
      doSwitch();
      return;
    }
    app.askConfirm({
      title: t('timer.switch.title', { mode: t('mode.' + mode) }),
      body: t('timer.switch.body'),
      confirmLabel: t('timer.switch.yes'),
      onConfirm: doSwitch,
    });
  },
  startTimer(app) {
    app.startTimer();
    app.alert = null;
    app.ui.focusAfterRender = 'pauseTimer:';
    app.render();
    app.renderToasts();
  },
  pauseTimer(app) {
    app.pauseTimer();
    app.ui.focusAfterRender = 'resumeTimer:';
    app.render();
  },
  resumeTimer(app) {
    app.resumeTimer();
    app.ui.focusAfterRender = 'pauseTimer:';
    app.render();
  },
  /** Stop: end the session early and go back to an idle Focus session. */
  stopTimer(app) {
    const wasActive = app.timer.status !== 'idle';
    app.resetTimer('focus');
    app.ui.focusAfterRender = 'startTimer:';
    app.render();
    if (wasActive) app.toast(t('timer.notCounted'));
  },
  /** Reset: restart the current mode from its full length. */
  resetTimer(app) {
    const wasActive = app.timer.status !== 'idle';
    app.resetTimer();
    app.ui.focusAfterRender = 'startTimer:';
    app.render();
    if (wasActive) app.toast(t('timer.notCounted'));
  },
  openTaskPicker(app, arg, element) {
    app.ui.returnFocusId = element.dataset.focusId;
    app.ui.openModal = 'taskPicker';
    app.ui.focusAfterRender = 'pickTask:' + (app.timer.taskId || '');
    app.render();
  },
  pickTask(app, taskId) {
    app.timer.taskId = taskId || null;
    app.saveTimer();
    app.closeModal(true);
  },
  closeTaskPicker(app) {
    app.closeModal(true);
  },
  setTaskSort(app, sortBy) {
    app.ui.focusAfterRender = 'setTaskSort:' + sortBy;
    app.commit((data) => {
      data.settings.taskSort = sortBy;
      data.settings.updatedAt = Date.now();
    });
  },

  /* ---- Session alert and toasts ---- */
  alertPrimaryAction(app) {
    app.alert = null;
    if (app.timer.status === 'idle') app.startTimer();
    app.ui.screen = 'main';
    app.ui.tab = 'timer';
    app.ui.focusAfterRender = 'pauseTimer:';
    app.render();
    app.renderToasts();
  },
  dismissAlert(app) {
    app.alert = null;
    app.renderToasts();
  },
  closeToast(app, toastId) {
    app.toasts = app.toasts.filter((toast) => toast.id !== toastId);
    app.renderToasts();
  },

  /* ---- Tasks ---- */
  setTaskFilter(app, filter) {
    app.ui.taskFilter = filter;
    app.ui.openMenuTaskId = null;
    app.ui.focusAfterRender = 'setTaskFilter:' + filter;
    app.render();
  },
  newTask(app, arg, element) {
    app.openTaskForm(null, element ? element.dataset.focusId : 'newTask:');
  },
  editTask(app, taskId) {
    app.openTaskForm(app.findTask(taskId), 'toggleTaskMenu:' + taskId);
  },
  focusOnTask(app, taskId) {
    app.ui.openMenuTaskId = null;
    app.timer.taskId = taskId;
    app.saveTimer();
    app.navigate('timer');
  },
  toggleTaskMenu(app, taskId) {
    app.ui.openMenuTaskId = app.ui.openMenuTaskId === taskId ? null : taskId;
    app.ui.focusAfterRender = app.ui.openMenuTaskId ? 'editTask:' + taskId : 'toggleTaskMenu:' + taskId;
    app.render();
  },
  deleteTask(app, taskId) {
    const task = app.findTask(taskId);
    app.ui.openMenuTaskId = null;
    app.askConfirm({
      title: t('tasks.del.title', { title: task.title }),
      body: t('tasks.del.body'),
      confirmLabel: t('tasks.delete'),
      danger: true,
      onConfirm: () => {
        app.commit((data) => {
          const target = data.tasks.find((candidate) => candidate.id === taskId);
          target.deleted = true;
          target.updatedAt = Date.now();
        });
        if (app.timer.taskId === taskId) {
          app.timer.taskId = null;
          app.saveTimer();
        }
        app.ui.focusAfterRender = 'newTask:';
        app.toast(t('tasks.deletedToast'));
        app.render();
      },
    });
  },
  completeTask(app, taskId) {
    const task = app.findTask(taskId);
    const achievementsBefore = unlockedAchievementIds(app.data);

    // Move focus to the neighbouring task so keyboard users don't lose their place.
    const openTasks = app.openTasksSorted();
    const index = openTasks.findIndex((candidate) => candidate.id === taskId);
    const neighbour = openTasks[index + 1] || openTasks[index - 1];

    app.commit((data) => {
      const target = data.tasks.find((candidate) => candidate.id === taskId);
      target.completed = true;
      target.completedAt = Date.now();
      target.updatedAt = Date.now();
    });
    if (app.timer.taskId === taskId) {
      app.timer.taskId = null;
      app.saveTimer();
    }

    app.ui.focusAfterRender = neighbour ? 'completeTask:' + neighbour.id : 'newTask:';
    const message = `${t('tasks.doneToast', { title: task.title })} ${t('aura.earned', { n: AURA_REWARDS.taskDone })}`;
    app.toast(message, 'success', themeEmoji('taskDone'));
    app.celebrateNewAchievements(achievementsBefore);
    app.render();
  },
  reopenTask(app, taskId) {
    const task = app.findTask(taskId);
    app.commit((data) => {
      const target = data.tasks.find((candidate) => candidate.id === taskId);
      target.completed = false;
      target.completedAt = null;
      target.updatedAt = Date.now();
    });
    app.ui.focusAfterRender = 'setTaskFilter:completed';
    app.toast(t('tasks.reopenedToast', { title: task.title }));
    app.render();
  },

  /* ---- Task form ---- */
  setPriority(app, priority) {
    app.ui.taskForm.priority = priority;
    app.ui.focusAfterRender = 'setPriority:' + priority;
    app.render();
  },
  setDueDate(app, choice) {
    const form = app.ui.taskForm;
    app.ui.focusAfterRender = 'setDueDate:' + choice;
    if (choice === 'today') {
      form.dueDate = toDayKey(new Date());
      form.showDatePicker = false;
    } else if (choice === 'tomorrow') {
      form.dueDate = toDayKey(daysFromNow(1));
      form.showDatePicker = false;
    } else if (choice === 'pick') {
      form.showDatePicker = true;
      if (!form.dueDate) form.dueDate = toDayKey(daysFromNow(2));
      app.ui.focusAfterRender = 'taskForm.dueDate';
    } else {
      form.dueDate = '';
      form.showDatePicker = false;
    }
    app.render();
  },
  cancelTaskForm(app) {
    app.closeModal(false);
  },
  retryTaskSave(app) {
    app.saveTaskForm();
  },
  keepTaskOnDevice(app) {
    app.closeModal(true);
    app.toast(t('sync.savedLocal'));
  },

  /* ---- Dialogs ---- */
  backdropClick(app, which, element, event) {
    if (event.target !== element) return; // ignore clicks inside the dialog
    if (which === 'confirm') ACTIONS.confirmCancel(app);
    else app.closeModal(false);
  },
  confirmAccept(app) {
    const dialog = app.ui.confirmDialog;
    app.ui.confirmDialog = null;
    dialog.onConfirm();
  },
  confirmCancel(app) {
    const dialog = app.ui.confirmDialog;
    app.ui.confirmDialog = null;
    app.ui.focusAfterRender = dialog && dialog.returnFocusId;
    app.render();
  },

  /* ---- Stats ---- */
  startFocusing(app) {
    app.navigate('timer');
    if (app.timer.status === 'idle') {
      app.timer.mode = 'focus';
      app.startTimer();
      app.render();
    }
  },

  /* ---- Settings ---- */
  chooseTheme(app, themeId) {
    app.ui.settingsDraft.themeId = themeId;
    applyTheme(themeId); // live preview; reverted on Cancel
    app.ui.focusAfterRender = 'chooseTheme:' + themeId;
    app.render();
  },
  /** Stepper buttons next to the duration inputs. arg = 'focusMin:1' or 'focusMin:-1'. */
  stepDuration(app, arg) {
    const [key, step] = arg.split(':');
    const [min, max] = DURATION_LIMITS[key];
    const current = parseInt(app.ui.settingsDraft[key], 10);
    const base = Number.isNaN(current) ? DEFAULT_SETTINGS[key] : current;
    app.ui.settingsDraft[key] = String(Math.min(max, Math.max(min, base + Number(step))));
    app.render();
  },
  saveSettings(app) {
    if (Object.keys(app.settingsErrors()).length) return;
    const draft = app.ui.settingsDraft;
    const saved = {
      ...deepCopy(draft),
      focusMin: Number(draft.focusMin),
      shortMin: Number(draft.shortMin),
      longMin: Number(draft.longMin),
      taskSort: app.settings().taskSort,
      updatedAt: Date.now(),
    };
    app.ui.settingsDraft = deepCopy(saved);
    app.commit((data) => (data.settings = saved));
    applyTheme(saved.themeId);
    applyReducedMotion(saved.reduceMotion);
    app.toast(t('set.saved'), 'success');
    app.ui.focusAfterRender = 'tab:settings';
    app.render();
  },
  cancelSettings(app) {
    app.ui.settingsDraft = deepCopy(app.settings());
    app.revertSettingsPreview();
    app.ui.focusAfterRender = 'tab:settings';
    app.render();
  },

  /* ---- Shop ---- */
  openShop(app, category) {
    if (['theme', 'sound', 'avatar'].includes(category)) app.ui.shopCategory = category;
    app.navigate('shop');
  },
  setShopCategory(app, category) {
    app.ui.shopCategory = category;
    app.ui.focusAfterRender = 'setShopCategory:' + category;
    app.render();
  },
  previewSound(app, packId) {
    unlockAudio();
    const pack = SOUND_PACKS.find((p) => p.id === packId);
    if (pack) pack.play('sessionEnd');
  },
  /** arg = '<kind>:<id>', e.g. 'sound:tung'. */
  buyItem(app, arg) {
    const [kind, id] = arg.split(':');
    const item = findShopItem(kind, id);
    const balance = auraBalance(app.data);
    if (!item || balance < item.price || ownsItem(app.data, kind, id)) return;

    app.askConfirm({
      title: t('aura.buy.title', { name: item.name }),
      body: t('aura.buy.body', { price: item.price, left: balance - item.price }),
      confirmLabel: t('aura.buy.yes'),
      onConfirm: () => {
        app.commit((data) => {
          data.purchases = data.purchases || [];
          data.purchases.push({ id: 'p_' + makeId(), itemId: arg, price: item.price, at: Date.now() });
        });
        const message = item.comingSoon
          ? t('aura.boughtSoon', { name: item.name })
          : t('aura.bought', { name: item.name });
        app.toast(message, 'success', themeEmoji('aura'));
        app.ui.focusAfterRender = item.comingSoon ? 'setShopCategory:' + kind : 'equipItem:' + arg;
        app.render();
      },
    });
  },
  /** arg = '<kind>:<id>'. Saves the choice in settings so it syncs. */
  equipItem(app, arg) {
    const [kind, id] = arg.split(':');
    const item = findShopItem(kind, id);
    if (!item || item.comingSoon || !ownsItem(app.data, kind, id)) return;

    const settingKey = { theme: 'themeId', sound: 'soundPack', avatar: 'avatarId' }[kind];
    app.commit((data) => {
      data.settings[settingKey] = id;
      data.settings.updatedAt = Date.now();
    });
    if (app.ui.settingsDraft) app.ui.settingsDraft[settingKey] = id;
    if (kind === 'theme') applyTheme(id);
    if (kind === 'sound') ACTIONS.previewSound(app, id);

    app.ui.focusAfterRender = 'setShopCategory:' + kind;
    app.toast(t('aura.equippedToast', { name: item.name }), 'success');
    app.render();
  },
};

/* ---------------------------- Event wiring ---------------------------- */

function attachEventHandlers(app) {
  const root = app.root;

  root.addEventListener('click', (event) => {
    unlockAudio();
    const button = event.target.closest('[data-action]');

    // Clicking outside an open popover or task menu closes it.
    if (app.ui.openPopover && !event.target.closest('.popover') && button?.dataset.action !== 'togglePopover') {
      app.ui.openPopover = null;
      if (!button) return app.render();
    }
    if (app.ui.openMenuTaskId && !event.target.closest('.menu') && button?.dataset.action !== 'toggleTaskMenu') {
      app.ui.openMenuTaskId = null;
      if (!button) return app.render();
    }

    // Submit buttons run their form's handler directly.
    const submitButton = event.target.closest('button[type=submit]');
    if (submitButton) {
      event.preventDefault();
      const form = submitButton.closest('form[data-form]');
      if (!submitButton.disabled && form) FORM_HANDLERS[form.dataset.form]?.(app);
      return;
    }

    if (!button || button.disabled) return;
    const handler = ACTIONS[button.dataset.action];
    if (handler) {
      event.preventDefault();
      handler(app, button.dataset.arg, button, event);
    }
  });

  // Never let a form submit natively.
  root.addEventListener('submit', (event) => event.preventDefault());

  root.addEventListener('input', (event) => handleInput(app, event.target));

  root.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') handleEnterKey(app, event);
    else if (event.key === 'Escape') handleEscapeKey(app, event);
    else if (event.key === 'Tab') trapFocusInDialog(app, event);
  });
}

/** Write an input's value into UI state, then refresh only what needs it. */
function handleInput(app, input) {
  const path = input.dataset.bind;
  if (!path) return;
  const value = input.type === 'checkbox' ? input.checked : input.value;

  // The Tasks sort menu saves immediately (it's part of the account settings).
  if (path === 'taskSort') {
    app.ui.focusAfterRender = 'taskSort';
    app.commit((data) => {
      data.settings.taskSort = value;
      data.settings.updatedAt = Date.now();
    });
    return;
  }

  setByPath(app.ui, path, value);
  if (path === 'settingsDraft.reduceMotion') applyReducedMotion(value);

  switch (input.dataset.live) {
    case 'render': // e.g. toggles that show/hide other fields
      app.render();
      break;
    case 'settings': // number fields: update errors and the Save bar without losing the cursor
      refreshSettingsFeedback(app);
      break;
    case 'titleCounter': {
      const counter = app.screenHost.querySelector('[data-counter]');
      if (counter) counter.textContent = `${value.length}/100`;
      if (app.ui.taskForm.showTitleError && value.trim()) {
        app.ui.taskForm.showTitleError = false;
        app.render();
      }
      break;
    }
    case 'passwordHint': {
      const hint = app.screenHost.querySelector('[data-password-hint]');
      if (hint) hint.textContent = value.length >= 8 ? t('auth.pwHintOk') : t('auth.pwHintCount', { n: value.length });
      break;
    }
    case 'dueDateHint': {
      const hint = app.screenHost.querySelector('[data-due-hint]');
      if (hint) hint.textContent = dueDateHint(value);
      break;
    }
  }
}

function handleEnterKey(app, event) {
  const isTextInput = event.target.matches('input:not([type=checkbox]):not([type=button])');
  const form = event.target.closest('form[data-form]');
  if (!isTextInput || !form) return;
  event.preventDefault();
  const submitButton = form.querySelector('button[type=submit]');
  if (submitButton && !submitButton.disabled) FORM_HANDLERS[form.dataset.form](app);
}

/** Escape closes the top-most layer: confirm dialog → modal → menu → popover → alert. */
function handleEscapeKey(app, event) {
  const ui = app.ui;
  if (ui.confirmDialog) {
    ACTIONS.confirmCancel(app);
  } else if (ui.openModal) {
    app.closeModal(false);
  } else if (ui.openMenuTaskId) {
    ui.focusAfterRender = 'toggleTaskMenu:' + ui.openMenuTaskId;
    ui.openMenuTaskId = null;
    app.render();
  } else if (ui.openPopover) {
    ui.focusAfterRender = 'togglePopover:' + ui.openPopover;
    ui.openPopover = null;
    app.render();
  } else if (app.alert) {
    ACTIONS.dismissAlert(app);
  } else {
    return;
  }
  event.preventDefault();
}

/** Keep Tab / Shift+Tab inside the open dialog. */
function trapFocusInDialog(app, event) {
  const dialogs = app.screenHost.querySelectorAll('.trap');
  const topDialog = dialogs[dialogs.length - 1];
  if (!topDialog) return;

  const focusable = [
    ...topDialog.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea, select, [tabindex="0"]'),
  ];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (!topDialog.contains(document.activeElement)) {
    event.preventDefault();
    first.focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
