/* Sigma Grindset: black and gold, no distractions. Dark theme.
   Uses the brainrot wording from ../../copy.js with a few lines of its own. */

import { SHARED_TOKENS } from '../../../shared.js';

export default {
  id: 'sigma-grindset',
  name: 'Sigma Grindset',
  description: 'Black and gold. No distractions, only grind.',
  appearance: 'dark',
  price: 250,

  tokens: {
    ...SHARED_TOKENS,
    scheme: 'dark',
    // Surfaces and text
    bg: '#0d0d0f',
    surface: '#1a1a1f',
    'surface-raised': '#222228',
    'surface-sunken': '#08080a',
    border: '#33333b',
    'border-strong': '#7a7a86',
    text: '#f2f2f2',
    'text-muted': '#a8a8b3',
    // Brand and states (gold)
    primary: '#d4a62a',
    'on-primary': '#0d0d0f',
    'focus-ring': '#f0c445',
    success: '#5bd68a',
    'success-bg': '#14301f',
    warning: '#f5c451',
    'warning-bg': '#3a2e10',
    danger: '#ff8a80',
    'danger-bg': '#3d1a18',
    'on-danger': '#1b0b08',
    info: '#8fb4ff',
    'info-bg': '#17243f',
    // Timer modes
    'mode-focus': '#d4a62a',
    'mode-short': '#5bd68a',
    'mode-long': '#b9a2ff',
    'on-mode': '#0d0d0f',
    // Task priorities
    'priority-high': '#ff8a80',
    'priority-high-bg': '#3d1a18',
    'priority-medium': '#f5c451',
    'priority-medium-bg': '#3a2e10',
    'priority-low': '#8fb4ff',
    'priority-low-bg': '#17243f',
    // Elevation
    'shadow-sm': '0 1px 2px rgba(0,0,0,.5)',
    'shadow-md': '0 12px 30px rgba(0,0,0,.65)',
  },

  copy: {
    'app.tagline': 'Rise and grind. Zero excuses.',
    'alert.breakDone': 'Rest is over. Back to the grind.',
  },
  decorations: {},

  // Theme-only CSS, scoped under [data-theme="sigma-grindset"].
  stylesheet: new URL('./theme.css', import.meta.url).href,
};