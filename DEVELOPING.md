# Pomodoro app: developer guide

This is the app itself: a plain website hosted on GitHub Pages. The clickable prototype stays in `design/prototype/` and isn't used by the app.

The app works fully with a **mock backend** that keeps everything in the browser's localStorage. The real backend replaces one file (see [Plugging in the backend](#plugging-in-the-backend)), and nothing else changes.

## Run it locally

There's no build step: the files are plain JavaScript modules that the browser loads directly. Modules don't load from `file://`, so serve the folder:

```
python3 -m http.server 8080      # then open http://localhost:8080
```

VS Code's **Live Server** extension works too.

Log in with the demo account `tungtung@ramranch.app` / `pomodoro123`, or create an account. After changing code, refresh the page.

## Put it on GitHub Pages

1. On GitHub, open the repo's **Settings → Pages**.
2. Under **Build and deployment**, pick **Deploy from a branch**, then branch `main` and folder `/ (root)`.
3. Save. A minute later the app is live at `https://<user>.github.io/<repo>/`.

Every push to `main` updates the site. All paths are relative, so it works in a subfolder too. `.nojekyll` tells Pages to serve the files as they are.

## What a website can't do (yet)

The timer, alerts and reminders run inside the page:
- **Tab open:** everything works. In another tab you get a browser notification if you allowed it; the browser asks the first time you press Start.
- **Tab closed:** nothing can alert you. The timer is saved as an end time, so reopening shows the right time, and a session that finished meanwhile is counted.

Making it a browser extension later would fix this. All of it is in `src/services/`, which is the only part that would change.

## Where things are

```
index.html               the page (loads src/main.js)
icons/                   favicon and home-screen icon
src/
  config.js              which backend to use
  main.js                start-up

  core/                  shared helpers, no screen code
    copy.js              ALL user-facing text (themes can override any line)
    theme-engine.js      picks the mode (ecosystem) and theme: setMode(), applyTheme(), t()
    storage.js           localStorage wrapper + every storage key
    utils.js, icons.js

  content/               two separate ecosystems; only the currency is shared (see content/README.md)
    index.js             lists the ecosystems
    professional/        the default: its own themes, sounds, shop items, wording, currency name
    brainrot/            the hidden one: the same pieces, plus copy.js with the meme-speak

  data/                  the ONLY way to reach the backend
    index.js             picks the backend from config.js
    mock-backend.js      in-browser backend with the demo account
    model.js             defaults + validation shared by every backend
    demo-data.js, errors.js

  timer/                 timer rules as plain functions
  services/              things that run next to the screens
    index.js             start-up and wiring
    timer-service.js     timer commands and session end
    session-queue.js     saves finished sessions, retries when offline
    reminders.js         deadline + daily reminders
    notify.js            browser notifications, sound, tab title
  audio/                 sound synthesis for previews and alerts
  shop/                  shop catalog (active ecosystem), currency balance, streaks, achievements

  app/                   app state and plumbing
    app.js               the App object: state + small helpers
    account.js           start-up, log in/out, loading data, cache
    saving.js            saveChange(): save → Synced, or error + Retry
    timer-client.js      talks to the timer service, session alerts
    render.js, events.js, state.js, settings-draft.js, deadlines.js

  screens/               one file per screen: what it draws + what its buttons do
    auth.js              log in, register, forgot/reset password
    shell.js             header, banners, tab bar, loading/error states
    timer.js             Timer tab
    tasks.js             Tasks tab
    task-form.js         create/edit task sheet
    task-picker.js       "which task are you focusing on" dialog
    stats.js             Stats tab
    shop.js              Shop tab
    settings.js          Settings tab
    profile.js           Profile
    tabs.js              which file draws which tab
    index.js             collects every screen's actions/forms

  ui/                    building blocks: buttons, banners, pills, confirm dialog
  styles/                app.css imports one file per area; screens/ has one per screen
```

## How a screen works

Each file in `src/screens/` exports:

- a **render function** that returns HTML, built from `src/ui/components.js`
- `actions`: what its buttons do. A button with `data-action="startTimer"` runs `actions.startTimer(app, arg)`.
- `forms` (optional): submit handlers. `<form data-form="task">` runs `forms.task(app)`.
- `liveUpdates` (optional): runs while typing in an input with `data-live="name"`.

`src/screens/index.js` merges them all and warns if two screens use the same name.

