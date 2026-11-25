/* 6-7 Chime sound pack. Synthesized in the browser: no audio files. */

export default {
  id: 'six-seven-chime',
  name: '6-7 Chime',
  description: 'Six… seven. Two notes, endless aura.',
  price: 150,
  icon: 'music', // from src/core/icons.js
  /** Notes to play. `event` is 'sessionEnd' or 'breakEnd'. See src/audio/player.js for the note format. */
  notes: () => [
    { frequency: 660, duration: 0.28, wave: 'square', volume: 0.08 },
    { frequency: 784, startAt: 0.32, duration: 0.4, wave: 'square', volume: 0.08 },
  ],
};
