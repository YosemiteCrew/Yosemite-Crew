'use strict';

(function () {
  const yc = globalThis.ycDesktop;
  const card = document.getElementById('lockCard');
  const unlockBtn = document.getElementById('unlock');
  const passwordBtn = document.getElementById('usePassword');
  const statusEl = document.getElementById('lockStatus');

  // A modal card: the rest of the page is inert and keyboard focus starts on
  // Unlock, so Enter or Space unlocks without reaching for the pointer. Escape
  // would dismiss the card and leave a lock screen with nothing on it to unlock
  // with. Cancelling the keydown stops that at the source, without relying on
  // the dialog's cancel event, which the browser may make uncancelable.
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') event.preventDefault();
  });
  card.showModal();

  // The page never authenticates on its own: doing so would open a second OS
  // prompt unrelated to the one the main process is awaiting, so a success here
  // would never actually restore the workspace. Both buttons just declare
  // intent, and the main process - which owns the lock - acts on it. It also
  // owns the outcome: on success it removes this overlay, so there is no
  // "Unlocked" state for this page to render.
  const request = function (mode) {
    if (!yc || typeof yc.idleUnlock !== 'function') {
      statusEl.textContent = 'Unlock is unavailable on this device.';
      return;
    }
    statusEl.textContent = mode === 'password' ? 'Signing out…' : 'Verifying…';
    yc.idleUnlock(mode);
  };

  unlockBtn.addEventListener('click', function () {
    request('biometric');
  });
  passwordBtn.addEventListener('click', function () {
    request('password');
  });

  if (yc && typeof yc.onIdleUnlockFailed === 'function') {
    yc.onIdleUnlockFailed(function () {
      statusEl.textContent = 'Could not verify. Try again.';
    });
  }
})();
