/* Tung Tung Tung Sahur: warm wood tones and a pre-dawn night blue for the
   long break (sahur is the meal before dawn). Uses the brainrot wording from
   ../../copy.js, with a few Sahur lines of its own below.
   dance.webp / dance-still.webp: the dancing animation for the session-complete card. */

import { SHARED_TOKENS } from '../../../shared.js';

export default {
  id: 'tung-tung-tung-sahur',
  name: 'Tung Tung Tung Sahur',
  description: 'Warm wood tones. Wakes you up for the grind.',
  appearance: 'light',
  price: 500,

  tokens: {
    ...SHARED_TOKENS,
    scheme: 'light',
    // Surfaces and text (light wood)
    bg: '#f7efe4',
    surface: '#fffaf3',
    'surface-raised': '#fffaf3',
    'surface-sunken': '#efe2cf',
    border: '#e0cdb3',
    'border-strong': '#9c7c5c',
    text: '#2b1d12',
    'text-muted': '#6b5240',
    // Brand and states (dark wood)
    primary: '#8b4513',
    'on-primary': '#ffffff',
    'focus-ring': '#c2410c',
    success: '#3f6212',
    'success-bg': '#ecf3dc',
    warning: '#92400e',
    'warning-bg': '#fdf0dc',
    danger: '#b42318',
    'danger-bg': '#fdecea',
    'on-danger': '#ffffff',
    info: '#1e40af',
    'info-bg': '#e6ecfb',
    // Timer modes: wood, olive, pre-dawn night
    'mode-focus': '#8b4513',
    'mode-short': '#3f6212',
    'mode-long': '#1e3a5f',
    'on-mode': '#ffffff',
    // Task priorities
    'priority-high': '#b42318',
    'priority-high-bg': '#fdecea',
    'priority-medium': '#92400e',
    'priority-medium-bg': '#fdf0dc',
    'priority-low': '#1e40af',
    'priority-low-bg': '#e6ecfb',
    // Elevation (warm shadows)
    'shadow-sm': '0 1px 2px rgba(60,35,15,.08), 0 1px 3px rgba(60,35,15,.10)',
    'shadow-md': '0 10px 28px rgba(60,35,15,.18)',
  },

  // Sahur lines on top of the brainrot wording.
  copy: {
    'app.tagline': 'Tung tung tung. Wake up and lock in.',
    'mode.long': 'Sahur Break',
    'alert.breakDone': 'Tung tung tung… back to it.',
    'notif.dailyTitle': 'Sahur time',
    'notif.dailyBody': 'Tung tung tung. Pick a quest and start a lock-in.',
  },

  // He dances in the "session complete" card (a still frame when Reduce motion is on).
  decorations: {
    celebration: () => `
      <img class="sahur-dance" src="${new URL('./dance.webp', import.meta.url).href}" alt="">
      <img class="sahur-dance-still" src="${new URL('./dance-still.webp', import.meta.url).href}" alt="">`,
  },

  // Theme-only CSS, scoped under [data-theme="tung-tung-tung-sahur"].
  stylesheet: new URL('./theme.css', import.meta.url).href,
};
