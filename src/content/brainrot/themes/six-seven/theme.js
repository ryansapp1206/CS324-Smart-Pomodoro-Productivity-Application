/* 6-7: warm cream with orange, teal and violet. Light theme.
   Uses the brainrot wording from ../../copy.js with a few lines of its own. */

import { SHARED_TOKENS } from '../../../shared.js';

export default {
  id: 'six-seven',
  name: '6-7',
  description: 'Six. Seven. You know exactly what this is.',
  appearance: 'light',
  price: 400,

  tokens: {
    ...SHARED_TOKENS,
    scheme: 'light',
    // Surfaces and text
    bg: '#fff8e1',
    surface: '#ffffff',
    'surface-raised': '#ffffff',
    'surface-sunken': '#fdefc0',
    border: '#ecd9a0',
    'border-strong': '#8f7a2e',
    text: '#1f1a0a',
    'text-muted': '#5e5320',
    // Brand and states (orange, darkened so white text passes AA)
    primary: '#c2410c',
    'on-primary': '#ffffff',
    'focus-ring': '#6d3df0',
    success: '#136a33',
    'success-bg': '#e7f5ec',
    warning: '#8a5a00',
    'warning-bg': '#fdf3dc',
    danger: '#b42318',
    'danger-bg': '#fdecea',
    'on-danger': '#ffffff',
    info: '#1d4ed8',
    'info-bg': '#e8effd',
    // Timer modes: orange, teal, violet
    'mode-focus': '#c2410c',
    'mode-short': '#00796b',
    'mode-long': '#6d3df0',
    'on-mode': '#ffffff',
    // Task priorities
    'priority-high': '#b42318',
    'priority-high-bg': '#fdecea',
    'priority-medium': '#8a5a00',
    'priority-medium-bg': '#fdf3dc',
    'priority-low': '#1d4ed8',
    'priority-low-bg': '#e8effd',
    // Elevation (warm shadows)
    'shadow-sm': '0 1px 2px rgba(60,40,5,.08), 0 1px 3px rgba(60,40,5,.10)',
    'shadow-md': '0 10px 28px rgba(60,40,5,.18)',
  },

  copy: {
    'app.tagline': 'Six. Seven. Lock in.',
  },
  decorations: {},

  // Theme-only CSS, scoped under [data-theme="six-seven"].
  stylesheet: new URL('./theme.css', import.meta.url).href,
};