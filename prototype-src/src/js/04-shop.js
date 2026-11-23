/* =====================================================================
   SHOP CATALOG
   Everything users can buy with aura. Three kinds of items:
     theme  – registered themes plus priced "coming soon" stubs (THEME_CATALOG).
              A stub becomes equippable automatically once a registerTheme()
              with the same id exists.
     sound  – alert sound packs (SOUND_PACKS). Synthesized in the browser,
              so there are no audio files and no copyrighted clips.
     avatar – profile pictures (AVATARS). Emoji badges named after brainrot
              figures (original, no character art).

   A purchase is stored on the account as { id, itemId: '<kind>:<id>', price, at }.
   To add an item, add one entry to the matching list below.
   ===================================================================== */

/* ------------------------- Theme stubs -------------------------- */

const THEME_CATALOG = [
  {
    id: 'sigma',
    name: 'Sigma Grindset',
    description: 'Black and gold. No distractions, only grind.',
    price: 250,
    swatch: ['#0d0d0f', '#1a1a1f', '#d4a62a', '#8c8c96', '#f2f2f2'],
  },
  {
    id: 'alpha-wolf',
    name: 'Alpha Wolf',
    description: 'Midnight blues and a full moon. Lone-wolf focus.',
    price: 300,
    swatch: ['#0b1426', '#15233f', '#9fb4d9', '#e8edf7', '#5b7bb5'],
  },
  {
    id: 'mogger',
    name: 'Mogger',
    description: 'Sharp jawline energy. Mogs every other theme.',
    price: 350,
    swatch: ['#121212', '#1f1f1f', '#ff4d4d', '#ffffff', '#a3a3a3'],
  },
  {
    id: 'six-seven',
    name: '6-7',
    description: 'Six. Seven. You know exactly what this is.',
    price: 400,
    swatch: ['#fff8e1', '#ffffff', '#ff6f00', '#7c4dff', '#00bfa5'],
  },
  {
    id: 'tralalero',
    name: 'Tralalero Tralala',
    description: 'Ocean blues and sneaker drip from the deep.',
    price: 450,
    swatch: ['#e6f4ff', '#ffffff', '#0277bd', '#26c6da', '#1565c0'],
  },
  {
    id: 'tung-tung',
    name: 'Tung Tung Tung Sahur',
    description: 'Warm wood tones. Wakes you up for the grind.',
    price: 500,
    swatch: ['#f7efe4', '#ffffff', '#8d5524', '#c68642', '#3e2723'],
  },
];

/* ----------------------------- Sound ----------------------------- */

let audioContext = null;

/** Browsers only allow audio after a user click, so every click calls this. */
function unlockAudio() {
  try {
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
  } catch (error) {
    /* no audio support: sounds are silently skipped */
  }
}

/**
 * Play a list of synthesized notes.
 * Each note: { frequency, slideTo?, startAt?, duration?, wave?, volume? }
 */
function playNotes(notes) {
  if (!audioContext) return;
  try {
    const now = audioContext.currentTime + 0.02;
    for (const note of notes) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const start = now + (note.startAt || 0);
      const duration = note.duration || 0.2;

      oscillator.type = note.wave || 'sine';
      oscillator.frequency.setValueAtTime(note.frequency, start);
      if (note.slideTo) oscillator.frequency.exponentialRampToValueAtTime(note.slideTo, start + duration);

      // Quick fade in and out so notes don't click.
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(note.volume || 0.18, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.05);
    }
  } catch (error) {
    /* ignore audio errors */
  }
}

/* Each pack's play(event) gets 'sessionEnd' or 'breakEnd'. */
const SOUND_PACKS = [
  {
    id: 'boring',
    name: 'Boring Beep',
    description: 'Two polite beeps. Very professional.',
    price: 0,
    emoji: '🔔',
    play: (event) =>
      playNotes(
        event === 'breakEnd'
          ? [
              { frequency: 1175, duration: 0.3 },
              { frequency: 880, startAt: 0.2, duration: 0.35 },
            ]
          : [
              { frequency: 880, duration: 0.3 },
              { frequency: 1175, startAt: 0.2, duration: 0.35 },
            ]
      ),
  },
  {
    id: 'tung',
    name: 'Tung Tung Drums',
    description: 'Three wooden thumps. Sahur time.',
    price: 150,
    emoji: '🥁',
    play: () =>
      playNotes([
        { frequency: 160, slideTo: 55, startAt: 0, duration: 0.2, volume: 0.5 },
        { frequency: 160, slideTo: 55, startAt: 0.22, duration: 0.2, volume: 0.5 },
        { frequency: 160, slideTo: 55, startAt: 0.44, duration: 0.2, volume: 0.5 },
        { frequency: 220, slideTo: 80, startAt: 0.75, duration: 0.3, volume: 0.5 },
      ]),
  },
  {
    id: 'six-seven',
    name: '6-7 Chime',
    description: 'Six… seven. Two notes, endless aura.',
    price: 150,
    emoji: '🔢',
    play: () =>
      playNotes([
        { frequency: 660, duration: 0.28, wave: 'square', volume: 0.08 },
        { frequency: 784, startAt: 0.32, duration: 0.4, wave: 'square', volume: 0.08 },
      ]),
  },
  {
    id: 'tralala',
    name: 'Tralalero Tune',
    description: 'A bouncy little sea shanty riff.',
    price: 200,
    emoji: '🦈',
    play: () =>
      playNotes(
        [523, 659, 784, 659, 1047].map((frequency, index) => ({
          frequency,
          startAt: index * 0.12,
          duration: 0.16,
          wave: 'triangle',
          volume: 0.2,
        }))
      ),
  },
  {
    id: 'sigma',
    name: 'Sigma Bass Drop',
    description: 'One deep drop. No words needed.',
    price: 250,
    emoji: '🗿',
    play: () =>
      playNotes([
        { frequency: 220, slideTo: 38, duration: 0.9, wave: 'sawtooth', volume: 0.12 },
        { frequency: 110, slideTo: 30, duration: 1, volume: 0.3 },
      ]),
  },
  {
    id: 'mogger',
    name: 'Mogger Horn',
    description: 'Three blasts. Everyone knows you mogged.',
    price: 250,
    emoji: '📯',
    play: () =>
      playNotes(
        [0, 0.28, 0.56].flatMap((startAt) => [
          { frequency: 466, startAt, duration: 0.22, wave: 'sawtooth', volume: 0.07 },
          { frequency: 587, startAt, duration: 0.22, wave: 'sawtooth', volume: 0.07 },
        ])
      ),
  },
  {
    id: 'wolf',
    name: 'Alpha Howl',
    description: 'A lone synth howl at the full moon.',
    price: 300,
    emoji: '🐺',
    play: () =>
      playNotes([
        { frequency: 300, slideTo: 760, duration: 0.55, volume: 0.16 },
        { frequency: 760, slideTo: 420, startAt: 0.55, duration: 0.7, volume: 0.14 },
      ]),
  },
];

