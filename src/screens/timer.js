/* =====================================================================
   SCREEN: TIMER   (requirements 2.1–2.6)
   Mode switcher, the countdown ring, the 4-session cycle, the task chip
   and Start / Pause / Resume / Stop / Reset. The timer itself lives in
   src/services/timer-service.js; these buttons send it commands.
   ===================================================================== */

import { formatClock } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { t, decoration } from '../core/theme-engine.js';
import { SESSIONS_PER_LONG_BREAK } from '../data/model.js';
import { RING_CIRCUMFERENCE, remainingMs, sendTimerCommand, totalMs } from '../app/timer-client.js';
import { playSound, requestNotificationPermission } from '../services/index.js';
import { actionButton, segmentButton } from '../ui/components.js';

export function timerScreen(app) {
  const timer = app.timer;
  const mode = timer.mode;
  const remaining = remainingMs(app);
  const total = totalMs(app);
  const currentTask = timer.taskId && app.tasks().find((task) => task.id === timer.taskId && !task.completed);
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
          stroke-dasharray="${RING_CIRCUMFERENCE}" stroke-dashoffset="${RING_CIRCUMFERENCE * (remaining / total)}"/>
      </svg>
      <div class="ring-center">
        <div class="time" data-time role="timer"
          aria-label="${t('timer.label', { time: formatClock(remaining), mode: t('mode.' + mode) })}">${formatClock(remaining)}</div>
        <div class="mode-label">
          ${t('mode.' + mode)}${timer.status === 'paused' ? ' · ' + t('timer.paused') : ''}
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
  const reset = (disabled) => actionButton('resetTimer', t('timer.reset'), { className: 'btn btn-pill', icon: 'reset', disabled });

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

export const actions = {
  switchMode(app, mode) {
    const timer = app.timer;
    if (mode === timer.mode && timer.status === 'idle') return;
    const doSwitch = () => {
      app.ui.focusAfterRender = 'switchMode:' + mode;
      sendTimerCommand(app, 'switchMode', mode);
    };
    if (timer.status === 'idle') return doSwitch();
    app.askConfirm({
      title: t('timer.switch.title', { mode: t('mode.' + mode) }),
      body: t('timer.switch.body'),
      confirmLabel: t('timer.switch.yes'),
      onConfirm: doSwitch,
    });
  },
  startTimer(app) {
    requestNotificationPermission(); // so the session-end alert can show while you're in another tab
    app.alert = null;
    app.renderToasts();
    app.ui.focusAfterRender = 'pauseTimer:';
    sendTimerCommand(app, 'start');
  },
  pauseTimer(app) {
    app.ui.focusAfterRender = 'resumeTimer:';
    sendTimerCommand(app, 'pause');
  },
  resumeTimer(app) {
    app.ui.focusAfterRender = 'pauseTimer:';
    sendTimerCommand(app, 'resume');
  },
  /** Stop: end the session early and go back to an idle Focus session. */
  stopTimer(app) {
    const wasActive = app.timer.status !== 'idle';
    app.ui.focusAfterRender = 'startTimer:';
    sendTimerCommand(app, 'stop');
    if (wasActive) {
      playSound('stopEarly');
      app.toast(t('timer.notCounted'));
    }
  },
  /** Reset: restart the current mode from its full length. */
  resetTimer(app) {
    const wasActive = app.timer.status !== 'idle';
    app.ui.focusAfterRender = 'startTimer:';
    sendTimerCommand(app, 'reset');
    if (wasActive) {
      playSound('stopEarly');
      app.toast(t('timer.notCounted'));
    }
  },
  openTaskPicker(app, arg, element) {
    app.ui.returnFocusId = element.dataset.focusId;
    app.ui.openModal = 'taskPicker';
    app.ui.focusAfterRender = 'pickTask:' + (app.timer.taskId || '');
    app.render();
  },
};
