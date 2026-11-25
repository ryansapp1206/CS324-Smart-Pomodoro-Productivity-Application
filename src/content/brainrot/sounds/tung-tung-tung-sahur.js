/* Tung Tung Tung Sahur sound pack: recorded audio, kept next to this file.
     sessionEnd: the "tung tung tung sahur" clip (first 3.2 s of the meme audio)
     breakEnd:   a bat bonk (sound effect by freesound_community on Pixabay)
   A pack with `files` plays them instead of synthesized `notes`. */

export default {
  id: 'tung-tung-tung-sahur',
  name: 'Tung Tung Tung Sahur',
  description: 'The real chant when you finish, and a bat bonk when a break ends.',
  price: 200,
  icon: 'bat', // from src/core/icons.js
  files: {
    sessionEnd: new URL('./tung-tung-tung-sahur.mp3', import.meta.url).href,
    breakEnd: new URL('./bonk.mp3', import.meta.url).href,
  },
};
