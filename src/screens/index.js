/* =====================================================================
   SCREEN REGISTRY
   Each screen file exports what it handles:
     actions      button clicks   (data-action="name")
     forms        form submits    (data-form="name")
     liveUpdates  typing         (data-live="name")
   They're merged here for src/app/events.js. A duplicate name is reported
   in the console, so two screens can't silently fight over one.
   ===================================================================== */

import * as auth from './auth.js';
import * as shell from './shell.js';
import * as timer from './timer.js';
import * as taskPicker from './task-picker.js';
import * as tasks from './tasks.js';
import * as taskForm from './task-form.js';
import * as stats from './stats.js';
import * as shop from './shop.js';
import * as settings from './settings.js';
import * as profile from './profile.js';
import * as devices from './devices.js';
import * as confirm from '../ui/confirm-dialog.js';

const MODULES = { auth, shell, timer, taskPicker, tasks, taskForm, stats, shop, settings, profile, devices, confirm };

function collect(field) {
  const merged = {};
  for (const [moduleName, module] of Object.entries(MODULES)) {
    for (const [name, handler] of Object.entries(module[field] || {})) {
      if (merged[name]) console.error(`[screens] "${name}" is defined twice (${field}, ${moduleName})`);
      merged[name] = handler;
    }
  }
  return merged;
}

export const ACTIONS = collect('actions');
export const FORMS = collect('forms');
export const LIVE_UPDATES = collect('liveUpdates');
