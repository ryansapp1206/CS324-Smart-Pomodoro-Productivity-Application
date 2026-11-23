/* =====================================================================
   OVERLAYS AND RENDERING
   Dialogs (task form, task picker, confirm), the main render loop and toasts.
   Rendering rebuilds the screen from state, then restores keyboard focus
   and scroll position so it feels like nothing was replaced.
   ===================================================================== */

/* ----------------------------- Task form ----------------------------- */

function taskFormSheet(app) {
  const form = app.ui.taskForm;
  const id = app.id;
  const todayKey = toDayKey(new Date());
  const tomorrowKey = toDayKey(daysFromNow(1));

  const dueChip = (choice, label, isSelected) => `
    <button type="button" class="chip" data-action="setDueDate" data-arg="${choice}"
      data-focus-id="setDueDate:${choice}" aria-pressed="${isSelected}">${label}</button>`;
  const priorityButtons = ['none', 'low', 'medium', 'high']
    .map((priority) =>
      segmentButton(
        'setPriority',
        priority,
        t('pri.' + priority),
        form.priority === priority,
        priority === 'none' ? '' : 'pri-' + priority
      )
    )
    .join('');

  const titleError = form.showTitleError ? errorMessage(`${id}-task-title`, t('form.err.title')) : '<span></span>';
  const datePicker = form.showDatePicker
    ? `<input type="date" class="input" style="margin-bottom:6px" aria-label="${t('form.pickLabel')}"
         value="${escapeHtml(form.dueDate)}" data-bind="taskForm.dueDate" data-live="dueDateHint" data-focus-id="taskForm.dueDate">`
    : '';
  const syncError = form.syncFailed
    ? banner(
        'danger',
        'alert',
        `<div>${t('form.err.sync')}</div>
         <div class="banner-actions">
           ${actionButton('retryTaskSave', t('sync.retry'), { className: 'btn btn-sm', icon: 'refresh' })}
           ${actionButton('keepTaskOnDevice', t('form.keepLocal'), { className: 'btn btn-sm btn-ghost' })}
         </div>`,
        { role: 'alert' }
      )
    : '';
  const saveLabel = form.isSaving ? `${spinnerHtml()}<span>${t('form.saving')}</span>` : t('form.save');
  const optional = `<span class="muted" style="font-weight:400">(${t('form.optional')})</span>`;

  return `
    <div class="backdrop" data-action="backdropClick" data-arg="modal">
      <div class="sheet trap" role="dialog" aria-modal="true" aria-labelledby="${id}-form-title">
        <form data-form="task" novalidate>
          <div class="sheet-hdr">
            <h2 id="${id}-form-title">${t(form.isNewTask ? 'form.new' : 'form.edit')}</h2>
            ${actionButton('cancelTaskForm', '', { className: 'icon-btn', icon: 'x', ariaLabel: t('common.close'), focusId: 'cancelTaskForm:x' })}
          </div>

          <div class="sheet-body">
            <div class="field">
              <label for="${id}-task-title">${t('form.title')}</label>
              <input id="${id}-task-title" class="input${form.showTitleError ? ' invalid' : ''}" maxlength="100"
                value="${escapeHtml(form.title)}" placeholder="${t('form.titlePh')}" aria-required="true"
                data-bind="taskForm.title" data-live="titleCounter" data-focus-id="taskForm.title"
                aria-describedby="${form.showTitleError ? `${id}-task-title-err ` : ''}${id}-task-count"
                ${form.showTitleError ? 'aria-invalid="true"' : ''}>
              <div class="field-foot">
                ${titleError}
                <span class="counter" id="${id}-task-count" data-counter>${form.title.length}/100</span>
              </div>
            </div>

            <div class="field">
              <label for="${id}-task-desc">${t('form.desc')} ${optional}</label>
              <textarea id="${id}-task-desc" class="input" rows="2" placeholder="${t('form.descPh')}"
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

            ${syncError}
          </div>

          <div class="sheet-foot">
            ${actionButton('cancelTaskForm', t('form.cancel'))}
            <button type="submit" class="btn btn-primary" data-focus-id="submit-task" ${form.isSaving ? 'disabled' : ''}>${saveLabel}</button>
          </div>
        </form>
      </div>
    </div>`;
}

