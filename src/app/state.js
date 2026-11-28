/* =====================================================================
   POPUP UI STATE
   Everything the screens need to draw themselves that isn't account data.
   It resets on sign-in and log-out.
   ===================================================================== */

export function createUiState() {
  return {
    screen: 'login', // signed out: login | register | forgot | reset; signed in: main | profile | devices
    tab: 'timer', // timer | tasks | stats | shop | settings
    previousTab: 'timer',
    authForm: { email: '', password: '', password2: '', name: '' },
    errors: {},
    notice: null,
    isBusy: false,
    showPassword: false,
    resetEmail: '',
    pairCode: '', // the code typed while pairing a device
    peerAddress: '', // Devices → Add by address
    deviceName: null, // Devices → rename this device (null = not edited)
    taskFilter: 'open', // open | completed
    shopCategory: 'theme', // theme | sound | avatar
    openMenuTaskId: null,
    openPopover: null, // sync | avatar
    openModal: null, // taskForm | taskPicker
    confirmDialog: null,
    taskForm: null,
    settingsDraft: null,
    profileForm: null,
    deadlineBanner: null,
    focusAfterRender: null, // data-focus-id to focus after the next render
    returnFocusId: null, // where focus goes when a dialog closes
  };
}

/** The task form's fields as one string, used to detect unsaved edits. */
export function taskFormSnapshot(form) {
  return JSON.stringify([form.title, form.description, form.priority, form.dueDate]);
}
