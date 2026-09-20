(function () {
  const yc = globalThis.ycDesktop;
  if (!yc) return;

  const view = globalThis.ycSettingsView;
  const statusEl = document.getElementById('status');
  const dndError = document.getElementById('dndError');
  const TIME_FIELDS = ['dndStart', 'dndEnd'];
  let saveTimer = null;

  /*
   * The status line is a fixed toast, not the last element of a 1045px page in
   * a 560px window: every control above the fold used to confirm itself
   * off-screen (issue #3298). It is a live region that starts empty, so a
   * screen reader announces a save when it happens instead of reading "Saved"
   * on load.
   */
  const showStatus = function (message, tone) {
    statusEl.textContent = message;
    statusEl.classList.toggle('error', tone === 'error');
    statusEl.classList.add('show');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      statusEl.classList.remove('show');
      // Emptied as well as faded: a live region that keeps its last message
      // re-announces it the next time anything in the region changes.
      statusEl.textContent = '';
    }, 2000);
  };

  // The main process decides which values are legal - the page does not repeat
  // the rule, it reports the answer. `rejected` names the keys the store
  // refused.
  const markTimeFields = function (rejected) {
    const bad = TIME_FIELDS.filter(function (key) {
      return rejected.includes(key);
    });
    for (const key of TIME_FIELDS) {
      const el = document.getElementById(key);
      if (el) el.setAttribute('aria-invalid', bad.includes(key) ? 'true' : 'false');
    }
    if (!dndError) return;
    dndError.textContent = bad.length > 0 ? view.TIME_HINT : '';
    dndError.hidden = bad.length === 0;
  };

  const setTheme = function (mode) {
    if (mode === 'dark') {
      document.documentElement.dataset.theme = 'dark';
    } else if (mode === 'light') {
      document.documentElement.dataset.theme = 'light';
    } else {
      delete document.documentElement.dataset.theme;
    }
  };

  const setFontScale = function (pct) {
    const scale = Math.round(pct) / 100;
    document.body.style.fontSize = scale * 100 + '%';
    document.getElementById('fontScaleLabel').textContent = Math.round(pct) + '%';
  };

  const loadSettings = function () {
    yc.getSettings().then(function (res) {
      if (!res?.ok || !res.settings) return;
      const s = res.settings;
      setValue('theme', s.theme || 'system');
      setTheme(s.theme || 'system');
      setValue('updateChannel', s.updateChannel || 'latest');
      setValue('idleLockMinutes', String(s.idleLockMinutes == null ? 0 : s.idleLockMinutes));
      setChecked('telemetryOptIn', s.telemetryOptIn === true);
      setChecked('openAtLogin', s.openAtLogin === true);
      setChecked('notificationsEnabled', s.notificationsEnabled !== false);
      setValue('dndStart', s.dndStart || '22:00');
      setValue('dndEnd', s.dndEnd || '07:00');
      setValue('telehealthProvider', s.telehealthProvider || 'getstream');
      if (s.fontScale != null) {
        const pct = Math.round(s.fontScale * 100);
        setValue('fontScale', String(pct));
        setFontScale(pct);
      }
    });
    refreshSyncStatus();
  };

  function setValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  function setChecked(id, val) {
    const el = document.getElementById(id);
    if (el) el.checked = val;
  }

  const getValue = function (id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  };

  const getChecked = function (id) {
    const el = document.getElementById(id);
    return el ? el.checked : false;
  };

  const saveSettings = function () {
    const fontScaleVal = Number.parseInt(getValue('fontScale'), 10) || 100;
    const settings = {
      theme: getValue('theme'),
      fontScale: Math.round(fontScaleVal) / 100,
      updateChannel: getValue('updateChannel'),
      idleLockMinutes: Number.parseInt(getValue('idleLockMinutes'), 10) || 0,
      notificationsEnabled: getChecked('notificationsEnabled'),
      dndStart: getValue('dndStart'),
      dndEnd: getValue('dndEnd'),
      telemetryOptIn: getChecked('telemetryOptIn'),
      telehealthProvider: getValue('telehealthProvider') || 'getstream',
      openAtLogin: getChecked('openAtLogin'),
    };
    yc.setSettings(settings).then(function (res) {
      if (!res?.ok) return;
      const rejected = Array.isArray(res.rejected) ? res.rejected : [];
      const feedback = view.saveFeedback(rejected);
      markTimeFields(rejected);
      showStatus(feedback.message, feedback.tone);
    });
  };

  const renderSyncStatus = function (res) {
    const el = document.getElementById('syncStatusText');
    if (!el || !res?.status) return;
    el.textContent = view.syncStatusLabel(res.status);
  };

  function refreshSyncStatus() {
    if (!yc.getSyncStatus) return;
    yc.getSyncStatus().then(renderSyncStatus);
  }

  const onChange = function () {
    saveSettings();
  };

  /*
   * `change` only. The text fields used to save on every `input` too, so typing
   * a time submitted "2", "22", "22:" and "22:0" in turn - each one refused by
   * the store, each one answered "Saved" (issue #3298). `change` fires on blur
   * and on Enter, which is when the user has finished the value.
   */
  document.querySelectorAll('select, input').forEach(function (el) {
    el.addEventListener('change', onChange);
  });

  document.getElementById('theme').addEventListener('change', function () {
    setTheme(getValue('theme'));
    saveSettings();
  });

  document.getElementById('fontScale').addEventListener('input', function () {
    const pct = Number.parseInt(this.value, 10) || 100;
    setFontScale(pct);
    saveSettings();
  });

  const syncNow = document.getElementById('syncNow');
  if (syncNow) {
    syncNow.addEventListener('click', function () {
      syncNow.disabled = true;
      yc.syncNow()
        .then(renderSyncStatus)
        .finally(function () {
          syncNow.disabled = false;
        });
    });
  }

  const clearLocalData = document.getElementById('clearLocalData');
  if (clearLocalData) {
    clearLocalData.addEventListener('click', function () {
      if (!globalThis.confirm('Clear local desktop data? You will need to sign in again.')) return;
      clearLocalData.disabled = true;
      yc.clearLocalData()
        .then(function (res) {
          if (res?.ok) {
            // Not "Saved": the action deleted the local cache, vault, recents,
            // sync queue and session rather than storing a preference.
            showStatus('Local data cleared', 'ok');
            refreshSyncStatus();
          }
        })
        .finally(function () {
          clearLocalData.disabled = false;
        });
    });
  }

  // Prefixes the channel hint with the running version, per the Preferences
  // design. The static markup stays as the fallback if the version never lands.
  yc.getAppVersion().then(function (v) {
    const hint = document.getElementById('updateHint');
    if (hint) hint.textContent = 'Version ' + v + ' · beta may include unfinished features';
  });

  loadSettings();
})();
