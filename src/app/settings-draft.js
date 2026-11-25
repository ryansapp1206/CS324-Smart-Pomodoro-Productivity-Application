/* =====================================================================
   SETTINGS DRAFT
   The Settings tab edits a copy (app.ui.settingsDraft). Nothing is saved
   until Save; Cancel throws the copy away. Durations are kept as text while
   typing so a half-typed number doesn't jump around.
   ===================================================================== */

import { t } from '../core/theme-engine.js';
import { DURATION_LIMITS } from '../data/model.js';

export const DURATION_LABEL_KEYS = { focus: 'set.focusMin', shortBreak: 'set.shortMin', longBreak: 'set.longMin' };

export function createSettingsDraft(settings) {
  const draft = structuredClone(settings);
  for (const key of Object.keys(DURATION_LIMITS)) draft.durations[key] = String(settings.durations[key]);
  return draft;
}

/** { focus?: message, shortBreak?: message, longBreak?: message } */
export function settingsErrors(draft) {
  const errors = {};
  if (!draft) return errors;
  for (const [key, [min, max]] of Object.entries(DURATION_LIMITS)) {
    const raw = String(draft.durations[key] ?? '').trim();
    const value = Number(raw);
    if (raw === '' || !Number.isInteger(value) || value < min || value > max) {
      errors[key] = t('set.err.range', { label: t(DURATION_LABEL_KEYS[key]), min, max });
    }
  }
  return errors;
}

/** The draft as real settings. The task sort is saved from the Tasks screen, so it keeps the current value. */
export function draftToSettings(draft, current) {
  const settings = structuredClone(draft);
  for (const key of Object.keys(DURATION_LIMITS)) settings.durations[key] = Number(draft.durations[key]);
  settings.taskSort = current.taskSort;
  return settings;
}

export function hasUnsavedSettings(app) {
  const draft = app.ui.settingsDraft;
  if (!draft) return false;
  const comparable = (settings) => {
    const copy = structuredClone(settings);
    for (const key of Object.keys(DURATION_LIMITS)) copy.durations[key] = String(copy.durations[key]);
    delete copy.taskSort;
    return JSON.stringify(copy);
  };
  return comparable(draft) !== comparable(app.settings());
}
