/* =====================================================================
   SCREENS: LOG IN, REGISTER, FORGOT PASSWORD, RESET PASSWORD
   (requirements 1.1–1.5)
   ===================================================================== */

import { escapeHtml } from '../core/utils.js';
import { spinnerHtml, TOMATO_LOGO } from '../core/icons.js';
import { t, decoration } from '../core/theme-engine.js';
import * as data from '../data/index.js';
import { isValidEmail, PASSWORD_MIN, DISPLAY_NAME_MAX } from '../data/model.js';
import { signIn } from '../app/account.js';
import { actionButton, banner, errorMessage } from '../ui/components.js';

/* ------------------------------ Pieces ------------------------------ */

/**
 * A labelled input bound to app.ui.authForm[name].
 * options: { autocomplete, placeholder, isPassword, live, hint, afterError }
 */
function authField(app, labelKey, name, type, options = {}) {
  const id = `app-${name}`;
  const error = app.ui.errors[name];
  const value = app.ui.authForm[name] ?? '';
  const describedBy = [error ? `${id}-err` : '', options.hint ? `${id}-hint` : ''].filter(Boolean).join(' ');

  const input = `
    <input id="${id}" class="input${error ? ' invalid' : ''}" type="${type}" value="${escapeHtml(value)}"
      data-bind="authForm.${name}" data-focus-id="authForm.${name}"
      ${options.autocomplete ? `autocomplete="${options.autocomplete}"` : ''}
      ${options.placeholder ? `placeholder="${options.placeholder}"` : ''}
      ${options.live ? `data-live="${options.live}"` : ''}
      ${error ? 'aria-invalid="true"' : ''}
      ${describedBy ? `aria-describedby="${describedBy}"` : ''}>`;

  const showHideButton = actionButton('togglePasswordVisibility', '', {
    className: 'icon-btn',
    icon: app.ui.showPassword ? 'eyeOff' : 'eye',
    ariaLabel: app.ui.showPassword ? t('auth.hidePw') : t('auth.showPw'),
    focusId: 'togglePasswordVisibility:' + name,
    attributes: `aria-pressed="${app.ui.showPassword}"`,
  });
  const inputWithToggle = options.isPassword ? `<div class="pw-wrap">${input}${showHideButton}</div>` : input;
  const hint = options.hint
    ? `<div class="hint" id="${id}-hint" ${options.live === 'passwordHint' ? 'data-password-hint' : ''}>${options.hint}</div>`
    : '';

  return `
    <div class="field">
      <label for="${id}">${t(labelKey)}</label>
      ${inputWithToggle}
      ${errorMessage(id, error)}
      ${options.afterError || ''}
      ${hint}
    </div>`;
}

function submitButton(app, labelKey, busyLabelKey) {
  const label = app.ui.isBusy ? `${spinnerHtml()}<span>${t(busyLabelKey)}</span>` : t(labelKey);
  return `
    <button type="submit" class="btn btn-primary btn-block btn-tall"
      data-focus-id="submit-${app.ui.screen}" ${app.ui.isBusy ? 'disabled' : ''}>${label}</button>`;
}

function formErrorBanner(app) {
  const error = app.ui.errors.form;
  return error ? banner('danger', 'alert', error, { role: 'alert' }) : '';
}

const passwordType = (app) => (app.ui.showPassword ? 'text' : 'password');

function backToLoginLink() {
  return `<p class="auth-alt">${actionButton('goToAuthScreen', t('auth.back'), { arg: 'login', className: 'btn-link' })}</p>`;
}

function passwordHint(length) {
  if (!length) return t('auth.pwHint');
  return length >= PASSWORD_MIN ? t('auth.pwHintOk') : t('auth.pwHintCount', { n: length });
}

/* ------------------------------ Screens ------------------------------ */

