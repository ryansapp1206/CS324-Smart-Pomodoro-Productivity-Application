/* =====================================================================
   APP CONFIG
   backend:   'local' → accounts and data are kept on this device
              (src/data/local-backend.js) and synced with your other
              devices over the local network (src/sync/).
   syncPort:  the port the local sync service uses on every device
              (sync-service/pomodoro-sync.mjs, TCP and UDP).
   syncDownloadUrl: where the Devices screen links to download the
              sync service (the website also serves it at downloads/).
   devTools:  true shows the developer console (Ctrl+Shift+D or ?dev).
   ===================================================================== */

export const CONFIG = {
  backend: 'local',
  syncPort: 47821,
  syncDownloadUrl: 'https://ryansapp1206.github.io/cs324/downloads/pomodoro-sync.mjs',
  devTools: false,
};
