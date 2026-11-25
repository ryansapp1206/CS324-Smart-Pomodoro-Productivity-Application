/* =====================================================================
   SOUND PLAYER
   Plays a sound pack: recorded audio files if the pack has `files`,
   otherwise its `notes` synthesized with the Web Audio API. Sound packs
   live in the active ecosystem (src/content/<mode>/sounds/), so brainrot
   sounds can only play in brainrot mode. To play a sound from app code,
   use playSound() in src/services/sound.js (it checks the Sound setting).
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

/* ------------------------------ Sound events ------------------------------
   Every sound the app makes is one of these events. A sound pack decides
   what each one sounds like, so equipping a pack changes all of them.
   Priority: a less important sound is skipped while a more important one
   plays; otherwise the new sound replaces the one playing. The same clip
   is never restarted, so a set completing and an achievement unlocking at
   the same moment play the choir once. */

export const SOUND_EVENTS = {
  sessionEnd: 2, // a focus session finished
  setComplete: 3, // the 4th focus session in a row finished (long break earned)
  achievement: 3, // an achievement unlocked
  breakEnd: 1, // a break finished
  smallWin: 1, // task done, item bought or equipped
  stopEarly: 2, // a session was stopped or reset before the end
};

/**
 * For packs that synthesize notes and only define some events: which
 * event's sound to use instead (smallWin has no stand-in, so it's silent).
 */
const NOTES_FALLBACK = { setComplete: 'sessionEnd', achievement: 'sessionEnd', stopEarly: 'breakEnd' };

/** The pack with this id in the active ecosystem, or the ecosystem's default pack. */
function findSoundPack(packId) {
  const { sounds, defaults } = activeEcosystem();
  return sounds.find((candidate) => candidate.id === packId) || sounds.find((candidate) => candidate.id === defaults.soundPack);
}

let current = null; // { audio, priority, url } of the file playing now

/** Play an audio file. Resolves when it finishes (or fails or is interrupted). */
function playFile(url, priority = 1) {
  return new Promise((resolve) => {
    try {
      const audio = new Audio(url);
      const done = () => {
        if (current && current.audio === audio) current = null;
        resolve();
      };
      audio.addEventListener('ended', done);
      audio.addEventListener('error', done);
      audio.addEventListener('pause', done);
      current = { audio, priority, url };
      audio.play().catch(done); // blocked until the user has clicked something on the page
    } catch {
      resolve(); // no audio support
    }
  });
}

function playNotesFor(pack, event) {
  const handled = pack.events || ['sessionEnd', 'breakEnd'];
  const use = handled.includes(event) ? event : NOTES_FALLBACK[event];
  if (use) playNotes(pack.notes(use));
}

/**
 * Play one event from a pack. A pack has either `files` (recorded audio:
 * one per event, plus `default` for events without their own file) or
 * `notes(event)` (synthesized; `events` lists the ones it handles).
 */
export function playPackEvent(packId, event) {
  const pack = findSoundPack(packId);
  const priority = SOUND_EVENTS[event] || 1;
  const file = pack.files && (pack.files[event] || pack.files.default);
  if (current && !current.audio.ended) {
    if (current.priority > priority) return; // something more important is playing
    if (file && current.url === file) return; // this exact clip is already playing
    current.audio.pause(); // the new sound replaces it
  }
  if (!pack.files) return playNotesFor(pack, event);
  if (file) playFile(file, priority);
}

/** Kept for older callers: same as playPackEvent. */
export function playSoundPack(packId, event = 'sessionEnd') {
  playPackEvent(packId, event);
}

/** The Shop's preview: the pack's `preview` events one after the other, or just 'sessionEnd'. */
export async function previewSoundPack(packId) {
  const pack = findSoundPack(packId);
  if (current) current.audio.pause();
  if (!pack.files) return playNotesFor(pack, 'sessionEnd');
  for (const event of pack.preview || ['sessionEnd']) {
    const file = pack.files[event] || pack.files.default;
    if (file) await playFile(file, 3);
  }
}
