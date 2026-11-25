/* =====================================================================
   SCREEN: SETTINGS   (requirements 2.7, 5.x)
   Timer lengths, alerts and reminders, theme, sync and account. Edits go
   into a draft (src/app/settings-draft.js) and are saved with the
   "Unsaved changes · Cancel / Save" bar.
   ===================================================================== */

import { escapeHtml } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { t, applyTheme, applyReducedMotion, builtThemes } from '../core/theme-engine.js';
import * as data from '../data/index.js';
import { DURATION_LIMITS } from '../data/model.js';
import { equippedId, findShopItem, ownsItem } from '../shop/catalog.js';
import { saveChange } from '../app/saving.js';
import { applyAppearance, shareSettings } from '../app/account.js';
import {
  DURATION_LABEL_KEYS,
  createSettingsDraft,
  draftToSettings,
  hasUnsavedSettings,
  settingsErrors,
} from '../app/settings-draft.js';
import { requestNotificationPermission } from '../services/index.js';
import { actionButton, lastSyncedText, swatchHtml, switchRow } from '../ui/components.js';

const THEME_SWATCH_TOKENS = ['bg', 'surface', 'mode-focus', 'mode-short', 'mode-long'];

/* ------------------------------ Pieces ------------------------------ */

function durationRow(app, key, errors) {
  const id = `app-duration-${key}`;
  const [min, max] = DURATION_LIMITS[key];
  const label = t(DURATION_LABEL_KEYS[key]);
  const error = errors[key];
  const stepButton = (step, iconName, ariaKey) =>
    actionButton('stepDuration', '', { arg: `${key}:${step}`, className: 'icon-btn', icon: iconName, ariaLabel: t(ariaKey, { label }) });

  return `
    <div class="dur-row">
      <div class="dur-line">
        <label for="${id}">${label}</label>
        <div class="stepper">
          ${stepButton(-1, 'minus', 'set.decrease')}
          <input id="${id}" class="input num${error ? ' invalid' : ''}" type="number" inputmode="numeric"
            min="${min}" max="${max}" step="1" value="${escapeHtml(app.ui.settingsDraft.durations[key])}"
            data-bind="settingsDraft.durations.${key}" data-live="settings" data-focus-id="settingsDraft.durations.${key}"
            ${error ? `aria-invalid="true" aria-describedby="${id}-err"` : ''}>
          ${stepButton(1, 'plus', 'set.increase')}
          <span class="unit">${t('set.minutes')}</span>
        </div>
      </div>
      <div class="err" id="${id}-err" data-error-for="${key}" ${error ? '' : 'hidden'}>
        ${error ? `${icon('alert')}<span>${error}</span>` : ''}
      </div>
    </div>`;
}

function themeCard(theme, isSelected) {
  const colors = THEME_SWATCH_TOKENS.map((token) => theme.tokens[token]);
  return `
    <button type="button" class="theme-card${isSelected ? ' on' : ''}" data-action="chooseTheme" data-arg="${theme.id}"
      data-focus-id="chooseTheme:${theme.id}" aria-pressed="${isSelected}">
      ${swatchHtml(colors)}
      <span class="tc-name">${escapeHtml(theme.name)}</span>
      <span class="tc-desc">${escapeHtml(theme.description)}</span>
    </button>`;
}

function dailyReminderTime(draft) {
  if (!draft.dailyReminder.enabled) return '';
  return `
    <div class="time-row">
      <label for="app-daily-time" class="small" style="font-weight:600">${t('set.dailyTime')}</label>
      <input id="app-daily-time" type="time" class="input" style="width:130px;min-height:36px"
        value="${escapeHtml(draft.dailyReminder.time)}"
        data-bind="settingsDraft.dailyReminder.time" data-live="settings" data-focus-id="settingsDraft.dailyReminder.time">
    </div>`;
}

/* ------------------------------ Screen ------------------------------ */

