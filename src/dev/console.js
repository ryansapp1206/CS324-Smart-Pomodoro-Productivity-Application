/* =====================================================================
   DEV CONSOLE (development only, remove or keep hidden before release)
   A small panel for testing faster: timer speed (1×, 10×, 60×) and
   "End session now".
   - Only exists when CONFIG.devTools is true (src/config.js).
   - Hidden until opened: add ?dev to the address, or press Ctrl+Shift+D.
   Everything it does goes through the timer service's dev commands
   (setSpeed, endNow in src/services/timer-service.js).
   ===================================================================== */

import { icon } from '../core/icons.js';
import { CONFIG } from '../config.js';
import { handleTimerCommand } from '../services/index.js';

const SPEEDS = [1, 10, 60];
let panel = null;

export function startDevConsole(app) {
  if (!CONFIG.devTools) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./console.css', import.meta.url).href;
  document.head.appendChild(link);

  if (new URLSearchParams(location.search).has('dev')) open(app);
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      panel ? close() : open(app);
    }
  });
}

function open(app) {
  panel = document.createElement('aside');
  panel.className = 'dev-console';
  panel.setAttribute('aria-label', 'Developer console');
  document.body.appendChild(panel);
  panel.addEventListener('click', (event) => onClick(app, event));
  draw(app);
}

function close() {
  panel.remove();
  panel = null;
}

function draw(app) {
  if (!panel) return;
  const speed = app.timer.speed || 1;
  const speedButtons = SPEEDS.map(
    (value) => `<button type="button" data-dev="speed" data-value="${value}" aria-pressed="${speed === value}" aria-label="${value} times speed">${value}${icon('x', 'i i-glyph dev-times')}</button>`
  ).join('');
  panel.innerHTML = `
    <div class="dev-head"><b>Dev console</b><button type="button" data-dev="close" aria-label="Close">${icon('x', 'i i-glyph')}</button></div>
    <div class="dev-label">Timer speed</div>
    <div class="dev-row">${speedButtons}</div>
    <button type="button" class="dev-wide" data-dev="endNow" ${app.timer.status === 'idle' ? 'disabled' : ''}>End session now</button>
    <div class="dev-hint">Ctrl+Shift+D to hide</div>`;
}

async function onClick(app, event) {
  const button = event.target.closest('[data-dev]');
  if (!button) return;
  const action = button.dataset.dev;
  if (action === 'close') return close();
  if (action === 'speed') app.timer = await handleTimerCommand('setSpeed', Number(button.dataset.value));
  if (action === 'endNow') app.timer = await handleTimerCommand('endNow');
  app.render();
  draw(app);
}

/** Keep the panel's buttons in step when the timer changes elsewhere. */
export function refreshDevConsole(app) {
  draw(app);
}
