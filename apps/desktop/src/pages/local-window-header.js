'use strict';

// Welcome, What's new and the loading screen render in the MAIN window's own
// webContents - there is no tab bar above them - so while one of them is up the
// window has no title bar of any kind. On macOS only the traffic lights are
// drawn and nothing on the page can be dragged; on Windows and Linux the window
// is frameless, so there is no minimise, maximise or close button at all and
// the window can be neither moved nor closed (issue #3291).
//
// These pages can use `-webkit-app-region: drag`, which the tab bar deliberately
// cannot: the property is all-or-nothing per WebContentsView, and the tab bar is
// a 40px child view stacked over the page, so a drag region there would swallow
// the clicks meant for the tabs. Here the view IS the whole window, and the
// strip sits above the page's own content, so it costs nothing below it.
//
// The strip is assembled here rather than copied into each page's markup so
// that adding one <script> tag is the whole of what a new local page has to do
// to get a title bar - the failure mode this replaces is a page shipping
// without one. The glyph geometry still lives in exactly one place
// (window-caption.js), shared with the tab bar's own caption buttons.
(function (root) {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const HEADER_CLASS = 'yc-window-header';

  const caption = root.ycWindowCaption;

  const buildGlyph = function (doc, name) {
    const svg = doc.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 12 12');
    svg.setAttribute('aria-hidden', 'true');
    svg.dataset.glyph = name;
    for (const shape of caption.GLYPHS[name]) {
      const node = doc.createElementNS(SVG_NS, shape.tag);
      for (const attribute of Object.keys(shape)) {
        if (attribute !== 'tag') node.setAttribute(attribute, shape[attribute]);
      }
      svg.appendChild(node);
    }
    return svg;
  };

  const buildButton = function (doc, label, glyphs, onClick) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'yc-window-btn';
    button.setAttribute('aria-label', label);
    button.title = label;
    for (const name of glyphs) button.appendChild(buildGlyph(doc, name));
    button.addEventListener('click', onClick);
    return button;
  };

  // Same contract as the tab bar's: the middle button follows the window's
  // real state, because it can also be maximised by snapping or from the menu.
  // Seeded restored, then corrected by the main process on this page's load.
  const wireMaximizeState = function (api, button) {
    const apply = function (isMaximized) {
      caption.applyMaximizeState(button, isMaximized);
    };
    apply(false);
    if (api && typeof api.onWindowMaximizedChanged === 'function') {
      api.onWindowMaximizedChanged(apply);
    }
  };

  const buildCaption = function (doc, api) {
    const group = doc.createElement('div');
    group.className = 'yc-window-caption';

    group.appendChild(
      buildButton(doc, 'Minimize', ['minimize'], function () {
        if (api) api.windowMinimize();
      })
    );

    const maxButton = buildButton(
      doc,
      caption.MAXIMIZE.label,
      ['maximize', 'restore'],
      function () {
        if (api) api.windowToggleMaximize();
      }
    );
    wireMaximizeState(api, maxButton);
    group.appendChild(maxButton);

    const closeButton = buildButton(doc, 'Close', ['close'], function () {
      if (api) api.windowClose();
    });
    closeButton.classList.add('yc-window-btn--close');
    group.appendChild(closeButton);

    return group;
  };

  // Idempotent: a page that both includes this script and calls mount() itself
  // gets one strip, not two.
  const mount = function (doc, options) {
    const existing = doc.querySelector('.' + HEADER_CLASS);
    if (existing) return existing;

    const opts = options || {};
    const platform = opts.platform || 'darwin';
    const api = opts.api || null;

    const header = doc.createElement('div');
    header.className = HEADER_CLASS;
    header.dataset.platform = platform;
    if (platform !== 'darwin') header.appendChild(buildCaption(doc, api));

    // No double-click-to-maximise handler: a drag region already gets that from
    // the platform, and a second handler on top of it would toggle twice and
    // land back where it started. The tab bar needs its own only because its
    // spacer is explicitly `no-drag`.

    doc.body.appendChild(header);
    return header;
  };

  // Published for the e2e specs, which drive the real pages: there is no DOM in
  // the unit environment, so this one is checked where it actually runs.
  root.ycLocalWindowHeader = { mount: mount, HEADER_CLASS: HEADER_CLASS };

  // Auto-mount, so including the script is the whole of the page's obligation.
  // `document.currentScript` is the <script> element while a classic external
  // script runs and null under a `require()` from the unit tests, which is what
  // keeps this from running against a document the tests never asked for.
  const doc = root.document;
  if (doc && doc.currentScript) {
    const autoMount = function () {
      mount(doc, {
        platform: root.ycPlatformLabels?.detectPlatform(root.ycDesktop, root.navigator.userAgent),
        api: root.ycDesktop || null,
      });
    };
    // mount() appends to <body>, so a page that loads this from <head> has to
    // wait. Every page today loads it at the end of <body> and takes the first
    // branch; the second is what keeps the other placement from failing silently.
    if (doc.body) autoMount();
    else doc.addEventListener('DOMContentLoaded', autoMount);
  }
})(globalThis);
