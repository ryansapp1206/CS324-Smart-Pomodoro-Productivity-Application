/* =====================================================================
   PROTOTYPE HARNESS (not part of the app)
   Mounts the app on the page, runs the clock, and powers the
   "Prototype controls" panel and the screen gallery used for demos,
   usability tests and screenshots.
   ===================================================================== */

const APPS = []; // every live app instance (Device 1, and Device 2 when open)

function getDevice1() {
  return APPS.find((app) => app.device === 'dev1');
}
function getDevice2() {
  return APPS.find((app) => app.device === 'dev2');
}

/* ------------------------------ Devices ------------------------------ */

function mountDevice(device, caption) {
  const wrapper = document.createElement('div');
  wrapper.className = 'dev';
  wrapper.id = 'device-' + device;
  wrapper.innerHTML = `
    <div class="dev-cap">
      <span>${caption}</span>
      <span style="display:flex;gap:6px">
        <button data-reload title="Pulls the latest data from the cloud, like reopening the app">Reload app</button>
        ${device === 'dev2' ? '<button data-close-device>Close</button>' : ''}
      </span>
    </div>
    <div class="popup" id="popup-${device}" role="region" aria-label="${t('app.name')}"></div>`;
  $('#desk').appendChild(wrapper);

  const app = new PomodoroApp(wrapper.querySelector('.popup'), { id: device, device, label: caption });
  wrapper.querySelector('[data-reload]').addEventListener('click', () => app.reload());
  wrapper.querySelector('[data-close-device]')?.addEventListener('click', closeDevice2);
  APPS.push(app);
  return app;
}

/** Device 2 signs in to the same account to demonstrate cross-device sync. */
function openDevice2() {
  if (getDevice2()) return;
  const device1 = getDevice1();
  if (device1 && device1.user) storage.set('brp_session_dev2', device1.user.id);
  mountDevice('dev2', 'Device 2 · Work laptop').boot();
  $('#device2-button').textContent = 'Close Device 2 window';
}

function closeDevice2() {
  const device2 = getDevice2();
  if (!device2) return;
  storage.remove('brp_session_dev2');
  storage.remove('brp_timer_dev2');
  $('#device-dev2').remove();
  APPS.splice(APPS.indexOf(device2), 1);
  $('#device2-button').textContent = 'Open Device 2 window';
}

function bootPrototype() {
  $('#desk').innerHTML = '';
  APPS.length = 0;
  getCloud(); // creates the demo account on first run
  applyTheme(storage.get('brp_last_theme', DEFAULT_THEME_ID));
  applyReducedMotion(false);
  mountDevice('dev1', 'Device 1 · Home laptop').boot();
  if (storage.get('brp_session_dev2', null)) openDevice2();
  syncControlsPanel();
}

/* --------------------------- Controls panel --------------------------- */

function showControlStatus(message) {
  const status = $('#control-status');
  status.textContent = message;
  clearTimeout(showControlStatus.timeout);
  showControlStatus.timeout = setTimeout(() => (status.textContent = ''), 4000);
}

/** Make the panel's radios and theme menu match the current state. */
function syncControlsPanel() {
  document
    .querySelectorAll('input[name=speed]')
    .forEach((radio) => (radio.checked = Number(radio.value) === simulation.speed));
  document.querySelectorAll('input[name=sync]').forEach((radio) => (radio.checked = radio.value === simulation.sync));
  $('#control-theme').innerHTML = Object.values(THEMES)
    .map(
      (theme) =>
        `<option value="${theme.id}" ${theme.id === currentThemeId ? 'selected' : ''}>${escapeHtml(theme.name)}</option>`
    )
    .join('');
}

themeChangeListeners.push((themeId) => {
  const select = $('#control-theme');
  if (select) select.value = themeId;
});

const SYNC_STATUS_MESSAGES = {
  normal: 'Sync is back to normal.',
  offline: 'Simulating offline.',
  savefail: 'Saves to the cloud will fail.',
  loadfail: 'Loading from the cloud will fail on next sign-in or reload.',
};

function onSpeedChange(speed) {
  APPS.forEach((app) => app.changeSpeed(speed));
  simulation.speed = speed;
  saveSimulation();
  APPS.forEach((app) => app.render());
  showControlStatus(speed === 1 ? 'Timer runs in real time.' : 'Demo speed on: 1 second = 1 minute.');
}

function onSyncSimulationChange(mode) {
  simulation.sync = mode;
  saveSimulation();
  showControlStatus(SYNC_STATUS_MESSAGES[mode]);

  for (const app of APPS) {
    if (!app.user) continue;
    if (mode === 'offline') {
      app.syncState = 'offline';
      app.render();
    } else if (mode === 'normal') {
      // Back online: push anything that was waiting.
      if (app.hasPendingChanges || app.saveFailed) app.sync();
      else if (app.syncState === 'offline') {
        app.syncState = 'synced';
        app.render();
      }
    }
  }
}

