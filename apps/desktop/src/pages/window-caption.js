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

  // The caption glyphs, as the SVG children each button needs. The tab bar
  // writes these straight into its own markup; the local pages' shared header
  // (local-window-header.js) has no markup of its own to write them into and
  // builds its buttons from this table instead. One copy, so the two title
  // bars cannot drift apart - window-caption.test.ts holds the tab bar's
  // markup to it, and holds every glyph here to the pixel grid.
  const GLYPHS = {
    minimize: [{ tag: 'path', d: 'M2 6.5h8' }],
    maximize: [{ tag: 'rect', x: '2.5', y: '2.5', width: '7', height: '7' }],
    restore: [
      { tag: 'rect', x: '2.5', y: '4.5', width: '5', height: '5' },
      { tag: 'path', d: 'M4.5 4.5V2.5h5v5h-2' },
    ],
    close: [{ tag: 'path', d: 'M2.5 2.5l7 7M9.5 2.5l-7 7' }],
  };

  // Applies a state to a caption button: the accessible name, the tooltip, and
  // which glyph is drawn. Shared so the tab bar and the local pages' header
  // cannot disagree about any of the three.
  //
  // The glyph is toggled as an ATTRIBUTE, not as `svg.hidden = …`: `hidden` is
  // an HTMLElement property and an SVGElement has none, so the assignment only
  // ever set an expando. The shipped Windows/Linux maximise button drew both
  // glyphs on top of each other and never changed with the window state. The
  // stylesheets carry the matching `svg[hidden] { display: none }` rule,
  // because the UA one is outranked here.
  const applyMaximizeState = function (button, isMaximized) {
    const spec = maximizeButton(isMaximized);
    button.setAttribute('aria-label', spec.label);
    button.title = spec.label;
    for (const glyph of button.querySelectorAll('svg[data-glyph]')) {
      glyph.toggleAttribute('hidden', glyph.dataset.glyph !== spec.glyph);
    }
    return spec;
  };

  const api = {
    maximizeButton: maximizeButton,
    applyMaximizeState: applyMaximizeState,
    MAXIMIZE: MAXIMIZE,
    RESTORE: RESTORE,
    GLYPHS: GLYPHS,
  };
  root.ycWindowCaption = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
