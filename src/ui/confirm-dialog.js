/* =====================================================================
   CONFIRM DIALOG
   Opened with app.askConfirm({ title, body, confirmLabel, cancelLabel?, danger?, onConfirm }).
   ===================================================================== */

import { t } from '../core/theme-engine.js';
import { actionButton } from './components.js';

export function confirmDialog(app) {
  const dialog = app.ui.confirmDialog;
  const confirmClass = dialog.danger ? 'btn btn-danger' : 'btn btn-primary';
  return `
    <div class="backdrop top" data-action="backdropClick" data-arg="confirm">
      <div class="dialog dialog-sm trap" role="alertdialog" aria-modal="true"
        aria-labelledby="confirm-title" aria-describedby="confirm-body">
        <h2 id="confirm-title">${dialog.title}</h2>
        <p id="confirm-body" class="muted">${dialog.body}</p>
        <div class="dialog-foot">
          ${actionButton('confirmCancel', dialog.cancelLabel || t('common.cancel'))}
          ${actionButton('confirmAccept', dialog.confirmLabel, { className: confirmClass })}
        </div>
      </div>
    </div>`;
}

export const actions = {
  confirmAccept(app) {
    const dialog = app.ui.confirmDialog;
    app.ui.confirmDialog = null;
    dialog.onConfirm();
  },
  confirmCancel(app) {
    const dialog = app.ui.confirmDialog;
    app.ui.confirmDialog = null;
    app.ui.focusAfterRender = dialog && dialog.returnFocusId;
    app.render();
  },
  /** A click on the dim background (not inside the dialog) closes it. */
  backdropClick(app, which, element, event) {
    if (event.target !== element) return;
    if (which === 'confirm') actions.confirmCancel(app);
    else app.closeModal();
  },
};
