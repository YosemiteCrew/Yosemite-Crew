'use strict';

// Autoplay policy for the welcome screen's feature carousel.
//
// The carousel used to advance every 4 seconds forever, pausing only while the
// pointer was over it. That fails WCAG 2.2.2 (Pause, Stop, Hide) for anyone not
// using a mouse, and kept moving under prefers-reduced-motion because only the
// slide TRANSITION was suppressed, not the slide changes.
//
// The decision is factored out here so it can be unit tested: welcome.js owns
// the timer and the DOM, this owns the rule.
//
// This is a plain browser script for the same reason as window-caption.js: the
// welcome page loads it over file:// under a strict CSP and cannot reach a
// compiled module under src/.
(function (root) {
  const SLIDE_MS = 4000;

  // Reduced motion is a setting, not a state the pause button can override:
  // someone who has asked the OS for less motion has already answered this.
  // Everything else is a transient reason to hold: the user pressed pause, the
  // pointer is over the slides, or a keyboard user is inside the controls and
  // would otherwise have the thing under them move.
  const shouldAdvance = function (state) {
    const s = state || {};
    if (s.reduceMotion) return false;
    return !s.paused && !s.hovering && !s.focusWithin;
  };

  // Whether the pause/play button can do anything. Under reduced motion there
  // is nothing to pause, so the control is hidden rather than left as a button
  // that does not change what the user sees.
  const controlIsUseful = function (state) {
    return !(state || {}).reduceMotion;
  };

  const nextIndex = function (index, total) {
    if (!total || total < 1) return 0;
    const wrapped = index % total;
    return wrapped < 0 ? wrapped + total : wrapped;
  };

  const api = {
    SLIDE_MS: SLIDE_MS,
    shouldAdvance: shouldAdvance,
    controlIsUseful: controlIsUseful,
    nextIndex: nextIndex,
  };
  root.ycCarouselAutoplay = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