Screens read state from `app` (`app.tasks()`, `app.settings()`, `app.timer`, `app.ui`), change it, and call `app.render()`. To save something, they use `saveChange()` from `src/app/saving.js`, which:

1. shows the change straight away
2. calls the data layer
3. on failure, undoes the change and shows the error with **Retry** (req 6.5)

## Common changes

| I want to… | Edit |
| --- | --- |
| Change any wording | `src/core/copy.js`, or the theme's `copy` for theme-specific wording |
| Rename the currency in an ecosystem | `currency: { name, title }` in `src/content/<ecosystem>/index.js` |
| Add a theme, sound pack or profile picture | Add one file in `src/content/<professional or brainrot>/…` and one line in that ecosystem's `index.js` ([guide](src/content/README.md)) |
| Finish a "coming soon" theme | In its `theme.js`, add `tokens`, `copy` (and `currency` if it renames it), and remove `comingSoon` and `swatch` |
| Change a color or font | A theme's `tokens`. Never hard-code colors in CSS or JS |
| Change a screen's layout | `src/screens/<screen>.js` and `src/styles/screens/<screen>.css` |
| Add a button to a screen | Add the HTML with `actionButton('myAction', label)` and add `myAction` to that file's `actions` |
| Add a tab | New file in `src/screens/`, then add it to `tabs.js`, to `TABS` in `shell.js` and to `screens/index.js`. Add a `tab.<id>` line to `copy.js` |
| Change timer rules | `src/timer/rules.js` |
| Change rewards or achievements | `src/shop/progress.js` |
| Add a setting | Default in `DEFAULT_SETTINGS` (`src/data/model.js`), control in `screens/settings.js`, text in `copy.js` |

## Plugging in the backend

Every data call goes through `src/data/index.js`, so the backend is one new file. If it needs a library such as the Firebase SDK, import it from a CDN URL inside that file, since there's no bundler:

1. Create `src/data/<name>-backend.js` that exports the same functions as `mock-backend.js` (the data contract in the team plan):
   - accounts: `signUp`, `signIn`, `signOut`, `resetPassword`, `getCurrentUser`, `updateProfile`
   - data: `getTasks`, `saveTask`, `deleteTask`, `recordSession`, `getSessions`, `getSettings`, `saveSettings`, `getPurchases`, `purchase`
2. Use `model.js` for the same validation and defaults: `prepareTask`, `prepareSession`, `normalizeSettings`, `validateSettings`, `preparePurchase`.
3. Fail by throwing `new DataError(code, copyKey)` from `errors.js`. Codes the app reacts to:
   - `network`: shows "Offline"
   - `signed-out`: logs the user out
   - `email-taken`: shown under the email field
   - anything else: shown with Retry
4. Add it to `BACKENDS` in `src/data/index.js` and set `backend` in `src/config.js`.

Things the app relies on:
- **Stay signed in.** `getCurrentUser()` must work after a reload and must not need the network.
- **Sign-in in storage.** Keep it in storage under `STORAGE_KEYS.auth` (use `storage` from `src/core/storage.js`). Logging out must remove that key, because `src/services/index.js` watches it to clear the timer and reminders.
- **Safe retries.** `recordSession()` may be called more than once with the same session `id` (offline retries). Save it under that id so it's never counted twice.
- **Password reset.** Only the mock backend has `confirmPasswordReset` (the in-app "Set a new password" step). A real backend emails a link and handles the new password on its own page.

## Decisions beyond the data contract

- **Settings fields added:** `sessionAlerts`, `breakAlerts`, `autoStart`, `reduceMotion`, `dailyReminder { enabled, time }` and `taskSort`. `normalizeSettings()` fills in defaults, so older saved settings still load.
- **Two ecosystems, professional first.** `settings.mode` (`'professional'` by default, or `'brainrot'`) picks the themes, sounds, profile pictures, wording and currency name. Only the balance is shared: *points* in professional, *aura* in brainrot. Brainrot is built but has no toggle in the UI yet.
- **Settings keep one equipped id per kind.** If it belongs to the other ecosystem, that ecosystem's default is used (see `equippedId()` in `src/shop/catalog.js`).
- **No emoji anywhere.** Icons come from `src/core/icons.js`.
- **Coming-soon items can be pre-bought**, as in the prototype.
- **The balance and session counts are worked out, not stored:** a task's focus-session count comes from the sessions list.

## AI use disclosure

This app was ported from the team's prototype with help from Claude (Anthropic's AI assistant).
