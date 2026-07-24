'use strict';

(function () {
  const yc = globalThis.ycDesktop;
  const unlockBtn = document.getElementById('unlock');
  const passwordBtn = document.getElementById('usePassword');
  const statusEl = document.getElementById('lockStatus');

  const attempt = function () {
    if (!yc || typeof yc.authenticateBiometric !== 'function') {
      statusEl.textContent = 'Biometric unlock is unavailable on this device.';
      return;
    }
    unlockBtn.disabled = true;
    statusEl.textContent = 'Verifying…';
    Promise.resolve(yc.authenticateBiometric('Unlock Yosemite Crew PIMS'))
      .then(function (res) {
        // The handler resolves to { ok, authenticated } - never a bare boolean,
        // so the response object itself is always truthy. The main process
        // observes the unlock and restores the workspace; the page only surfaces
        // progress so the button never looks dead.
        statusEl.textContent = res?.ok ? 'Unlocked' : 'Could not verify. Try again.';
      })
      .catch(function () {
        statusEl.textContent = 'Could not verify. Try again.';
      })
      .finally(function () {
        unlockBtn.disabled = false;
      });
  };

  unlockBtn.addEventListener('click', attempt);
  passwordBtn.addEventListener('click', attempt);
})();
