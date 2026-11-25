/* =====================================================================
   SHEET: CREATE / EDIT TASK   (requirements 3.1, 3.2)
   Title (required, max 100), description, priority and due date.
   A failed save keeps the form open with the input and a Retry button.
   ===================================================================== */

import { escapeHtml, toDayKey, daysFromNow, daysUntil } from '../core/utils.js';
import { spinnerHtml } from '../core/icons.js';
import { t } from '../core/theme-engine.js';
import * as data from '../data/index.js';
import { TITLE_MAX } from '../data/model.js';
import { taskFormSnapshot } from '../app/state.js';
import { saveChange } from '../app/saving.js';
import { actionButton, banner, dueDateHint, errorMessage, priorityKey, segmentButton } from '../ui/components.js';

const PRIORITY_CHOICES = ['none', 'low', 'medium', 'high'];
const PRIORITY_VALUES = { none: null, low: 'Low', medium: 'Medium', high: 'High' };

/** Open the sheet. Pass a task to edit it, or null to create one. */
export function openTaskForm(app, task, returnFocusId) {
  app.ui.openMenuTaskId = null;
  app.ui.returnFocusId = returnFocusId || null;

  const dueIsTodayOrTomorrow = task && task.dueDate && [0, 1].includes(daysUntil(task.dueDate));
  const form = {
    id: task ? task.id : null,
    isNewTask: !task,
    title: task ? task.title : '',
    description: task ? task.description || '' : '',
    priority: task ? priorityKey(task.priority) : 'none',
    dueDate: task ? task.dueDate || '' : '',
    showDatePicker: Boolean(task && task.dueDate && !dueIsTodayOrTomorrow),
    showTitleError: false,
    isSaving: false,
    saveError: null,
  };
  form.originalSnapshot = taskFormSnapshot(form);

  app.ui.taskForm = form;
  app.ui.openModal = 'taskForm';
  app.ui.focusAfterRender = 'taskForm.title';
  app.render();
}

export function taskFormSheet(app) {
  const form = app.ui.taskForm;
  const todayKey = toDayKey(new Date());
  const tomorrowKey = toDayKey(daysFromNow(1));

  const dueChip = (choice, label, isSelected) => `
    <button type="button" class="chip" data-action="setDueDate" data-arg="${choice}"
      data-focus-id="setDueDate:${choice}" aria-pressed="${isSelected}">${label}</button>`;
  const priorityButtons = PRIORITY_CHOICES.map((priority) =>
    segmentButton('setPriority', priority, t('pri.' + priority), form.priority === priority, priority === 'none' ? '' : 'pri-' + priority)
  ).join('');

  const titleError = form.showTitleError ? errorMessage('task-title', t('form.err.title')) : '<span></span>';
  const datePicker = form.showDatePicker
    ? `<input type="date" class="input" style="margin-bottom:6px" aria-label="${t('form.pickLabel')}"
         value="${escapeHtml(form.dueDate)}" data-bind="taskForm.dueDate" data-live="dueDateHint" data-focus-id="taskForm.dueDate">`
    : '';
  const saveError = form.saveError
    ? banner(
        'danger',
        'alert',
        `<div>${t('form.err.sync')}</div><div class="small">${form.saveError}</div>
         <div class="banner-actions">${actionButton('retryTaskSave', t('sync.retry'), { className: 'btn btn-sm', icon: 'refresh' })}</div>`,
        { role: 'alert' }
      )
    : '';
  const saveLabel = form.isSaving ? `${spinnerHtml()}<span>${t('form.saving')}</span>` : t('form.save');
  const optional = `<span class="muted" style="font-weight:400">(${t('form.optional')})</span>`;

  return `
    <div class="backdrop" data-action="backdropClick" data-arg="modal">
      <div class="sheet trap" role="dialog" aria-modal="true" aria-labelledby="form-title">
        <form data-form="task" novalidate>
          <div class="sheet-hdr">
            <h2 id="form-title">${t(form.isNewTask ? 'form.new' : 'form.edit')}</h2>
            ${actionButton('cancelTaskForm', '', { className: 'icon-btn', icon: 'x', ariaLabel: t('common.close'), focusId: 'cancelTaskForm:x' })}
          </div>

          <div class="sheet-body">
            <div class="field">
              <label for="task-title">${t('form.title')}</label>
              <input id="task-title" class="input${form.showTitleError ? ' invalid' : ''}" maxlength="${TITLE_MAX}"
                value="${escapeHtml(form.title)}" placeholder="${t('form.titlePh')}" aria-required="true"
                data-bind="taskForm.title" data-live="titleCounter" data-focus-id="taskForm.title"
                aria-describedby="${form.showTitleError ? 'task-title-err ' : ''}task-count"
                ${form.showTitleError ? 'aria-invalid="true"' : ''}>
              <div class="field-foot">
                ${titleError}
                <span class="counter" id="task-count" data-counter>${form.title.length}/${TITLE_MAX}</span>
              </div>
            </div>

            <div class="field">
              <label for="task-desc">${t('form.desc')} ${optional}</label>
              <textarea id="task-desc" class="input" rows="2" placeholder="${t('form.descPh')}"
                data-bind="taskForm.description" data-focus-id="taskForm.description">${escapeHtml(form.description)}</textarea>
            </div>

            <fieldset class="field">
              <legend>${t('pri.label')}</legend>
              <div class="seg">${priorityButtons}</div>
            </fieldset>

            <fieldset class="field">
              <legend>${t('form.due')} ${optional}</legend>
              <div class="chips">
                ${dueChip('today', t('form.today'), !form.showDatePicker && form.dueDate === todayKey)}
                ${dueChip('tomorrow', t('form.tomorrow'), !form.showDatePicker && form.dueDate === tomorrowKey)}
                ${dueChip('pick', t('form.pick'), form.showDatePicker)}
                ${dueChip('clear', t('form.clear'), false)}
              </div>
              ${datePicker}
              <div class="hint" data-due-hint>${dueDateHint(form.dueDate)}</div>
            </fieldset>

            ${saveError}
          </div>

          <div class="sheet-foot">
            ${actionButton('cancelTaskForm', t('form.cancel'))}
            <button type="submit" class="btn btn-primary" data-focus-id="submit-task" ${form.isSaving ? 'disabled' : ''}>${saveLabel}</button>
          </div>
        </form>
      </div>
    </div>`;
}

