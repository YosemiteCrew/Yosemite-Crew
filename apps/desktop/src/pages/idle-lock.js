'use strict';

(function () {
  // A modal card: the rest of the page is inert and keyboard focus starts on
  // Unlock, so Enter or Space unlocks without reaching for the pointer. The
  // controls - including the Escape handling this card depends on - live in
  // idle-lock-controls.js.
  globalThis.ycIdleLock.init(document, globalThis.ycDesktop);
  document.getElementById('lockCard').showModal();
})();
