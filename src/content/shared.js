/* Values shared by every theme in both ecosystems. */

/** Font, shape and motion tokens. Spread these into a theme's tokens. */
export const SHARED_TOKENS = {
  'font-display': "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  'font-body': "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  'font-timer': "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  'radius-sm': '8px',
  'radius-md': '12px',
  'radius-lg': '16px',
  'radius-full': '999px',
  'duration-fast': '120ms',
  'duration-base': '220ms',
  easing: 'cubic-bezier(.2,.7,.2,1)',
};

/**
 * Button (accent) colors the user can pick in Settings → Appearance.
 * They replace the `primary`, `on-primary` and `mode-focus` tokens of every theme marked
 * `accentable: true`. Each has a light and a dark version so both meet
 * WCAG AA contrast against their theme. Ids are saved in settings.accent,
 * so never rename one once released.
 */
export const ACCENTS = [
  { id: 'blue', name: 'Blue', light: { primary: '#2563eb', on: '#ffffff' }, dark: { primary: '#7aa7ff', on: '#0b1530' } },
  { id: 'red', name: 'Red', light: { primary: '#c0392b', on: '#ffffff' }, dark: { primary: '#ff7a6b', on: '#1b0b08' } },
  { id: 'orange', name: 'Orange', light: { primary: '#c2410c', on: '#ffffff' }, dark: { primary: '#ff9f5a', on: '#1f0e02' } },
  { id: 'green', name: 'Green', light: { primary: '#15803d', on: '#ffffff' }, dark: { primary: '#5bd68a', on: '#07210f' } },
  { id: 'teal', name: 'Teal', light: { primary: '#0f766e', on: '#ffffff' }, dark: { primary: '#3dd6c3', on: '#04201c' } },
  { id: 'purple', name: 'Purple', light: { primary: '#7c3aed', on: '#ffffff' }, dark: { primary: '#b69cff', on: '#190b3a' } },
  { id: 'pink', name: 'Pink', light: { primary: '#be185d', on: '#ffffff' }, dark: { primary: '#ff8cc6', on: '#2b0718' } },
];

export const DEFAULT_ACCENT = 'blue';

/** The accent with this id, or the default one. */
export function findAccent(id) {
  return ACCENTS.find((accent) => accent.id === id) || ACCENTS.find((accent) => accent.id === DEFAULT_ACCENT);
}
