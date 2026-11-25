/* Tung Tung Tung Sahur sound pack: recorded audio, kept next to this file.
     sessionEnd: the "tung tung tung sahur" chant (focus session complete)
     default:    a bat bonk, for every other sound (break ends, …)
     preview:    the Shop's preview plays the chant, then the bonk
   Bonk sound effect by freesound_community on Pixabay. */

export default {
  id: 'tung-tung-tung-sahur',
  name: 'Tung Tung Tung Sahur',
  description: 'The chant when you finish a focus session. A bat bonk for everything else.',
  price: 200,
  icon: 'bat', // from src/core/icons.js
  files: {
    sessionEnd: new URL('./tung-tung-tung-sahur.mp3', import.meta.url).href,
    default: new URL('./bonk.mp3', import.meta.url).href,
  },
  preview: ['sessionEnd', 'default'], // played one after the other
};
