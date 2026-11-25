/* Brainrot theme: the purple look. The meme-speak lives in
   ../../copy.js so every brainrot theme shares it. */

import { SHARED_TOKENS } from '../../../shared.js';

export default {
  id: 'brainrot',
  name: 'Brainrot',
  description: 'Meme-speak and maximum aura.',
  appearance: 'light',
  price: 0,

  tokens: {
    ...SHARED_TOKENS,
    scheme: 'light',
    // Surfaces and text
    bg: '#f6f3ff',
    surface: '#ffffff',
    'surface-raised': '#ffffff',
    'surface-sunken': '#ede8fb',
    border: '#ddd5f3',
    'border-strong': '#9a8fbb',
    text: '#1b1530',
    'text-muted': '#544b6e',
    // Brand and states
    primary: '#6d28d9',
    'on-primary': '#ffffff',
    'focus-ring': '#db2777',
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
    'mode-focus': '#6d28d9',
    'mode-short': '#0f766e',
    'mode-long': '#be185d',
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

  // Theme-only CSS, scoped under [data-theme="brainrot"].
  stylesheet: new URL('./theme.css', import.meta.url).href,
};
