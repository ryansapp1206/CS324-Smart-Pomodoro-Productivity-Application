/* Classic Beep sound pack (the default). Synthesized in the browser: no audio files. */

export default {
  id: 'classic-beep',
  name: 'Classic Beep',
  description: 'Two short, clear beeps.',
  price: 0,
  icon: 'bell', // from src/core/icons.js
  /** Notes to play. `event` is 'sessionEnd' or 'breakEnd'. See src/audio/player.js for the note format. */
  notes: (event) =>
    event === 'breakEnd'
      ? [{ frequency: 1175, duration: 0.3 }, { frequency: 880, startAt: 0.2, duration: 0.35 }]
      : [{ frequency: 880, duration: 0.3 }, { frequency: 1175, startAt: 0.2, duration: 0.35 }],
};
