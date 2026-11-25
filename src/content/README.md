# Content: two ecosystems

The app has two completely separate sets of content. **Only the currency balance is shared.**

```
content/
  index.js              lists the ecosystems; ALL_THEMES for lookups
  shared.js             font, shape and motion tokens every theme uses
  professional/         the default, what every visitor sees
    index.js            currency name, defaults, and the lists of themes / sounds / avatars
    themes/<id>/theme.js
    sounds/<id>.js
  brainrot/             hidden until the brainrot toggle exists
    index.js
    copy.js             meme-speak for every brainrot theme
    themes/<id>/theme.js (+ theme.css)
    sounds/<id>.js
    avatars/<id>.js
```

`settings.mode` (`'professional'` or `'brainrot'`) picks the active ecosystem. Settings and the Shop only ever show that ecosystem's items, and the currency takes its name: *points* or *aura*. There's no toggle in the UI yet. When one is added, it only has to save `mode` and call `applyAppearance()`.

## An ecosystem's `index.js`

| Field | What it does |
| --- | --- |
| `id` | `'professional'` or `'brainrot'` (the value of `settings.mode`) |
| `currency` | `{ name, title }`, e.g. `{ name: 'points', title: 'Points' }`. Text uses it through `{currency}` / `{Currency}` |
| `copy` | Text overrides for `src/core/copy.js`, shared by all of its themes |
| `defaults` | `{ theme, soundPack, avatar }`, used when nothing else is equipped. Defaults are always owned |
| `themes`, `sounds`, `avatars` | The items, in the order shown. "Initials" is built in, so it isn't listed |

## Adding an item

1. Create the file in the right ecosystem: `themes/<id>/theme.js`, `sounds/<id>.js` or `avatars/<id>.js`. Copy an existing one.
2. Add it to the list in that ecosystem's `index.js`.

Every item has `id`, `name`, `description` and `price` (in the shared currency, `0` = free).
- **Ids:** lowercase-with-dashes, unique across both ecosystems. They must never change once released, because purchases are saved by id (`theme:<id>`, `sound:<id>`, `avatar:<id>`).
- **Wording:** professional items use plain, professional names and descriptions.

## Themes

| Field | What it does |
| --- | --- |
| `appearance` | `'light'` or `'dark'` |
| `tokens` | CSS variable values (`bg`, `primary`, `mode-focus`, …). `professional/themes/light/theme.js` lists every token |
| `copy` | Optional overrides on top of the ecosystem's `copy` |
| `decorations` | `{ slot: () => 'html' }` for the slots `header-accent`, `timer-background`, `timer-overlay`, `empty-state-art`, `celebration`, `achievement-badge-frame` |
| `stylesheet` | `new URL('./theme.css', import.meta.url).href` to load theme-only CSS. Scope every rule under `[data-theme="<id>"]` |
| `comingSoon` + `swatch` | Sell the theme in the Shop before it's built. Remove both when it's finished |

Rules for every theme:
- same layout and components as the others
- WCAG 2.1 AA contrast for all text and controls
- animations must stop when "Reduce motion" is on (handled globally)
- no emoji; use icons from `src/core/icons.js`
- only original text, icons and CSS: no copyrighted images, audio or characters

## Sound packs

- `icon` is the picture in the Shop (a name from `src/core/icons.js`).
- A pack decides how **every sound in the app** sounds. The events (`SOUND_EVENTS` in `src/audio/player.js`):

  | Event | When it plays |
  | --- | --- |
  | `sessionEnd` | a focus session finished |
  | `setComplete` | the 4th focus session in a row finished (long break earned) |
  | `achievement` | an achievement unlocked |
  | `breakEnd` | a break finished |
  | `smallWin` | a task completed, or an item bought or equipped |
  | `stopEarly` | a session was stopped or reset before the end |

- A pack has **either** `files` or `notes`:
  - **`files`** plays recorded audio kept next to the pack's file, e.g. `{ sessionEnd: new URL('./clip.mp3', import.meta.url).href, …, default }`. `default` plays for any event without its own file. Optional `preview: ['sessionEnd', 'default']` sets what the Shop's preview plays, in order. See `brainrot/sounds/tung-tung-tung-sahur.js`.
  - **`notes(event)`** returns notes to synthesize. A note is `{ frequency, slideTo?, startAt?, duration?, wave?, volume? }`. `events: [...]` lists the events the pack has its own sound for. Others fall back: `setComplete` and `achievement` use `sessionEnd`, `stopEarly` uses `breakEnd`, and `smallWin` is silent. See `professional/sounds/classic-beep.js`.
- Buying a sound pack plays its `sessionEnd` sound.
- Nothing plays unless the **Sound** setting is on. App code plays sounds only through `playSound(event)` in `src/services/sound.js`.
- Keep clips short (a few seconds) and small.
- Brainrot has one sound pack per theme or character.

## Profile pictures

`icon` (a name from `src/core/icons.js`) and `color` draw the badge. For a photo instead, put the image next to the file (square, about 160×160, `.webp` or `.png`) and add `image: new URL('./<file>', import.meta.url).href`. The icon and color stay as the fallback. See `brainrot/avatars/tung-tung-tung-sahur.js`.