function onThemeControlChange(themeId) {
  applyTheme(themeId);
  for (const app of APPS) {
    if (!app.user || !app.data) {
      app.render();
      continue;
    }
    if (app.ui.settingsDraft) app.ui.settingsDraft.themeId = themeId;
    if (app.device === 'dev1') {
      app.commit((data) => {
        data.settings.themeId = themeId;
        data.settings.updatedAt = Date.now();
      });
    } else {
      app.render();
    }
  }
}

function createFreshAccount() {
  const cloud = getCloud();
  const user = {
    id: 'u_' + makeId(),
    email: `new${Object.keys(cloud.users).length}@ramranch.app`,
    displayName: 'Ballerina Cappuccina',
    passwordHash: fakeHash(DEMO_USER.password),
    createdAt: Date.now(),
  };
  cloud.users[user.email] = user;
  cloud.data[user.id] = emptyAccountData();
  saveCloud(cloud);
  return publicUser(user);
}

const CONTROL_ACTIONS = {
  jump(device1) {
    if (!device1.user) return showControlStatus('Log in on Device 1 first.');
    device1.jumpToLastSeconds();
    showControlStatus('Timer will finish in 5 seconds.');
  },
  deadline(device1) {
    if (!device1.user) return showControlStatus('Log in on Device 1 first.');
    device1.checkDeadlines(true);
  },
  device2() {
    if (getDevice2()) closeDevice2();
    else openDevice2();
  },
  'account-demo'(device1) {
    device1.logout(true);
    device1.signIn(mockApi.findUserById(DEMO_USER.id));
    showControlStatus('Signed in to the demo account.');
  },
  'account-fresh'(device1) {
    device1.logout(true);
    const user = createFreshAccount();
    device1.signIn(user);
    showControlStatus(`Signed in to a fresh account (${user.email}).`);
  },
  'account-out'(device1) {
    device1.logout();
    showControlStatus('Logged out on Device 1.');
  },
  gallery() {
    openScreenGallery();
  },
  reset() {
    storage.clearAll();
    storage.set('brp_ver', DATA_VERSION);
    simulation.speed = 1;
    simulation.sync = 'normal';
    saveSimulation();
    bootPrototype();
    showControlStatus('Demo data reset.');
  },
};

document.addEventListener('change', (event) => {
  const target = event.target;
  if (target.name === 'speed') onSpeedChange(Number(target.value));
  if (target.name === 'sync') onSyncSimulationChange(target.value);
  if (target.id === 'control-theme') onThemeControlChange(target.value);
});

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-control]');
  if (button) CONTROL_ACTIONS[button.dataset.control]?.(getDevice1());
});

$('#controls-collapse').addEventListener('click', (event) => {
  const collapsed = $('#controls').classList.toggle('collapsed');
  event.target.textContent = collapsed ? 'Show' : 'Hide';
  event.target.setAttribute('aria-expanded', String(!collapsed));
});

/* ----------------------- Global keyboard shortcuts -----------------------
   Space = start/pause on the Timer tab. N = new task on the Tasks tab. */

document.addEventListener('keydown', (event) => {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
  if (!$('#gallery').hidden) return;

  const focused = document.activeElement;
  if (focused && focused.matches('input, textarea, select, [contenteditable]')) return;

  let app = APPS.find((candidate) => candidate.root.contains(focused));
  if (!app && (!focused || focused === document.body)) app = getDevice1();
  if (!app || !app.user || !app.data || app.ui.openModal || app.ui.confirmDialog || app.ui.screen !== 'main') return;

  if (event.key === ' ' && app.ui.tab === 'timer') {
    if (focused && focused.matches('button, a')) return; // Space already clicks buttons
    event.preventDefault();
    app.toggleTimer();
  }
  if ((event.key === 'n' || event.key === 'N') && app.ui.tab === 'tasks') {
    event.preventDefault();
    ACTIONS.newTask(app);
  }
});

/* ---------------------------- Screen gallery ----------------------------
   Renders every screen and key state as static snapshots for screenshots. */

/** Put a static gallery app into a signed-in state with fresh demo data. */
function signInForGallery(app, tab = 'timer') {
  app.user = mockApi.findUserById(DEMO_USER.id) || { ...DEMO_USER, createdAt: daysFromNow(-40).getTime() };
  app.data = createDemoData();
  app.data.settings.themeId = currentThemeId;
  app.loadState = 'ready';
  app.lastSyncedAt = Date.now();
  app.ui.screen = 'main';
  app.ui.tab = tab;
}

