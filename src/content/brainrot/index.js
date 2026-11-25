/* =====================================================================
   BRAINROT ECOSYSTEM (hidden for now)
   A complete second set: meme-speak, its own themes, sound packs and
   profile pictures, and "aura" as the currency's name. Only the currency
   balance is shared with the professional ecosystem.

   Switched on by settings.mode = 'brainrot'. There's no toggle in the UI
   yet; when there is, the Shop and Settings show this ecosystem instead
   of the professional one.

   To add an item: create the file in themes/, sounds/ or avatars/ and add
   it to the matching list below. The format is in ../README.md.
   ===================================================================== */

import copy from './copy.js';

import brainrot from './themes/brainrot/theme.js';
import sigmaGrindset from './themes/sigma-grindset/theme.js';
import alphaWolf from './themes/alpha-wolf/theme.js';
import mogger from './themes/mogger/theme.js';
import sixSeven from './themes/six-seven/theme.js';
import tralaleroTralala from './themes/tralalero-tralala/theme.js';
import tungTungTungSahur from './themes/tung-tung-tung-sahur/theme.js';

import tungTungTungSahurSound from './sounds/tung-tung-tung-sahur.js';
import sixSevenChime from './sounds/six-seven-chime.js';
import tralaleroTune from './sounds/tralalero-tune.js';
import sigmaBassDrop from './sounds/sigma-bass-drop.js';
import moggerHorn from './sounds/mogger-horn.js';
import alphaHowl from './sounds/alpha-howl.js';

import tungTungTungSahurAvatar from './avatars/tung-tung-tung-sahur.js';
import tralaleroTralalaAvatar from './avatars/tralalero-tralala.js';
import bombardiroCrocodilo from './avatars/bombardiro-crocodilo.js';
import ballerinaCappuccina from './avatars/ballerina-cappuccina.js';
import brrBrrPatapim from './avatars/brr-brr-patapim.js';
import chimpanziniBananini from './avatars/chimpanzini-bananini.js';
import liriliLarila from './avatars/lirili-larila.js';
import cappuccinoAssassino from './avatars/cappuccino-assassino.js';

export default {
  id: 'brainrot',

  /** The shared currency's name in this ecosystem. The balance itself is shared. */
  currency: { name: 'aura', title: 'Aura' },

  /** Meme-speak overrides for src/core/copy.js, used by every brainrot theme. */
  copy,

  /** Equipped when nothing else is, and always owned. */
  // soundPack: temporary until the default brainrot pack is made.
  defaults: { theme: 'brainrot', soundPack: 'tung-tung-tung-sahur', avatar: 'initials' },

  /** Shown in this order in Settings and the Shop. */
  themes: [brainrot, sigmaGrindset, alphaWolf, mogger, sixSeven, tralaleroTralala, tungTungTungSahur],
  // One pack per brainrot theme or character.
  sounds: [tungTungTungSahurSound, sixSevenChime, tralaleroTune, sigmaBassDrop, moggerHorn, alphaHowl],
  avatars: [
    tungTungTungSahurAvatar,
    tralaleroTralalaAvatar,
    bombardiroCrocodilo,
    ballerinaCappuccina,
    brrBrrPatapim,
    chimpanziniBananini,
    liriliLarila,
    cappuccinoAssassino,
  ],
};
