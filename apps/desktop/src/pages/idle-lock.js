'use strict';

(function () {
  const yc = globalThis.ycDesktop;
  const unlockBtn = document.getElementById('unlock');
  const passwordBtn = document.getElementById('usePassword');
  const statusEl = document.getElementById('lockStatus');

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