/* ----------------------------- Task picker ----------------------------- */

function taskPickerDialog(app) {
  const openTasks = app.openTasksSorted();
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

  const noTaskOption = option(
    '',
    t('picker.none'),
    `<span class="small muted" style="display:block">${t('picker.noneSub')}</span>`
  );
  const taskOptions = openTasks.map((task) => option(task.id, escapeHtml(task.title), taskMeta(task, false))).join('');

  return `
    <div class="backdrop center" data-action="backdropClick" data-arg="modal">
      <div class="dialog trap" role="dialog" aria-modal="true" aria-labelledby="${app.id}-picker-title" style="max-height:520px">
        <div class="sheet-hdr">
          <h2 id="${app.id}-picker-title">${t('picker.title')}</h2>
          ${actionButton('closeTaskPicker', '', { className: 'icon-btn', icon: 'x', ariaLabel: t('common.close') })}
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

/* --------------------------- Confirm dialog --------------------------- */

function confirmDialog(app) {
  const dialog = app.ui.confirmDialog;
  const confirmClass = dialog.danger ? 'btn btn-danger' : 'btn btn-primary';
  return `
    <div class="backdrop top" data-action="backdropClick" data-arg="confirm">
      <div class="dialog dialog-sm trap" role="alertdialog" aria-modal="true"
        aria-labelledby="${app.id}-confirm-title" aria-describedby="${app.id}-confirm-body">
        <h2 id="${app.id}-confirm-title">${dialog.title}</h2>
        <p id="${app.id}-confirm-body" class="muted">${dialog.body}</p>
        <div class="dialog-foot">
          ${actionButton('confirmCancel', dialog.cancelLabel || t('common.cancel'))}
          ${actionButton('confirmAccept', dialog.confirmLabel, { className: confirmClass })}
        </div>
      </div>
    </div>`;
}

/* ----------------------------- Main render ----------------------------- */

const TAB_SCREENS = {
  timer: timerScreen,
  tasks: tasksScreen,
  stats: statsScreen,
  shop: shopScreen,
  settings: settingsScreen,
};

function renderSignedInApp(app) {
  if (app.loadState === 'loading' || (!app.data && app.loadState !== 'error')) {
    return `
      <div class="app">
        ${appHeader(app, { minimal: true })}
        <div class="content center-col" role="status">${spinnerHtml(true)}<p class="muted">${t('load.loading')}</p></div>
        ${tabBar(app, { disabled: true })}
      </div>`;
  }

  if (app.loadState === 'error') {
    return `
      <div class="app">
        ${appHeader(app)}
        ${openPopover(app)}
        <div class="content center-col">
          <div class="state-icon danger">${icon('alert')}</div>
          <h2 style="font-size:17px">${t('load.err.title')}</h2>
          <p class="muted">${t('load.err.body')}</p>
          ${actionButton('retryLoad', t('sync.retry'), { className: 'btn btn-primary', icon: 'refresh' })}
        </div>
        ${tabBar(app, { disabled: true })}
      </div>`;
  }

  const onProfile = app.ui.screen === 'profile';
  const screenKey = onProfile ? 'profile' : app.ui.tab;
  const screenHtml = onProfile ? profileScreen(app) : TAB_SCREENS[app.ui.tab](app);
  const settingsBar = !onProfile && app.ui.tab === 'settings' ? unsavedSettingsBar(app) : '';
  let overlay = '';
  if (app.ui.openModal === 'taskForm') overlay = taskFormSheet(app);
  if (app.ui.openModal === 'taskPicker') overlay = taskPickerDialog(app);

  return `
    <div class="app">
      ${appHeader(app)}
      ${openPopover(app)}
      <main class="content" data-scroll-key="${screenKey}">${statusBanners(app)}${screenHtml}</main>
      ${settingsBar}
      ${tabBar(app)}
      ${overlay}
      ${app.ui.confirmDialog ? confirmDialog(app) : ''}
    </div>`;
}

/** Re-render the whole screen while keeping focus, cursor and scroll position. */
PomodoroApp.prototype.render = function render() {
  const focused = document.activeElement;
  let focusIdToKeep = null;
  let selection = null;
  if (!this.isStatic && focused && this.root.contains(focused) && focused.dataset) {
    focusIdToKeep = focused.dataset.focusId || null;
    try {
      selection = [focused.selectionStart, focused.selectionEnd];
    } catch (error) {
      /* element has no text selection */
    }
  }

  const oldContent = this.screenHost.querySelector('.content');
  const oldScrollKey = oldContent && oldContent.dataset.scrollKey;
  const oldScrollTop = oldContent ? oldContent.scrollTop : 0;

  this.screenHost.innerHTML = this.user ? renderSignedInApp(this) : renderAuthScreens(this);
  this.root.style.setProperty('--mode', `var(--mode-${this.timer.mode})`);

  // Restore scroll on the same screen, or jump to a requested section.
  const content = this.screenHost.querySelector('.content');
  if (content && oldScrollKey && content.dataset.scrollKey === oldScrollKey) content.scrollTop = oldScrollTop;
  if (this.ui.scrollToSelector && content) {
    const target = this.screenHost.querySelector(this.ui.scrollToSelector);
    if (target) content.scrollTop = target.offsetTop - 8;
    if (!this.isStatic) this.ui.scrollToSelector = null;
  }
  if (this.isStatic) return;

  // Restore focus: an explicitly requested element wins, otherwise the element that had focus.
  const requestedFocusId = this.ui.focusAfterRender;
  this.ui.focusAfterRender = null;
  const focusId = requestedFocusId || focusIdToKeep;
  if (!focusId) return;
  const element = this.screenHost.querySelector(`[data-focus-id="${CSS.escape(focusId)}"]`);
  if (!element || element.disabled) return;
  element.focus({ preventScroll: !requestedFocusId });
  if (!requestedFocusId && selection && selection[0] != null) {
    try {
      element.setSelectionRange(selection[0], selection[1]);
    } catch (error) {
      /* not a text input */
    }
  }
};

/** Session-complete alert (top) and toasts (bottom). Rendered separately so they never wipe form input. */
PomodoroApp.prototype.renderToasts = function renderToasts() {
  let html = '';

  if (this.alert) {
    const alert = this.alert;
    const primary = alert.primaryLabel
      ? actionButton('alertPrimaryAction', alert.primaryLabel, { className: 'btn btn-mode btn-sm', icon: 'play' }) +
        actionButton('dismissAlert', t('alert.dismiss'), { className: 'btn btn-sm btn-ghost' })
      : actionButton('dismissAlert', t('alert.ok'), { className: 'btn btn-mode btn-sm', focusId: 'dismissAlert:ok' });
    html += `
      <div class="alert-card" role="alertdialog" aria-labelledby="${this.id}-alert-title" aria-describedby="${this.id}-alert-body">
        ${decoration('celebration')}
        <div class="alert-emoji" aria-hidden="true">${alert.emoji}</div>
        <div style="flex:1">
          <div class="alert-title" id="${this.id}-alert-title">${alert.title}</div>
          <div class="alert-text" id="${this.id}-alert-body">${alert.body}</div>
          <div class="alert-actions">${primary}</div>
        </div>
      </div>`;
  }

  if (this.toasts.length) {
    const toasts = this.toasts
      .map(
        (toast) => `
          <div class="toast" role="status">
            ${toast.emoji ? `<span aria-hidden="true">${toast.emoji}</span>` : ''}
            <span class="msg">${toast.message}</span>
            <button type="button" class="icon-btn" data-action="closeToast" data-arg="${toast.id}"
              aria-label="${t('common.close')}">${icon('x')}</button>
          </div>`
      )
      .join('');
    html += `<div class="toasts">${toasts}</div>`;
  }

  this.toastHost.innerHTML = html;
};
