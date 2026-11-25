# How the app talks to its backend (and how to plug in a real one)

This guide is for whoever builds the real backend, and for any AI assistant helping them. It explains how the current **mock backend** works, who calls it and when, and exactly what a real backend has to do to replace it without changing any screens.

**If you're using an AI assistant**, give it this file plus these four source files:
- `src/data/index.js`
- `src/data/mock-backend.js`
- `src/data/model.js`
- `src/data/errors.js`

---

## 1. The big picture

```
 screens (src/screens/)  ─┐
 app state (src/app/)     ├──>  src/data/index.js  ──>  mock-backend.js   (today)
 services (src/services/) ─┘          │                  your-backend.js  (later)
                                      └─ picks one using src/config.js
```

- The app is a plain website: ES modules, no bundler, hosted on GitHub Pages.
- **Nothing calls a backend directly.** Every read and write goes through `src/data/index.js`, which forwards to the backend named in `src/config.js`:

  ```js
  export const CONFIG = { backend: 'mock' };
  ```
- The real backend is **one new file**, `src/data/<name>-backend.js`. It exports the same functions as `mock-backend.js` and is registered in `BACKENDS` in `src/data/index.js`. After that, switch `CONFIG.backend`, and no screen changes.
- `index.js` also exports `backendKind`. When it's `'mock'`, the login page shows the demo-account hint and the in-app "Set a new password" step. With any other backend both disappear by themselves.

---

## 2. The data contract

Every function returns a **Promise**. On failure it **throws (rejects with) a `DataError`** from `src/data/errors.js`: `{ code, message }`, where `message` is ready to show the user.

| Function | Takes | Returns |
| --- | --- | --- |
| `signUp(email, password, displayName)` | strings | the **User** (and is now signed in) |
| `signIn(email, password)` | strings | the **User** |
| `signOut()` | nothing | nothing |
| `resetPassword(email)` | string | nothing. It sends a reset email, and succeeds even for unknown emails so nobody can probe for accounts |
| `getCurrentUser()` | nothing | the **User**, or `null`. Must work **without the network** (see 5.1) |
| `updateProfile({ displayName })` | object | the updated **User** |
| `getTasks()` | nothing | **Task[]** |
| `saveTask(task)` | a Task. No `id` means create; an `id` means update that task | the saved **Task** |
| `deleteTask(id)` | string | nothing |
| `recordSession(session)` | a Session | the saved **Session**. Must be **idempotent by `id`** (see 5.3) |
| `getSessions({ days })` | optional `days` (e.g. 7); no `days` means all | **Session[]**, oldest first |
| `getSettings()` | nothing | **Settings**, with every field filled in |
| `saveSettings(settings)` | Settings | the saved **Settings** |
| `getPurchases()` | nothing | **Purchase[]** |
| `purchase(itemId, price)` | `'<kind>:<id>'`, number | the new **Purchase** |
| `confirmPasswordReset(email, newPassword)` | strings | **mock only**: stands in for the page the reset email links to. A real backend doesn't need it |

### Data shapes

Dates are `YYYY-MM-DD`; times are ISO 8601 strings in UTC; lengths are in minutes.

```js
// User
{ id: 'u_abc', email: 'demo@example.com', displayName: 'Alex Morgan', createdAt: '2026-10-16T14:00:00.000Z' }

// Task
{ id: 't_8f2k', title: 'Finish SRS draft', description: '', priority: 'High',   // 'Low' | 'Medium' | 'High' | null
  dueDate: '2026-12-03', completed: false, completedAt: null, createdAt: '2026-11-24T19:05:00.000Z' }

// Session (one finished focus session)
{ id: 's_1764012345678', startedAt: '2026-11-24T19:30:00.000Z', durationMinutes: 25, taskId: 't_8f2k' /* or null */ }

// Settings
{ durations: { focus: 25, shortBreak: 5, longBreak: 15 },
  alertSound: false, deadlineReminders: true,
  theme: 'dark', soundPack: 'classic-beep', avatar: 'initials',
  mode: 'professional',              // 'professional' | 'brainrot' (which content ecosystem is active)
  sessionAlerts: true, breakAlerts: true, autoStart: false, reduceMotion: false,
  dailyReminder: { enabled: false, time: '09:00' },
  taskSort: 'due' }                  // 'due' | 'priority'

// Purchase
{ itemId: 'theme:sigma-grindset', price: 250, purchasedAt: '2026-11-30T16:00:00.000Z' }
```

### Values the app works out and never stores

- **Currency balance** (points or aura): earned is 10 per focus session, plus 5 per completed task, plus 25 per achievement. The balance is earned minus the sum of purchase prices. See `src/shop/progress.js`.
- **A task's focus-session count**: the number of sessions with that `taskId`.
- **Streaks and achievements**: worked out from sessions and tasks.

---

## 3. Shared rules you should reuse: `src/data/model.js`

Both backends call these, so validation and defaults are identical. A real backend should use them too, rather than rewriting them.

