/* Sigma Bass Drop sound pack. Synthesized in the browser: no audio files. */

export default {
  id: 'sigma-bass-drop',
  name: 'Sigma Bass Drop',
  description: 'One deep drop. No words needed.',
  price: 250,
  icon: 'volume', // from src/core/icons.js
  /** Notes to play. `event` is 'sessionEnd' or 'breakEnd'. See src/audio/player.js for the note format. */
  notes: () => [
    { frequency: 220, slideTo: 38, duration: 0.9, wave: 'sawtooth', volume: 0.12 },
    { frequency: 110, slideTo: 30, duration: 1, volume: 0.3 },
  ],
};
