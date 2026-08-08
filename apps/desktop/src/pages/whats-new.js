'use strict';

(function () {
  const version = document.getElementById('version');
  const yc = globalThis.ycDesktop;

  /** The stable feed is stored as "latest"; anything else is the beta feed. */
  const channelLabel = function (channel) {
    return channel === 'beta' ? 'Beta' : 'Stable';
  };

  if (yc) {
    // The channel is a nice-to-have: a failed settings read still leaves the
    // version line readable rather than blanking it.
    const channel = yc.getSettings().then(
      function (res) {
        return res?.ok && res.settings ? res.settings.updateChannel : null;
      },
      function () {
        return null;
      }
    );
    Promise.all([yc.getAppVersion(), channel]).then(function (parts) {
      const suffix = parts[1] ? ' · ' + channelLabel(parts[1]) + ' channel' : '';
      version.textContent = 'Version ' + parts[0] + suffix;
    });
  }

  document.getElementById('continue-btn').addEventListener('click', function () {
    if (yc) yc.dismissWhatsNew();
  });
})();