| Helper | Use it in | What it does |
| --- | --- | --- |
| `validateSignUp(email, password, displayName)` | `signUp` | email format, password ≥ 8, name ≤ 40 |
| `validateDisplayName(name)` | `updateProfile` | name ≤ 40 |
| `isValidEmail(email)` | `resetPassword` | format check |
| `prepareTask(input, existing)` | `saveTask` | trims the title (required, ≤ 100); normalizes priority and due date; sets `id`, `createdAt` and `completedAt` |
| `prepareSession(input)` | `recordSession` | fills `id` and `startedAt`; rounds `durationMinutes` |
| `normalizeSettings(settings)` | `getSettings` / `saveSettings` | fills every missing field with its default, so old saved settings keep working |
| `validateSettings(settings)` | `saveSettings` | timer lengths are whole minutes: focus 1–120, short 1–60, long 1–90 |
| `preparePurchase(itemId, price, { tasks, sessions, purchases })` | `purchase` | the item exists, isn't already owned, the price matches, and the balance is high enough |
| `filterSessionsByDays`, `sortByStart` | `getSessions` | the `days` filter and oldest-first order |

---

## 4. Who calls what, and when

### When the page opens (`src/app/account.js → boot`)

1. `getCurrentUser()`. A user means the app goes straight in; `null` shows the login page.
2. If signed in, `loadAccount()` runs these **four calls in parallel**:
   ```js
   getTasks(), getSessions(), getSettings(), getPurchases()
   ```
   - **On success:** the results are kept in memory (`app.data`), and a copy is cached in localStorage (`cache:<userId>`).
   - **On failure:** the cached copy is shown with a "Couldn't reach the cloud" banner and a Retry button. If there's no cache, an error screen with Retry appears.
   - **If the error code is `signed-out`:** the user is logged out.

### Logging in and out (`src/screens/auth.js`, `src/app/account.js`)

| User action | Calls |
| --- | --- |
| Log in | `signIn`, then `loadAccount` |
| Create account | `signUp`, then `loadAccount` (a new account starts empty) |
| Forgot password | `resetPassword` (mock only: then `confirmPasswordReset`) |
| Log out | `signOut` |

### Changing things (`src/app/saving.js → saveChange`)

Almost every change follows the same pattern:
1. Update the screen straight away.
2. Call the backend.
3. If the call fails, undo the change and show the error with **Retry**.

| Screen action | Calls |
| --- | --- |
| Create or edit a task | `saveTask`. On failure the form stays open with the user's input and Retry |
| Complete or reopen a task | `saveTask({ ...task, completed })` |
| Delete a task | `deleteTask(id)` |
| Change the task sort order | `saveSettings` |
| Save the Settings screen (incl. Brainrot mode) | `saveSettings` |
| Buy a shop item | `purchase(itemId, price)` |
| Equip a theme, sound or profile picture | `saveSettings` (fields `theme` / `soundPack` / `avatar`) |
| Change the display name | `updateProfile` |
| "Sync now" / Retry on the load error | the four load calls again |

### Running in the background while the page is open (`src/services/`)

| What | Calls | When |
| --- | --- | --- |
| A focus session finishes | `recordSession` (through a queue, see 5.3) | at 00:00, or the next time the page opens if it ended while closed |
| Retrying unsaved sessions | `recordSession` for each queued session | every 5 minutes while some are waiting, and when the browser comes back online |
| Deadline reminders | `getCurrentUser`, `getTasks` | when the page opens, then hourly |
| Daily reminder | `getCurrentUser` | at the time set in Settings |

---

## 5. Things a real backend must get right

### 5.1 Stay signed in, without the network

`getCurrentUser()` is called on every page load and by the reminders. It must:
- answer quickly
- work offline
- return the same User shape

The mock keeps the signed-in user in localStorage under `STORAGE_KEYS.auth` (`'auth'`), using `storage` from `src/core/storage.js`.

**Do the same:** keep whatever your service needs (the user, tokens) under `STORAGE_KEYS.auth`, and read it back in `getCurrentUser()`. If you use an SDK that keeps its own login (for example Firebase Auth), still write the User under `STORAGE_KEYS.auth` after sign-in, so the app can read it instantly.

### 5.2 Log out by removing `STORAGE_KEYS.auth`

`src/services/index.js` watches that key. When it's removed, the services:
- clear the timer
- clear the queue of unsaved sessions
- clear the copy of the settings
- stop the reminders

So `signOut()` must remove it, even if your SDK has its own sign-out.

### 5.3 `recordSession` must be idempotent

Finished sessions go into a local queue (`pendingSessions`) and are retried until saved. The same session can arrive more than once, after a timeout or from two open tabs.

