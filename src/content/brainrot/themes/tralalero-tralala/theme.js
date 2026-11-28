/* Tralalero Tralala: ocean blues and cool aqua. Light theme.
   Uses the brainrot wording from ../../copy.js with a few lines of its own. */

import { SHARED_TOKENS } from '../../../shared.js';

export default {
  id: 'tralalero-tralala',
  name: 'Tralalero Tralala',
  description: 'Ocean blues and sneaker drip from the deep.',
  appearance: 'light',
  price: 450,

  tokens: {
    ...SHARED_TOKENS,
    scheme: 'light',
    // Surfaces and text
    bg: '#e6f4ff',
    surface: '#ffffff',
    'surface-raised': '#ffffff',
    'surface-sunken': '#d3e9f9',
    border: '#b7d6ee',
    'border-strong': '#4d7fa3',
    text: '#0a2236',
    'text-muted': '#3f5d75',
    // Brand and states (ocean blue)
    primary: '#0277bd',
    'on-primary': '#ffffff',
    'focus-ring': '#1565c0',
    success: '#136a33',
    'success-bg': '#e7f5ec',
    warning: '#8a5a00',
    'warning-bg': '#fdf3dc',
    danger: '#b42318',
    'danger-bg': '#fdecea',
    'on-danger': '#ffffff',
    info: '#1d4ed8',
    'info-bg': '#e8effd',
    // Timer modes: blue, deep aqua, navy
    'mode-focus': '#0277bd',
    'mode-short': '#00697a',
    'mode-long': '#1565c0',
    'on-mode': '#ffffff',
    // Task priorities
    'priority-high': '#b42318',
    'priority-high-bg': '#fdecea',
    'priority-medium': '#8a5a00',
    'priority-medium-bg': '#fdf3dc',
    'priority-low': '#1d4ed8',
    'priority-low-bg': '#e8effd',
    // Elevation (cool shadows)
    'shadow-sm': '0 1px 2px rgba(8,40,70,.08), 0 1px 3px rgba(8,40,70,.10)',
    'shadow-md': '0 10px 28px rgba(8,40,70,.18)',
  },

  copy: {
    'app.tagline': 'Dive deep. Stay locked in.',
  },
  decorations: {},

  // Theme-only CSS, scoped under [data-theme="tralalero-tralala"].
  stylesheet: new URL('./theme.css', import.meta.url).href,
};