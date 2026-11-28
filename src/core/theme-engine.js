/* =====================================================================
   THEME ENGINE
   Two levels:
     - the MODE picks an ecosystem from src/content/ (professional or
       brainrot): its themes, sound packs, profile pictures, wording and
       currency name
     - the THEME is one of that ecosystem's themes
   Components never hard-code colors, fonts or text. They read:
     - CSS variables (var(--primary), …) set from theme.tokens; themes
       marked `accentable` take primary / on-primary / mode-focus from
       the user's button color (setAccent)
     - text from t(key): theme.copy, then the ecosystem's copy, then BASE_COPY
     - the currency name: {currency} / {Currency} in any text
     - optional decorations from decoration(slot)
   The content format is documented in src/content/README.md.
   ===================================================================== */

import { BASE_COPY } from './copy.js';
import { escapeHtml } from './utils.js';
import { ALL_THEMES, DEFAULT_MODE, getEcosystem } from '../content/index.js';
import { DEFAULT_ACCENT, findAccent } from '../content/shared.js';

let currentMode = DEFAULT_MODE;
let currentThemeId = getEcosystem(DEFAULT_MODE).defaults.theme;
let currentAccent = DEFAULT_ACCENT;

/* ------------------------------ Mode ------------------------------ */

/** Switch ecosystem: 'professional' | 'brainrot'. Call applyTheme() afterwards. */
export function setMode(mode) {
  currentMode = getEcosystem(mode).id;
}

export function activeMode() {
  return currentMode;
}

/** The active ecosystem: { id, currency, copy, defaults, themes, sounds, avatars }. */
export function activeEcosystem() {
  return getEcosystem(currentMode);
}

/** The shared currency's name in the active ecosystem: { name: 'points', title: 'Points' }. */
export function currency() {
  return activeEcosystem().currency;
}

/* ------------------------------ Accent ------------------------------ */

/** Pick the button color (an id from ACCENTS in src/content/shared.js). Call applyTheme() afterwards. */
export function setAccent(accentId) {
  currentAccent = findAccent(accentId).id;
}

export function activeAccentId() {
  return currentAccent;
}

/** True when the active theme lets the user pick its button color. */
export function themeHasAccent() {
  return Boolean(activeTheme().accentable);
}

/* ------------------------------ Themes ------------------------------ */

export function getTheme(id) {
  return ALL_THEMES[id];
}

export function activeTheme() {
  return ALL_THEMES[currentThemeId];
}

export function activeThemeId() {
  return currentThemeId;
}

/** The active ecosystem's themes that are finished and can be equipped (not "coming soon"). */
export function builtThemes() {
  return activeEcosystem().themes.filter((theme) => !theme.comingSoon);
}

/** Switch the UI to a theme of the active ecosystem (its default if the id isn't one of them). */
export function applyTheme(themeId) {
  const themes = builtThemes();
  const theme = themes.find((candidate) => candidate.id === themeId) || getTheme(activeEcosystem().defaults.theme);
  currentThemeId = theme.id;
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  for (const [token, value] of Object.entries(theme.tokens)) root.style.setProperty('--' + token, value);
  if (theme.accentable) {
    const colors = findAccent(currentAccent)[theme.appearance === 'dark' ? 'dark' : 'light'];
    root.style.setProperty('--primary', colors.primary);
    root.style.setProperty('--on-primary', colors.on);
    root.style.setProperty('--mode-focus', colors.primary); // the Start / Pause buttons and focus ring
  }
  root.dataset.theme = theme.id;
  root.dataset.mode = currentMode;
  root.dataset.appearance = theme.appearance;

  let link = document.getElementById('theme-stylesheet');
  if (theme.stylesheet) {
    if (!link) {
      link = document.createElement('link');
      link.id = 'theme-stylesheet';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = theme.stylesheet;
  } else if (link) {
    link.remove();
  }
}

export function applyReducedMotion(isOn) {
  if (typeof document !== 'undefined') document.documentElement.dataset.reduceMotion = isOn ? 'true' : 'false';
}

/* ------------------------------ Text ------------------------------ */

/**
 * Get UI text: the theme's copy, then the ecosystem's, then the base copy.
 * {placeholders} are filled from vars and escaped; {currency} and
 * {Currency} are always available.
 */
const reportedMissingKeys = new Set();
export function t(key, vars) {
  const theme = activeTheme();
  let text = (theme.copy && theme.copy[key]) ?? activeEcosystem().copy[key] ?? BASE_COPY[key];
  if (text == null) {
    if (!reportedMissingKeys.has(key)) {
      reportedMissingKeys.add(key);
      console.warn('[copy] missing key:', key);
    }
    text = key;
  }
  if (!text.includes('{')) return text;
  const { name, title } = currency();
  const values = { currency: name, Currency: title, ...vars };
  return text.replace(/\{(\w+)\}/g, (match, placeholder) => (placeholder in values ? escapeHtml(values[placeholder]) : match));
}

/** HTML for a decoration slot, or '' when the active theme doesn't decorate it. */
export function decoration(slot) {
  const render = activeTheme().decorations && activeTheme().decorations[slot];
  return render ? `<div class="deco deco-${slot}" aria-hidden="true">${render()}</div>` : '';
}
