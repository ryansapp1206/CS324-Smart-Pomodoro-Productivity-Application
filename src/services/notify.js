/* =====================================================================
   NOTIFICATIONS, SOUND AND TAB TITLE
   - Notifications use the browser's Notification API, so they show even
     when the tab is in the background (but open). The browser asks the
     user for permission the first time they press Start.
   - The tab title shows the time left ("24:13 · Focus"), so it's visible
     from other tabs.
   ===================================================================== */

import { formatClock } from '../core/utils.js';
import { t } from '../core/theme-engine.js';
import { playSoundPack } from '../audio/player.js';
import { plainText } from '../timer/messages.js';
import * as rules from '../timer/rules.js';

const ICON = 'icons/icon128.png';

export function notificationsSupported() {
  return typeof Notification !== 'undefined';
}

/** Ask once (must be called from a click). Does nothing if already allowed or blocked. */
export function requestNotificationPermission() {
  if (notificationsSupported() && Notification.permission === 'default') Notification.requestPermission();
}

/** A system notification. A newer one with the same `tag` replaces the older one. */
export function showNotification(tag, title, message) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  try {
    const notification = new Notification(plainText(title), { body: plainText(message), icon: ICON, tag });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch (error) {
    console.warn('[notify] could not show notification', error);
  }
}

/** event: 'sessionEnd' | 'breakEnd'. */
export function playAlert(soundPackId, event) {
  playSoundPack(soundPackId, event);
}

/** "24:13 · Focus · Pomodoro" while a session runs, the app name otherwise (both from the theme's text). */
export function updateTabTitle(timer, settings) {
  if (typeof document === 'undefined') return;
  const appName = plainText(t('app.name'));
  if (!timer || timer.status === 'idle') {
    document.title = appName;
    return;
  }
  const time = formatClock(rules.remainingMs(timer, settings));
  const paused = timer.status === 'paused' ? ` (${plainText(t('timer.paused'))})` : '';
  document.title = `${time}${paused} · ${plainText(t('mode.' + timer.mode))} · ${appName}`;
}