export function settingsScreen(app) {
  if (!app.ui.settingsDraft) app.ui.settingsDraft = createSettingsDraft(app.settings());
  const draft = app.ui.settingsDraft;
  const errors = settingsErrors(draft);

  const themeCards = builtThemes()
    .filter((theme) => ownsItem(app.data.purchases, 'theme', theme.id))
    .map((theme) => themeCard(theme, equippedId(draft, 'theme') === theme.id))
    .join('');
  const soundPack = findShopItem('sound', equippedId(app.settings(), 'sound'));
  const backendName = data.backendKind === 'mock' ? t('set.backendMock') : data.backendKind;

  return `
    <div class="sec-label">${t('set.timer')}</div>
    <section class="card">
      ${durationRow(app, 'focus', errors)}
      ${durationRow(app, 'shortBreak', errors)}
      ${durationRow(app, 'longBreak', errors)}
      <div class="info-line">${icon('info')}<span>${t('set.longEvery')} ${t('set.applyNote')}</span></div>
      ${switchRow(app, 'settingsDraft.autoStart', 'set.autoStart', 'set.autoStartSub')}
    </section>

    <div class="sec-label">${t('set.notif')}</div>
    <section class="card">
      ${switchRow(app, 'settingsDraft.alertSound', 'set.alertSound', 'set.alertSoundSub')}
      <div class="sw-row">
        <div class="sw-txt">
          <div style="font-weight:600">${t('set.soundPack')}</div>
          <div class="sub">${t('set.soundPackSub', { name: soundPack.name })}</div>
        </div>
        ${actionButton('openShop', t('set.changeInShop'), { arg: 'sound', className: 'btn btn-sm', focusId: 'openShop:sound' })}
      </div>
      ${switchRow(app, 'settingsDraft.sessionAlerts', 'set.sessionAlerts', 'set.sessionAlertsSub')}
      ${switchRow(app, 'settingsDraft.breakAlerts', 'set.breakAlerts', 'set.breakAlertsSub')}
      ${switchRow(app, 'settingsDraft.deadlineReminders', 'set.deadline', 'set.deadlineSub')}
      ${switchRow(app, 'settingsDraft.dailyReminder.enabled', 'set.daily', 'set.dailySub')}
      ${dailyReminderTime(draft)}
    </section>

    <div class="sec-label">${t('set.appearance')}</div>
    <section class="card">
      <div class="small" style="font-weight:600;margin-bottom:8px" id="theme-label">${t('set.theme')}</div>
      <div class="theme-grid" role="group" aria-labelledby="theme-label">${themeCards}</div>
      <div style="margin:2px 0 4px">
        ${actionButton('openShop', t('currency.moreThemes'), { arg: 'theme', className: 'btn-link', focusId: 'openShop:settings' })}
      </div>
      ${switchRow(app, 'settingsDraft.reduceMotion', 'set.reduceMotion', 'set.reduceMotionSub')}
    </section>

    <div class="sec-label">${t('set.sync')}</div>
    <section class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div>
          <div style="font-weight:600">${t('sync.' + app.syncState)}</div>
          <div class="small muted">${lastSyncedText(app)}</div>
          <div class="small muted">${t('set.backend')}: ${backendName}</div>
        </div>
        ${actionButton('syncNow', t('sync.now'), { className: 'btn btn-sm', icon: 'refresh', focusId: 'syncNow:settings', disabled: app.syncState === 'syncing' })}
      </div>
    </section>

    <div class="sec-label">${t('set.account')}</div>
    <section class="card" style="display:flex;flex-direction:column;gap:8px">
      ${actionButton('openProfile', `${t('set.profile')} · <span class="muted" style="font-weight:500">${t('set.profileSub')}</span>`, {
        className: 'btn btn-block',
        icon: 'user',
        focusId: 'openProfile:settings',
      })}
      ${actionButton('logout', t('set.logout'), { className: 'btn btn-block btn-danger-outline', icon: 'logout', focusId: 'logout:settings' })}
    </section>`;
}

