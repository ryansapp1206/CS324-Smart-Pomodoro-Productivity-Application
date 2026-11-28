/* =====================================================================
   PROGRESS: streaks, achievements and the currency balance
   Pure functions of the account data (tasks, sessions, purchases), so the
   numbers are the same on every device and nothing extra is stored.

   To add an achievement:
     1. add a line to ACHIEVEMENTS below (id, track, goal, icon)
     2. add its name to src/core/copy.js as 'ach.<id>'
     3. if it needs a NEW track, add that number to calculateProgress()
   ===================================================================== */

import { ONE_DAY_MS, fromDayKey, startOfDay, toDayKey } from '../core/utils.js';

/**
 * track: which number from calculateProgress() the goal is measured against.
 * Tracks: sessions, minutes, bestStreak, tasksDone, activeDays,
 *         bestDaySessions, earlyBird, nightOwl, weekendSessions.
 * icon: a name from src/core/icons.js.
 */
export const ACHIEVEMENTS = [
  // Focus sessions
  { id: 's1', track: 'sessions', goal: 1, icon: 'timer' },
  { id: 's10', track: 'sessions', goal: 10, icon: 'timer' },
  { id: 's25', track: 'sessions', goal: 25, icon: 'timer' },
  { id: 's50', track: 'sessions', goal: 50, icon: 'timer' },
  { id: 's100', track: 'sessions', goal: 100, icon: 'trophy' },
  { id: 's250', track: 'sessions', goal: 250, icon: 'trophy' },
  { id: 's500', track: 'sessions', goal: 500, icon: 'trophy' },
  // Total focus time (goal in minutes)
  { id: 't10h', track: 'minutes', goal: 600, icon: 'clock' },
  { id: 't50h', track: 'minutes', goal: 3000, icon: 'clock' },
  { id: 't100h', track: 'minutes', goal: 6000, icon: 'clock' },
  // Streaks
  { id: 'k3', track: 'bestStreak', goal: 3, icon: 'flame' },
  { id: 'k7', track: 'bestStreak', goal: 7, icon: 'flame' },
  { id: 'k14', track: 'bestStreak', goal: 14, icon: 'flame' },
  { id: 'k30', track: 'bestStreak', goal: 30, icon: 'flame' },
  // Tasks
  { id: 'd5', track: 'tasksDone', goal: 5, icon: 'check' },
  { id: 'd10', track: 'tasksDone', goal: 10, icon: 'check' },
  { id: 'd25', track: 'tasksDone', goal: 25, icon: 'trophy' },
  { id: 'd50', track: 'tasksDone', goal: 50, icon: 'trophy' },
  { id: 'd100', track: 'tasksDone', goal: 100, icon: 'trophy' },
  // Consistency and habits
  { id: 'a7', track: 'activeDays', goal: 7, icon: 'check' },
  { id: 'a30', track: 'activeDays', goal: 30, icon: 'check' },
  { id: 'f4', track: 'bestDaySessions', goal: 4, icon: 'timer' },
  { id: 'f8', track: 'bestDaySessions', goal: 8, icon: 'flame' },
  { id: 'eb5', track: 'earlyBird', goal: 5, icon: 'clock' },
  { id: 'no5', track: 'nightOwl', goal: 5, icon: 'moon' },
  { id: 'we10', track: 'weekendSessions', goal: 10, icon: 'flame' },
];

/** The currency (points / aura / …, named by the theme) is earned from progress and spent in the Shop. */
export const REWARDS = {
  focusSession: 10,
  taskDone: 5,
  achievement: 25,
};

/** Hour thresholds (local time) for the habit achievements. */
const EARLY_BIRD_BEFORE_HOUR = 8; // session started before 8:00
const NIGHT_OWL_FROM_HOUR = 22; // session started at or after 22:00

/** Current streak (alive if you focused today or yesterday) and best streak ever. */
export function calculateStreaks(sessions, today = new Date()) {
  const focusDays = new Set(sessions.map((session) => toDayKey(session.startedAt)));

  let current = 0;
  const day = startOfDay(today);
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

export function calculateProgress({ tasks, sessions }, today = new Date()) {
  const streaks = calculateStreaks(sessions, today);

  // Sessions per calendar day, for "active days" and "sessions in one day".
  const perDay = new Map();
  for (const session of sessions) {
    const key = toDayKey(session.startedAt);
    perDay.set(key, (perDay.get(key) || 0) + 1);
  }
  const startedAt = (session) => new Date(session.startedAt);

  return {
    sessions: sessions.length,
    minutes: sessions.reduce((total, session) => total + session.durationMinutes, 0),
    tasksDone: tasks.filter((task) => task.completed).length,
    currentStreak: streaks.current,
    bestStreak: streaks.best,
    activeDays: perDay.size,
    bestDaySessions: [...perDay.values()].reduce((best, count) => Math.max(best, count), 0),
    earlyBird: sessions.filter((session) => startedAt(session).getHours() < EARLY_BIRD_BEFORE_HOUR).length,
    nightOwl: sessions.filter((session) => startedAt(session).getHours() >= NIGHT_OWL_FROM_HOUR).length,
    weekendSessions: sessions.filter((session) => [0, 6].includes(startedAt(session).getDay())).length,
  };
}

export function unlockedAchievementIds(data, today = new Date()) {
  const progress = calculateProgress(data, today);
  return new Set(ACHIEVEMENTS.filter((a) => progress[a.track] >= a.goal).map((a) => a.id));
}

/**
 * A purchase with this itemId gives the account an unlimited balance (the
 * demo account has it). It's shown as an infinity sign and never goes down.
 */
export const UNLIMITED_GRANT = 'grant:unlimited';
export const UNLIMITED_BALANCE = 9999;

export function hasUnlimitedBalance(data) {
  return (data.purchases || []).some((purchase) => purchase.itemId === UNLIMITED_GRANT);
}

/** Balance = earned − spent, never below 0 (or UNLIMITED_BALANCE for an unlimited account). */
export function balanceOf(data, today = new Date()) {
  if (hasUnlimitedBalance(data)) return UNLIMITED_BALANCE;
  const progress = calculateProgress(data, today);
  const earned =
    progress.sessions * REWARDS.focusSession +
    progress.tasksDone * REWARDS.taskDone +
    unlockedAchievementIds(data, today).size * REWARDS.achievement;
  const spent = (data.purchases || []).reduce((total, purchase) => total + purchase.price, 0);
  return Math.max(0, earned - spent);
}