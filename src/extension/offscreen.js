/* =====================================================================
   OFFSCREEN SOUND PAGE (Chrome extension only)
   Chrome's background is a service worker, which can't play audio. The
   background opens this hidden page to play a sound pack event, with the
   first sound named in the address and later ones sent as messages.
   Chrome closes the page by itself after 30 s of silence.
   ===================================================================== */

import { setMode } from '../core/theme-engine.js';
import { playPackEvent } from '../audio/player.js';

function play({ packId, event, mode }) {
  setMode(mode); // sound packs belong to an ecosystem
  playPackEvent(packId, event);
}

const first = new URLSearchParams(location.search);
if (first.has('event')) play(Object.fromEntries(first));

chrome.runtime.onMessage.addListener((message) => {
  if (message?.target === 'offscreen' && message.type === 'play') play(message);
});
