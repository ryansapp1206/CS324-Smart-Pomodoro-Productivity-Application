/* =====================================================================
   SCREEN: PROFILE   (requirement 1.6)
   Display name, email, member-since date and the profile picture.
   ===================================================================== */

import { escapeHtml, formatDate } from '../core/utils.js';
import { spinnerHtml } from '../core/icons.js';
import { t } from '../core/theme-engine.js';
import * as data from '../data/index.js';
import { DISPLAY_NAME_MAX } from '../data/model.js';
import { actionButton, avatarHtml, errorMessage } from '../ui/components.js';

export function profileScreen(app) {
  if (!app.ui.profileForm) app.ui.profileForm = { displayName: app.user.displayName, error: null, isBusy: false };
  const form = app.ui.profileForm;
  const id = 'profile-name';
  const memberSince = formatDate(app.user.createdAt, { month: 'long', year: 'numeric' });
  const saveLabel = form.isBusy ? `${spinnerHtml()}<span>${t('profile.saving')}</span>` : t('profile.save');

  return `
    <div class="sub-hdr">
      ${actionButton('goBack', t('profile.back'), { className: 'btn btn-ghost btn-sm', icon: 'chevronLeft' })}
      <h1>${t('profile.title')}</h1>
    </div>

    <section class="card profile-card">
      ${avatarHtml(app.user, app.settings().avatar, 'avatar-lg')}
      <div>
        <div class="p-name">${escapeHtml(app.user.displayName)}</div>
        <div class="small muted">${escapeHtml(app.user.email)}</div>
        <div class="small muted">${t('profile.since', { date: memberSince })}</div>
        ${actionButton('openShop', t('profile.changeAvatar'), { arg: 'avatar', className: 'btn-link', focusId: 'openShop:avatar' })}
      </div>
    </section>

    <form class="card" data-form="profile" novalidate>
      <div class="field">
        <label for="${id}">${t('profile.name')}</label>
        <input id="${id}" class="input${form.error ? ' invalid' : ''}" maxlength="${DISPLAY_NAME_MAX}" value="${escapeHtml(form.displayName)}"
          data-bind="profileForm.displayName" data-focus-id="profileForm.displayName"
          ${form.error ? `aria-invalid="true" aria-describedby="${id}-err"` : ''}>
        ${errorMessage(id, form.error)}
      </div>
      <div class="field">
        <label for="${id}-email">${t('profile.email')}</label>
        <input id="${id}-email" class="input" value="${escapeHtml(app.user.email)}" readonly aria-describedby="${id}-email-note">
        <div class="hint" id="${id}-email-note">${t('profile.emailNote')}</div>
      </div>
      <button type="submit" class="btn btn-primary" data-focus-id="submit-profile" ${form.isBusy ? 'disabled' : ''}>${saveLabel}</button>
    </form>

    <section class="card">
      ${actionButton('logout', t('profile.logout'), { className: 'btn btn-block btn-danger-outline', icon: 'logout', focusId: 'logout:profile' })}
    </section>`;
}

export const forms = {
  async profile(app) {
    const form = app.ui.profileForm;
    const name = form.displayName.trim();
    form.error = null;
    if (!name || name.length > DISPLAY_NAME_MAX) {
      form.error = t('profile.err.name');
      app.ui.focusAfterRender = 'profileForm.displayName';
      return app.render();
    }

    form.isBusy = true;
    app.render();
    try {
      app.user = await data.updateProfile({ displayName: name });
      form.displayName = app.user.displayName;
      app.toast(t('profile.saved'), 'success');
    } catch (error) {
      form.error = error.message; // keep the typed name so Save can be pressed again
    }
    form.isBusy = false;
    app.render();
  },
};

export const actions = {
  goBack(app) {
    app.navigate(app.ui.previousTab || 'timer');
  },
};