function setGalleryTimer(app, mode, remainingMs, status = 'running') {
  Object.assign(app.timer, {
    mode,
    status,
    sessionLengthMs: app.minutesFor(mode) * 60000,
    sessionMinutes: app.minutesFor(mode),
    endsAt: Date.now() + remainingMs / simulation.speed,
    pausedRemainingMs: remainingMs,
    taskId: 't_srs',
    completedInCycle: mode === 'long' ? 4 : 1,
  });
}

function galleryTaskForm(overrides) {
  return {
    id: null,
    isNewTask: true,
    title: '',
    description: '',
    priority: 'none',
    dueDate: '',
    showDatePicker: false,
    showTitleError: false,
    isSaving: false,
    syncFailed: false,
    ...overrides,
  };
}

const GALLERY_STATES = [
  ['Log in', () => {}],
  [
    'Log in error',
    (app) => {
      app.ui.authForm.email = DEMO_USER.email;
      app.ui.errors.form = t('auth.err.generic');
    },
  ],
  [
    'Register with errors',
    (app) => {
      app.ui.screen = 'register';
      Object.assign(app.ui.authForm, { name: 'Sam', email: DEMO_USER.email, password: 'short' });
      app.ui.errors = { email: t('auth.err.emailTaken'), emailTaken: true, password: t('auth.err.pwShort') };
    },
  ],
  [
    'Forgot password',
    (app) => {
      app.ui.screen = 'forgot';
      app.ui.authForm.email = DEMO_USER.email;
    },
  ],
  [
    'Check your email',
    (app) => {
      app.ui.screen = 'sent';
      app.ui.resetEmail = DEMO_USER.email;
    },
  ],
  [
    'Set new password',
    (app) => {
      app.ui.screen = 'reset';
      app.ui.resetEmail = DEMO_USER.email;
      Object.assign(app.ui.authForm, { password: 'newpass12', password2: 'newpass1' });
      app.ui.errors.password2 = t('auth.err.pwMatch');
    },
  ],
  [
    'Timer · idle',
    (app) => {
      signInForGallery(app);
      app.timer.taskId = 't_srs';
    },
  ],
  [
    'Timer · running',
    (app) => {
      signInForGallery(app);
      setGalleryTimer(app, 'focus', (14 * 60 + 32) * 1000);
    },
  ],
  [
    'Timer · paused',
    (app) => {
      signInForGallery(app);
      setGalleryTimer(app, 'focus', (9 * 60 + 5) * 1000, 'paused');
    },
  ],
  [
    'Timer · short break',
    (app) => {
      signInForGallery(app);
      setGalleryTimer(app, 'short', (3 * 60 + 41) * 1000);
    },
  ],
  [
    'Timer · long break',
    (app) => {
      signInForGallery(app);
      setGalleryTimer(app, 'long', (12 * 60 + 10) * 1000);
    },
  ],
  [
    'Session complete alert',
    (app) => {
      signInForGallery(app);
      Object.assign(app.timer, { mode: 'short', completedInCycle: 2 });
      app.alert = {
        title: t('alert.focusDone'),
        body: t('alert.toShort', { n: 5 }),
        primaryLabel: t('alert.startBreak'),
        emoji: themeEmoji('celebration'),
      };
    },
  ],
  [
    'Task picker',
    (app) => {
      signInForGallery(app);
      app.timer.taskId = 't_srs';
      app.ui.openModal = 'taskPicker';
    },
  ],
  [
    'Tasks · open',
    (app) => {
      signInForGallery(app, 'tasks');
      app.timer.taskId = 't_srs';
    },
  ],
  [
    'Tasks · completed',
    (app) => {
      signInForGallery(app, 'tasks');
      app.ui.taskFilter = 'completed';
    },
  ],
  [
    'Tasks · empty',
    (app) => {
      signInForGallery(app, 'tasks');
      app.data.tasks = [];
    },
  ],
  [
    'Task form with error',
    (app) => {
      signInForGallery(app, 'tasks');
      app.ui.openModal = 'taskForm';
      app.ui.taskForm = galleryTaskForm({ priority: 'high', dueDate: toDayKey(daysFromNow(1)), showTitleError: true });
    },
  ],
  [
    'Delete confirmation',
    (app) => {
      signInForGallery(app, 'tasks');
      app.ui.confirmDialog = {
        title: t('tasks.del.title', { title: 'Read chapter 6' }),
        body: t('tasks.del.body'),
        confirmLabel: t('tasks.delete'),
        danger: true,
      };
    },
  ],
  ['Stats', (app) => signInForGallery(app, 'stats')],
  [
    'Stats · empty',
    (app) => {
      signInForGallery(app, 'stats');
      app.data.sessions = [];
    },
  ],
  [
    'Achievements',
    (app) => {
      signInForGallery(app, 'stats');
      app.ui.scrollToSelector = '[data-achievements]';
    },
  ],
  [
    'Shop · themes',
    (app) => {
      signInForGallery(app, 'shop');
      app.ui.shopCategory = 'theme';
      app.data.purchases = [{ id: 'p1', itemId: 'theme:sigma', price: 250, at: Date.now() }];
    },
  ],
  [
    'Shop · sound packs',
    (app) => {
      signInForGallery(app, 'shop');
      app.ui.shopCategory = 'sound';
      app.data.settings.soundPack = 'tung';
      app.data.purchases = [{ id: 'p2', itemId: 'sound:tung', price: 150, at: Date.now() }];
    },
  ],
  [
    'Shop · profile pictures',
    (app) => {
      signInForGallery(app, 'shop');
      app.ui.shopCategory = 'avatar';
      app.data.settings.avatarId = 'tung-tung';
      app.data.purchases = [{ id: 'p3', itemId: 'avatar:tung-tung', price: 100, at: Date.now() }];
    },
  ],
  [
    'Buy confirmation',
    (app) => {
      signInForGallery(app, 'shop');
      app.ui.shopCategory = 'avatar';
      app.ui.confirmDialog = {
        title: t('aura.buy.title', { name: 'Tralalero Tralala' }),
        body: t('aura.buy.body', { price: 100, left: 595 }),
        confirmLabel: t('aura.buy.yes'),
      };
    },
  ],
  [
    'Settings with unsaved changes',
    (app) => {
      signInForGallery(app, 'settings');
      app.ui.settingsDraft = { ...deepCopy(app.data.settings), focusMin: '50', autoStart: true };
    },
  ],
  [
    'Settings · invalid value',
    (app) => {
      signInForGallery(app, 'settings');
      app.ui.settingsDraft = { ...deepCopy(app.data.settings), focusMin: '150' };
    },
  ],
  [
    'Profile',
    (app) => {
      signInForGallery(app);
      app.ui.screen = 'profile';
    },
  ],
  [
    'Account menu (log out)',
    (app) => {
      signInForGallery(app);
      app.ui.openPopover = 'avatar';
    },
  ],
  [
    'Sync · offline',
    (app) => {
      signInForGallery(app, 'tasks');
      app.syncState = 'offline';
      app.ui.openPopover = 'sync';
    },
  ],
  [
    'Sync failed with Retry',
    (app) => {
      signInForGallery(app, 'tasks');
      app.syncState = 'failed';
      app.saveFailed = true;
    },
  ],
  [
    'Task save failed',
    (app) => {
      signInForGallery(app, 'tasks');
      app.syncState = 'failed';
      app.ui.openModal = 'taskForm';
      app.ui.taskForm = galleryTaskForm({
        id: 't_new',
        title: 'Book study room',
        priority: 'medium',
        dueDate: toDayKey(new Date()),
        syncFailed: true,
      });
    },
  ],
  [
    'Load failed',
    (app) => {
      signInForGallery(app);
      app.loadState = 'error';
      app.syncState = 'failed';
    },
  ],
  [
    'Deadline reminder',
    (app) => {
      signInForGallery(app);
      app.ui.deadlineBanner = {
        items: [
          { title: 'Finish SRS draft', when: 'today' },
          { title: 'Study for stats quiz', when: 'tomorrow' },
        ],
      };
    },
  ],
];

