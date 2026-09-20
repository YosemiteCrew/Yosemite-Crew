'use strict';

// Presentation rules for the tab bar's small indicators: the sync status dot,
// the per-tab error/offline badge, and what a pinned tab shows once its title
// is hidden. The tab bar had these inline, which let the CSS classes and the
// tooltip map drift out of the SyncState union - the healthy `idle` state had
// neither, so the dot vanished exactly when everything was working.
//
// This is a plain browser script rather than a module under src/: the local
// pages load it over file:// under a strict CSP, so a compiled TypeScript
// module would not reach them. The unit tests require this file directly.
(function (root) {
  // Keys MUST be the SyncState union from src/sync/sync-status.ts, and each key
  // MUST have a matching `#sync-badge.<key>` colour rule in tabbar.html.
  const SYNC_LABELS = {
    'not-ready': 'Initializing',
    offline: 'Offline',
    blocked: 'Waiting for endpoint',
    pending: 'Pending changes',
    idle: 'Up to date',
    error: 'Sync error',
  };

  // An unrecognised state still has to draw a dot - an unstyled class is how
  // the healthy state went missing. The neutral colour is reused, but the label
  // says the state is unknown rather than claiming one.
  const syncBadge = function (state) {
    const known = Object.prototype.hasOwnProperty.call(SYNC_LABELS, state);
    const label = known ? SYNC_LABELS[state] : 'Sync status unknown';
    return {
      className: known ? state : 'not-ready',
      label: label,
      ariaLabel: known ? 'Sync: ' + label : label,
    };
  };

  // A network-class failure is reported as `offline`, anything else as `error`;
  // the tab bar only decides which of the two to draw. `title` carries the
  // detail, `label` is the accessible name.
  //
  // The offline badge has no `text`: Satoshi has no glyph for U+26A0 (nor for
  // U+2315, which is how the tab bar's search button ended up as a 7px system
  // fallback), so the badge's slash is drawn in CSS instead of set as text.
  const tabBadge = function (tab) {
    if (!tab) return null;
    if (tab.error) {
      return {
        className: 'tab-badge tab-badge--error',
        text: '!',
        label: 'Page failed to load',
        title: String(tab.error),
      };
    }
    if (tab.offline) {
      return {
        className: 'tab-badge tab-badge--offline',
        text: '',
        label: 'Tab is offline',
        title: 'No network connection',
      };
    }
    return null;
  };

  // First letter or digit of the title, for a pinned tab with no favicon. A
  // title made only of punctuation or emoji yields nothing, and the caller
  // falls back to the generic page icon.
  const monogram = function (title) {
    const match = String(title == null ? '' : title).match(/[\p{L}\p{N}]/u);
    return match ? match[0].toUpperCase() : '';
  };

  // A pinned tab is 48px wide at most, so it shows one glyph and no text.
  const pinnedGlyph = function (tab) {
    if (tab && tab.favicon) return { kind: 'favicon' };
    const initial = monogram(tab && tab.title);
    return initial ? { kind: 'monogram', text: initial } : { kind: 'icon' };
  };

  const api = {
    SYNC_LABELS: SYNC_LABELS,
    syncBadge: syncBadge,
    tabBadge: tabBadge,
    monogram: monogram,
    pinnedGlyph: pinnedGlyph,
  };
  root.ycTabIndicators = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
