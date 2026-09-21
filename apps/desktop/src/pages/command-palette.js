(function () {
  const yc = globalThis.ycDesktop;
  const fmt = globalThis.ycPaletteFormat;
  const searchEl = document.getElementById('search');
  const resultsEl = document.getElementById('results');
  const emptyEl = document.getElementById('empty');
  const liveEl = document.getElementById('cp-live');
  let selectedIndex = -1;
  let results = [];
  let currentQuery = '';
  let recentsCache = [];
  let actionMap = {};
  let ACTIONS = [];

  function buildActionMap(items) {
    ACTIONS = items;
    actionMap = {};
    ACTIONS.forEach(function (a) {
      actionMap[a.id] = a;
    });
  }

  function scoreFuzzy(query, text) {
    const q = query.toLowerCase().trim();
    const t = text.toLowerCase().trim();
    if (!q || !t) return 0;
    if (t === q) return 100;
    if (t.startsWith(q)) return 90;
    if (t.includes(q)) return 70;
    let qi = 0,
      consecutive = 0,
      maxConsecutive = 0;
    for (let ti = 0; ti < t.length && qi < q.length; ti++) {
      if (t[ti] === q[qi]) {
        qi++;
        consecutive++;
        if (consecutive > maxConsecutive) maxConsecutive = consecutive;
      } else {
        consecutive = 0;
      }
    }
    if (qi < q.length) return 0;
    return Math.min(50 + maxConsecutive * 5, 69);
  }

  function search(query, recents) {
    const q = query.toLowerCase().trim();
    if (!q) return { results: [], isRecents: true };
    const scored = [];
    ACTIONS.forEach(function (item) {
      const texts = [item.label, item.description].concat(item.keywords || []).filter(Boolean);
      let best = 0;
      texts.forEach(function (t) {
        const s = scoreFuzzy(q, t);
        if (s > best) best = s;
      });
      if (best > 0) {
        const r = recents.filter(function (re) {
          return re.id === item.id;
        });
        const boost =
          r.length > 0 ? Math.min(15, Math.max(0, 15 - (Date.now() - r[0].visitedAt) / 60000)) : 0;
        scored.push({ item: item, score: best + boost });
      }
    });
    scored.sort(function (a, b) {
      return b.score - a.score;
    });
    return { results: scored, isRecents: false };
  }

  const escapeHtml = fmt.escapeHtml;
  const highlightLabel = fmt.highlightLabel;

  // Rows carry listbox semantics, so each needs a stable id for the input's
  // aria-activedescendant to point at.
  function optionId(index) {
    return 'cp-option-' + index;
  }

  // The icon tile used to fall back to a bullet whenever an action had no
  // icon - which is every built-in action, so every row showed the same
  // meaningless dot. No icon, no tile.
  function iconTile(action, extraClass) {
    if (!action.icon) return '';
    return (
      '<div class="item-icon' +
      (extraClass ? ' ' + extraClass : '') +
      '" aria-hidden="true">' +
      escapeHtml(action.icon) +
      '</div>'
    );
  }

  function render(query) {
    currentQuery = query;
    const data = search(query, recentsCache);
    let html = '';
    let emptyText = '';
    results = [];
    selectedIndex = -1;

    if (data.isRecents && recentsCache.length > 0) {
      // The section title is inside the listbox, so the rows it heads are
      // wrapped in a group - a listbox may only contain options and groups.
      let rows = '';
      recentsCache.forEach(function (r) {
        const a = actionMap[r.id];
        if (!a) return;
        const index = results.length;
        results.push(a);
        rows +=
          '<div class="item" role="option" aria-selected="false" id="' +
          optionId(index) +
          '" data-index="' +
          index +
          '">' +
          iconTile(a, 'recents-clock') +
          '<div class="item-label">' +
          escapeHtml(a.label) +
          '</div>' +
          (a.description ? '<div class="item-desc">' + escapeHtml(a.description) + '</div>' : '') +
          '</div>';
      });
      if (results.length === 0) {
        emptyText = 'No recents yet';
      } else {
        html =
          '<div role="group" aria-labelledby="cp-recent-title">' +
          '<div class="section-title" id="cp-recent-title">Recent</div>' +
          rows +
          '</div>';
      }
    } else if (data.results.length > 0) {
      data.results.forEach(function (r, i) {
        const a = r.item;
        results.push(a);
        html +=
          '<div class="item" role="option" aria-selected="false" id="' +
          optionId(i) +
          '" data-index="' +
          i +
          '">' +
          iconTile(a) +
          '<div class="item-label">' +
          highlightLabel(a.label, query) +
          '</div>' +
          '<div class="item-type">' +
          escapeHtml(a.type) +
          '</div>' +
          '</div>';
      });
    } else {
      emptyText = fmt.resultsAnnouncement(0, query);
    }

    resultsEl.innerHTML = html;
    emptyEl.textContent = emptyText;
    searchEl.setAttribute('aria-expanded', results.length > 0 ? 'true' : 'false');
    // Arrow-key movement is announced through aria-activedescendant; the live
    // region carries the two things with no element to point at - how many rows
    // there are, and the empty states.
    liveEl.textContent = emptyText || fmt.resultsAnnouncement(results.length, query);

    resultsEl.querySelectorAll('.item').forEach(function (el) {
      el.addEventListener('click', function () {
        const idx = Number.parseInt(el.dataset.index, 10);
        selectItem(idx);
      });
      el.addEventListener('mousemove', function () {
        const idx = Number.parseInt(el.dataset.index, 10);
        if (selectedIndex !== idx) {
          setSelected(idx);
        }
      });
    });

    // Auto-select the first result so Enter activates it immediately.
    if (results.length > 0) setSelected(0);
  }

  function setSelected(idx) {
    if (selectedIndex >= 0) {
      const prev = resultsEl.querySelector('.item[data-index="' + selectedIndex + '"]');
      if (prev) {
        prev.classList.remove('selected');
        prev.setAttribute('aria-selected', 'false');
      }
    }
    selectedIndex = idx;
    const next =
      selectedIndex >= 0
        ? resultsEl.querySelector('.item[data-index="' + selectedIndex + '"]')
        : null;
    if (next) {
      next.classList.add('selected');
      next.setAttribute('aria-selected', 'true');
      next.scrollIntoView({ block: 'nearest' });
      searchEl.setAttribute('aria-activedescendant', next.id);
    } else {
      searchEl.removeAttribute('aria-activedescendant');
    }
  }

  function selectItem(idx) {
    const item = results[idx];
    if (!item) return;
    if (yc && typeof yc.executeCommand === 'function') {
      yc.executeCommand(item.id);
    }
  }

  searchEl.addEventListener('input', function () {
    render(this.value);
  });

  searchEl.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected(Math.min(results.length - 1, selectedIndex + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected(Math.max(0, selectedIndex - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        selectItem(selectedIndex);
      }
    } else if (e.key === 'Escape') {
      if (yc && typeof yc.closePalette === 'function') {
        yc.closePalette();
      }
    }
  });

  // Actions come from an async IPC call so the HTML and TS share one source of truth.
  // Load them first, then load recents, then render.
  function loadActionsAndRecents() {
    if (yc && typeof yc.getPaletteActions === 'function') {
      Promise.resolve(yc.getPaletteActions())
        .then(function (r) {
          if (r?.ok && r.actions) {
            buildActionMap(r.actions);
          }
          return yc && typeof yc.getPaletteRecents === 'function'
            ? Promise.resolve(yc.getPaletteRecents())
            : Promise.resolve({ recents: [] });
        })
        .then(function (r) {
          if (r?.recents) {
            recentsCache = r.recents;
          } else if (Array.isArray(r)) {
            recentsCache = r;
          } else {
            recentsCache = [];
          }
          render(currentQuery);
        })
        .catch(function () {
          render(currentQuery);
        });
    } else {
      // Fallback: use minimal built-in actions if IPC unavailable
      buildActionMap([
        {
          id: 'open-settings',
          label: 'Open settings',
          description: 'Application preferences',
          keywords: ['preferences', 'config', 'options'],
          type: 'action',
          icon: '\u2699',
        },
      ]);
      render('');
    }
  }

  loadActionsAndRecents();
  searchEl.focus();
})();