function playAlertSound(event, soundPackId) {
  const pack = SOUND_PACKS.find((p) => p.id === soundPackId) || SOUND_PACKS[0];
  pack.play(event);
}

/* ------------------------ Profile pictures ------------------------ */

const AVATARS = [
  { id: 'initials', name: 'Initials', description: 'Your initials. The classic.', price: 0, emoji: '', color: '' },
  {
    id: 'tung-tung',
    name: 'Tung Tung Tung Sahur',
    description: 'Wakes you up. Will not stop.',
    price: 100,
    emoji: '🥁',
    color: '#c68642',
  },
  {
    id: 'tralalero',
    name: 'Tralalero Tralala',
    description: 'Shark. Sneakers. Iconic.',
    price: 100,
    emoji: '🦈',
    color: '#4fc3f7',
  },
  {
    id: 'bombardiro',
    name: 'Bombardiro Crocodilo',
    description: 'Flies in, takes over.',
    price: 120,
    emoji: '🐊',
    color: '#7cb342',
  },
  {
    id: 'ballerina',
    name: 'Ballerina Cappuccina',
    description: 'Graceful. Caffeinated.',
    price: 120,
    emoji: '🩰',
    color: '#f8bbd0',
  },
  {
    id: 'patapim',
    name: 'Brr Brr Patapim',
    description: 'Forest energy. Big feet.',
    price: 80,
    emoji: '🌳',
    color: '#a5d6a7',
  },
  {
    id: 'chimpanzini',
    name: 'Chimpanzini Bananini',
    description: 'Half banana, all chaos.',
    price: 80,
    emoji: '🍌',
    color: '#fff176',
  },
  {
    id: 'lirili',
    name: 'Lirili Larila',
    description: 'Desert wanderer, keeps time.',
    price: 150,
    emoji: '🌵',
    color: '#ffcc80',
  },
  {
    id: 'cappuccino',
    name: 'Cappuccino Assassino',
    description: 'Silent, deadly, extra foam.',
    price: 150,
    emoji: '☕',
    color: '#bcaaa4',
  },
];

function initialsOf(name) {
  return (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

/** The user's profile picture: their equipped avatar, or their initials. */
function avatarHtml(user, settings, className = 'av') {
  const avatar = AVATARS.find((a) => a.id === settings?.avatarId && a.id !== 'initials');
  if (avatar) {
    return `<span class="${className} av-emoji" style="background:${avatar.color}" aria-hidden="true">${avatar.emoji}</span>`;
  }
  return `<span class="${className}" aria-hidden="true">${escapeHtml(initialsOf(user.displayName))}</span>`;
}

/* --------------------------- Lookups ---------------------------- */

const THEME_SWATCH_TOKENS = ['bg', 'surface', 'mode-focus', 'mode-short', 'mode-long'];

/** All items of one kind, in a common shape for the Shop screen. */
function shopItems(kind) {
  if (kind === 'sound') return SOUND_PACKS.map((pack) => ({ ...pack, kind }));
  if (kind === 'avatar') return AVATARS.map((avatar) => ({ ...avatar, kind }));

  const builtThemes = Object.values(THEMES).map((theme) => ({
    kind: 'theme',
    id: theme.id,
    name: theme.name,
    description: theme.description,
    price: theme.price || 0,
    swatch: THEME_SWATCH_TOKENS.map((token) => theme.tokens[token]),
    comingSoon: false,
  }));
  const plannedThemes = THEME_CATALOG.filter((stub) => !THEMES[stub.id]).map((stub) => ({
    ...stub,
    kind: 'theme',
    comingSoon: true,
  }));
  return [...builtThemes, ...plannedThemes];
}

function findShopItem(kind, id) {
  return shopItems(kind).find((item) => item.id === id);
}

/** True when the item is free or the account has bought it. */
function ownsItem(accountData, kind, id) {
  const item = findShopItem(kind, id);
  if (!item) return false;
  if (item.price === 0) return true;
  return (accountData.purchases || []).some((purchase) => purchase.itemId === `${kind}:${id}`);
}
