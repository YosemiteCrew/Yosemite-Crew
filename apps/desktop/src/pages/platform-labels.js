'use strict';

// Key names and file-manager names differ per platform, and the desktop app
// ships for Windows and Linux as well as macOS. Shortcuts are written once as
// platform-neutral accelerators ("Mod+Shift+Y", the same shape the app menu
// gets from Electron's CmdOrCtrl) and rendered here for the running host.
//
// This is a plain browser script rather than a module under src/: the local
// pages load it over file:// under a strict CSP, and the sandboxed preload
// cannot require a compiled module either, so a shared TypeScript module would
// reach neither. The unit tests require this file directly.
(function (root) {
  const SYMBOLS = { Mod: '⌘', Shift: '⇧', Alt: '⌥' };
  const MAC_NAMES = { Mod: 'Cmd', Shift: 'Shift', Alt: 'Option' };
  const OTHER_NAMES = { Mod: 'Ctrl', Shift: 'Shift', Alt: 'Alt' };

  const isMac = function (platform) {
    return platform === 'darwin';
  };

  const render = function (accelerator, table, separator) {
    return String(accelerator)
      .split('+')
      .map(function (part) {
        return table[part] || part;
      })
      .join(separator);
  };

  // 'symbol' is the cheat sheet's compact macOS form (⌘⇧Y); 'name' is the
  // spelled-out form tooltips use (Cmd+Shift+Y). Off macOS the two agree:
  // Windows and Linux have no key glyphs to render instead of the names.
  const shortcut = function (accelerator, platform, style) {
    if (!isMac(platform)) return render(accelerator, OTHER_NAMES, '+');
    if (style === 'name') return render(accelerator, MAC_NAMES, '+');
    return render(accelerator, SYMBOLS, '');
  };

  // The button opens the system file manager on every platform, so it should
  // name the one the user actually has. Linux has no single file manager, hence
  // the generic wording there.
  const revealLabel = function (platform) {
    if (isMac(platform)) return 'Reveal in Finder';
    if (platform === 'win32') return 'Show in Explorer';
    return 'Show in folder';
  };

  // The preload reports the real host. The user-agent reading is the fallback
  // for a page rendered before the bridge exists; it is a guess, so it only has
  // to place the host in one of the three families.
  const detectPlatform = function (bridge, userAgent) {
    if (bridge && typeof bridge.platform === 'string' && bridge.platform) return bridge.platform;
    const ua = String(userAgent || '');
    if (ua.includes('Macintosh')) return 'darwin';
    if (ua.includes('Windows')) return 'win32';
    return 'linux';
  };

  const api = { shortcut: shortcut, revealLabel: revealLabel, detectPlatform: detectPlatform };
  root.ycPlatformLabels = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
