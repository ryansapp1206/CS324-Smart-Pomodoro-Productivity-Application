/* =====================================================================
   PROGRESS: streaks, achievements and the currency balance
   Pure functions of the account data (tasks, sessions, purchases), so the
   numbers are the same on every device and nothing extra is stored.
   ===================================================================== */

import { ONE_DAY_MS, fromDayKey, startOfDay, toDayKey } from '../core/utils.js';

export const ACHIEVEMENTS = [
  { id: 's1', track: 'sessions', goal: 1, icon: 'timer' },
  { id: 's10', track: 'sessions', goal: 10, icon: 'timer' },
  { id: 's50', track: 'sessions', goal: 50, icon: 'timer' },
  { id: 's100', track: 'sessions', goal: 100, icon: 'trophy' },
  { id: 't10h', track: 'minutes', goal: 600, icon: 'clock' },
  { id: 't50h', track: 'minutes', goal: 3000, icon: 'clock' },
  { id: 'k3', track: 'bestStreak', goal: 3, icon: 'flame' },
  { id: 'k7', track: 'bestStreak', goal: 7, icon: 'flame' },
  { id: 'd5', track: 'tasksDone', goal: 5, icon: 'check' },
  { id: 'd25', track: 'tasksDone', goal: 25, icon: 'trophy' },
];

/** The currency (points / aura / …, named by the theme) is earned from progress and spent in the Shop. */
export const REWARDS = {
  focusSession: 10,
  taskDone: 5,
  achievement: 25,
};

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
  return {
    sessions: sessions.length,
    minutes: sessions.reduce((total, session) => total + session.durationMinutes, 0),
    tasksDone: tasks.filter((task) => task.completed).length,
    currentStreak: streaks.current,
    bestStreak: streaks.best,
  };
}

export function unlockedAchievementIds(data, today = new Date()) {
  const progress = calculateProgress(data, today);
  return new Set(ACHIEVEMENTS.filter((a) => progress[a.track] >= a.goal).map((a) => a.id));
}

/** Balance = earned − spent, never below 0. */
export function balanceOf(data, today = new Date()) {
  const progress = calculateProgress(data, today);
  const earned =
    progress.sessions * REWARDS.focusSession +
    progress.tasksDone * REWARDS.taskDone +
    unlockedAchievementIds(data, today).size * REWARDS.achievement;
  const spent = (data.purchases || []).reduce((total, purchase) => total + purchase.price, 0);
  return Math.max(0, earned - spent);
}
