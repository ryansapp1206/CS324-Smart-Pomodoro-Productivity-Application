/* Mogger: sharp contrast, red on charcoal. Dark theme.
   Uses the brainrot wording from ../../copy.js with a few lines of its own. */

import { SHARED_TOKENS } from '../../../shared.js';

export default {
  id: 'mogger',
  name: 'Mogger',
  description: 'Sharp jawline energy. Mogs every other theme.',
  appearance: 'dark',
  price: 350,

  tokens: {
    ...SHARED_TOKENS,
    scheme: 'dark',
    // Surfaces and text
    bg: '#121212',
    surface: '#1f1f1f',
    'surface-raised': '#2a2a2a',
    'surface-sunken': '#0c0c0c',
    border: '#3a3a3a',
    'border-strong': '#808080',
    text: '#ffffff',
    'text-muted': '#a3a3a3',
    // Brand and states (red)
    primary: '#ff4d4d',
    'on-primary': '#121212',
    'focus-ring': '#ffffff',
    success: '#5bd68a',
    'success-bg': '#14301f',
    warning: '#f5c451',
    'warning-bg': '#3a2e10',
    danger: '#ff9a8f',
    'danger-bg': '#3d1a18',
    'on-danger': '#1b0b08',
    info: '#8fb4ff',
    'info-bg': '#17243f',
    // Timer modes
    'mode-focus': '#ff4d4d',
    'mode-short': '#5bd68a',
    'mode-long': '#b9a2ff',
    'on-mode': '#121212',
    // Task priorities
    'priority-high': '#ff9a8f',
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
    'app.tagline': 'Lock in. Level up. Out-focus everyone.',
  },
  decorations: {},

  // Theme-only CSS, scoped under [data-theme="mogger"].
  stylesheet: new URL('./theme.css', import.meta.url).href,
};