/** Sticky "Unsaved changes · Cancel / Save" bar under the Settings tab. */
export function unsavedSettingsBar(app) {
  const isDirty = hasUnsavedSettings(app);
  const hasErrors = Object.keys(settingsErrors(app.ui.settingsDraft)).length > 0;
  return `
    <div class="sbar" data-settings-bar ${isDirty ? '' : 'hidden'} role="region" aria-label="${t('set.unsaved')}">
      <span>${icon('alert')}${t('set.unsaved')}</span>
      <div>
        ${actionButton('cancelSettings', t('set.cancel'), { className: 'btn btn-sm' })}
        ${actionButton('saveSettings', t('set.save'), { className: 'btn btn-primary btn-sm', disabled: hasErrors })}
      </div>
    </div>`;
}

/* ------------------------------ Actions ------------------------------ */

export const actions = {
  chooseTheme(app, themeId) {
    app.ui.settingsDraft.theme = themeId;
    applyTheme(themeId); // live preview; undone on Cancel
    app.ui.focusAfterRender = 'chooseTheme:' + themeId;
    app.render();
  },

  /** Stepper buttons next to the duration inputs. arg = 'focus:1' or 'focus:-1'. */
  stepDuration(app, arg) {
    const [key, step] = arg.split(':');
    const [min, max] = DURATION_LIMITS[key];
    const current = parseInt(app.ui.settingsDraft.durations[key], 10);
    const base = Number.isNaN(current) ? app.settings().durations[key] : current;
    app.ui.settingsDraft.durations[key] = String(Math.min(max, Math.max(min, base + Number(step))));
    app.render();
  },

  async saveSettings(app) {
    if (Object.keys(settingsErrors(app.ui.settingsDraft)).length) return;
    const previous = app.settings();
    const settings = draftToSettings(app.ui.settingsDraft, previous);
    if (settings.deadlineReminders || settings.dailyReminder.enabled) requestNotificationPermission();
    app.ui.focusAfterRender = 'tab:settings';

    const result = await saveChange(app, {
      apply: () => (app.data.settings = settings),
      revert: () => (app.data.settings = previous),
      remote: async () => {
        app.data.settings = await data.saveSettings(settings);
        await shareSettings(app.data.settings); // the timer and reminders use the new values
      },
    });
    if (!result.ok) return;
    app.ui.settingsDraft = createSettingsDraft(app.settings());
    applyAppearance(app);
    app.toast(t('set.saved'), 'success');
    app.render();
  },

  cancelSettings(app) {
    app.ui.settingsDraft = createSettingsDraft(app.settings());
    applyAppearance(app);
    app.ui.focusAfterRender = 'tab:settings';
    app.render();
  },
};

/** Update duration errors and the Save bar while typing, without re-rendering (keeps the cursor). */
function refreshSettingsFeedback(app) {
  const errors = settingsErrors(app.ui.settingsDraft);
  for (const key of Object.keys(DURATION_LIMITS)) {
    const input = app.screenHost.querySelector(`[data-focus-id="settingsDraft.durations.${key}"]`);
    const errorSlot = app.screenHost.querySelector(`[data-error-for="${key}"]`);
    if (!input || !errorSlot) continue;

    input.classList.toggle('invalid', Boolean(errors[key]));
    if (errors[key]) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', errorSlot.id);
      errorSlot.innerHTML = `${icon('alert')}<span>${errors[key]}</span>`;
      errorSlot.hidden = false;
    } else {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
      errorSlot.innerHTML = '';
      errorSlot.hidden = true;
    }
  }
  const bar = app.screenHost.querySelector('[data-settings-bar]');
  if (bar) bar.outerHTML = unsavedSettingsBar(app);
}

export const liveUpdates = {
  settings: refreshSettingsFeedback,
  /** Switches: reduce motion previews straight away; others show or hide fields. */
  render(app, value, input) {
    if (input.dataset.bind === 'settingsDraft.reduceMotion') applyReducedMotion(value);
    app.render();
  },
};
