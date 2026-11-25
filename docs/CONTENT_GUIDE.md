# File structure and content guide

Where everything lives in the app, and how to add or change **themes**, **profile pictures (PFPs)** and **sound packs**.

---

## 1. File structure

```
index.html                 the page; loads src/main.js
icons/                     favicon and home-screen icon
DEVELOPING.md              running the app, deploying to GitHub Pages
docs/                      these guides

src/
  config.js                which backend to use ('mock' for now)
  main.js                  start-up

  content/                 ← THEMES, SOUNDS, PFPs live here (section 2)
    index.js               lists the two ecosystems
    shared.js              fonts, corner radius and animation timing shared by all themes
    professional/          the default ecosystem
    brainrot/              the hidden ecosystem (Settings → Brainrot mode)

  core/
    copy.js                ALL the app's text (themes can override any line)
    icons.js               every icon (line drawings), referenced by name
    theme-engine.js        switches mode and theme; t() gets text
    storage.js, utils.js

  shop/                    shop catalog, currency balance, achievements
  data/                    the data layer (mock backend; see docs/BACKEND.md)
  timer/                   timer rules
  services/                timer, reminders, notifications, sound playback
  audio/                   plays sound packs (synthesized, no audio files)
  app/                     app state, saving, events, rendering
  screens/                 one file per screen (timer, tasks, stats, shop, settings, …)
  ui/                      small building blocks (buttons, banners, …)
  styles/                  app.css + one stylesheet per area and per screen
```

**Rule of thumb:**
- **New content** (a theme, PFP or sound) only touches `src/content/`.
- **New wording** only touches `src/core/copy.js`, or an ecosystem's `copy.js`.
- Screens and styles never need editing to add content.

---

## 2. The two ecosystems

```
src/content/
  index.js                         registers both ecosystems
  shared.js
  professional/
    index.js                       ← the professional lists
    themes/
      light/theme.js
      dark/theme.js
    sounds/
      classic-beep.js
  brainrot/
    index.js                       ← the brainrot lists
    copy.js                        meme-speak for all brainrot themes
    themes/
      brainrot/theme.js + theme.css
      sigma-grindset/theme.js      (coming soon)
      …
    sounds/
      tung-tung-tung-sahur.js (+ .mp3 files) …
    avatars/
      tung-tung-tung-sahur.js …
```

- **Professional** is what everyone sees by default. **Brainrot** appears when **Settings → Appearance → Brainrot mode** is turned on and saved.
- While a mode is on, Settings and the Shop show **only that ecosystem's** themes, sounds and PFPs.
- **The currency balance is shared.** Only its name changes: *points* in professional, *aura* in brainrot.

Each ecosystem's `index.js` holds:

```js
export default {
  id: 'professional',
  currency: { name: 'points', title: 'Points' },   // how the shared balance is named here
  copy: {},                                          // text overrides for this ecosystem
  defaults: { theme: 'light', soundPack: 'classic-beep', avatar: 'initials' },  // always owned
  themes: [light, dark],                             // order shown in Settings and the Shop
  sounds: [classicBeep],
  avatars: [],                                       // "Initials" is built in and always listed first
};
```

**Adding any item is always two steps:**
1. Create its file.
2. Import it in the ecosystem's `index.js` and add it to the matching list.

### Rules for every item

| Field | Rule |
| --- | --- |
| `id` | lowercase-with-dashes, **unique across both ecosystems**, and **never changed after release**, because purchases are saved as `theme:<id>`, `sound:<id>`, `avatar:<id>` |
| `name`, `description` | shown in the Shop. Professional items use plain, professional wording |
| `price` | in the shared currency; `0` means free. An ecosystem's default items are always owned |
| icons | **no emoji anywhere**; use icon names from `src/core/icons.js` (section 6) |
| art | only original work, no copyrighted images, audio or characters |

---

## 3. Themes

A theme is a folder with a `theme.js`, plus an optional `theme.css`.

### Add a theme

1. **Copy a theme folder.** `professional/themes/light/` lists every color; `brainrot/themes/brainrot/` shows a theme with its own CSS.
   ```
   src/content/professional/themes/slate/theme.js
   ```
2. **Edit it:**
   ```js
   /* Slate: cool grey, low glare. */
   import { SHARED_TOKENS } from '../../../shared.js';

   export default {
     id: 'slate',
     name: 'Slate',
     description: 'Cool grey and low glare.',
     appearance: 'light',          // 'light' | 'dark'
     price: 150,                   // 0 = free
     tokens: {
       ...SHARED_TOKENS,
       scheme: 'light',
       bg: '#eef1f4',
       surface: '#ffffff',
       // …every token from light/theme.js, with your colors
     },
   };
   ```