function openScreenGallery() {
  const grid = $('#gallery-grid');
  grid.innerHTML = '';

  GALLERY_STATES.forEach(([label, setUpState], index) => {
    const figure = document.createElement('figure');
    figure.className = 'gal-item';
    figure.innerHTML = `<figcaption>${index + 1}. ${escapeHtml(label)}</figcaption><div class="popup" inert></div>`;
    grid.appendChild(figure);

    const app = new PomodoroApp(figure.querySelector('.popup'), {
      id: 'gallery' + index,
      device: 'gallery',
      label: 'Gallery',
      isStatic: true,
    });
    setUpState(app);
    app.render();
    app.renderToasts();
  });

  $('#gallery').hidden = false;
  $('#gallery-close').focus();
}

function closeScreenGallery() {
  $('#gallery').hidden = true;
  $('#gallery-grid').innerHTML = '';
  $('[data-control=gallery]').focus();
}

$('#gallery-close').addEventListener('click', closeScreenGallery);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !$('#gallery').hidden) closeScreenGallery();
});

/* ------------------------------- Start ------------------------------- */

setInterval(() => APPS.forEach((app) => app.tick()), 250);
setInterval(() => APPS.forEach((app) => app.checkDeadlines()), 60 * 60 * 1000);
bootPrototype();