function loginScreen(app) {
  const notice = app.ui.notice ? banner('success', 'check', app.ui.notice) : '';
  return `
    <form data-form="login" novalidate>
      <h1>${t('auth.login.title')}</h1>
      <p class="auth-sub">${t('auth.login.sub')}</p>
      ${notice}
      ${formErrorBanner(app)}
      ${authField(app, 'auth.email', 'email', 'email', { autocomplete: 'username' })}
      ${authField(app, 'auth.password', 'password', passwordType(app), { autocomplete: 'current-password', isPassword: true })}
      <div class="row-end">
        ${actionButton('goToAuthScreen', t('auth.forgotLink'), { arg: 'forgot', className: 'btn-link' })}
      </div>
      ${submitButton(app, 'auth.login.submit', 'auth.login.busy')}
      <p class="auth-alt">
        ${t('auth.noAccount')}
        ${actionButton('goToAuthScreen', t('auth.createLink'), { arg: 'register', className: 'btn-link' })}
      </p>
    </form>`;
}

function registerScreen(app) {
  const loginInsteadLink = app.ui.errors.emailTaken
    ? `<div>${actionButton('goToAuthScreen', t('auth.loginInstead'), { arg: 'login', className: 'btn-link' })}</div>`
    : '';
  return `
    <form data-form="register" novalidate>
      <h1>${t('auth.register.title')}</h1>
      <p class="auth-sub">${t('auth.register.sub')}</p>
      ${formErrorBanner(app)}
      ${authField(app, 'auth.displayName', 'name', 'text', { autocomplete: 'nickname', placeholder: t('auth.namePh') })}
      ${authField(app, 'auth.email', 'email', 'email', { autocomplete: 'email', afterError: loginInsteadLink })}
      ${authField(app, 'auth.password', 'password', passwordType(app), {
        autocomplete: 'new-password',
        isPassword: true,
        live: 'passwordHint',
        hint: passwordHint(app.ui.authForm.password.length),
      })}
      ${submitButton(app, 'auth.register.submit', 'auth.register.busy')}
      <p class="auth-alt">
        ${t('auth.haveAccount')}
        ${actionButton('goToAuthScreen', t('auth.loginLink'), { arg: 'login', className: 'btn-link' })}
      </p>
    </form>`;
}

function forgotPasswordScreen(app) {
  return `
    <form data-form="forgot" novalidate>
      <h1>${t('auth.forgot.title')}</h1>
      <p class="auth-sub">${t('auth.forgot.sub')}</p>
      ${formErrorBanner(app)}
      ${authField(app, 'auth.email', 'email', 'email', { autocomplete: 'email' })}
      ${submitButton(app, 'auth.forgot.submit', 'auth.forgot.busy')}
      ${backToLoginLink()}
    </form>`;
}

function resetPasswordScreen(app) {
  return `
    <form data-form="reset" novalidate>
      <h1>${t('auth.reset.title')}</h1>
      <p class="auth-sub">${t('auth.reset.sub', { email: app.ui.resetEmail })}</p>
      ${formErrorBanner(app)}
      ${authField(app, 'auth.reset.new', 'password', passwordType(app), {
        autocomplete: 'new-password',
        isPassword: true,
        hint: t('auth.pwHint'),
      })}
      ${authField(app, 'auth.reset.confirm', 'password2', passwordType(app), { autocomplete: 'new-password' })}
      ${submitButton(app, 'auth.reset.submit', 'auth.reset.busy')}
      ${backToLoginLink()}
    </form>`;
}

const AUTH_SCREENS = {
  login: loginScreen,
  register: registerScreen,
  forgot: forgotPasswordScreen,
  reset: resetPasswordScreen,
};

export function renderAuthScreens(app) {
  const screen = AUTH_SCREENS[app.ui.screen] || loginScreen;
  return `
    <div class="auth">
      <div class="auth-brand">
        ${TOMATO_LOGO}
        <div class="auth-name">${t('app.name')}</div>
        <div class="auth-tag">${t('app.tagline')}</div>
        ${decoration('header-accent')}
      </div>
      ${screen(app)}
    </div>`;
}

/* ------------------------------ Forms ------------------------------ */

/** Run a data call with the busy spinner on. Returns the result, or null after showing the error. */
async function withBusy(app, call, onError) {
  app.ui.isBusy = true;
  app.render();
  try {
    return await call();
  } catch (error) {
    onError(error);
    return null;
  } finally {
    app.ui.isBusy = false;
    app.render();
  }
}