3. **Register it** in `src/content/professional/index.js`:
   ```js
   import slate from './themes/slate/theme.js';
   // …
   themes: [light, dark, slate],
   ```

It now appears in the Shop. Once bought, it shows in Settings → Theme.

### Theme fields

| Field | What it does |
| --- | --- |
| `appearance` | `'light'` or `'dark'` |
| `tokens` | the colors. Every component uses these through CSS variables like `var(--primary)`. Never hard-code colors anywhere else |
| `copy` (optional) | text overrides just for this theme, on top of the ecosystem's `copy` |
| `stylesheet` (optional) | extra CSS. Write `stylesheet: new URL('./theme.css', import.meta.url).href` and scope **every** rule with `[data-theme="<id>"]` |
| `decorations` (optional) | small HTML extras in fixed slots: `header-accent`, `timer-background`, `timer-overlay`, `empty-state-art`, `celebration` (the session-complete card), `achievement-badge-frame`. See the Tung Tung Tung Sahur theme's dancing celebration |
| `comingSoon` + `swatch` | sell a theme before it's built (below) |

### The color tokens

| Group | Tokens |
| --- | --- |
| Surfaces and text | `bg`, `surface`, `surface-raised`, `surface-sunken`, `border`, `border-strong`, `text`, `text-muted` |
| Brand and states | `primary`, `on-primary`, `focus-ring`, `success`, `success-bg`, `warning`, `warning-bg`, `danger`, `danger-bg`, `on-danger`, `info`, `info-bg` |
| Timer modes | `mode-focus`, `mode-short`, `mode-long`, `on-mode` |
| Task priorities | `priority-high`, `priority-high-bg`, `priority-medium`, `priority-medium-bg`, `priority-low`, `priority-low-bg` |
| Shadows | `shadow-sm`, `shadow-md` |
| Other | `scheme` (`'light'` or `'dark'`), plus `...SHARED_TOKENS` for fonts, radii and timing |

Keep text and buttons readable: at least **4.5:1** contrast for text, and **3:1** for button outlines and icons. Test the theme on every tab.

### Sell a theme before it's built ("coming soon")

The brainrot folder has six of these. A stub only needs:

```js
export default {
  id: 'mogger',
  name: 'Mogger',
  description: 'Sharp jawline energy.',
  price: 350,
  comingSoon: true,
  swatch: ['#111', '#222', '#e33', '#888', '#fff'],   // 5 preview colors for the Shop
};
```

People can buy it, and it shows "Owned · coming soon." **To finish it:** add `appearance` and `tokens`, then delete `comingSoon` and `swatch`. Everyone who bought it can equip it straight away.

### Change a theme

- **Colors:** edit its `tokens`.
- **Name or description:** edit `name` and `description`. Never change `id`.
- **Wording:** add keys to the theme's `copy`. Every key is in `src/core/copy.js`. For example, `'tab.timer': 'Grind'` renames the Timer tab.

---

## 4. Profile pictures (PFPs)

A PFP is an icon on a colored circle.

### Add a PFP

1. **Create** `src/content/<ecosystem>/avatars/<id>.js`:
   ```js
   /* Rocket profile picture: an icon badge. */
   export default {
     id: 'rocket',
     name: 'Rocket',
     description: 'Always launching something.',
     price: 80,
     icon: 'zap',          // any name from src/core/icons.js
     color: '#ffcc80',     // the circle's color (keep it light; the icon is dark)
   };
   ```
2. **Register it** in that ecosystem's `index.js`:
   ```js
   import rocket from './avatars/rocket.js';
   // …
   avatars: [/* … */, rocket],
   ```

The professional ecosystem has no PFPs yet. Its `avatars: []` is ready for them; "Initials" is always offered first.

### Change a PFP

Edit `icon`, `color`, `name`, `description` or `price`. Never change `id`.

**Use a photo instead of an icon:** crop the image square (about 160×160; `.webp` or `.png`) and put it next to the file. Then add:

```js
image: new URL('./rocket.webp', import.meta.url).href,
```

It fills the circle everywhere the PFP appears. `icon` and `color` stay as the fallback. `brainrot/avatars/tung-tung-tung-sahur.js` is an example.

---

## 5. Sound packs

A pack is either a list of **notes synthesized in the browser** (no audio files), or a pair of **recorded audio files** (see the end of this section).

