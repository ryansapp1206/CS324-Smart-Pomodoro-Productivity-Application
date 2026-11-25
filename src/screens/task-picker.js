/* =====================================================================
   DIALOG: PICK A TASK TO FOCUS ON   (requirement 3.6)
   Opened from the task chip on the Timer screen.
   ===================================================================== */

import { escapeHtml } from '../core/utils.js';
import { t } from '../core/theme-engine.js';
import { actionButton, segmentButton, taskMeta } from '../ui/components.js';
import { sendTimerCommand } from '../app/timer-client.js';
import { saveTaskSort } from './tasks.js';

export function taskPickerDialog(app) {
  const openTasks = app.openTasksSorted();
  const counts = app.sessionCounts();
  const selectedId = app.timer.taskId || '';
  const sortBy = app.settings().taskSort;

  const option = (taskId, title, details) => `
    <li>
      <button type="button" class="pick" data-action="pickTask" data-arg="${taskId}" data-focus-id="pickTask:${taskId}"
        aria-pressed="${selectedId === taskId}">
        <span class="radio" aria-hidden="true"></span>
        <span class="pick-main"><span class="pick-title">${title}</span>${details}</span>
      </button>
    </li>`;

  const noTaskOption = option('', t('picker.none'), `<span class="small muted" style="display:block">${t('picker.noneSub')}</span>`);
  const taskOptions = openTasks.map((task) => option(task.id, escapeHtml(task.title), taskMeta(task, counts.get(task.id), false))).join('');

  return `
    <div class="backdrop center" data-action="backdropClick" data-arg="modal">
      <div class="dialog trap" role="dialog" aria-modal="true" aria-labelledby="picker-title" style="max-height:520px">
        <div class="sheet-hdr">
          <h2 id="picker-title">${t('picker.title')}</h2>
          ${actionButton('closeModal', '', { className: 'icon-btn', icon: 'x', ariaLabel: t('common.close') })}
        </div>
        <div class="picker-sort">
          <span>${t('picker.sortBy')}</span>
          <div class="seg" role="group" aria-label="${t('picker.sortBy')}">
            ${segmentButton('setTaskSort', 'due', t('sort.due'), sortBy === 'due')}
            ${segmentButton('setTaskSort', 'priority', t('sort.priority'), sortBy === 'priority')}
          </div>
        </div>
        <ul class="pick-list">${noTaskOption}${taskOptions}</ul>
        ${openTasks.length ? '' : `<p class="hint center" style="padding:8px 16px">${t('picker.empty')}</p>`}
        <div style="height:10px"></div>
      </div>
    </div>`;
}

export const actions = {
  pickTask(app, taskId) {
    app.closeModal(true);
    sendTimerCommand(app, 'setTask', taskId || null);
  },
  setTaskSort(app, sortBy) {
    app.ui.focusAfterRender = 'setTaskSort:' + sortBy;
    saveTaskSort(app, sortBy);
  },
};
