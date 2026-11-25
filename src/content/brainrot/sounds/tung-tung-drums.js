/* Tung Tung Drums sound pack. Synthesized in the browser: no audio files. */

export default {
  id: 'tung-tung-drums',
  name: 'Tung Tung Drums',
  description: 'Three wooden thumps. Sahur time.',
  price: 150,
  icon: 'drum', // from src/core/icons.js
  /** Notes to play. `event` is 'sessionEnd' or 'breakEnd'. See src/audio/player.js for the note format. */
  notes: () => [
    { frequency: 160, slideTo: 55, startAt: 0, duration: 0.2, volume: 0.5 },
    { frequency: 160, slideTo: 55, startAt: 0.22, duration: 0.2, volume: 0.5 },
    { frequency: 160, slideTo: 55, startAt: 0.44, duration: 0.2, volume: 0.5 },
    { frequency: 220, slideTo: 80, startAt: 0.75, duration: 0.3, volume: 0.5 },
  ],
};
