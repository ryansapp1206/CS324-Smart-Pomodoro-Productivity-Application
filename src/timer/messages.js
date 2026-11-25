/* =====================================================================
   SESSION-END MESSAGES
   The same title and text are used by the in-app alert card and the
   browser notification.
   ===================================================================== */

import { t } from '../core/theme-engine.js';

/** { title, body, primaryLabel } for a finished session. primaryLabel is null when the next one auto-started. */
export function sessionEndMessage({ finishedMode, nextMode, nextMinutes, autoStarted }) {
  let title;
  let body;
  let primaryLabel;

  if (finishedMode === 'focus') {
    title = nextMode === 'long' ? t('alert.focusDoneLong') : t('alert.focusDone');
    body = nextMode === 'long' ? t('alert.toLong', { n: nextMinutes }) : t('alert.toShort', { n: nextMinutes });
    primaryLabel = t('alert.startBreak');
  } else {
    title = t('alert.breakDone');
    body = t('alert.toFocus', { n: nextMinutes });
    primaryLabel = t('alert.startFocus');
  }

  if (autoStarted) {
    body += ' ' + t('alert.autoStarted');
    primaryLabel = null;
  }
  return { title, body, primaryLabel };
}

/** Copy text can contain simple HTML; notifications need plain text. */
export function plainText(html) {
  return String(html)
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
