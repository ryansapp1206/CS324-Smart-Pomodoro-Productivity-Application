/* =====================================================================
   TIMER SERVICE
   Owns the timer. Screens call handleTimerCommand() and redraw when
   STORAGE_KEYS.timer changes. The timer is stored as an end time, so it
   stays right across page reloads, and a session that ended while the page
   was closed is counted as soon as the page opens again.
   ===================================================================== */

import { storage, STORAGE_KEYS } from '../core/storage.js';
import * as rules from '../timer/rules.js';
import { sessionEndMessage } from '../timer/messages.js';
import { scheduler } from '../core/scheduler.js';
import { isUiVisible, loadSettings } from './context.js';
import { showNotification, updateTabTitle } from './notify.js';
import { playSound } from './sound.js';
import { queueSession } from './session-queue.js';

scheduler.define('session-end', () => checkSessionEnd());

async function loadTimer() {
  return (await storage.get(STORAGE_KEYS.timer)) || rules.createIdleTimer();
}

/** Save the timer and set a wake-up for when the session ends. */
async function saveTimer(timer, settings) {
  await storage.set(STORAGE_KEYS.timer, timer);
  scheduleSessionEnd(timer);
  updateTabTitle(timer, settings);
  return timer;
}

function scheduleSessionEnd(timer) {
  if (timer.status === 'running') scheduler.at('session-end', timer.endsAt + 50);
  else scheduler.cancel('session-end');
}

const COMMANDS = {
  start: (timer, settings) => (timer.status === 'idle' ? rules.start(timer, settings) : timer),
  pause: (timer) => rules.pause(timer),
  resume: (timer) => rules.resume(timer),
  stop: (timer) => rules.stop(timer),
  reset: (timer) => rules.reset(timer),
  switchMode: (timer, settings, mode) => (rules.MODES.includes(mode) ? rules.reset(timer, mode) : timer),
  setTask: (timer, settings, taskId) => ({ ...timer, taskId: taskId || null }),
  // Dev console only (src/dev/):
  setSpeed: (timer, settings, speed) => rules.setSpeed(timer, speed),
  endNow: (timer) => rules.endNow(timer),
  clear: () => rules.createIdleTimer(),
};

/* Commands and session ends run one at a time, so two can never overwrite each other. */
let queue = Promise.resolve();
function serialized(job) {
  const result = queue.then(job, job);
  queue = result.catch(() => {});
  return result;
}

/** command: start | pause | resume | stop | reset | switchMode | setTask | clear (+ setSpeed, endNow for the dev console). Returns the new timer. */
export function handleTimerCommand(command, arg) {
  return serialized(async () => {
    const run = COMMANDS[command];
    if (!run) throw new Error(`Unknown timer command: ${command}`);
    const settings = await loadSettings();
    const timer = await saveTimer(run(await loadTimer(), settings, arg), settings);
    return command === 'endNow' ? finishSession(timer, settings) : timer;
  });
}

/** Finish the session if its time is up. Safe to call as often as you like. */
export function checkSessionEnd() {
  return serialized(async () => {
    const timer = await loadTimer();
    const settings = await loadSettings();
    scheduleSessionEnd(timer); // e.g. after a reload
    updateTabTitle(timer, settings);
    return rules.isDue(timer) ? finishSession(timer, settings) : timer;
  });
}

async function finishSession(timer, settings) {
  const result = rules.finish(timer, settings);
  await saveTimer(result.timer, settings);

  const alert = {
    id: `${result.finishedMode}-${timer.endsAt}`,
    finishedMode: result.finishedMode,
    nextMode: result.nextMode,
    nextMinutes: rules.minutesFor(settings, result.nextMode),
    autoStarted: result.autoStarted,
    at: Date.now(),
    seen: false,
  };
  await storage.set(STORAGE_KEYS.alert, alert);

  // Only notify if it ended just now, not hours ago while the page was closed.
  const endedRecently = Date.now() - timer.endsAt < 60000;
  const alertsOn = result.finishedMode === 'focus' ? settings.sessionAlerts : settings.breakAlerts;
  if (endedRecently && alertsOn && !isUiVisible()) {
    const { title, body } = sessionEndMessage(alert);
    showNotification('session-end', title, body);
  }
  if (endedRecently) {
    let event = 'breakEnd';
    if (result.finishedMode === 'focus') event = result.nextMode === 'long' ? 'setComplete' : 'sessionEnd';
    playSound(event);
  }
  if (result.session) await queueSession(result.session);
  return result.timer;
}
