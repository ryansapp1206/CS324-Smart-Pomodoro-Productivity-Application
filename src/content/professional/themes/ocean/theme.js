/* Ocean: a deep-navy dark theme with cool, aqua highlights.
   Built from the Dark theme's token list. Every text/control pair was
   checked against WCAG 2.1 AA (4.5:1 for text, 3:1 for controls and borders). */

import { SHARED_TOKENS } from '../../../shared.js';

export default {
  id: 'ocean',
  name: 'Ocean',
  description: 'Deep navy with calm aqua highlights.',
  appearance: 'dark',
  accentable: true, // primary, on-primary and mode-focus follow the user's button color (settings.accent)
  price: 100, // in points; set to 0 to make it free
  tokens: {
    ...SHARED_TOKENS,
    scheme: 'dark',
    // Surfaces and text
    bg: '#07182b',
    surface: '#0d2540',
    'surface-raised': '#133251',
    'surface-sunken': '#0a1f36',
    border: '#1f4468',
    'border-strong': '#5f8bb0',
    text: '#eaf6ff',
    'text-muted': '#9fbdd6',
    // Brand and states
    primary: '#4cc9f0',
    'on-primary': '#04202e',
    'focus-ring': '#4cc9f0',
    success: '#5bd68a',
    'success-bg': '#12342a',
    warning: '#f5c451',
    'warning-bg': '#3a2e10',
    danger: '#ff8a80',
    'danger-bg': '#3d1a18',
    'on-danger': '#1b0b08',
    info: '#8fb4ff',
    'info-bg': '#14284a',
    // Timer modes
    'mode-focus': '#4cc9f0',
    'mode-short': '#6ee7b7',
    'mode-long': '#a5b0ff',
    'on-mode': '#04202e',
    // Task priorities
    'priority-high': '#ff8a80',
    'priority-high-bg': '#3d1a18',
    'priority-medium': '#f5c451',
    'priority-medium-bg': '#3a2e10',
    'priority-low': '#8fb4ff',
    'priority-low-bg': '#14284a',
    // Elevation
    'shadow-sm': '0 1px 2px rgba(0,0,0,.45)',
    'shadow-md': '0 12px 30px rgba(0,0,0,.6)',
  },
  copy: {},
  decorations: {},
};