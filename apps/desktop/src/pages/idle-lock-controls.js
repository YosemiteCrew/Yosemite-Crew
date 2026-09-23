'use strict';

// The lock screen's controls, kept apart from idle-lock.js so the two-step
// sign-out and the pending state can be driven in a test. The local pages are
// plain files loaded over file:// under a strict CSP, so this is a sibling
// script the page loads - not a module it could import.
(function (root) {
  const VERIFYING = 'Verifying…';
  const SIGNING_OUT = 'Signing out…';
  const UNAVAILABLE = 'Unlock is unavailable on this device.';
  const FAILED = 'Could not verify. Try again.';

  const init = function (doc, bridge) {
    const card = doc.getElementById('lockCard');
    const unlockBtn = doc.getElementById('unlock');
    const passwordBtn = doc.getElementById('usePassword');
    const confirmPanel = doc.getElementById('signOutConfirm');
    const confirmBtn = doc.getElementById('confirmSignOut');
    const cancelBtn = doc.getElementById('cancelSignOut');
    const statusEl = doc.getElementById('lockStatus');
    let pending = false;

    const setStatus = function (text, isError) {
      statusEl.textContent = text;
      statusEl.classList.toggle('is-error', Boolean(isError));
    };

    // While the main process is deciding, no control may be pressed again: a
    // second Touch ID press opens a second OS prompt, and a sign-out pressed
    // over a running check is dropped by main while the page claims to be
    // signing out. Disabling both is also what keeps the status line honest.
    const setPending = function (value) {
      pending = value;
      unlockBtn.disabled = value;
      passwordBtn.disabled = value;
      confirmBtn.disabled = value;
      cancelBtn.disabled = value;
      if (value) card.setAttribute('aria-busy', 'true');
      else card.removeAttribute('aria-busy');
    };

    const openConfirm = function () {
      confirmPanel.hidden = false;
      passwordBtn.setAttribute('aria-expanded', 'true');
      confirmBtn.focus();
    };

    const closeConfirm = function (restoreFocus) {
      confirmPanel.hidden = true;
      passwordBtn.setAttribute('aria-expanded', 'false');
      if (restoreFocus) passwordBtn.focus();
    };

    // The page never authenticates on its own: doing so would open a second OS
    // prompt unrelated to the one the main process is awaiting, so a success
    // here would never actually restore the workspace. Both modes just declare
    // intent, and the main process - which owns the lock - acts on it. It also
    // owns the outcome: on success it removes this overlay, so there is no
    // "Unlocked" state for this page to render.
    // Nothing guards re-entry here: a control that is `disabled` cannot be
    // activated at all, which is the same guarantee, stated where a user can
    // see it.
    const request = function (mode) {
      if (typeof bridge?.idleUnlock !== 'function') {
        setStatus(UNAVAILABLE, true);
        return;
      }
      setPending(true);
      setStatus(mode === 'password' ? SIGNING_OUT : VERIFYING, false);
      bridge.idleUnlock(mode);
    };

    unlockBtn.addEventListener('click', function () {
      closeConfirm(false);
      request('biometric');
    });

    // Sign-out ends the session and closes whatever is open in the tabs, so it
    // asks first. Nothing is sent - and the status line says nothing - until
    // the second press.
    passwordBtn.addEventListener('click', function () {
      if (confirmPanel.hidden) openConfirm();
      else closeConfirm(true);
    });

    confirmBtn.addEventListener('click', function () {
      request('password');
    });

    cancelBtn.addEventListener('click', function () {
      closeConfirm(true);
    });

    // Escape would dismiss the modal card and leave a lock screen with nothing
    // on it to unlock with. Cancelling the keydown stops that at the source,
    // without relying on the dialog's cancel event, which the browser may make
    // uncancelable. With the sign-out question open, Escape answers it instead.
    doc.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (!confirmPanel.hidden && !pending) closeConfirm(true);
    });

    if (typeof bridge?.onIdleUnlockFailed === 'function') {
      bridge.onIdleUnlockFailed(function () {
        setPending(false);
        setStatus(FAILED, true);
      });
    }
  };

  const api = { init, VERIFYING, SIGNING_OUT, UNAVAILABLE, FAILED };
  root.ycIdleLock = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
