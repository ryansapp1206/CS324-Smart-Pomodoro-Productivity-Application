/* =====================================================================
   CONTENT ECOSYSTEMS
   The app has two separate sets of content, each with its own themes,
   sound packs, profile pictures, wording and currency name:
     professional/   the default, what every visitor sees
     brainrot/       the hidden one (settings.mode = 'brainrot')
   Only the currency balance is shared between them. The active
   ecosystem is chosen in src/core/theme-engine.js (setMode).
   ===================================================================== */

import professional from './professional/index.js';
import brainrot from './brainrot/index.js';

export const ECOSYSTEMS = { professional, brainrot };
export const DEFAULT_MODE = 'professional';

export function getEcosystem(mode) {
  return ECOSYSTEMS[mode] || ECOSYSTEMS[DEFAULT_MODE];
}

/** Every theme from every ecosystem, by id. */
export const ALL_THEMES = Object.fromEntries(
  Object.values(ECOSYSTEMS).flatMap((ecosystem) => ecosystem.themes.map((theme) => [theme.id, theme]))
);
