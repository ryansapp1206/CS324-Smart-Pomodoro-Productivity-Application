/* Tung Tung Drums sound pack. The "tung" is the knock of wood on a hollow
   wooden drum, the way people are woken for sahur. Synthesized in the
   browser: no audio files, no voice.
     sessionEnd: tung, tung, tung … then two deep drum booms ("sa-hur")
     breakEnd:   a quick double knock, then one boom */

/** One hollow wood knock: a short bright click over a woody body. */
function knock(startAt, pitch = 1) {
  return [
    { frequency: 900 * pitch, slideTo: 500 * pitch, startAt, duration: 0.05, wave: 'triangle', volume: 0.25 },
    { frequency: 260 * pitch, slideTo: 150 * pitch, startAt, duration: 0.16, wave: 'sine', volume: 0.5 },
  ];
}

/** A deep drum hit. */
function boom(startAt, frequency = 110) {
  return [{ frequency, slideTo: frequency / 2, startAt, duration: 0.45, wave: 'sine', volume: 0.6 }];
}

export default {
  id: 'tung-tung-drums',
  name: 'Tung Tung Drums',
  description: 'Three wooden knocks and a sahur boom.',
  price: 150,
  icon: 'drum', // from src/core/icons.js
  /** Notes to play. `event` is 'sessionEnd' or 'breakEnd'. See src/audio/player.js for the note format. */
  notes: (event) =>
    event === 'breakEnd'
      ? [...knock(0, 1.1), ...knock(0.14, 1.1), ...boom(0.4, 120)]
      : [...knock(0), ...knock(0.28), ...knock(0.56), ...boom(0.98, 110), ...boom(1.38, 92)],
};
