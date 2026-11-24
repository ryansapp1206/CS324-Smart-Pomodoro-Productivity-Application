/* =====================================================================
   THEME: Brainrot (default)
   Everything brainrot lives in this one block: colors, meme-speak, emoji,
   decorations and theme-only CSS. Delete it and the app falls back to the
   Boring themes with no other changes.

   Control labels (Start, Pause, Resume, Stop, Reset, Low/Medium/High,
   Delete) stay plain on purpose so the app stays easy to learn. The flavor
   lives in titles, messages, tab names and empty states.
   ===================================================================== */

registerTheme({
  id: 'brainrot',
  name: 'Brainrot',
  description: 'Meme-speak, chaotic emoji, maximum aura.',
  appearance: 'light',
  price: 0,

  // Starts from Boring Light and changes only the colors that differ.
  tokens: {
    ...THEMES['default-light'].tokens,
    bg: '#f6f3ff',
    'surface-sunken': '#ede8fb',
    border: '#ddd5f3',
    'border-strong': '#9a8fbb',
    text: '#1b1530',
    'text-muted': '#544b6e',
    primary: '#6d28d9',
    'on-primary': '#ffffff',
    'focus-ring': '#db2777',
    'mode-focus': '#6d28d9',
    'mode-short': '#0f766e',
    'mode-long': '#be185d',
    'on-mode': '#ffffff',
  },

  emoji: {
    focus: '🧠',
    shortBreak: '🧃',
    longBreak: '🌱',
    taskDone: '🗿',
    celebration: '🔥',
    empty: '💀',
    aura: '✨',
  },

  copy: {
    // App
    'app.tagline': 'Lock in. Touch grass. Repeat.',
    // Timer modes
    'mode.focus': 'Lock In',
    'mode.short': 'Mini Break',
    'mode.long': 'Touch Grass',
    'mode.sub.focus': 'Focus mode',
    'mode.sub.short': 'Short break',
    'mode.sub.long': 'Long break',
    // Tabs
    'tab.timer': 'Grind',
    'tab.tasks': 'Quests',
    'tab.stats': 'Aura',
    // Accounts
    'auth.login.title': 'Welcome back, chat',
    'auth.login.sub': 'Log in so you can lock in.',
    'auth.err.generic': 'Email or password is incorrect. Not very sigma of us. Try again.',
    'auth.err.offline': 'You’re offline. The Wi-Fi is cooked. Reconnect, then try again.',
    'auth.register.title': 'Join the brainrot',
    'auth.register.sub': 'Your quests, streaks and aura sync to every browser you sign in on.',
    'auth.register.submit': 'Create account',
    'auth.namePh': 'Tung Tung Tung Sahur, perhaps?',
    'auth.forgot.title': 'Forgot your password?',
    'auth.forgot.sub': 'It happens to the best of us. Enter your email and we’ll send a reset link.',
    'auth.sent.title': 'Check your email, chat',
    'auth.reset.done': 'Password updated. Log in and get back to the grind.',
    // Loading
    'load.loading': 'Loading your aura…',
    'load.err.title': 'Couldn’t load your data',
    // Timer
    'timer.sessionOf': 'Lock-in {n} of 4',
    'timer.shortInfo': '{n} of 4 lock-ins done · Touch Grass after 4',
    'timer.longInfo': 'Full set cooked. Go touch grass.',
    'timer.working': 'Grinding: {title}',
    'timer.noTask': 'No quest selected · pick one (optional)',
    'timer.hint': 'Press Space to lock in or pause.',
    'timer.notCounted': 'Session not counted. No aura for you.',
    'timer.switch.body': 'This ends your current session and it won’t count. Fumbling the bag?',
    // Task picker
    'picker.title': 'Pick a quest to grind',
    'picker.none': 'No quest',
    'picker.noneSub': 'Just vibe and lock in',
    'picker.empty': 'No open quests. You can still lock in without one.',
    // Tasks (Quests)
    'tasks.open': 'Open',
    'tasks.completed': 'Cooked',
    'tasks.add': 'New quest',
    'tasks.view': 'Quest list',
    'tasks.empty': 'No quests yet. Add one and start grinding.',
    'tasks.emptyDone': 'No W’s yet. Finished quests show up here.',
    'tasks.current': 'Grinding',
    'tasks.focus': 'Lock in on this',
    'tasks.completedOn': 'Cooked {date}',
    'tasks.sessions': '{n} lock-ins',
    'tasks.sessionOne': '1 lock-in',
    'tasks.doneToast': 'W. “{title}” is cooked.',
    'tasks.reopenedToast': '“{title}” is back on the menu.',
    'tasks.deletedToast': 'Quest yeeted.',
    'tasks.savedToast': 'Quest saved. Let him cook.',
    'tasks.del.title': 'Yeet “{title}”?',
    'tasks.del.body': 'This can’t be undone. It’s gone forever.',
    // Task form
    'form.new': 'New quest',
    'form.edit': 'Edit quest',
    'form.titlePh': 'What are we cooking?',
    'form.err.title': 'Your quest needs a title.',
    'form.save': 'Save quest',
    'form.descPh': 'Lore, links or notes',
    'form.err.sync': 'Couldn’t save to the cloud. Your quest is safe on this device.',
    'form.discard.title': 'Fumble these changes?',
    'form.discard.body': 'Your edits to this quest won’t be saved.',
    // Stats (Aura)
    'stats.today': 'Today’s aura',
    'stats.sessions': 'Lock-ins',
    'stats.tasksDone': 'Quests cooked',
    'stats.week': 'Aura this week',
    'stats.weekSummary': 'This week: {total}. {day} was peak.',
    'stats.weekNone': 'This week: zero aura so far.',
    'stats.streak': '{n}-day streak',
    'stats.streakSub': 'Days in a row with at least one lock-in. Personal best: {best}.',
    'stats.empty.title': 'Zero aura detected',
    'stats.empty.body': 'Finish your first lock-in and your stats show up here.',
    'stats.empty.cta': 'Lock in now',
    // Achievements
    'ach.s1': 'Baby’s first lock-in',
    'ach.s10': 'Certified grinder (10)',
    'ach.s50': 'Sigma grindset (50)',
    'ach.s100': 'Absolute cinema (100)',
    'ach.t10h': '10 hours of aura',
    'ach.t50h': '50 hours, no cap',
    'ach.k3': '3-day streak',
    'ach.k7': '7-day streak, unstoppable',
    'ach.d5': '5 quests cooked',
    'ach.d25': '25 quests cooked',
    'ach.toast': 'Achievement unlocked: {name}',
    // Session alerts
    'alert.focusDone': 'W session!',
    'alert.focusDoneLong': 'Four lock-ins in a row. Absolute cinema.',
    'alert.toShort': 'Take {n} minutes. You earned it, chat.',
    'alert.toLong': 'Go touch grass for {n} minutes.',
    'alert.breakDone': 'Break’s over. Back to the grind.',
    'alert.toFocus': 'Ready to lock in for {n} minutes?',
    'alert.startFocus': 'Lock in',
    'alert.ok': 'Bet',
    // Deadline reminders
    'notif.deadlineOne': '1 quest is due soon',
    'notif.deadlineMany': '{n} quests are due soon, chat',
    'notif.view': 'View quests',
    'notif.noneDue': 'No quests due today or tomorrow. You’re chilling.',
    // Settings
    'set.autoStart': 'Auto-start next session',
    'set.autoStartSub': 'Start the next lock-in or break the moment the last one ends.',
    'set.saved': 'Settings saved. Locked in.',
    // Sync
    'sync.done': 'All synced. We’re so back.',
    'sync.failedBody': 'Couldn’t save to the cloud. Your changes are safe on this device. Hit Retry.',
    // Aura and Shop
    'aura.how': 'Farm aura: {s} per lock-in, {t} per quest cooked, {a} per achievement.',
    'aura.shopSub': 'Spend your aura on drip. Equip anything you own here or in Settings → Appearance.',
    'aura.need': 'Need {n} more aura',
    'aura.buy.title': 'Cop {name}?',
    'aura.buy.yes': 'Cop it',
    'aura.bought': '{name} secured. W.',
    'aura.boughtSoon': '{name} secured. It drops in a future update.',
    'aura.equippedToast': '{name} equipped. Aura +∞ (not really).',
    'aura.moreThemes': 'Cop more themes in the Shop',
    'shop.avatars': 'PFPs',
    'shop.title': 'Drip Shop',
    'shop.themesSub': 'Change the whole vibe of the app.',
    'shop.avatarsSub': 'Rep your favorite brainrot icon as your PFP.',
    // Profile
    'profile.changeAvatar': 'Cop PFPs in the Shop',
    'profile.saved': 'Name updated. Iconic.',
    // Log out
    'logout.notice': 'Logged out. Go touch grass.',
  },

  decorations: {
    // Little emoji burst on the "session complete" alert.
    celebration: () => '<span class="br-burst">🔥</span><span class="br-burst second">🗿</span>',
  },

  css: `
    [data-theme="brainrot"] .logo span {
      background: linear-gradient(90deg, #6d28d9, #be185d);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    [data-theme="brainrot"] .alert-card { overflow: hidden; }
    [data-theme="brainrot"] .deco-celebration { position: absolute; inset: 0; pointer-events: none; }
    [data-theme="brainrot"] .br-burst {
      position: absolute;
      right: 14px;
      top: 10px;
      font-size: 20px;
      animation: brainrot-float 1.4s ease-out both;
    }
    [data-theme="brainrot"] .br-burst.second { right: 44px; animation-delay: 0.15s; }
    @keyframes brainrot-float {
      from { transform: translateY(16px) scale(0.6); opacity: 0; }
      60% { opacity: 1; }
      to { transform: translateY(-4px) scale(1); opacity: 0.9; }
    }
  `,
});
