# Prototype source

The prototype ships as one self-contained HTML file so it can be opened offline or hosted anywhere.
This folder holds the same code split into readable modules. `build.sh` joins them in order:

```
./design/prototype/build.sh   →   design/prototype/dist/index.html   (dist/ is not committed)
```

## Publishing an update

The live site is served from the `gh-pages` branch, which only holds `index.html` and `.nojekyll`.
After rebuilding, copy the new file onto that branch:

```
./design/prototype/build.sh
git worktree add ../gh-pages gh-pages
cp design/prototype/dist/index.html ../gh-pages/index.html
cd ../gh-pages && git commit -am "Update prototype" && git push && cd -
git worktree remove ../gh-pages
```

| File | What it contains |
| --- | --- |
| `src/index.template.html` | Page markup: device area, Prototype controls panel, notifications, screen gallery |
| `src/styles/prototype.css` | Styles for the page and demo tools (fixed colors) |
| `src/styles/app.css` | Styles for the app. Uses theme tokens (`var(--primary)` …) only |
| `src/js/01-core.js` | Helpers, safe storage, icons |
| `src/js/02-copy.js` | `BASE_COPY`: every user-facing string, grouped by screen |
| `src/js/03-theme-engine.js` | `registerTheme`, `t()`, `applyTheme`, plus the theme format and rules |
| `src/themes/01-boring.js` | Boring Light (with the full token list) and Boring Dark |
| `src/themes/02-brainrot.js` | Brainrot theme: tokens, meme copy, emoji, decorations, theme-only CSS |
| `src/js/04-shop.js` | Shop catalog: theme stubs, synthesized sound packs, profile pictures |
| `src/js/05-data.js` | Mock cloud and API (the swap point for Firebase), demo data, achievements, aura |
| `src/js/06-app.js` | `PomodoroApp` class: state, sync, timer, reminders, navigation, task form |
| `src/js/07-actions.js` | `ACTIONS` (buttons, by `data-action`), `FORM_HANDLERS` (by `data-form`), event wiring |
| `src/js/08-components.js` | Small HTML building blocks |
| `src/js/09-screens-auth.js` | Log in, register, forgot/reset password |
| `src/js/10-screens-main.js` | Header, tabs, Timer, Tasks, Stats, Shop, Settings, Profile |
| `src/js/11-render.js` | Dialogs, render loop (keeps focus and scroll), toasts |
| `src/js/12-prototype.js` | Device mounting, Prototype controls, screen gallery, clock |

## Adding a theme

Write one `registerTheme({...})` block (copy `src/themes/01-boring.js` as a starting point) and add the file to the
`SCRIPTS` list in `build.sh`. Components never hard-code colors or text, so nothing else changes.
If the theme's `id` matches a "coming soon" stub in `src/js/04-shop.js`, anyone who bought it can equip it right away.

## Adding a shop item

Add one entry to `THEME_CATALOG`, `SOUND_PACKS` or `AVATARS` in `src/js/04-shop.js`.

## Formatting

Code is formatted with Prettier (`.prettierrc`): `npx prettier --write "design/prototype/src/**/*.{js,css}"`.
