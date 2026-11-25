/* Tung Tung Tung Sahur profile picture: a photo (tung-tung-tung-sahur.webp,
   next to this file). `icon` and `color` are the fallback if the image
   can't load. */

export default {
  id: 'tung-tung-tung-sahur',
  name: 'Tung Tung Tung Sahur',
  description: 'Has a bat. Wakes you up. Will not stop.',
  price: 100,
  image: new URL('./tung-tung-tung-sahur.webp', import.meta.url).href,
  icon: 'bat', // from src/core/icons.js
  color: '#d9a066', // badge background
};
