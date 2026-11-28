/* Alpha Wolf: midnight blues and a full moon. Dark theme.
   Uses the brainrot wording from ../../copy.js with a few lines of its own. */

import { SHARED_TOKENS } from '../../../shared.js';

export default {
  id: 'alpha-wolf',
  name: 'Alpha Wolf',
  description: 'Midnight blues and a full moon. Lone-wolf focus.',
  appearance: 'dark',
  price: 300,

  tokens: {
    ...SHARED_TOKENS,
    scheme: 'dark',
    // Surfaces and text
    bg: '#0b1426',
    surface: '#15233f',
    'surface-raised': '#1c2e4f',
    'surface-sunken': '#08101f',
    border: '#27395c',
    'border-strong': '#6f88b5',
    text: '#e8edf7',
    'text-muted': '#9fb4d9',
    // Brand and states (moonlit blue)
    primary: '#8fb0f0',
    'on-primary': '#0b1426',
    'focus-ring': '#c4d4f5',
    success: '#5bd68a',
    'success-bg': '#13321f',
    warning: '#f5c451',
    'warning-bg': '#3a2e10',
    danger: '#ff8a80',
    'danger-bg': '#3d1a18',
    'on-danger': '#1b0b08',
    info: '#9fc0ff',
    'info-bg': '#14284a',
    // Timer modes
    'mode-focus': '#8fb0f0',
    'mode-short': '#7fd6c8',
    'mode-long': '#c4b5fd',
    'on-mode': '#0b1426',
    // Task priorities
    'priority-high': '#ff8a80',
    'priority-high-bg': '#3d1a18',
    'priority-medium': '#f5c451',
    'priority-medium-bg': '#3a2e10',
    'priority-low': '#9fc0ff',
    'priority-low-bg': '#14284a',
    // Elevation
    'shadow-sm': '0 1px 2px rgba(0,0,0,.45)',
    'shadow-md': '0 12px 30px rgba(0,0,0,.6)',
  },

  copy: {
    'app.tagline': 'The pack sleeps. You hunt.',
    'mode.long': 'Moonlight Break',
  },
  decorations: {},

  // Theme-only CSS, scoped under [data-theme="alpha-wolf"].
  stylesheet: new URL('./theme.css', import.meta.url).href,
};