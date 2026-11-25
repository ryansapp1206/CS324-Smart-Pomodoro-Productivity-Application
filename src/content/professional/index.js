/* =====================================================================
   PROFESSIONAL ECOSYSTEM (the default)
   What every visitor sees first: plain wording, a clean look and its own
   shop. Everything listed here appears in Settings and the Shop while
   professional mode is on; nothing from ../brainrot/ does.

   To add an item: create the file in themes/, sounds/ or avatars/ and add
   it to the matching list below. The format is in ../README.md.
   ===================================================================== */

import light from './themes/light/theme.js';
import dark from './themes/dark/theme.js';
import classicBeep from './sounds/classic-beep.js';

export default {
  id: 'professional',

  /** The shared currency's name in this ecosystem. The balance itself is shared. */
  currency: { name: 'points', title: 'Points' },

  /** Text overrides for src/core/copy.js. Empty: the base text is already professional. */
  copy: {},

  /** Equipped when nothing else is, and always owned. */
  defaults: { theme: 'dark', soundPack: 'classic-beep', avatar: 'initials' },

  /** Shown in this order in Settings and the Shop. */
  themes: [dark, light],
  sounds: [classicBeep],
  avatars: [], // "Initials" is built in; add professional profile pictures here
};
