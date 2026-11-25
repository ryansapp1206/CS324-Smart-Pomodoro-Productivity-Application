/* Tung Tung Tung Sahur sound pack: recorded audio, kept next to this file.
     sessionEnd:  the original "tung tung tung sahur" chant (focus session done)
     setComplete: the choir (4 focus sessions in a row: long break earned)
     achievement: the choir
     stopEarly:   the slowed-down evil chant (session stopped or reset early)
     default:     a bat bonk, for every other sound (small wins, break ends)
   The Shop preview plays the chant, then the bonk. Buying the pack plays the chant.
   Bonk sound effect by freesound_community on Pixabay. */

export default {
  id: 'tung-tung-tung-sahur',
  name: 'Tung Tung Tung Sahur',
  description: 'Chant when you finish, a choir for big wins, a bonk for small ones. Quit early and he gets evil.',
  price: 200,
  icon: 'bat', // from src/core/icons.js
  files: {
    sessionEnd: new URL('./tung-tung-tung-sahur.mp3', import.meta.url).href,
    setComplete: new URL('./choir.mp3', import.meta.url).href,
    achievement: new URL('./choir.mp3', import.meta.url).href,
    stopEarly: new URL('./evil.mp3', import.meta.url).href,
    default: new URL('./bonk.mp3', import.meta.url).href,
  },
  preview: ['sessionEnd', 'default'], // played one after the other
};
