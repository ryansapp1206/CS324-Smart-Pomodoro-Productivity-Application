/* =====================================================================
   DATA, MOCK CLOUD AND GAME RULES
   No real backend: a "cloud" object lives in browser storage and every
   call goes through mockApi with fake latency. In the real extension,
   mockApi is the only thing that gets swapped for Firebase Auth + Firestore.
   ===================================================================== */

/* Bump this when the saved data shape changes; old demo data is wiped. */
const DATA_VERSION = 4;
if (storage.get('brp_ver', 0) !== DATA_VERSION) {
  storage.clearAll();
  storage.set('brp_ver', DATA_VERSION);
}

/* Prototype-only switches, changed from the Prototype controls panel. */
const simulation = storage.get('brp_sim', {
  speed: 1, // 1 = real time, 60 = 1 second per minute
  sync: 'normal', // normal | offline | savefail | loadfail
});
function saveSimulation() {
  storage.set('brp_sim', simulation);
}

const DEFAULT_SETTINGS = {
  focusMin: 25,
  shortMin: 5,
  longMin: 15,
  autoStart: false,
  alertSound: false,
  sessionAlerts: true,
  breakAlerts: true,
  deadlineReminders: true,
  dailyReminder: { enabled: false, time: '09:00' },
  themeId: DEFAULT_THEME_ID,
  soundPack: 'boring',
  avatarId: 'initials',
  reduceMotion: false,
  taskSort: 'due', // due | priority
  updatedAt: 0,
};

/** Allowed range (minutes) for each timer length. */
const DURATION_LIMITS = {
  focusMin: [1, 120],
  shortMin: [1, 60],
  longMin: [1, 90],
};

const SESSIONS_PER_LONG_BREAK = 4;

function emptyAccountData() {
  return {
    tasks: [],
    sessions: [],
    purchases: [],
    settings: { ...deepCopy(DEFAULT_SETTINGS), themeId: currentThemeId, updatedAt: Date.now() },
    updatedAt: Date.now(),
  };
}

/* ------------------------- Demo account ------------------------- */

function demoTask(id, title, priority, dueInDays, sessionCount, extra = {}) {
  const twoWeeksAgo = daysFromNow(-14).getTime();
  return {
    id,
    title,
    description: '',
    priority, // 'low' | 'medium' | 'high' | null
    dueDate: dueInDays == null ? null : toDayKey(daysFromNow(dueInDays)),
    completed: false,
    completedAt: null,
    sessionCount,
    createdAt: twoWeeksAgo,
    updatedAt: twoWeeksAgo,
    deleted: false,
    ...extra,
  };
}

/** Realistic tasks plus ~30 days of focus history so charts and achievements look real. */
function createDemoData() {
  const now = Date.now();
  const tenAmOn = (dayOffset) => daysFromNow(dayOffset).getTime() + 10 * 3600000;
  const earlierToday = Math.max(now - 2 * 3600000, startOfDay().getTime() + 60000);

  const tasks = [
    demoTask('t_srs', 'Finish SRS draft', 'high', 0, 3, { description: 'Sections 3–5 plus the use case diagram.' }),
    demoTask('t_quiz', 'Study for stats quiz', 'medium', 1, 2),
    demoTask('t_bug', 'Fix login form bug', 'high', -2, 1, {
      description: 'Error message shows under the wrong field.',
    }),
    demoTask('t_read', 'Read chapter 6', 'low', 4, 0),
    demoTask('t_script', 'Write usability test script', 'medium', 6, 1),
    demoTask('t_email', 'Email project update to the team', null, null, 0),
    demoTask('t_git', 'Clean up old Git branches', 'low', 10, 0),
    demoTask('t_fb', 'Set up Firebase project', 'high', null, 4, { completed: true, completedAt: earlierToday }),
    demoTask('t_stories', 'Write user stories', 'medium', null, 3, { completed: true, completedAt: tenAmOn(-1) }),
    demoTask('t_repo', 'Create GitHub repo and PR rules', 'medium', null, 2, {
      completed: true,
      completedAt: tenAmOn(-3),
    }),
    demoTask('t_wire', 'Sketch first wireframes', 'low', null, 2, { completed: true, completedAt: tenAmOn(-8) }),
    demoTask('t_team', 'Fill out team formation form', null, null, 1, { completed: true, completedAt: tenAmOn(-12) }),
  ];

  const sessions = [];
  const linkedTasks = ['t_srs', 't_quiz', null, 't_bug'];
  const addSessions = (dayOffset, count) => {
    for (let i = 0; i < count; i++) {
      const endedAt =
        dayOffset === 0
          ? now - (i + 1) * 35 * 60000 // today: earlier in the day
          : daysFromNow(dayOffset).getTime() + (9 * 60 + i * 35 + 25) * 60000; // from 9:25 am
      sessions.push({
        id: `s_${dayOffset}_${i}`,
        startedAt: endedAt - 25 * 60000,
        endedAt,
        durationMin: 25,
        taskId: linkedTasks[(i + Math.abs(dayOffset)) % linkedTasks.length],
      });
    }
  };

  // Last 7 days (oldest first), then a sprinkling of older days.
  [4, 3, 0, 5, 4, 6, 2].forEach((count, index) => addSessions(index - 6, count));
  for (let daysAgo = 7; daysAgo <= 30; daysAgo++) {
    const count = daysAgo % 3 === 0 ? 2 : daysAgo % 5 === 0 ? 3 : daysAgo % 7 === 0 ? 1 : 0;
    if (count) addSessions(-daysAgo, count);
  }
  sessions.sort((a, b) => a.endedAt - b.endedAt);

  return { tasks, sessions, purchases: [], settings: { ...deepCopy(DEFAULT_SETTINGS), updatedAt: 1 }, updatedAt: now };
}

