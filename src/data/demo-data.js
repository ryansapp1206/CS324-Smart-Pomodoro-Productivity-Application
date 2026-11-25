/* =====================================================================
   DEMO ACCOUNT (mock backend only)
   Realistic tasks plus ~30 days of focus history, all relative to today,
   so the stats, streaks and achievements look real in demos.
   ===================================================================== */

import { daysFromNow, startOfDay, toDayKey } from '../core/utils.js';
import { DEFAULT_SETTINGS } from './model.js';
import { UNLIMITED_GRANT } from '../shop/progress.js';

export const DEMO_USER = {
  id: 'u_demo',
  email: 'demo@example.com',
  password: 'pomodoro123',
  displayName: 'Alex Morgan',
};

const HOUR = 3600000;
const MINUTE = 60000;
const iso = (ms) => new Date(ms).toISOString();

function demoTask(id, title, priority, dueInDays, extra = {}) {
  return {
    id,
    title,
    description: '',
    priority, // 'Low' | 'Medium' | 'High' | null
    dueDate: dueInDays == null ? null : toDayKey(daysFromNow(dueInDays)),
    completed: false,
    completedAt: null,
    createdAt: iso(daysFromNow(-14).getTime()),
    ...extra,
  };
}

export function createDemoData() {
  const now = Date.now();
  const tenAmOn = (dayOffset) => iso(daysFromNow(dayOffset).getTime() + 10 * HOUR);
  const earlierToday = iso(Math.max(now - 2 * HOUR, startOfDay().getTime() + MINUTE));

  const tasks = [
    demoTask('t_srs', 'Finish SRS draft', 'High', 0, { description: 'Sections 3–5 plus the use case diagram.' }),
    demoTask('t_quiz', 'Study for stats quiz', 'Medium', 1),
    demoTask('t_bug', 'Fix login form bug', 'High', -2, { description: 'Error message shows under the wrong field.' }),
    demoTask('t_read', 'Read chapter 6', 'Low', 4),
    demoTask('t_script', 'Write usability test script', 'Medium', 6),
    demoTask('t_email', 'Email project update to the team', null, null),
    demoTask('t_git', 'Clean up old Git branches', 'Low', 10),
    demoTask('t_fb', 'Set up Firebase project', 'High', null, { completed: true, completedAt: earlierToday }),
    demoTask('t_stories', 'Write user stories', 'Medium', null, { completed: true, completedAt: tenAmOn(-1) }),
    demoTask('t_repo', 'Create GitHub repo and PR rules', 'Medium', null, { completed: true, completedAt: tenAmOn(-3) }),
    demoTask('t_wire', 'Sketch first wireframes', 'Low', null, { completed: true, completedAt: tenAmOn(-8) }),
    demoTask('t_team', 'Fill out team formation form', null, null, { completed: true, completedAt: tenAmOn(-12) }),
  ];

  const sessions = [];
  const linkedTasks = ['t_srs', 't_quiz', null, 't_bug', 't_fb'];
  const addSessions = (dayOffset, count) => {
    for (let i = 0; i < count; i++) {
      const startedAt =
        dayOffset === 0
          ? now - (i + 1) * 35 * MINUTE - 25 * MINUTE // today: earlier in the day
          : daysFromNow(dayOffset).getTime() + (9 * 60 + i * 35) * MINUTE; // from 9:00 am
      sessions.push({
        id: `s_${Math.abs(dayOffset)}_${i}`,
        startedAt: iso(startedAt),
        durationMinutes: 25,
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
  sessions.sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  // Unlimited balance, shown as a glowing infinity sign (src/shop/progress.js).
  const purchases = [{ itemId: UNLIMITED_GRANT, price: 0, purchasedAt: new Date(now).toISOString() }];

  return { tasks, sessions, purchases, settings: structuredClone(DEFAULT_SETTINGS) };
}