/* ------------------------------ Saving ------------------------------ */

async function saveTaskForm(app) {
  const form = app.ui.taskForm;
  if (!form.title.trim()) {
    form.showTitleError = true;
    app.ui.focusAfterRender = 'taskForm.title';
    return app.render();
  }

  const existing = form.id ? app.findTask(form.id) : null;
  const task = {
    ...(existing || {}),
    id: form.id || undefined,
    title: form.title.trim(),
    description: form.description.trim(),
    priority: PRIORITY_VALUES[form.priority],
    dueDate: form.dueDate || null,
    completed: existing ? existing.completed : false,
  };

  form.isSaving = true;
  form.saveError = null;
  const result = await saveChange(app, { quiet: true, remote: () => data.saveTask(task) });
  if (app.ui.taskForm !== form) return; // closed while saving
  form.isSaving = false;

  if (!result.ok) {
    form.saveError = result.error.message; // keep the form open with the input (req 6.5)
    return app.render();
  }

  const saved = result.value;
  if (existing) app.data.tasks = app.data.tasks.map((other) => (other.id === saved.id ? saved : other));
  else app.data.tasks.push(saved);
  app.closeModal(true);
  app.toast(t('tasks.savedToast'), 'success');
}

export const forms = {
  task: saveTaskForm,
};

export const actions = {
  setPriority(app, priority) {
    app.ui.taskForm.priority = priority;
    app.ui.focusAfterRender = 'setPriority:' + priority;
    app.render();
  },
  setDueDate(app, choice) {
    const form = app.ui.taskForm;
    app.ui.focusAfterRender = 'setDueDate:' + choice;
    if (choice === 'today') Object.assign(form, { dueDate: toDayKey(new Date()), showDatePicker: false });
    else if (choice === 'tomorrow') Object.assign(form, { dueDate: toDayKey(daysFromNow(1)), showDatePicker: false });
    else if (choice === 'pick') {
      form.showDatePicker = true;
      if (!form.dueDate) form.dueDate = toDayKey(daysFromNow(2));
      app.ui.focusAfterRender = 'taskForm.dueDate';
    } else Object.assign(form, { dueDate: '', showDatePicker: false });
    app.render();
  },
  cancelTaskForm(app) {
    app.closeModal(false);
  },
  retryTaskSave(app) {
    saveTaskForm(app);
  },
};

export const liveUpdates = {
  titleCounter(app, value) {
    const counter = app.screenHost.querySelector('[data-counter]');
    if (counter) counter.textContent = `${value.length}/${TITLE_MAX}`;
    if (app.ui.taskForm.showTitleError && value.trim()) {
      app.ui.taskForm.showTitleError = false;
      app.render();
    }
  },
  dueDateHint(app, value) {
    const hint = app.screenHost.querySelector('[data-due-hint]');
    if (hint) hint.textContent = dueDateHint(value);
  },
};