export const forms = {
  async login(app) {
    const form = app.ui.authForm;
    app.ui.errors = {};
    app.ui.notice = null;
    if (!form.email.trim() || !form.password) {
      app.ui.errors.form = t('auth.err.empty');
      app.ui.focusAfterRender = 'authForm.email';
      return app.render();
    }
    const user = await withBusy(
      app,
      () => data.signIn(form.email, form.password),
      (error) => {
        app.ui.errors.form = error.message; // one message: never says which field was wrong
        form.password = '';
        app.ui.focusAfterRender = 'authForm.password';
      }
    );
    if (user) await signIn(app, user);
  },

  async register(app) {
    const form = app.ui.authForm;
    const errors = {};
    if (form.name.trim().length > DISPLAY_NAME_MAX) errors.name = t('auth.err.nameLong');
    if (!isValidEmail(form.email)) errors.email = t('auth.err.email');
    if (form.password.length < PASSWORD_MIN) errors.password = t('auth.err.pwShort');
    app.ui.errors = errors;
    if (Object.keys(errors).length) {
      app.ui.focusAfterRender = 'authForm.' + Object.keys(errors)[0];
      return app.render();
    }

    const user = await withBusy(
      app,
      () => data.signUp(form.email, form.password, form.name),
      (error) => {
        if (error.code === 'email-taken') {
          app.ui.errors = { email: error.message, emailTaken: true };
          app.ui.focusAfterRender = 'authForm.email';
        } else {
          app.ui.errors = { form: error.message };
        }
      }
    );
    if (user) await signIn(app, user);
  },

  async forgot(app) {
    const email = app.ui.authForm.email.trim().toLowerCase();
    app.ui.errors = {};
    if (!isValidEmail(email)) {
      app.ui.errors.email = t('auth.err.email');
      app.ui.focusAfterRender = 'authForm.email';
      return app.render();
    }
    let sent = false;
    await withBusy(
      app,
      async () => {
        await data.resetPassword(email);
        sent = true;
      },
      (error) => (app.ui.errors.form = error.message)
    );
    if (!sent) return;
    // Accounts live on this device, so the new password is chosen right here.
    Object.assign(app.ui, { resetEmail: email, screen: 'reset', errors: {} });
    app.ui.authForm.password = '';
    app.ui.authForm.password2 = '';
    app.ui.focusAfterRender = 'authForm.password';
    app.render();
  },

  async reset(app) {
    const form = app.ui.authForm;
    const errors = {};
    if (form.password.length < PASSWORD_MIN) errors.password = t('auth.err.pwShort');
    else if (form.password !== form.password2) errors.password2 = t('auth.err.pwMatch');
    app.ui.errors = errors;
    if (Object.keys(errors).length) {
      app.ui.focusAfterRender = 'authForm.' + Object.keys(errors)[0];
      return app.render();
    }

    let done = false;
    await withBusy(
      app,
      async () => {
        await data.confirmPasswordReset(app.ui.resetEmail, form.password);
        done = true;
      },
      (error) => (app.ui.errors.form = error.message)
    );
    if (!done) return;
    app.ui.screen = 'login';
    app.ui.authForm = { email: app.ui.resetEmail, password: '', password2: '', name: '' };
    app.ui.notice = t('auth.reset.done');
    app.ui.focusAfterRender = 'authForm.password';
    app.render();
  },
};

/* ------------------------------ Actions ------------------------------ */

export const actions = {
  goToAuthScreen(app, screen) {
    Object.assign(app.ui, { screen, errors: {}, notice: null, showPassword: false });
    app.ui.focusAfterRender = screen === 'register' ? 'authForm.name' : 'authForm.email';
    app.render();
  },
  togglePasswordVisibility(app) {
    app.ui.showPassword = !app.ui.showPassword;
    app.render();
  },
};

export const liveUpdates = {
  passwordHint(app, value) {
    const hint = app.screenHost.querySelector('[data-password-hint]');
    if (hint) hint.textContent = passwordHint(value.length);
  },
};
