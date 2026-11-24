/* =====================================================================
   THEME ENGINE
   Themes are plug-ins. Each theme is ONE object passed to registerTheme().
   Components never hard-code colors, fonts or text; they read:
     - CSS variables (var(--primary), var(--surface), …) set from theme.tokens
     - text from t(key), which checks theme.copy first, then BASE_COPY
     - emoji from themeEmoji(name)
     - optional decorations from decoration(slot)

   A theme object can contain:
     id, name, description   – shown in Settings and the Shop
     appearance              – 'light' | 'dark'
     price                   – aura cost in the Shop (0 or missing = free)
     tokens                  – CSS variable values (see the Boring Light theme for the full list)
     copy                    – overrides for any BASE_COPY key
     emoji                   – { focus, shortBreak, longBreak, taskDone, celebration, empty, aura }
     decorations             – { slotName: () => 'html' } for the slots in DECORATION_SLOTS
     css                     – extra CSS for this theme only; scope rules under [data-theme="<id>"]

   Rules every theme must follow:
     - same layout and components as the base themes
     - WCAG 2.1 AA contrast for all text and controls
     - animations must stop when "Reduce motion" is on (handled globally in app.css)
     - only original text, emoji and CSS animations (no copyrighted images, audio or meme media)
   ===================================================================== */

const THEMES = {};
const DEFAULT_THEME_ID = 'brainrot';

const BASE_EMOJI = {
  focus: '🍅',
  shortBreak: '☕',
  longBreak: '🌿',
  taskDone: '✅',
  celebration: '🎉',
  empty: '🌱',
  aura: '✨',
};

/** Places in the UI where a theme can inject extra decoration HTML. */
const DECORATION_SLOTS = [
  'header-accent',
  'timer-background',
  'timer-overlay',
  'empty-state-art',
  'celebration',
  'achievement-badge-frame',
];

/** Font and shape tokens shared by the built-in themes. */
const SHARED_TOKENS = {
  'font-display': "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  'font-body': "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  'font-timer': "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  'radius-sm': '8px',
  'radius-md': '12px',
  'radius-lg': '16px',
  'radius-full': '999px',
  'duration-fast': '120ms',
  'duration-base': '220ms',
  easing: 'cubic-bezier(.2,.7,.2,1)',
};

let currentThemeId = DEFAULT_THEME_ID;
const themeChangeListeners = [];

function registerTheme(theme) {
  THEMES[theme.id] = theme;
}

function activeTheme() {
  return THEMES[currentThemeId] || THEMES[DEFAULT_THEME_ID];
}

/** Get UI text. Theme override first, then base copy. {placeholders} are filled from vars and escaped. */
const reportedMissingKeys = new Set();
function t(key, vars) {
  const theme = activeTheme();
  let text = (theme.copy && theme.copy[key]) ?? BASE_COPY[key];

  if (text == null) {
    if (!reportedMissingKeys.has(key)) {
      reportedMissingKeys.add(key);
      console.warn('[copy] missing key:', key);
    }
    text = key;
  }

  if (vars) {
    text = text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? escapeHtml(vars[name]) : match));
  }
  return text;
}

function themeEmoji(name) {
  const theme = activeTheme();
  return (theme.emoji && theme.emoji[name]) || BASE_EMOJI[name];
}

/** HTML for a decoration slot, or '' when the active theme doesn't decorate it. */
function decoration(slot) {
  const render = activeTheme().decorations && activeTheme().decorations[slot];
  return render ? `<div class="deco deco-${slot}" aria-hidden="true">${render()}</div>` : '';
}

/** Switch the whole UI to a theme: CSS variables, theme CSS and the data-theme attribute. */
function applyTheme(themeId) {
  if (!THEMES[themeId]) themeId = DEFAULT_THEME_ID;
  currentThemeId = themeId;

  const theme = THEMES[themeId];
  const root = document.documentElement;
  for (const [token, value] of Object.entries(theme.tokens)) {
    root.style.setProperty('--' + token, value);
  }
  root.dataset.theme = themeId;
  root.dataset.appearance = theme.appearance;

  let themeStyleTag = document.getElementById('theme-css');
  if (!themeStyleTag) {
    themeStyleTag = document.createElement('style');
    themeStyleTag.id = 'theme-css';
    document.head.appendChild(themeStyleTag);
  }
  themeStyleTag.textContent = theme.css || '';

  storage.set('brp_last_theme', themeId);
  themeChangeListeners.forEach((listener) => listener(themeId));
}

function applyReducedMotion(isOn) {
  document.documentElement.dataset.reduceMotion = isOn ? 'true' : 'false';
}
