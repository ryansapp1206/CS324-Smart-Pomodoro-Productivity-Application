/* =====================================================================
   SCREENS: SIGNED-IN APP
   Header, banners, tab bar, and the five tabs:
   Timer · Tasks · Stats · Shop · Settings (+ Profile)
   ===================================================================== */

/* ------------------------------ App shell ------------------------------ */

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
      aria-label="${t('menu.account')}: ${escapeHtml(app.user.displayName)}">${avatarHtml(app.user, app.settings())}</button>`;

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
    const menuItem = (action, label, iconName, extra = {}) =>
      actionButton(action, label, {
        className: 'mi ' + (extra.className || ''),
        icon: iconName,
        attributes: 'role="menuitem"',
        ...extra.options,
      });
    return `
      <div class="popover menu-pop" role="menu" aria-label="${t('menu.account')}">
        <div class="pop-head">
          <div style="font-weight:700">${escapeHtml(app.user.displayName)}</div>
          <div class="muted small">${escapeHtml(app.user.email)}</div>
        </div>
        ${menuItem('openProfile', t('menu.profile'), 'user')}
        ${menuItem('openSettings', t('menu.settings'), 'gear')}
        ${menuItem('logout', t('menu.logout'), 'logout', { className: 'danger', options: { focusId: 'logout:menu' } })}
      </div>`;
  }
  return '';
}

/** Deadline reminder, save failure and "showing cached data" banners. */
function statusBanners(app) {
  let html = '';

  const deadline = app.ui.deadlineBanner;
  if (deadline) {
    const items = deadline.items;
    const heading = items.length === 1 ? t('notif.deadlineOne') : t('notif.deadlineMany', { n: items.length });
    const onTimerScreen = app.ui.tab === 'timer' && app.ui.screen === 'main';

    if (onTimerScreen) {
      // Compact one-line version so the Start button stays visible.
      const titles = escapeHtml(items.map((item) => item.title).join(', '));
      html += banner('warn', 'bell', `<b>${heading}</b> <span class="muted">· ${titles}</span>`, {
        extraClass: 'banner-compact',
        trailing:
          actionButton('viewDueTasks', t('notif.view'), { className: 'btn btn-sm btn-ghost' }) +
          closeBannerButton('deadline'),
      });
    } else {
      const list = items
        .map((item) => {
          const when = t(item.when === 'today' ? 'notif.dueToday' : 'notif.dueTomorrow');
          return `<li>${escapeHtml(item.title)} <span class="muted">· ${when}</span></li>`;
        })
        .join('');
      const content = `
        <div class="b-title">${heading}</div>
        <ul class="b-list">${list}</ul>
        <div class="banner-actions">${actionButton('viewDueTasks', t('notif.view'), { className: 'btn btn-sm' })}</div>`;
      html += banner('warn', 'bell', content, { trailing: closeBannerButton('deadline') });
    }
  }

  if (app.saveFailed) {
    const retry = actionButton('retrySync', t('sync.retry'), {
      className: 'btn btn-sm',
      icon: 'refresh',
      disabled: app.syncState === 'syncing',
    });
    html += banner('danger', 'alert', `<div>${t('sync.failedBody')}</div><div class="banner-actions">${retry}</div>`, {
      role: 'alert',
    });
  }

  if (app.showingCachedData) {
    const retry = actionButton('retryLoad', t('sync.retry'), {
      className: 'btn btn-sm',
      icon: 'refresh',
      focusId: 'retryLoad:banner',
    });
    html += banner('info', 'info', `<div>${t('load.cached')}</div><div class="banner-actions">${retry}</div>`, {
      trailing: closeBannerButton('cache'),
    });
  }
  return html;
}

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

/* ------------------------------ Timer tab ------------------------------ */

function timerScreen(app) {
  const timer = app.timer;
  const mode = timer.mode;
  const remaining = app.remainingMs();
  const total = app.totalMs() || 1;
  const circumference = 2 * Math.PI * 96;
  const currentTask = timer.taskId && app.liveTasks().find((task) => task.id === timer.taskId && !task.completed);
  const modeEmoji = { focus: themeEmoji('focus'), short: themeEmoji('shortBreak'), long: themeEmoji('longBreak') }[
    mode
  ];
  const modeSubtitle = t('mode.sub.' + mode);

  const modeSelector = ['focus', 'short', 'long']
    .map((option) => segmentButton('switchMode', option, t('mode.' + option), mode === option))
    .join('');

  // Four dots: how many focus sessions are done toward the long break.
  const filledDots = mode === 'long' ? SESSIONS_PER_LONG_BREAK : timer.completedInCycle;
  const dots = [0, 1, 2, 3].map((i) => `<span class="${i < filledDots ? 'on' : ''}"></span>`).join('');
  let cycleText;
  if (mode === 'focus') cycleText = t('timer.sessionOf', { n: Math.min(4, timer.completedInCycle + 1) });
  else if (mode === 'short') cycleText = t('timer.shortInfo', { n: timer.completedInCycle });
  else cycleText = t('timer.longInfo');

  const taskChip = `
    <button type="button" class="task-chip${currentTask ? ' has' : ''}" data-action="openTaskPicker"
      data-focus-id="openTaskPicker:" aria-haspopup="dialog">
      ${icon('target')}
      <span class="chip-txt">${currentTask ? t('timer.working', { title: currentTask.title }) : t('timer.noTask')}</span>
      ${icon('chevronDown')}
    </button>`;

  return `
    <div class="seg seg-modes" role="group" aria-label="${t('timer.modes')}">${modeSelector}</div>

    <div class="ring-wrap">
      ${decoration('timer-background')}
      <svg class="ring" viewBox="0 0 220 220" aria-hidden="true">
        <circle class="ring-track" cx="110" cy="110" r="96"/>
        <circle class="ring-prog" data-ring cx="110" cy="110" r="96" transform="rotate(-90 110 110)"
          stroke-dasharray="${circumference}" stroke-dashoffset="${circumference * (remaining / total)}"/>
      </svg>
      <div class="ring-center">
        <div class="time" data-time role="timer"
          aria-label="${t('timer.label', { time: formatClock(remaining), mode: t('mode.' + mode) })}">${formatClock(remaining)}</div>
        <div class="mode-label">
          <span aria-hidden="true">${modeEmoji}</span> ${t('mode.' + mode)}${timer.status === 'paused' ? ' · ' + t('timer.paused') : ''}
        </div>
        ${modeSubtitle ? `<div class="mode-sub">${modeSubtitle}</div>` : ''}
      </div>
      ${decoration('timer-overlay')}
    </div>

    <div class="cycle">
      <div class="cdots" aria-hidden="true">${dots}</div>
      <div class="cycle-txt">${cycleText}</div>
    </div>

    ${taskChip}
    <div class="controls-row">${timerControls(app)}</div>
    <p class="hint center" style="margin-top:10px">${t('timer.hint')}</p>`;
}

/** Idle: Start (+ disabled Reset). Running: Stop · Pause · Reset. Paused: Stop · Resume · Reset. */
function timerControls(app) {
  const timer = app.timer;
  const reset = (disabled) =>
    actionButton('resetTimer', t('timer.reset'), { className: 'btn btn-pill', icon: 'reset', disabled });

  if (timer.status === 'idle') {
    let startLabel = t('timer.start');
    if (timer.mode !== 'focus') startLabel = t('timer.startBreak');
    else if (timer.justFinishedBreak) startLabel = t('timer.startFocus');
    return `
      <span class="spacer-btn"></span>
      ${actionButton('startTimer', startLabel, { className: 'btn btn-mode btn-lg', icon: 'play' })}
      ${reset(true)}`;
  }

  const stop = actionButton('stopTimer', t('timer.stop'), { className: 'btn btn-pill', icon: 'stop' });
  const pauseOrResume =
    timer.status === 'running'
      ? actionButton('pauseTimer', t('timer.pause'), { className: 'btn btn-mode btn-lg', icon: 'pause' })
      : actionButton('resumeTimer', t('timer.resume'), { className: 'btn btn-mode btn-lg', icon: 'play' });
  return `${stop}${pauseOrResume}${reset(false)}`;
}

/* ------------------------------ Tasks tab ------------------------------ */

function openTaskRow(app, task) {
  const isCurrent = app.timer.taskId === task.id;
  const menuOpen = app.ui.openMenuTaskId === task.id;
  const menuItem = (action, iconName, label, className = '') =>
    actionButton(action, label, {
      arg: task.id,
      className: 'mi ' + className,
      icon: iconName,
      attributes: 'role="menuitem"',
    });
  const menu = menuOpen
    ? `<div class="menu" role="menu">
         ${menuItem('editTask', 'edit', t('tasks.edit'))}
         ${menuItem('focusOnTask', 'target', t('tasks.focus'))}
         ${menuItem('deleteTask', 'trash', t('tasks.delete'), 'danger')}
       </div>`
    : '';

  return `
    <li class="task${isCurrent ? ' is-current' : ''}">
      <button type="button" class="check" role="checkbox" aria-checked="false"
        data-action="completeTask" data-arg="${task.id}" data-focus-id="completeTask:${task.id}"
        aria-label="${t('tasks.markDone', { title: task.title })}"><span class="box">${icon('check')}</span></button>
      <div class="task-main">
        <div class="task-title">${escapeHtml(task.title)}</div>
        ${task.description ? `<div class="task-desc">${escapeHtml(task.description)}</div>` : ''}
        ${taskMeta(task, isCurrent)}
      </div>
      <div class="menu-wrap">
        ${actionButton('toggleTaskMenu', '', {
          arg: task.id,
          className: 'icon-btn',
          icon: 'more',
          ariaLabel: t('tasks.more', { title: task.title }),
          attributes: `aria-haspopup="menu" aria-expanded="${menuOpen}"`,
        })}
        ${menu}
      </div>
    </li>`;
}

function completedTaskRow(task) {
  return `
    <li class="task done">
      <button type="button" class="check" role="checkbox" aria-checked="true"
        data-action="reopenTask" data-arg="${task.id}" data-focus-id="check:${task.id}"
        aria-label="${t('tasks.reopenLabel', { title: task.title })}"><span class="box">${icon('check')}</span></button>
      <div class="task-main">
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="task-meta">
          <span>${t('tasks.completedOn', { date: formatDate(task.completedAt) })}</span>${sessionCountBadge(task.sessionCount)}
        </div>
      </div>
      ${actionButton('reopenTask', t('tasks.reopen'), {
        arg: task.id,
        className: 'btn btn-sm btn-ghost',
        ariaLabel: t('tasks.reopenLabel', { title: task.title }),
      })}
    </li>`;
}

function tasksScreen(app) {
  const openTasks = app.openTasksSorted();
  const doneTasks = app
    .liveTasks()
    .filter((task) => task.completed)
    .sort((a, b) => b.completedAt - a.completedAt);
  const filter = app.ui.taskFilter;

  const header = `
    <div class="tasks-top">
      <div class="seg" role="group" aria-label="${t('tasks.view')}">
        ${segmentButton('setTaskFilter', 'open', `${t('tasks.open')} (${openTasks.length})`, filter === 'open')}
        ${segmentButton('setTaskFilter', 'completed', `${t('tasks.completed')} (${doneTasks.length})`, filter === 'completed')}
      </div>
      ${actionButton('newTask', t('tasks.add'), { className: 'btn btn-primary btn-sm', icon: 'plus' })}
    </div>`;

  if (filter === 'completed') {
    if (!doneTasks.length) {
      return `${header}
        <div class="empty"><div class="empty-emoji" aria-hidden="true">${themeEmoji('taskDone')}</div><p>${t('tasks.emptyDone')}</p></div>`;
    }
    return `${header}<ul class="task-list">${doneTasks.map(completedTaskRow).join('')}</ul>`;
  }

  if (!openTasks.length) {
    return `${header}
      <div class="empty">
        ${decoration('empty-state-art')}
        <div class="empty-emoji" aria-hidden="true">${themeEmoji('empty')}</div>
        <p>${t('tasks.empty')}</p>
        ${actionButton('newTask', t('tasks.add'), { className: 'btn btn-primary', icon: 'plus', focusId: 'newTask:empty' })}
      </div>`;
  }

  const sortBy = app.settings().taskSort;
  const sortMenu = `
    <div class="sort-row">
      <label for="${app.id}-sort">${t('sort.label')}</label>
      <select id="${app.id}-sort" class="select" data-bind="taskSort" data-focus-id="taskSort">
        <option value="due" ${sortBy === 'due' ? 'selected' : ''}>${t('sort.due')}</option>
        <option value="priority" ${sortBy === 'priority' ? 'selected' : ''}>${t('sort.priority')}</option>
      </select>
    </div>`;
  return `${header}${sortMenu}<ul class="task-list">${openTasks.map((task) => openTaskRow(app, task)).join('')}</ul>`;
}

/* ------------------------------ Stats tab ------------------------------ */

function auraBalanceCard(app) {
  const rewards = { s: AURA_REWARDS.focusSession, t: AURA_REWARDS.taskDone, a: AURA_REWARDS.achievement };
  return `
    <section class="card aura-card">
      <span class="aura-emoji" aria-hidden="true">${themeEmoji('aura')}</span>
      <div class="grow">
        <div class="small muted">${t('aura.balance')}</div>
        <div class="aura-v">${auraBalance(app.data).toLocaleString()}</div>
      </div>
      ${actionButton('openShop', t('aura.openShop'), { className: 'btn btn-sm', icon: 'bag', focusId: 'openShop:card' })}
    </section>
    <p class="small muted" style="margin:-4px 2px 12px">${t('aura.how', rewards)}</p>`;
}

function statsScreen(app) {
  return auraBalanceCard(app) + (app.data.sessions.length ? statsDetails(app) : statsEmptyState());
}

function statsEmptyState() {
  return `
    <div class="empty" style="padding:20px">
      ${decoration('empty-state-art')}
      <div class="empty-emoji" aria-hidden="true">${themeEmoji('empty')}</div>
      <h2>${t('stats.empty.title')}</h2>
      <p>${t('stats.empty.body')}</p>
      ${actionButton('startFocusing', t('stats.empty.cta'), { className: 'btn btn-primary', icon: 'play' })}
    </div>`;
}

function statsDetails(app) {
  const sessions = app.data.sessions;
  const todayKey = toDayKey(new Date());
  const todaySessions = sessions.filter((session) => toDayKey(session.endedAt) === todayKey);
  const todayMinutes = todaySessions.reduce((total, session) => total + session.durationMin, 0);
  const tasksDoneToday = app
    .liveTasks()
    .filter((task) => task.completed && toDayKey(task.completedAt) === todayKey).length;

  const statCard = (value, labelKey) =>
    `<div class="stat"><div class="stat-v">${value}</div><div class="stat-l">${t(labelKey)}</div></div>`;

  return `
    <div class="sec-label">${t('stats.today')}</div>
    <div class="cards3">
      ${statCard(todaySessions.length, 'stats.sessions')}
      ${statCard(formatDuration(todayMinutes), 'stats.focusTime')}
      ${statCard(tasksDoneToday, 'stats.tasksDone')}
    </div>
    ${weeklyChartCard(app)}
    ${streakCard(app)}
    ${achievementsCard(app)}`;
}

/** Bar chart of focus minutes for the last 7 days. Each bar is focusable and labelled. */
function weeklyChartCard(app) {
  const sessions = app.data.sessions;
  const todayKey = toDayKey(new Date());
  const days = [6, 5, 4, 3, 2, 1, 0].map((daysAgo) => {
    const date = daysFromNow(-daysAgo);
    const key = toDayKey(date);
    const minutes = sessions.filter((s) => toDayKey(s.endedAt) === key).reduce((total, s) => total + s.durationMin, 0);
    return { key, date, minutes };
  });

  const chart = { width: 336, height: 150, baseline: 120, barWidth: 26, maxBarHeight: 96 };
  const slotWidth = chart.width / days.length;
  const axisMax = Math.ceil(Math.max(60, ...days.map((d) => d.minutes)) / 30) * 30;

  const bars = days
    .map((day, index) => {
      const height = day.minutes ? Math.max(3, Math.round((day.minutes / axisMax) * chart.maxBarHeight)) : 0;
      const x = index * slotWidth + (slotWidth - chart.barWidth) / 2;
      const center = x + chart.barWidth / 2;
      const isToday = day.key === todayKey;
      const label = t('stats.barLabel', {
        day: formatDate(day.date, { weekday: 'long' }),
        value: formatDuration(day.minutes),
      });
      return `
        <g class="bar${isToday ? ' today' : ''}" tabindex="0" role="img" aria-label="${label}">
          <rect class="hit" x="${index * slotWidth + 2}" y="4" width="${slotWidth - 4}" height="${chart.height - 4}" rx="6"/>
          <rect class="b" x="${x}" y="${chart.baseline - height}" width="${chart.barWidth}" height="${height}" rx="5"/>
          <text class="val" x="${center}" y="${chart.baseline - height - 6}" text-anchor="middle">${formatDuration(day.minutes)}</text>
          <text class="lbl" x="${center}" y="${chart.baseline + 18}" text-anchor="middle">${formatDate(day.date, { weekday: 'short' })}</text>
        </g>`;
    })
    .join('');

  const weekTotal = days.reduce((total, day) => total + day.minutes, 0);
  const bestDay = days.reduce((best, day) => (day.minutes > best.minutes ? day : best), days[0]);
  const summary = weekTotal
    ? t('stats.weekSummary', { total: formatDuration(weekTotal), day: formatDate(bestDay.date, { weekday: 'long' }) })
    : t('stats.weekNone');

  return `
    <section class="card">
      <div class="card-h"><h2>${t('stats.week')}</h2><span class="small muted">${formatDuration(weekTotal)}</span></div>
      <svg class="chart" viewBox="0 0 ${chart.width} ${chart.height}" role="group" aria-label="${t('stats.chartLabel')}">${bars}</svg>
      <p class="small muted" style="margin-top:6px">${summary}</p>
    </section>`;
}

function streakCard(app) {
  const progress = calculateProgress(app.data);
  return `
    <section class="card streak">
      <span class="streak-emoji" aria-hidden="true">🔥</span>
      <div>
        <h2 style="font-size:16px">${t('stats.streak', { n: progress.currentStreak })}</h2>
        <p class="small muted">${t('stats.streakSub', { best: progress.bestStreak })}</p>
      </div>
    </section>`;
}

function achievementsCard(app) {
  const progress = calculateProgress(app.data);
  const unlocked = unlockedAchievementIds(app.data);

  const items = ACHIEVEMENTS.map((achievement) => {
    const value = progress[achievement.track];
    const isUnlocked = unlocked.has(achievement.id);
    const percent = Math.min(100, Math.round((value / achievement.goal) * 100));
    const progressText =
      achievement.track === 'minutes'
        ? `${Math.floor(Math.min(value, achievement.goal) / 60)}h / ${achievement.goal / 60}h`
        : `${Math.min(value, achievement.goal)}/${achievement.goal}`;
    const status = isUnlocked ? t('ach.unlocked') : `<span class="sr-only">${t('ach.locked')}, </span>${progressText}`;
    return `
      <li class="ach${isUnlocked ? ' on' : ''}">
        <span class="ach-emoji" aria-hidden="true">${achievement.emoji}</span>
        <div style="flex:1;min-width:0">
          <div class="ach-name">${t('ach.' + achievement.id)}</div>
          <span class="pbar" aria-hidden="true"><i style="width:${percent}%"></i></span>
          <span class="small muted">${status}</span>
        </div>
        ${decoration('achievement-badge-frame')}
      </li>`;
  }).join('');

  return `
    <section class="card" data-achievements>
      <div class="card-h">
        <h2>${t('stats.ach')}</h2>
        <span class="small muted">${t('stats.achSub', { n: unlocked.size, total: ACHIEVEMENTS.length })}</span>
      </div>
      <ul class="ach-grid">${items}</ul>
    </section>`;
}

/* ------------------------------- Shop tab ------------------------------- */

const SHOP_CATEGORIES = [
  { id: 'theme', labelKey: 'shop.themes', descriptionKey: 'shop.themesSub', settingKey: 'themeId' },
  { id: 'sound', labelKey: 'shop.sounds', descriptionKey: 'shop.soundsSub', settingKey: 'soundPack' },
  { id: 'avatar', labelKey: 'shop.avatars', descriptionKey: 'shop.avatarsSub', settingKey: 'avatarId' },
];

function shopScreen(app) {
  const category = SHOP_CATEGORIES.find((c) => c.id === app.ui.shopCategory) || SHOP_CATEGORIES[0];
  const balance = auraBalance(app.data);
  const equippedId = category.id === 'theme' ? currentThemeId : app.settings()[category.settingKey] || 'initials';

  const tabs = SHOP_CATEGORIES.map((c) =>
    segmentButton('setShopCategory', c.id, t(c.labelKey), c.id === category.id)
  ).join('');
  const items = shopItems(category.id)
    .map((item) => shopItemRow(app, item, balance, equippedId))
    .join('');

  return `
    <div class="shop-bal" data-shop>
      <span aria-hidden="true">${themeEmoji('aura')}</span>
      <span><b>${balance.toLocaleString()}</b> ${t('aura.unit')}</span>
      <span class="small muted" style="margin-left:auto">${t('shop.title')}</span>
    </div>
    <div class="seg" role="group" aria-label="${t('shop.cats')}" style="margin-bottom:10px">${tabs}</div>
    <p class="small muted" style="margin:0 2px 10px">${t(category.descriptionKey)}</p>
    <ul class="shop-list">${items}</ul>`;
}

function shopItemThumbnail(app, item) {
  if (item.kind === 'theme') return swatchHtml(item.swatch, 'swatch sw-mini');
  if (item.kind === 'sound') return `<span class="shop-thumb" aria-hidden="true">${item.emoji}</span>`;
  if (item.id === 'initials') return avatarHtml(app.user, { avatarId: 'initials' }, 'shop-thumb av-ini');
  return `<span class="shop-thumb round" style="background:${item.color}" aria-hidden="true">${item.emoji}</span>`;
}

/** The button on a shop row: Equipped / Equip / Buy / Need more / Owned · coming soon. */
function shopItemButton(app, item, balance, equippedId) {
  const key = `${item.kind}:${item.id}`;
  const owned = ownsItem(app.data, item.kind, item.id);

  if (owned && item.comingSoon) return `<span class="tag">${t('aura.soon')}</span>`;
  if (owned && equippedId === item.id) return disabledButton(t('aura.equipped'), 'check');
  if (owned) return actionButton('equipItem', t('aura.equip'), { arg: key, className: 'btn btn-sm' });
  if (balance >= item.price) {
    return actionButton('buyItem', t('aura.buy', { n: item.price }), { arg: key, className: 'btn btn-primary btn-sm' });
  }
  return disabledButton(t('aura.need', { n: item.price - balance }));
}

function shopItemRow(app, item, balance, equippedId) {
  const previewButton =
    item.kind === 'sound'
      ? actionButton('previewSound', '', {
          arg: item.id,
          className: 'icon-btn',
          icon: 'volume',
          ariaLabel: t('shop.previewLabel', { name: item.name }),
        })
      : '';
  const comingSoonTag = item.comingSoon ? ` <span class="tag">${t('aura.soonTag')}</span>` : '';
  const price = item.price ? t('aura.priceTag', { n: item.price }) : t('aura.free');

  return `
    <li class="shop-item">
      ${shopItemThumbnail(app, item)}
      <div class="grow" style="min-width:0">
        <div class="tc-name">${escapeHtml(item.name)}${comingSoonTag}</div>
        <div class="tc-desc">${escapeHtml(item.description)}</div>
        <div class="small muted">${price}</div>
      </div>
      <div class="shop-acts">${previewButton}${shopItemButton(app, item, balance, equippedId)}</div>
    </li>`;
}

/* ----------------------------- Settings tab ----------------------------- */

const DURATION_LABEL_KEYS = { focusMin: 'set.focusMin', shortMin: 'set.shortMin', longMin: 'set.longMin' };

function durationRow(app, key, errors) {
  const id = `${app.id}-${key}`;
  const [min, max] = DURATION_LIMITS[key];
  const label = t(DURATION_LABEL_KEYS[key]);
  const error = errors[key];
  const stepButton = (step, iconName, ariaKey) =>
    actionButton('stepDuration', '', {
      arg: `${key}:${step}`,
      className: 'icon-btn',
      icon: iconName,
      ariaLabel: t(ariaKey, { label }),
    });

  return `
    <div class="dur-row">
      <div class="dur-line">
        <label for="${id}">${label}</label>
        <div class="stepper">
          ${stepButton(-1, 'minus', 'set.decrease')}
          <input id="${id}" class="input num${error ? ' invalid' : ''}" type="number" inputmode="numeric"
            min="${min}" max="${max}" step="1" value="${escapeHtml(app.ui.settingsDraft[key])}"
            data-bind="settingsDraft.${key}" data-live="settings" data-focus-id="settingsDraft.${key}"
            ${error ? `aria-invalid="true" aria-describedby="${id}-err"` : ''}>
          ${stepButton(1, 'plus', 'set.increase')}
          <span class="unit">${t('set.minutes')}</span>
        </div>
      </div>
      <div class="err" id="${id}-err" data-error-for="${key}" ${error ? '' : 'hidden'}>
        ${error ? `${icon('alert')}<span>${error}</span>` : ''}
      </div>
    </div>`;
}

function themeCard(theme, isSelected) {
  const colors = THEME_SWATCH_TOKENS.map((token) => theme.tokens[token]);
  return `
    <button type="button" class="theme-card${isSelected ? ' on' : ''}" data-action="chooseTheme" data-arg="${theme.id}"
      data-focus-id="chooseTheme:${theme.id}" aria-pressed="${isSelected}">
      ${swatchHtml(colors)}
      <span class="tc-name">${escapeHtml(theme.name)}</span>
      <span class="tc-desc">${escapeHtml(theme.description)}</span>
    </button>`;
}

function settingsScreen(app) {
  if (!app.ui.settingsDraft) app.ui.settingsDraft = deepCopy(app.settings());
  const draft = app.ui.settingsDraft;
  const errors = app.settingsErrors();

  const ownedThemes = Object.values(THEMES).filter((theme) => ownsItem(app.data, 'theme', theme.id));
  const themeCards = ownedThemes.map((theme) => themeCard(theme, draft.themeId === theme.id)).join('');
  const currentSoundPack = SOUND_PACKS.find((pack) => pack.id === app.settings().soundPack) || SOUND_PACKS[0];
  const reminderTimeId = `${app.id}-daily-time`;
  const reminderTime = draft.dailyReminder.enabled
    ? `<div class="time-row">
         <label for="${reminderTimeId}" class="small" style="font-weight:600">${t('set.dailyTime')}</label>
         <input id="${reminderTimeId}" type="time" class="input" style="width:130px;min-height:36px"
           value="${escapeHtml(draft.dailyReminder.time)}"
           data-bind="settingsDraft.dailyReminder.time" data-live="settings" data-focus-id="settingsDraft.dailyReminder.time">
       </div>`
    : '';

  return `
    <div class="sec-label">${t('set.timer')}</div>
    <section class="card">
      ${durationRow(app, 'focusMin', errors)}
      ${durationRow(app, 'shortMin', errors)}
      ${durationRow(app, 'longMin', errors)}
      <div class="info-line">${icon('info')}<span>${t('set.longEvery')} ${t('set.applyNote')}</span></div>
      ${switchRow(app, 'settingsDraft.autoStart', 'set.autoStart', 'set.autoStartSub')}
    </section>

    <div class="sec-label">${t('set.notif')}</div>
    <section class="card">
      ${switchRow(app, 'settingsDraft.alertSound', 'set.alertSound', 'set.alertSoundSub')}
      <div class="sw-row">
        <div class="sw-txt">
          <div style="font-weight:600">${t('set.soundPack')}</div>
          <div class="sub">${t('set.soundPackSub', { name: currentSoundPack.name })}</div>
        </div>
        ${actionButton('openShop', t('set.changeInShop'), { arg: 'sound', className: 'btn btn-sm', focusId: 'openShop:sound' })}
      </div>
      ${switchRow(app, 'settingsDraft.sessionAlerts', 'set.sessionAlerts', 'set.sessionAlertsSub')}
      ${switchRow(app, 'settingsDraft.breakAlerts', 'set.breakAlerts', 'set.breakAlertsSub')}
      ${switchRow(app, 'settingsDraft.deadlineReminders', 'set.deadline', 'set.deadlineSub')}
      ${switchRow(app, 'settingsDraft.dailyReminder.enabled', 'set.daily', 'set.dailySub')}
      ${reminderTime}
    </section>

    <div class="sec-label">${t('set.appearance')}</div>
    <section class="card">
      <div class="small" style="font-weight:600;margin-bottom:8px" id="${app.id}-theme-label">${t('set.theme')}</div>
      <div class="theme-grid" role="group" aria-labelledby="${app.id}-theme-label">${themeCards}</div>
      <div style="margin:2px 0 4px">
        ${actionButton('openShop', t('aura.moreThemes'), { arg: 'theme', className: 'btn-link', focusId: 'openShop:settings' })}
      </div>
      ${switchRow(app, 'settingsDraft.reduceMotion', 'set.reduceMotion', 'set.reduceMotionSub')}
    </section>

    <div class="sec-label">${t('set.sync')}</div>
    <section class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div>
          <div style="font-weight:600">${t('sync.' + app.syncState)}</div>
          <div class="small muted">${lastSyncedText(app)}</div>
        </div>
        ${actionButton('syncNow', t('sync.now'), {
          className: 'btn btn-sm',
          icon: 'refresh',
          focusId: 'syncNow:settings',
          disabled: app.syncState === 'syncing',
        })}
      </div>
    </section>

    <div class="sec-label">${t('set.account')}</div>
    <section class="card" style="display:flex;flex-direction:column;gap:8px">
      ${actionButton(
        'openProfile',
        `${t('set.profile')} · <span class="muted" style="font-weight:500">${t('set.profileSub')}</span>`,
        {
          className: 'btn btn-block',
          icon: 'user',
          focusId: 'openProfile:settings',
        }
      )}
      ${actionButton('logout', t('set.logout'), { className: 'btn btn-block btn-danger-outline', icon: 'logout', focusId: 'logout:settings' })}
    </section>`;
}

/** Sticky "Unsaved changes · Cancel / Save" bar under the Settings tab. */
function unsavedSettingsBar(app) {
  const isDirty = app.hasUnsavedSettings();
  const hasErrors = Object.keys(app.settingsErrors()).length > 0;
  return `
    <div class="sbar" data-settings-bar ${isDirty ? '' : 'hidden'} role="region" aria-label="${t('set.unsaved')}">
      <span>${icon('alert')}${t('set.unsaved')}</span>
      <div>
        ${actionButton('cancelSettings', t('set.cancel'), { className: 'btn btn-sm' })}
        ${actionButton('saveSettings', t('set.save'), { className: 'btn btn-primary btn-sm', disabled: hasErrors })}
      </div>
    </div>`;
}

/** Update duration errors and the Save bar while typing, without re-rendering (keeps the cursor). */
function refreshSettingsFeedback(app) {
  const errors = app.settingsErrors();
  for (const key of Object.keys(DURATION_LIMITS)) {
    const input = app.screenHost.querySelector(`[data-focus-id="settingsDraft.${key}"]`);
    const errorSlot = app.screenHost.querySelector(`[data-error-for="${key}"]`);
    if (!input || !errorSlot) continue;

    input.classList.toggle('invalid', Boolean(errors[key]));
    if (errors[key]) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', errorSlot.id);
      errorSlot.innerHTML = `${icon('alert')}<span>${errors[key]}</span>`;
      errorSlot.hidden = false;
    } else {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
      errorSlot.innerHTML = '';
      errorSlot.hidden = true;
    }
  }
  const bar = app.screenHost.querySelector('[data-settings-bar]');
  if (bar) bar.outerHTML = unsavedSettingsBar(app);
}

/* ------------------------------ Profile ------------------------------ */

function profileScreen(app) {
  if (!app.ui.profileForm) app.ui.profileForm = { displayName: app.user.displayName, error: null, isBusy: false };
  const form = app.ui.profileForm;
  const id = `${app.id}-profile-name`;
  const memberSince = formatDate(app.user.createdAt, { month: 'long', year: 'numeric' });
  const saveLabel = form.isBusy ? `${spinnerHtml()}<span>${t('profile.saving')}</span>` : t('profile.save');

  return `
    <div class="sub-hdr">
      ${actionButton('goBack', t('profile.back'), { className: 'btn btn-ghost btn-sm', icon: 'chevronLeft' })}
      <h1>${t('profile.title')}</h1>
    </div>

    <section class="card profile-card">
      ${avatarHtml(app.user, app.settings(), 'avatar-lg')}
      <div>
        <div class="p-name">${escapeHtml(app.user.displayName)}</div>
        <div class="small muted">${escapeHtml(app.user.email)}</div>
        <div class="small muted">${t('profile.since', { date: memberSince })}</div>
        ${actionButton('openShop', t('profile.changeAvatar'), { arg: 'avatar', className: 'btn-link', focusId: 'openShop:avatar' })}
      </div>
    </section>

    <form class="card" data-form="profile" novalidate>
      <div class="field">
        <label for="${id}">${t('profile.name')}</label>
        <input id="${id}" class="input${form.error ? ' invalid' : ''}" maxlength="40" value="${escapeHtml(form.displayName)}"
          data-bind="profileForm.displayName" data-focus-id="profileForm.displayName"
          ${form.error ? `aria-invalid="true" aria-describedby="${id}-err"` : ''}>
        ${errorMessage(id, form.error)}
      </div>
      <div class="field">
        <label for="${id}-email">${t('profile.email')}</label>
        <input id="${id}-email" class="input" value="${escapeHtml(app.user.email)}" readonly aria-describedby="${id}-email-note">
        <div class="hint" id="${id}-email-note">${t('profile.emailNote')}</div>
      </div>
      <button type="submit" class="btn btn-primary" data-focus-id="submit-profile" ${form.isBusy ? 'disabled' : ''}>${saveLabel}</button>
    </form>

    <section class="card">
      ${actionButton('logout', t('profile.logout'), { className: 'btn btn-block btn-danger-outline', icon: 'logout', focusId: 'logout:profile' })}
    </section>`;
}
