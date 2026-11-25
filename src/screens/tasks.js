/* =====================================================================
   SCREEN: TASKS   (requirements 3.1–3.5)
   Open / Completed lists, sorting, complete / reopen, the row menu
   (Edit, Focus on this, Delete). The create/edit form is task-form.js.
   ===================================================================== */

import { escapeHtml, formatDate, nowIso } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { t, decoration } from '../core/theme-engine.js';
import * as data from '../data/index.js';
import { REWARDS } from '../shop/progress.js';
import { saveChange } from '../app/saving.js';
import { shareSettings } from '../app/account.js';
import { sendTimerCommand } from '../app/timer-client.js';
import { actionButton, segmentButton, sessionCountBadge, taskMeta } from '../ui/components.js';
import { openTaskForm } from './task-form.js';

/* ------------------------------ Rows ------------------------------ */

function openTaskRow(app, task, sessionCount) {
  const isCurrent = app.timer.taskId === task.id;
  const menuOpen = app.ui.openMenuTaskId === task.id;
  const menuItem = (action, iconName, label, className = '') =>
    actionButton(action, label, { arg: task.id, className: 'mi ' + className, icon: iconName, attributes: 'role="menuitem"' });
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
        ${taskMeta(task, sessionCount, isCurrent)}
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

function completedTaskRow(task, sessionCount) {
  return `
    <li class="task done">
      <button type="button" class="check" role="checkbox" aria-checked="true"
        data-action="reopenTask" data-arg="${task.id}" data-focus-id="check:${task.id}"
        aria-label="${t('tasks.reopenLabel', { title: task.title })}"><span class="box">${icon('check')}</span></button>
      <div class="task-main">
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="task-meta">
          <span>${t('tasks.completedOn', { date: formatDate(task.completedAt) })}</span>${sessionCountBadge(sessionCount)}
        </div>
      </div>
      ${actionButton('reopenTask', t('tasks.reopen'), {
        arg: task.id,
        className: 'btn btn-sm btn-ghost',
        ariaLabel: t('tasks.reopenLabel', { title: task.title }),
      })}
    </li>`;
}

/* ------------------------------ Screen ------------------------------ */

export function tasksScreen(app) {
  const openTasks = app.openTasksSorted();
  const doneTasks = app.completedTasks();
  const counts = app.sessionCounts();
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
        <div class="empty"><div class="empty-icon" aria-hidden="true">${icon('check')}</div><p>${t('tasks.emptyDone')}</p></div>`;
    }
    return `${header}<ul class="task-list">${doneTasks.map((task) => completedTaskRow(task, counts.get(task.id))).join('')}</ul>`;
  }

  if (!openTasks.length) {
    return `${header}
      <div class="empty">
        ${decoration('empty-state-art')}
        <div class="empty-icon" aria-hidden="true">${icon('list')}</div>
        <p>${t('tasks.empty')}</p>
        ${actionButton('newTask', t('tasks.add'), { className: 'btn btn-primary', icon: 'plus', focusId: 'newTask:empty' })}
      </div>`;
  }

  const sortBy = app.settings().taskSort;
  const sortMenu = `
    <div class="sort-row">
      <label for="app-sort">${t('sort.label')}</label>
      <select id="app-sort" class="select" data-live="taskSort" data-focus-id="taskSort">
        <option value="due" ${sortBy === 'due' ? 'selected' : ''}>${t('sort.due')}</option>
        <option value="priority" ${sortBy === 'priority' ? 'selected' : ''}>${t('sort.priority')}</option>
      </select>
    </div>`;
  return `${header}${sortMenu}<ul class="task-list">${openTasks.map((task) => openTaskRow(app, task, counts.get(task.id))).join('')}</ul>`;
}

/* ------------------------------ Saving ------------------------------ */

/** The sort order is part of the account settings, so it's saved straight away. */
export function saveTaskSort(app, sortBy) {
  const previous = app.settings().taskSort;
  const settings = { ...app.settings(), taskSort: sortBy };
  return saveChange(app, {
    apply: () => (app.data.settings = settings),
    revert: () => (app.data.settings = { ...app.settings(), taskSort: previous }),
    remote: async () => {
      app.data.settings = await data.saveSettings(settings);
      await shareSettings(app.data.settings);
    },
  });
}

/** Replace one task in the local list (after a save, or to undo a failed one). */
function putTask(app, task) {
  app.data.tasks = app.data.tasks.map((existing) => (existing.id === task.id ? task : existing));
}

/** Save a changed copy of a task: shown at once, undone if the save fails. */
function updateTask(app, original, changes) {
  const updated = { ...original, ...changes };
  return saveChange(app, {
    apply: () => putTask(app, updated),
    revert: () => putTask(app, original),
    remote: async () => putTask(app, await data.saveTask(updated)),
  });
}

/* ------------------------------ Actions ------------------------------ */

export const actions = {
  setTaskFilter(app, filter) {
    app.ui.taskFilter = filter;
    app.ui.openMenuTaskId = null;
    app.ui.focusAfterRender = 'setTaskFilter:' + filter;
    app.render();
  },
  newTask(app, arg, element) {
    openTaskForm(app, null, element ? element.dataset.focusId : 'newTask:');
  },
  editTask(app, taskId) {
    openTaskForm(app, app.findTask(taskId), 'toggleTaskMenu:' + taskId);
  },
  focusOnTask(app, taskId) {
    app.ui.openMenuTaskId = null;
    sendTimerCommand(app, 'setTask', taskId);
    app.navigate('timer');
  },
  toggleTaskMenu(app, taskId) {
    app.ui.openMenuTaskId = app.ui.openMenuTaskId === taskId ? null : taskId;
    app.ui.focusAfterRender = app.ui.openMenuTaskId ? 'editTask:' + taskId : 'toggleTaskMenu:' + taskId;
    app.render();
  },

  deleteTask(app, taskId) {
    const task = app.findTask(taskId);
    app.ui.openMenuTaskId = null;
    app.askConfirm({
      title: t('tasks.del.title', { title: task.title }),
      body: t('tasks.del.body'),
      confirmLabel: t('tasks.delete'),
      danger: true,
      onConfirm: async () => {
        const index = app.data.tasks.indexOf(task);
        app.ui.focusAfterRender = 'newTask:';
        const result = await saveChange(app, {
          apply: () => (app.data.tasks = app.data.tasks.filter((other) => other.id !== taskId)),
          revert: () => app.data.tasks.splice(index, 0, task),
          remote: () => data.deleteTask(taskId),
        });
        if (!result.ok) return;
        if (app.timer.taskId === taskId) sendTimerCommand(app, 'setTask', null);
        app.toast(t('tasks.deletedToast'));
      },
    });
  },

  async completeTask(app, taskId) {
    const task = app.findTask(taskId);
    const achievementsBefore = app.achievementIds();

    // Move focus to the neighbouring task so keyboard users don't lose their place.
    const openTasks = app.openTasksSorted();
    const index = openTasks.findIndex((candidate) => candidate.id === taskId);
    const neighbour = openTasks[index + 1] || openTasks[index - 1];
    app.ui.focusAfterRender = neighbour ? 'completeTask:' + neighbour.id : 'newTask:';

    const result = await updateTask(app, task, { completed: true, completedAt: nowIso() });
    if (!result.ok) return;
    if (app.timer.taskId === taskId) sendTimerCommand(app, 'setTask', null);
    const message = `${t('tasks.doneToast', { title: task.title })} ${t('currency.earned', { n: REWARDS.taskDone })}`;
    app.toast(message, 'success', 'check');
    app.celebrateNewAchievements(achievementsBefore);
  },

  async reopenTask(app, taskId) {
    const task = app.findTask(taskId);
    app.ui.focusAfterRender = 'setTaskFilter:completed';
    const result = await updateTask(app, task, { completed: false, completedAt: null });
    if (result.ok) app.toast(t('tasks.reopenedToast', { title: task.title }));
  },
};

export const liveUpdates = {
  taskSort(app, value) {
    app.ui.focusAfterRender = 'taskSort';
    saveTaskSort(app, value);
  },
};