### Add a sound pack

1. **Create** `src/content/<ecosystem>/sounds/<id>.js`:
   ```js
   /* Soft Chime sound pack. Synthesized in the browser: no audio files. */
   export default {
     id: 'soft-chime',
     name: 'Soft Chime',
     description: 'Three gentle rising notes.',
     price: 100,
     icon: 'bell',                      // shown in the Shop (src/core/icons.js)
     /** event: 'sessionEnd' (focus finished) or 'breakEnd' (break finished) */
     notes: (event) =>
       event === 'breakEnd'
         ? [{ frequency: 784, duration: 0.3 }, { frequency: 659, startAt: 0.18, duration: 0.4 }]
         : [
             { frequency: 523, duration: 0.25 },
             { frequency: 659, startAt: 0.15, duration: 0.25 },
             { frequency: 784, startAt: 0.3, duration: 0.45 },
           ],
   };
   ```
2. **Register it** in that ecosystem's `index.js`, in the `sounds` list.

### Note format

| Field | Meaning | Default |
| --- | --- | --- |
| `frequency` | pitch in Hz (440 = A4, 523 = C5, 880 = A5) | required |
| `startAt` | seconds after the sound starts | `0` |
| `duration` | seconds | `0.2` |
| `slideTo` | pitch to slide to by the end (drums, horns, drops) | none |
| `wave` | `'sine'` (soft), `'triangle'` (mellow), `'square'` (buzzy), `'sawtooth'` (bright) | `'sine'` |
| `volume` | 0 to 1 | `0.18` |

**Try it:** open the Shop, go to Sound packs, and press the speaker button next to the pack. You don't have to buy it to preview it.

### Use recorded audio instead

Put short `.mp3` files next to the pack's `.js` file, and use `files` instead of `notes`:

```js
export default {
  id: 'my-clip-pack',
  name: 'My Clip Pack',
  description: '…',
  price: 200,
  icon: 'music',
  files: {
    sessionEnd: new URL('./finish.mp3', import.meta.url).href,   // focus session complete
    default: new URL('./other.mp3', import.meta.url).href,       // every other sound (break ends, …)
  },
  preview: ['sessionEnd', 'default'],   // what the Shop's preview plays, in order
};
```

Keep clips to a few seconds, and only use audio you're allowed to use. `brainrot/sounds/tung-tung-tung-sahur.js` is an example.

---

## 6. Icons

PFPs, sound packs and the rest of the app use line icons from `src/core/icons.js`. These names are available:

`coffee` `flame` `trophy` `coins` `music` `clock` `drum` `fish` `plane` `tree` `leaf` `moon` `zap` `megaphone` `lock` `play` `pause` `stop` `reset` `plus` `minus` `check` `more` `trash` `edit` `target` `timer` `list` `chart` `bag` `volume` `gear` `user` `logout` `cloudCheck` `cloudOff` `refresh` `alert` `info` `x` `chevronDown` `chevronLeft` `bell` `eye` `eyeOff` `calendar`

**To add one:** add a line to `ICON_PATHS` in `icons.js`. Its value is the inside of a 24×24 SVG drawn with strokes (no fill), for example:

```js
star: '<path d="M12 2l3 7h7l-5.5 4.5 2 7.5L12 17l-6.5 4 2-7.5L2 9h7z"/>',
```

Simple line-icon sets with permissive licenses, like Lucide (ISC license), are good sources for paths.

---

## 7. Changing wording and the currency

- **All base text** lives in `src/core/copy.js`. Find the line and change it.
- **Brainrot wording** lives in `src/content/brainrot/copy.js`. It overrides base lines for every brainrot theme.
- **The currency name** is `currency: { name, title }` in each ecosystem's `index.js`. In text, write `{currency}` (`points`) or `{Currency}` (`Points`) and the active name is filled in.
- **Text lookup order:** the theme's `copy`, then the ecosystem's `copy`, then `src/core/copy.js`.

---

## 8. Checklist before committing content

- [ ] The new file is imported **and** added to the list in the ecosystem's `index.js`.
- [ ] The `id` is new, lowercase-with-dashes, and not used by the other ecosystem.
- [ ] No emoji. Icons come from `src/core/icons.js`.
- [ ] Run it (`python -m http.server 8080`) and check it in the Shop, buy it, equip it, and look at every tab.
- [ ] Theme: text is readable on every screen, in both its own appearance and with "Reduce motion" on.
- [ ] Sound: preview it in the Shop, and check it plays at the end of a session with "Alert sound" on.
