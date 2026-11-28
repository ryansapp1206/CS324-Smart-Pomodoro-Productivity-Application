/* Light: the bright professional theme. Also documents the
   full token list, so copy this file when you start a new theme. */

import { SHARED_TOKENS } from '../../../shared.js';

export default {
  id: 'light',
  name: 'Light',
  description: 'Clean, bright and easy to read.',
  appearance: 'light',
  accentable: true, // primary, on-primary and mode-focus follow the user's button color (settings.accent)
  price: 0,
  tokens: {
    ...SHARED_TOKENS,
    scheme: 'light',
    // Surfaces and text
    bg: '#f5f4f1',
    surface: '#ffffff',
    'surface-raised': '#ffffff',
    'surface-sunken': '#efede9',
    border: '#dedad4',
    'border-strong': '#a8a198',
    text: '#1d1b18',
    'text-muted': '#5c5750',
    // Brand and states
    primary: '#2563eb',
    'on-primary': '#ffffff',
    'focus-ring': '#2563eb',
    success: '#15803d',
    'success-bg': '#e7f5ec',
    warning: '#8a5a00',
    'warning-bg': '#fdf3dc',
    danger: '#b42318',
    'danger-bg': '#fdecea',
    'on-danger': '#ffffff',
    info: '#1d4ed8',
    'info-bg': '#e8effd',
    // Timer modes
    'mode-focus': '#2563eb',
    'mode-short': '#0f766e',
    'mode-long': '#4338ca',
    'on-mode': '#ffffff',
    // Task priorities
    'priority-high': '#b42318',
    'priority-high-bg': '#fdecea',
    'priority-medium': '#8a5a00',
    'priority-medium-bg': '#fdf3dc',
    'priority-low': '#1d4ed8',
    'priority-low-bg': '#e8effd',
    // Elevation
    'shadow-sm': '0 1px 2px rgba(28,25,23,.06), 0 1px 3px rgba(28,25,23,.08)',
    'shadow-md': '0 10px 28px rgba(28,25,23,.16)',
  },
  copy: {},
  decorations: {},
};
