/* =====================================================================
   PLATFORM
   Tells the code whether it runs as the website or as the browser
   extension (Chrome/Edge/Brave or Firefox), and gives one name for the
   extension API: `ext` is `browser` in Firefox and `chrome` elsewhere.
   On the website `ext` is null and IS_EXTENSION is false.
   ===================================================================== */

function findExtensionApi() {
  // A normal web page in Chrome has a `chrome` object too, but no runtime.id.
  if (globalThis.browser?.runtime?.id) return globalThis.browser;
  if (globalThis.chrome?.runtime?.id) return globalThis.chrome;
  return null;
}

export const ext = findExtensionApi();
export const IS_EXTENSION = Boolean(ext);
