/* Alpha Howl sound pack. Synthesized in the browser: no audio files. */

export default {
  id: 'alpha-howl',
  name: 'Alpha Howl',
  description: 'A lone synth howl at the full moon.',
  price: 300,
  icon: 'moon', // from src/core/icons.js
  /** Notes to play. `event` is 'sessionEnd' or 'breakEnd'. See src/audio/player.js for the note format. */
  notes: () => [
    { frequency: 300, slideTo: 760, duration: 0.55, volume: 0.16 },
    { frequency: 760, slideTo: 420, startAt: 0.55, duration: 0.7, volume: 0.14 },
  ],
};
