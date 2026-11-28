/* =====================================================================
   SCREEN: STATS   (requirements 4.1–4.4)
   Currency balance, today's numbers, the 7-day chart, streak and achievements.
   Everything is worked out from the session history (src/shop/progress.js).
   ===================================================================== */

import { daysFromNow, formatDate, formatDuration, toDayKey } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { t, decoration } from '../core/theme-engine.js';
import { ACHIEVEMENTS, REWARDS, calculateProgress, unlockedAchievementIds } from '../shop/progress.js';
import { sendTimerCommand } from '../app/timer-client.js';
import { actionButton, balanceHtml } from '../ui/components.js';
import * as data from '../data/index.js';
import { saveChange } from '../app/saving.js';
import { shareSettings } from '../app/account.js';

const minutesOn = (sessions, dayKey) =>
  sessions.filter((session) => toDayKey(session.startedAt) === dayKey).reduce((total, session) => total + session.durationMinutes, 0);

/** False when Settings → "Show achievements" is off. Missing (older saved settings) counts as on. */
const achievementsVisible = (app) => app.settings().showAchievements !== false;

/** The fold state is saved separately from the Settings form, like task sort. */
function saveAchievementsCollapsed(app, collapsed) {
  const previous = Boolean(app.settings().achievementsCollapsed);
  const settings = { ...app.settings(), achievementsCollapsed: collapsed };
  return saveChange(app, {
    apply: () => (app.data.settings = settings),
    revert: () => (app.data.settings = { ...app.settings(), achievementsCollapsed: previous }),
    remote: async () => {
      app.data.settings = await data.saveSettings(settings);
      await shareSettings(app.data.settings);
    },
  });
}

function balanceCard(app) {
  const rewards = { s: REWARDS.focusSession, t: REWARDS.taskDone, a: REWARDS.achievement };
  return `
    <section class="card balance-card">
      <span class="balance-icon" aria-hidden="true">${icon('coins')}</span>
      <div class="grow">
        <div class="small muted">${t('currency.balance')}</div>
        <div class="balance-v">${balanceHtml(app)}</div>
      </div>
      ${actionButton('openShop', t('currency.openShop'), { className: 'btn btn-sm', icon: 'bag', focusId: 'openShop:card' })}
    </section>
    <p class="small muted" style="margin:-4px 2px 12px">${t('currency.how', rewards)}</p>`;
}

export function statsScreen(app) {
  return balanceCard(app) + (app.data.sessions.length ? statsDetails(app) : statsEmptyState() + (achievementsVisible(app) ? achievementsCard(app) : ''));
}

function statsEmptyState() {
  return `
    <div class="empty" style="padding:20px">
      ${decoration('empty-state-art')}
      <div class="empty-icon" aria-hidden="true">${icon('chart')}</div>
      <h2>${t('stats.empty.title')}</h2>
      <p>${t('stats.empty.body')}</p>
      ${actionButton('startFocusing', t('stats.empty.cta'), { className: 'btn btn-primary', icon: 'play' })}
    </div>`;
}

function statsDetails(app) {
  const sessions = app.data.sessions;
  const todayKey = toDayKey(new Date());
  const todaySessions = sessions.filter((session) => toDayKey(session.startedAt) === todayKey);
  const tasksDoneToday = app.tasks().filter((task) => task.completed && task.completedAt && toDayKey(task.completedAt) === todayKey).length;
  const statCard = (value, labelKey) => `<div class="stat"><div class="stat-v">${value}</div><div class="stat-l">${t(labelKey)}</div></div>`;

  return `
    <div class="sec-label">${t('stats.today')}</div>
    <div class="cards3">
      ${statCard(todaySessions.length, 'stats.sessions')}
      ${statCard(formatDuration(minutesOn(sessions, todayKey)), 'stats.focusTime')}
      ${statCard(tasksDoneToday, 'stats.tasksDone')}
    </div>
    ${weeklyChartCard(app)}
    ${streakCard(app)}
    ${achievementsVisible(app) ? achievementsCard(app) : ''}`;
}