**Save it under its `id`** (overwrite, don't append), so it's never counted twice. The id is stable: `s_<start time in ms>`.

### 5.4 Errors the app reacts to

Throw `new DataError(code, copyKey)`. The message comes from `src/core/copy.js`, so it's already worded for users.

| `code` | Copy key to use | What the app does |
| --- | --- | --- |
| `network` | `err.network` | header shows **Offline**; data stays on screen; Retry offered |
| `signed-out` | `err.notSignedIn` | logs the user out and shows the message on the login page |
| `invalid-credentials` | `auth.err.generic` | **one** message for a wrong email *or* a wrong password, so it never reveals which |
| `email-taken` | `auth.err.emailTaken` | shown under the email field, with a "Log in instead" link |
| `invalid-email` / `weak-password` | `auth.err.email` / `auth.err.pwShort` | shown on the form |
| `not-found` | `err.taskNotFound` | e.g. editing a task deleted on another device |
| `not-enough-balance` / `already-owned` / `invalid-item` | from `preparePurchase` | shown with Retry |
| anything else | `err.generic` | shown with Retry |

`networkError()` in `errors.js` builds the `network` error. Wrap `fetch` (or SDK calls) so a dropped connection becomes that rather than a crash.

### 5.5 Settings that aren't in the original contract

Run `getSettings()` and `saveSettings()` through `normalizeSettings()`. That covers the fields added since the original contract:
- `mode`
- `sessionAlerts` and `breakAlerts`
- `autoStart`
- `reduceMotion`
- `dailyReminder`
- `taskSort`

Store the whole settings object as one document or record.

### 5.6 Purchases and security

The balance is worked out from tasks, sessions and purchases. The mock checks a purchase with `preparePurchase` in the browser.

A real backend **should repeat that check on the server**, for example in a Cloud Function or an API endpoint. A browser-only check can be bypassed by anyone who edits requests. At minimum:
- the server refuses a second purchase of the same `itemId`
- each user can only read and write their own data

---

## 6. How the mock works inside (for reference)

- Everything lives in the browser's localStorage under `brp:mockCloud`:
  ```js
  {
    users: { 'demo@example.com': { id, email, displayName, passwordHash, createdAt } },
    data:  { '<userId>': { tasks: [], sessions: [], purchases: [], settings: {} } }
  }
  ```
- **Passwords** are SHA-256 hashed in the browser. That's fine for a mock, but not real security.
- **Latency:** every call waits 120 ms so loading states are visible.
- **Demo account:** `demo@example.com` / `pomodoro123` ("Alex Morgan"). It comes with realistic tasks and about 30 days of sessions (`src/data/demo-data.js`), and is created only when `brp:mockCloud` doesn't exist yet. New accounts start empty.
- **Signed in:** the signed-in user is stored under `brp:auth` as `{ backend: 'mock', user }`.

---

## 7. Step-by-step: adding the real backend

1. **Create** `src/data/<name>-backend.js` (e.g. `firebase-backend.js`) exporting every function in section 2 except `confirmPasswordReset`.
2. **Libraries come from a CDN**, since there's no bundler. Import them by URL at the top of the file, for example:
   ```js
   import { initializeApp } from 'https://www.gstatic.com/firebasejs/<version>/firebase-app.js';
   ```
   Or call the service's REST API with `fetch`.
3. **Reuse `model.js`** (section 3) for validation, defaults and purchase checks.
4. **Map the service's errors** to the `DataError` codes in section 5.4.
5. **Handle auth storage** as in 5.1 and 5.2: write the User under `STORAGE_KEYS.auth` on sign-in, and remove it on sign-out.
6. **Register the backend**:
   ```js
   // src/data/index.js
   import * as firebaseBackend from './firebase-backend.js';
   const BACKENDS = { mock: mockBackend, firebase: firebaseBackend };
   ```
   ```js
   // src/config.js
   export const CONFIG = { backend: 'firebase' };
   ```
7. **Lock down access** with the service's security rules, so each user can only reach their own records. For Firestore that would be `/users/{uid}/**`, allowed only when `request.auth.uid == uid`.
8. **Suggested data layout** (one per user):
   ```
   users/{uid}                    { email, displayName, createdAt }
   users/{uid}/tasks/{taskId}     Task
   users/{uid}/sessions/{id}      Session      ← keyed by session id (idempotent)
   users/{uid}/purchases/{itemId} Purchase     ← keyed by item id (one purchase each)
   users/{uid}/meta/settings      Settings
   ```

Never commit secrets. A web app's public config, like a Firebase `apiKey`, is designed to be public; anything server-side is not.

## 8. Checking it works

Serve the folder with `python -m http.server 8080`, open http://localhost:8080, and go through:

- [ ] Create an account. You land on the timer with no tasks and 0 points.
- [ ] Log out and back in. Refresh the page; you're still signed in.
- [ ] Create, edit, complete, reopen and delete a task. Refresh; the changes are still there.
- [ ] Turn the network off in the browser's dev tools and complete a task. You get an error with Retry. Turn it back on, press Retry, and it saves.
- [ ] Finish a focus session (set Focus to 1 minute in Settings). Stats show it, and the balance goes up by 10.
- [ ] Buy and equip a shop item. Try buying it again: it shows as owned.
- [ ] Sign in on a second browser. The same data appears.
- [ ] Use "Forgot password". The reset email arrives, and the new password works.
