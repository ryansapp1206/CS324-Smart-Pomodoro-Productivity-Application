/* =====================================================================
   SCREENS: LOG IN, REGISTER, FORGOT PASSWORD, RESET PASSWORD
   ===================================================================== */

/**
 * A labelled input bound to app.ui.authForm[name].
 * options: { autocomplete, placeholder, isPassword, live, hint, afterError }
 */
function authField(app, labelKey, name, type, options = {}) {
  const id = `${app.id}-${name}`;
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

function authSubmitButton(app, labelKey, busyLabelKey) {
  const label = app.ui.isBusy ? `${spinnerHtml()}<span>${t(busyLabelKey)}</span>` : t(labelKey);
  return `
    <button type="submit" class="btn btn-primary btn-block btn-tall"
      data-focus-id="submit-${app.ui.screen}" ${app.ui.isBusy ? 'disabled' : ''}>${label}</button>`;
}

function formErrorBanner(app) {
  const error = app.ui.errors.form;
  return error ? banner('danger', 'alert', error, { role: 'alert' }) : '';
}

function passwordType(app) {
  return app.ui.showPassword ? 'text' : 'password';
}

function backToLoginLink() {
  return `<p class="auth-alt">${actionButton('goToAuthScreen', t('auth.back'), { arg: 'login', className: 'btn-link' })}</p>`;
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
      ${authSubmitButton(app, 'auth.login.submit', 'auth.login.busy')}
      <p class="auth-alt">
        ${t('auth.noAccount')}
        ${actionButton('goToAuthScreen', t('auth.createLink'), { arg: 'register', className: 'btn-link' })}
      </p>
      <div class="demo-hint">
        ${icon('info')}
        <div>
          <div>${t('auth.demoHint')}</div>
          ${actionButton('fillDemoAccount', t('auth.useDemo'), { className: 'btn-link' })}
        </div>
      </div>
    </form>`;
}

function registerScreen(app) {
  const passwordLength = app.ui.authForm.password.length;
  let passwordHint = t('auth.pwHint');
  if (passwordLength)
    passwordHint = passwordLength >= 8 ? t('auth.pwHintOk') : t('auth.pwHintCount', { n: passwordLength });

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
        hint: passwordHint,
      })}
      ${authSubmitButton(app, 'auth.register.submit', 'auth.register.busy')}
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
      ${authSubmitButton(app, 'auth.forgot.submit', 'auth.forgot.busy')}
      ${backToLoginLink()}
    </form>`;
}

/** "Check your email". The demo button stands in for clicking the emailed link. */
function resetLinkSentScreen(app) {
  const demoLink = app.ui.resetAccountExists
    ? `${actionButton('openResetLink', t('auth.sent.demo'), { className: 'btn btn-primary btn-block btn-tall' })}
       <p class="hint">${t('auth.sent.demoNote')}</p>`
    : `<p class="hint">${t('auth.sent.noAccount')}</p>`;
  return `
    <div class="center-col" style="padding-top:6px">
      <div class="state-icon ok">${icon('check')}</div>
      <h1>${t('auth.sent.title')}</h1>
      <p class="auth-sub">${t('auth.sent.body', { email: app.ui.resetEmail })}</p>
      ${demoLink}
      ${backToLoginLink()}
    </div>`;
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
      ${authSubmitButton(app, 'auth.reset.submit', 'auth.reset.busy')}
      ${backToLoginLink()}
    </form>`;
}

const AUTH_SCREENS = {
  login: loginScreen,
  register: registerScreen,
  forgot: forgotPasswordScreen,
  sent: resetLinkSentScreen,
  reset: resetPasswordScreen,
};

function renderAuthScreens(app) {
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