/** Bar chart of focus minutes for the last 7 days. Each bar is focusable and labelled. */
function weeklyChartCard(app) {
  const todayKey = toDayKey(new Date());
  const days = [6, 5, 4, 3, 2, 1, 0].map((daysAgo) => {
    const date = daysFromNow(-daysAgo);
    const key = toDayKey(date);
    return { key, date, minutes: minutesOn(app.data.sessions, key) };
  });

  const chart = { width: 336, height: 150, baseline: 120, barWidth: 26, maxBarHeight: 96 };
  const slotWidth = chart.width / days.length;
  const axisMax = Math.ceil(Math.max(60, ...days.map((d) => d.minutes)) / 30) * 30;

  const bars = days
    .map((day, index) => {
      const height = day.minutes ? Math.max(3, Math.round((day.minutes / axisMax) * chart.maxBarHeight)) : 0;
      const x = index * slotWidth + (slotWidth - chart.barWidth) / 2;
      const center = x + chart.barWidth / 2;
      const label = t('stats.barLabel', { day: formatDate(day.date, { weekday: 'long' }), value: formatDuration(day.minutes) });
      return `
        <g class="bar${day.key === todayKey ? ' today' : ''}" tabindex="0" role="img" aria-label="${label}">
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
      <span class="streak-icon" aria-hidden="true">${icon('flame')}</span>
      <div>
        <h2 style="font-size:16px">${t('stats.streak', { n: progress.currentStreak })}</h2>
        <p class="small muted">${t('stats.streakSub', { best: progress.bestStreak })}</p>
      </div>
    </section>`;
}

/** One achievement row: icon, name, progress bar and status. */
function achievementItem(achievement, progress, isUnlocked) {
  const value = progress[achievement.track];
  const percent = Math.min(100, Math.round((value / achievement.goal) * 100));
  const progressText =
    achievement.track === 'minutes'
      ? `${Math.floor(Math.min(value, achievement.goal) / 60)}h / ${achievement.goal / 60}h`
      : `${Math.min(value, achievement.goal)}/${achievement.goal}`;
  const status = isUnlocked ? t('ach.unlocked') : `<span class="sr-only">${t('ach.locked')}, </span>${progressText}`;
  return `
      <li class="ach${isUnlocked ? ' on' : ''}">
        <span class="ach-icon" aria-hidden="true">${icon(achievement.icon)}</span>
        <div style="flex:1;min-width:0">
          <div class="ach-name">${t('ach.' + achievement.id)}</div>
          <span class="pbar" aria-hidden="true"><i style="width:${percent}%"></i></span>
          <span class="small muted">${status}</span>
        </div>
        ${decoration('achievement-badge-frame')}
      </li>`;
}

/** Achievements, split into "Up next" (closest first) and "Unlocked". */
function achievementsCard(app) {
  const collapsed = Boolean(app.settings().achievementsCollapsed);
  const progress = calculateProgress(app.data);
  const unlocked = unlockedAchievementIds(app.data);
  const percentOf = (achievement) => Math.min(100, (progress[achievement.track] / achievement.goal) * 100);

  const done = ACHIEVEMENTS.filter((achievement) => unlocked.has(achievement.id));
  const next = ACHIEVEMENTS.filter((achievement) => !unlocked.has(achievement.id)).sort((a, b) => percentOf(b) - percentOf(a));

  const group = (headKey, list, isUnlocked) =>
    list.length
      ? `
      <div class="small" style="font-weight:600;margin:14px 0 8px">${t(headKey, { n: list.length })}</div>
      <ul class="ach-grid">${list.map((achievement) => achievementItem(achievement, progress, isUnlocked)).join('')}</ul>`
      : '';

  const note = !done.length ? t('stats.achNone') : !next.length ? t('stats.achAll') : '';

  const toggle = actionButton('toggleAchievements', t(collapsed ? 'stats.achShow' : 'stats.achHide'), {
    className: 'btn btn-sm btn-ghost',
    focusId: 'toggleAchievements',
    ariaLabel: t(collapsed ? 'stats.achShowLabel' : 'stats.achHideLabel'),
    attributes: `aria-expanded="${!collapsed}"`,
  });

  const body = collapsed
    ? ''
    : `
      <p class="small muted" style="margin:-2px 0 0">${t('stats.achRewardNote', { n: REWARDS.achievement })}</p>
      ${note ? `<p class="small" style="margin:10px 0 0">${note}</p>` : ''}
      ${group('stats.achNextHead', next, false)}
      ${group('stats.achUnlockedHead', done, true)}`;

  return `
    <section class="card" data-achievements>
      <div class="card-h">
        <h2>${t('stats.ach')}</h2>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="small muted">${t('stats.achSub', { n: unlocked.size, total: ACHIEVEMENTS.length })}</span>
          ${toggle}
        </div>
      </div>${body}
    </section>`;
}

export const actions = {
  toggleAchievements(app) {
    app.ui.focusAfterRender = 'toggleAchievements';
    saveAchievementsCollapsed(app, !app.settings().achievementsCollapsed);
  },

  startFocusing(app) {
    app.navigate('timer');
    if (app.timer.status !== 'idle') return;
    if (app.timer.mode !== 'focus') sendTimerCommand(app, 'switchMode', 'focus').then(() => sendTimerCommand(app, 'start'));
    else sendTimerCommand(app, 'start');
  },
};
