/* Tralalero Tune sound pack. Synthesized in the browser: no audio files. */

export default {
  id: 'tralalero-tune',
  name: 'Tralalero Tune',
  description: 'A bouncy little sea shanty riff.',
  price: 200,
  icon: 'music', // from src/core/icons.js
  /** Notes to play. `event` is 'sessionEnd' or 'breakEnd'. See src/audio/player.js for the note format. */
  notes: () =>
    [523, 659, 784, 659, 1047].map((frequency, index) => ({
      frequency,
      startAt: index * 0.12,
      duration: 0.16,
      wave: 'triangle',
      volume: 0.2,
    })),
};
