/* =====================================================================
   UI BUILDING BLOCKS
   Small functions that return HTML strings. Screens are built from these.
   All visual styling comes from CSS classes that use theme tokens.

   Buttons say what they do with data attributes (see src/app/events.js):
     data-action="startTimer"  runs that action from a screen's `actions`
     data-arg="..."            the argument (a task id, a mode, …)
     data-focus-id="..."       stable id used to restore keyboard focus after re-rendering
   ===================================================================== */

import { escapeHtml, getByPath, daysUntil, fromDayKey, formatDate } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { t, activeEcosystem } from '../core/theme-engine.js';

/**
 * A button that runs an action when clicked.
 * options: { arg, className, icon, disabled, ariaLabel, focusId, attributes }
 * `label` is already-safe HTML (text from t() or escaped values).
 */
export function actionButton(action, label, options = {}) {
  const arg = options.arg ?? '';
  const focusId = options.focusId || `${action}:${arg}`;
  const attributes = [
    `type="button"`,
    `class="${options.className || 'btn'}"`,
    `data-action="${action}"`,
    `data-arg="${escapeHtml(arg)}"`,
    `data-focus-id="${escapeHtml(focusId)}"`,
    options.disabled ? 'disabled' : '',
    options.ariaLabel ? `aria-label="${options.ariaLabel}"` : '',
    options.attributes || '',
  ]
    .filter(Boolean)
    .join(' ');
  const iconHtml = options.icon ? icon(options.icon) : '';
  const labelHtml = label ? `<span>${label}</span>` : '';
  return `<button ${attributes}>${iconHtml}${labelHtml}</button>`;
}

/** A disabled button used to show a state ("Equipped", "Need 50 more"). */
export function disabledButton(label, iconName = '') {
  return `<button type="button" class="btn btn-sm" disabled>${iconName ? icon(iconName) : ''}<span>${label}</span></button>`;
}

export function errorMessage(id, message) {
  if (!message) return '';
  return `<div class="err" id="${id}-err">${icon('alert')}<span>${message}</span></div>`;
}

export function banner(kind, iconName, content, { role = 'status', extraClass = '', trailing = '' } = {}) {
  return `
    <div class="banner banner-${kind} ${extraClass}" role="${role}">
      ${icon(iconName)}
      <div class="grow">${content}</div>
      ${trailing}
    </div>`;
}

export function closeBannerButton(which) {
  return actionButton('dismissBanner', '', { arg: which, className: 'icon-btn', icon: 'x', ariaLabel: t('common.close') });
}

/** A toggle switch row bound to a UI state path (e.g. 'settingsDraft.autoStart'). */
export function switchRow(app, path, labelKey, descriptionKey) {
  const id = `app-${path.replace(/\./g, '-')}`;
  const checked = getByPath(app.ui, path) ? 'checked' : '';
  const description = descriptionKey ? `<div class="sub" id="${id}-d">${t(descriptionKey)}</div>` : '';
  const describedBy = descriptionKey ? `aria-describedby="${id}-d"` : '';
  return `
    <div class="sw-row">
      <div class="sw-txt"><label for="${id}">${t(labelKey)}</label>${description}</div>
      <input type="checkbox" role="switch" class="switch" id="${id}" ${checked}
        data-bind="${path}" data-live="render" data-focus-id="${path}" ${describedBy}>
    </div>`;
}

/** A segmented control button (one choice of several). */
export function segmentButton(action, value, label, isSelected, extraClass = '') {
  return `
    <button type="button" class="seg-btn${isSelected ? ' on' : ''} ${extraClass}"
      data-action="${action}" data-arg="${value}" data-focus-id="${action}:${value}"
      aria-pressed="${isSelected}">${label}</button>`;
}

export function swatchHtml(colors, className = 'swatch') {
  return `<span class="${className}" aria-hidden="true">${colors.map((color) => `<i style="background:${color}"></i>`).join('')}</span>`;
}

/* ------------------------------ Avatars ------------------------------ */

