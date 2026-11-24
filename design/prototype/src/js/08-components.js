/* =====================================================================
   UI BUILDING BLOCKS
   Small functions that return HTML strings. Screens are built from these.
   All visual styling comes from CSS classes that use theme tokens.
   ===================================================================== */

/**
 * A button that runs ACTIONS[action] when clicked.
 * options: { arg, className, icon, disabled, ariaLabel, focusId, attributes }
 * `label` is already-safe HTML (text from t() or escaped values).
 */
function actionButton(action, label, options = {}) {
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
function disabledButton(label, iconName = '') {
  return `<button type="button" class="btn btn-sm" disabled>${iconName ? icon(iconName) : ''}<span>${label}</span></button>`;
}

function errorMessage(id, message) {
  if (!message) return '';
  return `<div class="err" id="${id}-err">${icon('alert')}<span>${message}</span></div>`;
}

function banner(kind, iconName, content, { role = 'status', extraClass = '', trailing = '' } = {}) {
  return `
    <div class="banner banner-${kind} ${extraClass}" role="${role}">
      ${icon(iconName)}
      <div class="grow">${content}</div>
      ${trailing}
    </div>`;
}

function closeBannerButton(which) {
  return actionButton('dismissBanner', '', {
    arg: which,
    className: 'icon-btn',
    icon: 'x',
    ariaLabel: t('common.close'),
  });
}

/** A toggle switch row bound to a UI state path (e.g. 'settingsDraft.autoStart'). */
function switchRow(app, path, labelKey, descriptionKey) {
  const id = `${app.id}-${path.replace(/\./g, '-')}`;
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
function segmentButton(action, value, label, isSelected, extraClass = '') {
  return `
    <button type="button" class="seg-btn${isSelected ? ' on' : ''} ${extraClass}"
      data-action="${action}" data-arg="${value}" data-focus-id="${action}:${value}"
      aria-pressed="${isSelected}">${label}</button>`;
}

function swatchHtml(colors, className = 'swatch') {
  return `<span class="${className}" aria-hidden="true">${colors.map((color) => `<i style="background:${color}"></i>`).join('')}</span>`;
}

function priorityPill(priority) {
  return `<span class="pill pri-${priority}">${t('pri.pill', { p: t('pri.' + priority) })}</span>`;
}

function dueDateLabel(dayKey) {
  const days = daysUntil(dayKey);
  if (days < 0)
    return `<span class="due overdue">${icon('alert')}${t('due.overdue', { date: formatDate(fromDayKey(dayKey)) })}</span>`;
  if (days === 0) return `<span class="due today">${icon('calendar')}${t('due.today')}</span>`;
  if (days === 1) return `<span class="due">${icon('calendar')}${t('due.tomorrow')}</span>`;
  const date = formatDate(fromDayKey(dayKey), { weekday: 'short', month: 'short', day: 'numeric' });
  return `<span class="due">${icon('calendar')}${t('due.on', { date })}</span>`;
}

function dueDateHint(dayKey) {
  if (!dayKey) return t('form.dueNone');
  return t('form.dueOn', {
    date: formatDate(fromDayKey(dayKey), { weekday: 'short', month: 'short', day: 'numeric' }),
  });
}

function sessionCountText(count) {
  return count === 1 ? t('tasks.sessionOne') : t('tasks.sessions', { n: count });
}

/** "🍅 3" with a screen-reader friendly label. */
function sessionCountBadge(count) {
  if (!count) return '';
  return `<span><span aria-hidden="true">${themeEmoji('focus')} ${count}</span><span class="sr-only">${sessionCountText(count)}</span></span>`;
}

/** Priority, due date, focus sessions and "current" markers under a task title. */
function taskMeta(task, isCurrent) {
  const parts = [];
  if (task.priority) parts.push(priorityPill(task.priority));
  if (task.dueDate) parts.push(dueDateLabel(task.dueDate));
  if (task.sessionCount) parts.push(sessionCountBadge(task.sessionCount));
  if (isCurrent) parts.push(`<span class="pill pill-current">${t('tasks.current')}</span>`);
  return parts.length ? `<div class="task-meta">${parts.join('')}</div>` : '';
}

function lastSyncedText(app) {
  if (!app.lastSyncedAt) return t('sync.never');
  const minutesAgo = Math.floor((Date.now() - app.lastSyncedAt) / 60000);
  let when;
  if (minutesAgo < 1) when = t('sync.justNow');
  else if (minutesAgo < 60) when = t('sync.minAgo', { n: minutesAgo });
  else when = formatDate(app.lastSyncedAt, { hour: 'numeric', minute: '2-digit' });
  return t('sync.lastSynced', { when });
}

const SYNC_ICONS = { synced: 'cloudCheck', syncing: 'refresh', offline: 'cloudOff', failed: 'alert' };
