/* Mogger Horn sound pack. Synthesized in the browser: no audio files. */

export default {
  id: 'mogger-horn',
  name: 'Mogger Horn',
  description: 'Three blasts. Everyone knows you mogged.',
  price: 250,
  icon: 'megaphone', // from src/core/icons.js
  /** Notes to play. `event` is 'sessionEnd' or 'breakEnd'. See src/audio/player.js for the note format. */
  notes: () =>
    [0, 0.28, 0.56].flatMap((startAt) => [
      { frequency: 466, startAt, duration: 0.22, wave: 'sawtooth', volume: 0.07 },
      { frequency: 587, startAt, duration: 0.22, wave: 'sawtooth', volume: 0.07 },
    ]),
};