export function initialsOf(name) {
  return (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

/** The user's profile picture: an equipped avatar's photo or icon badge, or their initials. */
export function avatarHtml(user, avatarId, className = 'av') {
  const avatar = activeEcosystem().avatars.find((candidate) => candidate.id === avatarId);
  if (avatar && avatar.image) {
    return `<span class="${className} av-photo" style="background:${avatar.color}" aria-hidden="true"><img src="${avatar.image}" alt=""></span>`;
  }
  if (avatar) {
    return `<span class="${className} av-icon" style="background:${avatar.color}" aria-hidden="true">${icon(avatar.icon)}</span>`;
  }
  return `<span class="${className}" aria-hidden="true">${escapeHtml(initialsOf(user.displayName))}</span>`;
}

/* ------------------------------- Tasks ------------------------------- */

/** Contract priorities are 'Low' | 'Medium' | 'High'; CSS classes and copy keys use lowercase. */
export function priorityKey(priority) {
  return priority ? priority.toLowerCase() : 'none';
}

export function priorityPill(priority) {
  const key = priorityKey(priority);
  return `<span class="pill pri-${key}">${t('pri.pill', { p: t('pri.' + key) })}</span>`;
}

export function dueDateLabel(dayKey) {
  const days = daysUntil(dayKey);
  if (days < 0) return `<span class="due overdue">${icon('alert')}${t('due.overdue', { date: formatDate(fromDayKey(dayKey)) })}</span>`;
  if (days === 0) return `<span class="due today">${icon('calendar')}${t('due.today')}</span>`;
  if (days === 1) return `<span class="due">${icon('calendar')}${t('due.tomorrow')}</span>`;
  const date = formatDate(fromDayKey(dayKey), { weekday: 'short', month: 'short', day: 'numeric' });
  return `<span class="due">${icon('calendar')}${t('due.on', { date })}</span>`;
}

export function dueDateHint(dayKey) {
  if (!dayKey) return t('form.dueNone');
  return t('form.dueOn', { date: formatDate(fromDayKey(dayKey), { weekday: 'short', month: 'short', day: 'numeric' }) });
}

function sessionCountText(count) {
  return count === 1 ? t('tasks.sessionOne') : t('tasks.sessions', { n: count });
}

/** Timer icon + count, with a screen-reader friendly label. */
export function sessionCountBadge(count) {
  if (!count) return '';
  return `<span class="session-count"><span aria-hidden="true">${icon('timer')}${count}</span><span class="sr-only">${sessionCountText(count)}</span></span>`;
}

/** Priority, due date, focus sessions and "current" markers under a task title. */
export function taskMeta(task, sessionCount, isCurrent) {
  const parts = [];
  if (task.priority) parts.push(priorityPill(task.priority));
  if (task.dueDate) parts.push(dueDateLabel(task.dueDate));
  if (sessionCount) parts.push(sessionCountBadge(sessionCount));
  if (isCurrent) parts.push(`<span class="pill pill-current">${t('tasks.current')}</span>`);
  return parts.length ? `<div class="task-meta">${parts.join('')}</div>` : '';
}

/* ------------------------------- Sync ------------------------------- */

export const SYNC_ICONS = { synced: 'cloudCheck', syncing: 'refresh', offline: 'cloudOff', failed: 'alert' };

export function lastSyncedText(app) {
  if (!app.lastSyncedAt) return t('sync.never');
  const minutesAgo = Math.floor((Date.now() - app.lastSyncedAt) / 60000);
  let when;
  if (minutesAgo < 1) when = t('sync.justNow');
  else if (minutesAgo < 60) when = t('sync.minAgo', { n: minutesAgo });
  else when = formatDate(app.lastSyncedAt, { hour: 'numeric', minute: '2-digit' });
  return t('sync.lastSynced', { when });
}

/* ------------------------------ Currency ------------------------------ */

/** The balance as text, or a glowing infinity icon for an unlimited account. */
export function balanceHtml(app) {
  if (app.hasUnlimitedBalance()) {
    return `<span class="balance-infinite" aria-hidden="true">${icon('infinity', 'i i-glyph')}</span><span class="sr-only">${t('currency.unlimited')}</span>`;
  }
  return app.balance().toLocaleString();
}
