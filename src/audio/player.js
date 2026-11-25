/* =====================================================================
   SOUND PLAYER
   Plays a sound pack: recorded audio files if the pack has `files`,
   otherwise its `notes` synthesized with the Web Audio API.
   Used for Shop previews and session-end alerts. Sound packs live in
   the active ecosystem (src/content/<mode>/sounds/).
   ===================================================================== */

import { activeEcosystem } from '../core/theme-engine.js';

let audioContext = null;

/** Browsers only allow sound after a click, so call this from a click handler. */
export function unlockAudio() {
  try {
    audioContext ??= new AudioContext();
    if (audioContext.state === 'suspended') audioContext.resume();
  } catch {
    /* no audio support: sounds are silently skipped */
  }
}

/** Play notes: [{ frequency, slideTo?, startAt?, duration?, wave?, volume? }]. */
export function playNotes(notes) {
  unlockAudio();
  if (!audioContext) return;
  try {
    const now = audioContext.currentTime + 0.02;
    for (const note of notes) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const start = now + (note.startAt || 0);
      const duration = note.duration || 0.2;

      oscillator.type = note.wave || 'sine';
      oscillator.frequency.setValueAtTime(note.frequency, start);
      if (note.slideTo) oscillator.frequency.exponentialRampToValueAtTime(note.slideTo, start + duration);

      // Quick fade in and out so notes don't click.
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(note.volume || 0.18, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.05);
    }
  } catch {
    /* ignore audio errors */
  }
}

/** The pack with this id in the active ecosystem, or the ecosystem's default pack. */
function findSoundPack(packId) {
  const { sounds, defaults } = activeEcosystem();
  return sounds.find((candidate) => candidate.id === packId) || sounds.find((candidate) => candidate.id === defaults.soundPack);
}

/** Play an audio file (for packs with recorded sounds). */
function playFile(url) {
  try {
    const audio = new Audio(url);
    audio.play().catch(() => {}); // blocked until the user has clicked something on the page
  } catch {
    /* no audio support */
  }
}

/**
 * Play a sound pack. event: 'sessionEnd' | 'breakEnd'.
 * A pack either has `files` (recorded audio, one per event) or `notes` (synthesized).
 */
export function playSoundPack(packId, event = 'sessionEnd') {
  const pack = findSoundPack(packId);
  const file = pack.files && (pack.files[event] || pack.files.sessionEnd);
  if (file) playFile(file);
  else playNotes(pack.notes(event));
}
