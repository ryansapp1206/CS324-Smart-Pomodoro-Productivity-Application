/* =====================================================================
   SERVICE CONTEXT
   The timer and reminders read the signed-in user's settings from a copy
   in storage (STORAGE_KEYS.settings), written whenever settings load or
   save, so they never have to wait for the backend.
   The extension's background replaces two things here
   (src/extension/background.js):
     - setUiVisibility(): whether the app is on screen (popup or tab open
       and showing), instead of this page's document.hidden
     - onSettingsLoaded(): switch wording and sounds to the user's
       ecosystem, since the background has no screens doing it
   ===================================================================== */

import { storage, STORAGE_KEYS } from '../core/storage.js';
import { normalizeSettings } from '../data/model.js';
import { getCurrentUser } from '../data/index.js';

let settingsLoaded = () => {};
let uiVisible = () => typeof document !== 'undefined' && !document.hidden;

export function onSettingsLoaded(listener) {
  settingsLoaded = listener;
}

export function setUiVisibility(isVisible) {
  uiVisible = isVisible;
}

/** True while the user can see the app, so a notification isn't needed. */
export function isUiVisible() {
  return uiVisible();
}

export async function loadSettings() {
  const settings = normalizeSettings((await storage.get(STORAGE_KEYS.settings)) || {});
  settingsLoaded(settings);
  return settings;
}

export async function isSignedIn() {
  return Boolean(await getCurrentUser());
}
