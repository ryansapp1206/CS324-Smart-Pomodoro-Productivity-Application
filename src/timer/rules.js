/* =====================================================================
   TIMER RULES
   Plain functions, no DOM or storage, so they're easy to unit test.
   Each takes a timer state and returns a new one; nothing is changed in place.

   Remaining time comes from a stored end time (not from counting down), so
   the timer stays right across reloads and while the page is closed.

   Timer state:
     mode              'focus' | 'short' | 'long'
     status            'idle' | 'running' | 'paused'
     endsAt            ms timestamp when a running session ends
     pausedRemainingMs time left when paused
     sessionLengthMs   length of the session in progress
     sessionMinutes    same, in minutes (saved with the session)
     completedInCycle  focus sessions done since the last long break (0–4)
     taskId            task being worked on, or null
     startedAt         ms timestamp the session started
     justFinishedBreak true right after a break ends (Start button says "Start focus")
     speed             1 normally; >1 only from the dev console (60 = 1 second per minute)
   ===================================================================== */

import { SESSIONS_PER_LONG_BREAK } from '../data/model.js';

export const MODES = ['focus', 'short', 'long'];

const SETTINGS_KEY = { focus: 'focus', short: 'shortBreak', long: 'longBreak' };

export function minutesFor(settings, mode) {
  return settings.durations[SETTINGS_KEY[mode]];
}

export function createIdleTimer() {
  return {
    mode: 'focus',
    status: 'idle',
    endsAt: 0,
    pausedRemainingMs: 0,
    sessionLengthMs: 0,
    sessionMinutes: 0,
    completedInCycle: 0,
    taskId: null,
    startedAt: 0,
    justFinishedBreak: false,
    speed: 1,
  };
}

/** Timer speed (only the dev console changes it). */
function speedOf(timer) {
  return timer.speed || 1;
}

export function remainingMs(timer, settings, now = Date.now()) {
  if (timer.status === 'running') return Math.max(0, (timer.endsAt - now) * speedOf(timer));
  if (timer.status === 'paused') return timer.pausedRemainingMs;
  return minutesFor(settings, timer.mode) * 60000;
}

/** Full length of the current session (for the progress ring). */
export function totalMs(timer, settings) {
  return timer.status === 'idle' ? minutesFor(settings, timer.mode) * 60000 : timer.sessionLengthMs;
}

export function isDue(timer, now = Date.now()) {
  return timer.status === 'running' && timer.endsAt <= now;
}

export function start(timer, settings, now = Date.now()) {
  const minutes = minutesFor(settings, timer.mode);
  return {
    ...timer,
    status: 'running',
    sessionMinutes: minutes,
    sessionLengthMs: minutes * 60000,
    startedAt: now,
    endsAt: now + (minutes * 60000) / speedOf(timer),
    justFinishedBreak: false,
  };
}

export function pause(timer, now = Date.now()) {
  if (timer.status !== 'running') return timer;
  return { ...timer, status: 'paused', pausedRemainingMs: remainingMs(timer, null, now) };
}

export function resume(timer, now = Date.now()) {
  if (timer.status !== 'paused') return timer;
  return { ...timer, status: 'running', endsAt: now + timer.pausedRemainingMs / speedOf(timer) };
}

/** Dev console: change the speed, keeping the time left on a running session. */
export function setSpeed(timer, speed, now = Date.now()) {
  const next = { ...timer, speed: Math.max(1, Number(speed) || 1) };
  if (timer.status === 'running') next.endsAt = now + remainingMs(timer, null, now) / next.speed;
  return next;
}

/** Dev console: make a running or paused session end right now. */
export function endNow(timer, now = Date.now()) {
  if (timer.status === 'idle') return timer;
  return { ...timer, status: 'running', endsAt: now };
}

/** Back to idle, optionally in another mode. The session in progress is not counted. */
export function reset(timer, mode = timer.mode) {
  return { ...timer, mode, status: 'idle', endsAt: 0, pausedRemainingMs: 0, sessionLengthMs: 0, justFinishedBreak: false };
}

/** Stop: end early and go back to an idle Focus session. */
export function stop(timer) {
  return reset(timer, 'focus');
}

export function nextModeAfter(finishedMode, completedInCycle) {
  if (finishedMode !== 'focus') return 'focus';
  return completedInCycle >= SESSIONS_PER_LONG_BREAK ? 'long' : 'short';
}

/**
 * A session reached 00:00. Returns the next timer, which modes finished and
 * started, and the focus session to save (null after a break).
 * Every 4th focus session leads to a long break; a long break resets the count.
 */
export function finish(timer, settings, now = Date.now()) {
  const finishedMode = timer.mode;
  let completedInCycle = timer.completedInCycle;
  let session = null;

  if (finishedMode === 'focus') {
    completedInCycle = Math.min(SESSIONS_PER_LONG_BREAK, completedInCycle + 1);
    session = {
      id: `s_${timer.startedAt}`, // stable id, so saving twice never double counts
      startedAt: new Date(timer.startedAt || now).toISOString(),
      durationMinutes: timer.sessionMinutes || minutesFor(settings, 'focus'),
      taskId: timer.taskId || null,
    };
  } else if (finishedMode === 'long') {
    completedInCycle = 0;
  }

  const nextMode = nextModeAfter(finishedMode, completedInCycle);
  let next = { ...reset(timer, nextMode), completedInCycle, justFinishedBreak: finishedMode !== 'focus' };
  if (settings.autoStart) next = start(next, settings, now);

  return { timer: next, finishedMode, nextMode, session, autoStarted: Boolean(settings.autoStart) };
}
