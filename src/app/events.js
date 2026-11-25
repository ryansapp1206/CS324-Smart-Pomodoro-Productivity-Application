/* =====================================================================
   EVENTS: clicks, typing and keyboard
   - Buttons with data-action="name" run ACTIONS.name(app, arg, element, event)
   - Inputs with data-bind="path.in.ui" write their value into app.ui
   - Inputs with data-live="name" also run LIVE_UPDATES.name(app, value, input)
   - Forms with data-form="name" run FORMS.name(app) on submit or Enter
   ACTIONS, FORMS and LIVE_UPDATES are collected from the screens in
   src/screens/index.js.
   ===================================================================== */

import { setByPath } from '../core/utils.js';
import { unlockAudio } from '../audio/player.js';
import { ACTIONS, FORMS, LIVE_UPDATES } from '../screens/index.js';

export function attachEventHandlers(app) {
  const root = app.root;

  root.addEventListener('click', (event) => {
    unlockAudio();
    const button = event.target.closest('[data-action]');

    // Clicking outside an open popover or task menu closes it.
    if (app.ui.openPopover && !event.target.closest('.popover') && button?.dataset.action !== 'togglePopover') {
      app.ui.openPopover = null;
      if (!button) return app.render();
    }
    if (app.ui.openMenuTaskId && !event.target.closest('.menu') && button?.dataset.action !== 'toggleTaskMenu') {
      app.ui.openMenuTaskId = null;
      if (!button) return app.render();
    }

    // Submit buttons run their form's handler directly.
    const submitButton = event.target.closest('button[type=submit]');
    if (submitButton) {
      event.preventDefault();
      const form = submitButton.closest('form[data-form]');
      if (!submitButton.disabled && form) FORMS[form.dataset.form]?.(app);
      return;
    }

    if (!button || button.disabled) return;
    const handler = ACTIONS[button.dataset.action];
    if (!handler) return console.warn('[actions] no action named', button.dataset.action);
    event.preventDefault();
    handler(app, button.dataset.arg, button, event);
  });

  root.addEventListener('submit', (event) => event.preventDefault());
  // Selects report on change; everything else on every keystroke.
  root.addEventListener('input', (event) => {
    if (event.target.tagName !== 'SELECT') handleInput(app, event.target);
  });
  root.addEventListener('change', (event) => {
    if (event.target.tagName === 'SELECT') handleInput(app, event.target);
  });

  root.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') handleEnterKey(app, event);
    else if (event.key === 'Escape') handleEscapeKey(app, event);
    else if (event.key === 'Tab') trapFocusInDialog(app, event);
  });
}

/** Write an input's value into UI state, then refresh only what needs it. */
function handleInput(app, input) {
  const value = input.type === 'checkbox' ? input.checked : input.value;
  if (input.dataset.bind) setByPath(app.ui, input.dataset.bind, value);
  const live = LIVE_UPDATES[input.dataset.live];
  if (live) live(app, value, input);
}

function handleEnterKey(app, event) {
  const isTextInput = event.target.matches('input:not([type=checkbox]):not([type=button])');
  const form = event.target.closest('form[data-form]');
  if (!isTextInput || !form) return;
  event.preventDefault();
  const submitButton = form.querySelector('button[type=submit]');
  if (submitButton && !submitButton.disabled) FORMS[form.dataset.form](app);
}

/** Escape closes the top-most layer: confirm dialog → modal → menu → popover → alert. */
function handleEscapeKey(app, event) {
  const ui = app.ui;
  if (ui.confirmDialog) ACTIONS.confirmCancel(app);
  else if (ui.openModal) ACTIONS.closeModal(app);
  else if (ui.openMenuTaskId) {
    ui.focusAfterRender = 'toggleTaskMenu:' + ui.openMenuTaskId;
    ui.openMenuTaskId = null;
    app.render();
  } else if (ui.openPopover) {
    ui.focusAfterRender = 'togglePopover:' + ui.openPopover;
    ui.openPopover = null;
    app.render();
  } else if (app.alert) ACTIONS.dismissAlert(app);
  else return;
  event.preventDefault();
}

/** Keep Tab / Shift+Tab inside the open dialog. */
function trapFocusInDialog(app, event) {
  const dialogs = app.screenHost.querySelectorAll('.trap');
  const topDialog = dialogs[dialogs.length - 1];
  if (!topDialog) return;

  const focusable = [
    ...topDialog.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea, select, [tabindex="0"]'),
  ];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (!topDialog.contains(document.activeElement)) {
    event.preventDefault();
    first.focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
