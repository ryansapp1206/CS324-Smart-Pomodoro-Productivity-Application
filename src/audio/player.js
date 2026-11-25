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

/** Play an audio file. Resolves when it finishes (or fails). */
function playFile(url) {
  return new Promise((resolve) => {
    try {
      const audio = new Audio(url);
      audio.addEventListener('ended', resolve);
      audio.addEventListener('error', resolve);
      audio.play().catch(resolve); // blocked until the user has clicked something on the page
    } catch {
      resolve(); // no audio support
    }
  });
}

/**
 * Play a sound pack. event: 'sessionEnd' | 'breakEnd'.
 * A pack has either `files` (recorded audio: one per event, plus `default`
 * for any event without its own file) or `notes` (synthesized).
 */
export function playSoundPack(packId, event = 'sessionEnd') {
  const pack = findSoundPack(packId);
  if (!pack.files) return playNotes(pack.notes(event));
  const file = pack.files[event] || pack.files.default;
  if (file) playFile(file);
}

/** The Shop's preview: the pack's `preview` events one after the other, or just 'sessionEnd'. */
export async function previewSoundPack(packId) {
  const pack = findSoundPack(packId);
  if (!pack.files) return playNotes(pack.notes('sessionEnd'));
  for (const event of pack.preview || ['sessionEnd']) {
    const file = pack.files[event] || pack.files.default;
    if (file) await playFile(file);
  }
}
