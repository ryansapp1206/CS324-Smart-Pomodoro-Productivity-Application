/* =====================================================================
   POPUP START-UP
   Creates the app inside index.html, wires up events, starts the timer
   and reminder services, and restores the signed-in user.
   ===================================================================== */

import { App } from './app/app.js';
import { attachEventHandlers } from './app/events.js';
import { boot } from './app/account.js';
import { startServices } from './services/index.js';
import { startDevConsole } from './dev/console.js'; // development only

// The extension's toolbar popup opens index.html?popup (fixed-size window, see page.css).
if (new URLSearchParams(location.search).has('popup')) document.documentElement.dataset.surface = 'popup';

const app = new App(document.getElementById('app'));
attachEventHandlers(app);
startServices();
boot(app);
startDevConsole(app);
