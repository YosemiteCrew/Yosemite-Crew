'use strict';

(function () {
  const version = document.getElementById('version');
  if (globalThis.ycDesktop) {
    globalThis.ycDesktop.getAppVersion().then(function (v) {
      version.textContent = 'v' + v;
    });
  }
  document.getElementById('continue-btn').addEventListener('click', function () {
    if (globalThis.ycDesktop) globalThis.ycDesktop.dismissWhatsNew();
  });
})();