const DEMO_USER = {
  id: 'u_demo',
  email: 'tungtung@ramranch.app',
  password: 'pomodoro123',
  displayName: 'Tung Tung Tung Sahur',
};

/* -------------------------- Mock cloud -------------------------- */

/** The whole "server": { users: { email: user }, data: { userId: accountData } }. */
function getCloud() {
  let cloud = storage.get('brp_cloud', null);
  if (!cloud) {
    cloud = {
      users: {
        [DEMO_USER.email]: {
          id: DEMO_USER.id,
          email: DEMO_USER.email,
          displayName: DEMO_USER.displayName,
          passwordHash: fakeHash(DEMO_USER.password),
          createdAt: daysFromNow(-40).getTime(),
        },
      },
      data: { [DEMO_USER.id]: createDemoData() },
    };
    storage.set('brp_cloud', cloud);
  }
  return cloud;
}

function saveCloud(cloud) {
  storage.set('brp_cloud', cloud);
}

/** What the app is allowed to know about a user (never the password hash). */
function publicUser(user) {
  return { id: user.id, email: user.email, displayName: user.displayName, createdAt: user.createdAt };
}

/**
 * Merge two copies of an account (e.g. cloud + this device).
 * Tasks: newest edit wins per task. Sessions and purchases: union. Settings: newest wins.
 */
function mergeAccountData(remote, local) {
  if (!remote) return deepCopy(local);

  const tasksById = new Map();
  for (const task of [...remote.tasks, ...local.tasks]) {
    const existing = tasksById.get(task.id);
    if (!existing || (task.updatedAt || 0) >= (existing.updatedAt || 0)) tasksById.set(task.id, task);
  }

  const sessionsById = new Map();
  for (const session of [...remote.sessions, ...local.sessions]) sessionsById.set(session.id, session);

  const purchasesById = new Map();
  for (const purchase of [...(remote.purchases || []), ...(local.purchases || [])])
    purchasesById.set(purchase.id, purchase);

  const localSettingsNewer = (local.settings.updatedAt || 0) >= (remote.settings.updatedAt || 0);

  return deepCopy({
    tasks: [...tasksById.values()].sort((a, b) => a.createdAt - b.createdAt),
    sessions: [...sessionsById.values()].sort((a, b) => a.endedAt - b.endedAt),
    purchases: [...purchasesById.values()],
    settings: localSettingsNewer ? local.settings : remote.settings,
    updatedAt: Date.now(),
  });
}

/* ---------------------------- Mock API ----------------------------
   Every method waits like a network call and respects the sync simulation.
   Errors are thrown as { code: 'offline' | 'failed' | 'auth' | 'taken' }. */

function throwIfOffline() {
  if (simulation.sync === 'offline') throw { code: 'offline' };
}

const mockApi = {
  async login(email, password) {
    await fakeNetworkDelay();
    throwIfOffline();
    const user = getCloud().users[email];
    if (!user || user.passwordHash !== fakeHash(password)) throw { code: 'auth' };
    return publicUser(user);
  },

  async register(displayName, email, password) {
    await fakeNetworkDelay();
    throwIfOffline();
    const cloud = getCloud();
    if (cloud.users[email]) throw { code: 'taken' };
    const user = {
      id: 'u_' + makeId(),
      email,
      displayName: displayName || email.split('@')[0],
      passwordHash: fakeHash(password),
      createdAt: Date.now(),
    };
    cloud.users[email] = user;
    cloud.data[user.id] = emptyAccountData();
    saveCloud(cloud);
    return publicUser(user);
  },

  /** Returns whether an account exists (the UI never reveals this to the user). */
  async requestPasswordReset(email) {
    await fakeNetworkDelay();
    throwIfOffline();
    return Boolean(getCloud().users[email]);
  },

  async resetPassword(email, newPassword) {
    await fakeNetworkDelay();
    throwIfOffline();
    const cloud = getCloud();
    if (cloud.users[email]) {
      cloud.users[email].passwordHash = fakeHash(newPassword);
      saveCloud(cloud);
    }
  },

  async updateDisplayName(userId, displayName) {
    await fakeNetworkDelay();
    throwIfOffline();
    if (simulation.sync === 'savefail') throw { code: 'failed' };
    const cloud = getCloud();
    const user = Object.values(cloud.users).find((u) => u.id === userId);
    user.displayName = displayName;
    saveCloud(cloud);
    return publicUser(user);
  },

  async loadAccount(userId) {
    await fakeNetworkDelay();
    throwIfOffline();
    if (simulation.sync === 'loadfail') throw { code: 'failed' };
    return deepCopy(getCloud().data[userId] || emptyAccountData());
  },

  /** Saves this device's copy, merging with whatever the cloud already has. */
  async saveAccount(userId, localData) {
    await fakeNetworkDelay();
    throwIfOffline();
    if (simulation.sync === 'savefail') throw { code: 'failed' };
    const cloud = getCloud();
    const merged = mergeAccountData(cloud.data[userId], localData);
    cloud.data[userId] = merged;
    saveCloud(cloud);
    return deepCopy(merged);
  },

  /** Instant lookup used to restore a saved session (like a stored auth token). */
  findUserById(userId) {
    const user = Object.values(getCloud().users).find((u) => u.id === userId);
    return user ? publicUser(user) : null;
  },
};

