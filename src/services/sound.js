/* =====================================================================
   SOUND EFFECTS
   The one place app code asks for a sound:  playSound('smallWin')
   Events are listed in src/audio/player.js (SOUND_EVENTS). The equipped
   sound pack decides what each one sounds like. Nothing plays unless the
   Sound setting is on.
   ===================================================================== */

import { playPackEvent } from '../audio/player.js';
import { loadSettings } from './context.js';

export async function playSound(event) {
  const settings = await loadSettings();
  if (settings.alertSound) playPackEvent(settings.soundPack, event);
}
