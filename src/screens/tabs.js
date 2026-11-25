/* =====================================================================
   TAB SCREENS
   Which file draws each tab. Tab ids match the copy keys (tab.timer, …),
   so a theme can rename a tab without touching code.
   To add a tab: make a screen file, add it here and to TABS in shell.js.
   ===================================================================== */

import { timerScreen } from './timer.js';
import { tasksScreen } from './tasks.js';
import { statsScreen } from './stats.js';
import { shopScreen } from './shop.js';
import { settingsScreen } from './settings.js';

export const TAB_SCREENS = {
  timer: timerScreen,
  tasks: tasksScreen,
  stats: statsScreen,
  shop: shopScreen,
  settings: settingsScreen,
};
