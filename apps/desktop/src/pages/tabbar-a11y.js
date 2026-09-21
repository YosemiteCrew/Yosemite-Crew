'use strict';

// Keyboard mapping and accessible names for the tab bar.
//
// The strip declares `role="tab"` on every tab but shipped with no `tabindex`
// and no arrow-key handling, so Tab skipped every tab and the only focusable
// thing in the strip was a close button that is invisible unless its tab is
// hovered or active. This module owns the decisions the ARIA tabs pattern asks
// for — which tab is in the tab order, what each arrow key does, and what each
// control is called — so they can be unit-tested without a DOM. The page keeps
// the imperative half: it reads these answers and moves focus.
//
// Plain browser script rather than a compiled module for the same reason as
// platform-labels.js and window-caption.js: the tab bar is a local page loaded
// over file:// under a strict CSP and cannot reach anything under build/.
(function (root) {
  // A tab with no title yet (still loading, or a blank new tab) still needs a
  // name, otherwise its close button is announced as bare "Close" and a screen
  // reader user cannot tell which of five identical buttons they are on.
  const tabName = function (tab) {
    if (!tab) return 'tab';
    const title = typeof tab.title === 'string' ? tab.title.trim() : '';
    if (title) return title;
    const url = typeof tab.url === 'string' ? tab.url.trim() : '';
    return url || 'Untitled tab';
  };

  const closeLabel = function (tab) {
    return 'Close ' + tabName(tab);
  };

  const muteLabel = function (tab) {
    return (tab?.muted ? 'Unmute ' : 'Mute ') + tabName(tab);
  };

  // Roving tabindex: exactly one tab is in the document's tab order, so Tab
  // enters and leaves the strip as a single stop and the arrow keys move
  // within it. The active tab is the natural entry point; when nothing is
  // active (which the strip briefly shows while a session restores) the first
  // tab takes the slot, because a strip where every tab is -1 is unreachable.
  const rovingTabIndex = function (tabs, activeId, tabId) {
    if (!Array.isArray(tabs) || tabs.length === 0) return -1;
    const hasActive = tabs.some(function (t) {
      return t && t.id === activeId;
    });
    const entry = hasActive ? activeId : tabs[0].id;
    return tabId === entry ? 0 : -1;
  };

  // Only the arrows along the strip's own axis are claimed. In a vertical rail
  // Left/Right belong to the page, and claiming them would swallow a key the
  // user expects to do nothing here.
  const ARROWS = {
    horizontal: { ArrowRight: 'next', ArrowLeft: 'prev' },
    vertical: { ArrowDown: 'next', ArrowUp: 'prev' },
  };

  const keyAction = function (key, orientation) {
    const arrows = ARROWS[orientation === 'vertical' ? 'vertical' : 'horizontal'];
    if (Object.hasOwn(arrows, key)) return arrows[key];
    if (key === 'Home') return 'first';
    if (key === 'End') return 'last';
    if (key === 'Enter' || key === ' ' || key === 'Spacebar') return 'activate';
    if (key === 'Delete' || key === 'Backspace') return 'close';
    return null;
  };

  // Movement wraps, which is what the tabs pattern specifies and what the
  // existing Ctrl+Tab cycling already does, so the two agree.
  const moveIndex = function (action, index, count) {
    if (!Number.isInteger(count) || count <= 0) return null;
    if (action === 'first') return 0;
    if (action === 'last') return count - 1;
    if (action === 'next') return (index + 1 + count) % count;
    if (action === 'prev') return (index - 1 + count) % count;
    return null;
  };

  // Tab search filters as you type, so the result count changes with no focus
  // move and nothing else announces it. "No matching tabs" was on screen only.
  const resultsStatus = function (count) {
    if (!Number.isInteger(count) || count <= 0) return 'No matching tabs';
    if (count === 1) return '1 tab';
    return String(count) + ' tabs';
  };

  const api = {
    tabName: tabName,
    closeLabel: closeLabel,
    muteLabel: muteLabel,
    rovingTabIndex: rovingTabIndex,
    keyAction: keyAction,
    moveIndex: moveIndex,
    resultsStatus: resultsStatus,
  };
  root.ycTabbarA11y = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