/* ----------------------- Streaks and achievements ----------------------- */

const ACHIEVEMENTS = [
  { id: 's1', track: 'sessions', goal: 1, emoji: '🌱' },
  { id: 's10', track: 'sessions', goal: 10, emoji: '🍅' },
  { id: 's50', track: 'sessions', goal: 50, emoji: '🎯' },
  { id: 's100', track: 'sessions', goal: 100, emoji: '💯' },
  { id: 't10h', track: 'minutes', goal: 600, emoji: '⏱️' },
  { id: 't50h', track: 'minutes', goal: 3000, emoji: '🏔️' },
  { id: 'k3', track: 'bestStreak', goal: 3, emoji: '🔥' },
  { id: 'k7', track: 'bestStreak', goal: 7, emoji: '⚡' },
  { id: 'd5', track: 'tasksDone', goal: 5, emoji: '✅' },
  { id: 'd25', track: 'tasksDone', goal: 25, emoji: '🏆' },
];

/** Current streak (alive if you focused today or yesterday) and best streak ever. */
function calculateStreaks(sessions) {
  const focusDays = new Set(sessions.map((session) => toDayKey(session.endedAt)));

  let current = 0;
  const day = startOfDay();
  if (!focusDays.has(toDayKey(day))) day.setDate(day.getDate() - 1);
  while (focusDays.has(toDayKey(day))) {
    current++;
    day.setDate(day.getDate() - 1);
  }

  let best = 0;
  let run = 0;
  let previousDay = null;
  for (const dayKey of [...focusDays].sort()) {
    const date = fromDayKey(dayKey);
    const isNextDay = previousDay && Math.round((date - previousDay) / ONE_DAY_MS) === 1;
    run = isNextDay ? run + 1 : 1;
    best = Math.max(best, run);
    previousDay = date;
  }
  return { current, best: Math.max(best, current) };
}

function calculateProgress(accountData) {
  const streaks = calculateStreaks(accountData.sessions);
  return {
    sessions: accountData.sessions.length,
    minutes: accountData.sessions.reduce((total, session) => total + session.durationMin, 0),
    tasksDone: accountData.tasks.filter((task) => !task.deleted && task.completed).length,
    currentStreak: streaks.current,
    bestStreak: streaks.best,
  };
}

function unlockedAchievementIds(accountData) {
  const progress = calculateProgress(accountData);
  return new Set(ACHIEVEMENTS.filter((a) => progress[a.track] >= a.goal).map((a) => a.id));
}

/* ------------------------------ Aura ------------------------------
   Aura is the in-app currency. It's earned from progress and spent in the Shop.
   Balance = earned − spent (never below 0). */

const AURA_REWARDS = {
  focusSession: 10,
  taskDone: 5,
  achievement: 25,
};

function auraBalance(accountData) {
  const progress = calculateProgress(accountData);
  const earned =
    progress.sessions * AURA_REWARDS.focusSession +
    progress.tasksDone * AURA_REWARDS.taskDone +
    unlockedAchievementIds(accountData).size * AURA_REWARDS.achievement;
  const spent = (accountData.purchases || []).reduce((total, purchase) => total + purchase.price, 0);
  return Math.max(0, earned - spent);
}

/* --------------------- Mock OS notifications --------------------- */

/** Shows a card that imitates a desktop notification (bottom-right of the page). */
function showSystemNotification(title, body, deviceLabel) {
  const container = $('#system-notifications');
  if (!container) return;

  const card = document.createElement('div');
  card.className = 'sysnote';
  card.innerHTML = `
    <div class="sn-app">
      ${TOMATO_LOGO}<span>Brainrot Pomodoro</span><span class="sn-dev">· ${escapeHtml(deviceLabel)}</span>
      <button class="sn-x" aria-label="Dismiss notification">×</button>
    </div>
    <div class="sn-title">${title}</div>
    <div class="sn-body">${body}</div>`;
  card.querySelector('.sn-x').onclick = () => card.remove();

  container.prepend(card);
  setTimeout(() => card.remove(), 8000);
  while (container.children.length > 3) container.lastChild.remove();
}
