/* =====================================================================
   RENDERING
   Rebuilds the screen from state, then restores keyboard focus, the text
   cursor and the scroll position so it feels like nothing was replaced.
   The session alert and toasts are drawn separately so they never wipe
   what you're typing.
   ===================================================================== */

import { t, decoration } from '../core/theme-engine.js';
import { renderAuthScreens } from '../screens/auth.js';
import { renderSignedIn } from '../screens/shell.js';
import { actionButton } from '../ui/components.js';
import { icon } from '../core/icons.js';
import { updateTabTitle } from '../services/notify.js';

export function renderApp(app) {
  const focused = document.activeElement;
  let focusIdToKeep = null;
  let selection = null;
  if (focused && app.root.contains(focused) && focused.dataset) {
    focusIdToKeep = focused.dataset.focusId || null;
    try {
      selection = [focused.selectionStart, focused.selectionEnd];
    } catch {
      /* element has no text selection */
    }
  }

  const oldContent = app.screenHost.querySelector('.content');
  const oldScrollKey = oldContent && oldContent.dataset.scrollKey;
  const oldScrollTop = oldContent ? oldContent.scrollTop : 0;

  app.screenHost.innerHTML = app.user ? renderSignedIn(app) : renderAuthScreens(app);
  app.root.style.setProperty('--mode', `var(--mode-${app.timer.mode})`);
  updateTabTitle(app.timer, app.settings()); // the app name can change with the theme

  const content = app.screenHost.querySelector('.content');
  if (content && oldScrollKey && content.dataset.scrollKey === oldScrollKey) content.scrollTop = oldScrollTop;

  // An explicitly requested element wins, otherwise the element that had focus.
  const requestedFocusId = app.ui.focusAfterRender;
  app.ui.focusAfterRender = null;
  const focusId = requestedFocusId || focusIdToKeep;
  if (!focusId) return;
  const element = app.screenHost.querySelector(`[data-focus-id="${CSS.escape(focusId)}"]`);
  if (!element || element.disabled) return;
  element.focus({ preventScroll: !requestedFocusId });
  if (!requestedFocusId && selection && selection[0] != null) {
    try {
      element.setSelectionRange(selection[0], selection[1]);
    } catch {
      /* not a text input */
    }
  }
}

/** Session-complete card (top) and toasts (bottom). */
export function renderToasts(app) {
  let html = '';

  if (app.alert) {
    const alert = app.alert;
    const buttons = alert.primaryLabel
      ? actionButton('alertPrimaryAction', alert.primaryLabel, { className: 'btn btn-mode btn-sm', icon: 'play' }) +
        actionButton('dismissAlert', t('alert.dismiss'), { className: 'btn btn-sm btn-ghost' })
      : actionButton('dismissAlert', t('alert.ok'), { className: 'btn btn-mode btn-sm', focusId: 'dismissAlert:ok' });
    html += `
      <div class="alert-card" role="alertdialog" aria-labelledby="alert-title" aria-describedby="alert-body">
        ${alert.celebrate ? decoration('celebration') : ''}
        <div class="alert-icon" aria-hidden="true">${icon(alert.icon)}</div>
        <div style="flex:1">
          <div class="alert-title" id="alert-title">${alert.title}</div>
          <div class="alert-text" id="alert-body">${alert.body}</div>
          <div class="alert-actions">${buttons}</div>
        </div>
      </div>`;
  }

  if (app.toasts.length) {
    const toasts = app.toasts
      .map(
        (toast) => `
          <div class="toast" role="status">
            ${toast.iconName ? `<span class="toast-icon" aria-hidden="true">${icon(toast.iconName)}</span>` : ''}
            <span class="msg">${toast.message}</span>
            <button type="button" class="icon-btn" data-action="closeToast" data-arg="${toast.id}"
              aria-label="${t('common.close')}">${icon('x')}</button>
          </div>`
      )
      .join('');
    html += `<div class="toasts">${toasts}</div>`;
  }

  app.toastHost.innerHTML = html;
}
