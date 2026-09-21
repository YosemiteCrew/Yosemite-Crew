'use strict';

// The contents of one tab-strip row: one element per slot, created once and
// updated in place, with the slots a tab does not need hidden rather than
// removed. Nothing in the row is created or destroyed by a poll, so focus
// inside it - on the mute button, say - survives.
//
// Extracted from tabbar.html because the strip now reconciles instead of
// rebuilding, which means "built" and "updated" are no longer the same moment.
// A per-poll indicator written only on the build path is a bug that CI cannot
// see from the page, and the page's inline script cannot be imported by a test.
//
// A plain browser script rather than a module under src/: the local pages load
// it over file:// under a strict CSP, so a compiled TypeScript module would not
// reach them. The unit tests require this file directly.
(function (root) {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // A favicon URL that failed once. Without this the next poll asks for the
  // same missing icon again, and the <img> holds its 14px until the error
  // arrives, so the label shifts sideways once a second forever.
  const failedFavicons = new Set();

  // `hidden` as an IDL property is defined on HTMLElement only. Assigning it on
  // the SVG page icon would set a plain expando and paint nothing, so every
  // slot is hidden through the attribute instead - toggleAttribute is on
  // Element, which both kinds of slot are.
  const setHidden = function (el, hidden) {
    el.toggleAttribute('hidden', Boolean(hidden));
  };

  // Drawn rather than set as text: the app font has no glyph for the page and
  // warning characters, which is how the search button ended up as a 7px
  // system fallback.
  const buildPageIcon = function () {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'tab-page-icon');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.4');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    const page = document.createElementNS(SVG_NS, 'path');
    page.setAttribute('d', 'M3.5 2.5h6l3 3v8h-9z');
    const fold = document.createElementNS(SVG_NS, 'path');
    fold.setAttribute('d', 'M9.5 2.5v3h3');
    svg.appendChild(page);
    svg.appendChild(fold);
    return svg;
  };

  // `onToggleMute` is handed the tab id read off the row's parent at click time
  // rather than closed over, because a row outlives any one poll's tab object.
  const buildRow = function (onToggleMute) {
    const inner = document.createElement('div');
    inner.className = 'tab-inner';

    const spinner = document.createElement('span');
    spinner.className = 'tab-spinner';

    const favicon = document.createElement('img');
    favicon.className = 'tab-favicon';
    favicon.alt = '';
    favicon.addEventListener('error', function () {
      if (favicon.dataset.url) failedFavicons.add(favicon.dataset.url);
      setHidden(favicon, true);
    });

    const monogram = document.createElement('span');
    monogram.className = 'tab-monogram';
    monogram.setAttribute('aria-hidden', 'true');

    const pageIcon = buildPageIcon();

    const label = document.createElement('span');
    label.className = 'tab-label';

    const badge = document.createElement('span');
    badge.className = 'tab-badge';
    badge.setAttribute('role', 'img');

    const audio = document.createElement('button');
    audio.type = 'button';
    audio.className = 'tab-audio';
    audio.addEventListener('click', function (e) {
      e.stopPropagation();
      if (onToggleMute) onToggleMute(inner.parentElement.dataset.tabId);
    });

    for (const slot of [spinner, favicon, monogram, pageIcon, badge, audio]) {
      setHidden(slot, true);
    }

    inner.append(spinner, favicon, monogram, pageIcon, label, badge, audio);
    return inner;
  };

  const slotsOf = function (inner) {
    const children = inner.children;
    return {
      spinner: children[0],
      favicon: children[1],
      monogram: children[2],
      pageIcon: children[3],
      label: children[4],
      badge: children[5],
      audio: children[6],
    };
  };

  const updateFaviconSlot = function (favicon, tab, wanted) {
    const url = wanted && tab.favicon && !failedFavicons.has(tab.favicon) ? tab.favicon : '';
    if (favicon.dataset.url !== url) {
      favicon.dataset.url = url;
      // Only ever assign a non-empty src: clearing it re-requests the page.
      if (url) favicon.src = url;
    }
    setHidden(favicon, !url);
  };

  // A pinned tab is 48px wide at most, so it shows one glyph and no text; an
  // ordinary tab shows its favicon and its label. Which of the three pinned
  // glyphs applies is ycTabIndicators' decision, not this module's.
  const updateGlyphSlots = function (slots, tab) {
    const loading = Boolean(tab.loading);
    const pinned = Boolean(tab.pinned);
    const glyph = loading || !pinned ? null : root.ycTabIndicators.pinnedGlyph(tab);

    setHidden(slots.spinner, !loading);
    setHidden(slots.label, pinned);
    updateFaviconSlot(slots.favicon, tab, !loading && (!pinned || glyph.kind === 'favicon'));

    const monogram = glyph && glyph.kind === 'monogram' ? glyph.text : '';
    if (monogram && slots.monogram.textContent !== monogram) {
      slots.monogram.textContent = monogram;
    }
    setHidden(slots.monogram, !monogram);
    setHidden(slots.pageIcon, !glyph || glyph.kind !== 'icon');
  };

  const updateBadgeSlot = function (badge, tab) {
    const view = root.ycTabIndicators.tabBadge(tab);
    setHidden(badge, !view);
    if (!view) return;
    badge.className = view.className;
    badge.textContent = view.text;
    badge.title = view.title;
    badge.setAttribute('aria-label', view.label);
  };

  const updateAudioSlot = function (audio, tab) {
    setHidden(audio, !tab.audible);
    if (!tab.audible) return;
    const muteName = root.ycTabbarA11y.muteLabel(tab);
    audio.className = 'tab-audio' + (tab.muted ? ' tab-audio--muted' : '');
    audio.textContent = tab.muted ? '\uD83D\uDD07' : '\uD83D\uDD0A';
    audio.title = muteName;
    audio.setAttribute('aria-label', muteName);
    audio.setAttribute('aria-pressed', String(Boolean(tab.muted)));
  };

  // Runs for EVERY tab on EVERY poll, not just for rows that were inserted.
  // Anything that can change while a tab is open belongs here and nowhere else.
  const updateRow = function (inner, tab) {
    const slots = slotsOf(inner);
    updateGlyphSlots(slots, tab);
    const title = tab.title || '';
    if (slots.label.textContent !== title) slots.label.textContent = title;
    updateBadgeSlot(slots.badge, tab);
    updateAudioSlot(slots.audio, tab);
  };

  const api = {
    buildRow: buildRow,
    updateRow: updateRow,
    slotsOf: slotsOf,
    failedFavicons: failedFavicons,
  };
  root.ycTabRow = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
