/* Classic Beep sound pack (the professional default). Synthesized in the
   browser: no audio files. Calm and short for every sound event. */

const C5 = 523;
const E5 = 659;
const G5 = 784;
const A5 = 880;
const C6 = 1047;
const D6 = 1175;

/** Notes for each sound event (see SOUND_EVENTS in src/audio/player.js). */
const SOUNDS = {
  sessionEnd: [{ frequency: A5, duration: 0.3 }, { frequency: D6, startAt: 0.2, duration: 0.35 }],
  breakEnd: [{ frequency: D6, duration: 0.3 }, { frequency: A5, startAt: 0.2, duration: 0.35 }],
  setComplete: [
    { frequency: C5, duration: 0.25 },
    { frequency: E5, startAt: 0.15, duration: 0.25 },
    { frequency: G5, startAt: 0.3, duration: 0.25 },
    { frequency: C6, startAt: 0.45, duration: 0.5 },
  ],
  achievement: [
    { frequency: G5, duration: 0.2 },
    { frequency: C6, startAt: 0.14, duration: 0.45 },
  ],
  smallWin: [{ frequency: 1320, duration: 0.07, volume: 0.1 }],
  stopEarly: [{ frequency: 392, slideTo: 294, duration: 0.35, wave: 'triangle', volume: 0.15 }],
};

export default {
  id: 'classic-beep',
  name: 'Classic Beep',
  description: 'Short, clear tones.',
  price: 0,
  icon: 'bell', // from src/core/icons.js
  events: Object.keys(SOUNDS), // the events this pack has its own sound for
  notes: (event) => SOUNDS[event] || SOUNDS.sessionEnd,
};
