'use strict';

// The frameless window on Windows and Linux draws its own caption buttons, so
// the middle one has to say which action it performs: "Maximize" while the
// window is restored, "Restore" while it is maximised or full-screen. A native
// title bar swaps both the icon and the accessible name, and a screen reader
// reading a stale "Maximize" on an already-maximised window announces the
// wrong action.
//
// Both glyphs are in the markup and this picks which one is shown, rather than
// writing SVG into the button: the page has no need of an innerHTML sink, and
// the glyph geometry stays somewhere a stylesheet and a reader can find it.
//
// This is a plain browser script for the same reason as platform-labels.js:
// the local pages load it over file:// under a strict CSP and cannot reach a
// compiled module under src/. The unit tests require this file directly.
(function (root) {
  const MAXIMIZE = { label: 'Maximize', glyph: 'maximize' };
  const RESTORE = { label: 'Restore', glyph: 'restore' };

  // `isMaximized` covers full screen too: the window fills the display either
  // way, so the button's job in both states is to give the user their window
  // back.
  const maximizeButton = function (isMaximized) {
    return isMaximized ? RESTORE : MAXIMIZE;
  };

  const api = { maximizeButton: maximizeButton, MAXIMIZE: MAXIMIZE, RESTORE: RESTORE };
  root.ycWindowCaption = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
