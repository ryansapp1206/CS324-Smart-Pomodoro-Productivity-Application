/* =====================================================================
   SOUND EFFECTS
   The one place app code asks for a sound:  playSound('smallWin')
   Events are listed in src/audio/player.js (SOUND_EVENTS). The equipped
   sound pack decides what each one sounds like. Nothing plays unless the
   Sound setting is on.
   The Chrome extension's background can't play audio itself, so it
   replaces the output with setSoundOutput() (src/extension/background.js).
   ===================================================================== */

import { playPackEvent } from '../audio/player.js';
import { loadSettings } from './context.js';

let output = (packId, event) => playPackEvent(packId, event);

/** output(packId, event, mode) */
export function setSoundOutput(play) {
  output = play;
}

export async function playSound(event) {
  const settings = await loadSettings();
  if (settings.alertSound) output(settings.soundPack, event, settings.mode);
}
