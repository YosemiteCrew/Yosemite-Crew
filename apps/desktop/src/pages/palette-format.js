'use strict';

// Text formatting for the command palette's result rows.
//
// This is a plain browser script for the same reason as window-caption.js: the
// palette page loads it over file:// under a strict CSP and cannot reach a
// compiled module under src/. The unit tests require this file directly.
(function (root) {
  const escapeHtml = function (value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[c];
    });
  };

  // A row is matched on its label, its description OR its keywords, but only
  // the label is rendered. Marking whatever subsequence of the query happens to
  // appear in the label turned a description-only match into scattered single
  // letters - searching "app" marked just the "a" of "Pin current page", which
  // reads as a claim the row matched on that letter. Highlight only when the
  // WHOLE query is present in the label; otherwise leave the label plain.
  const highlightLabel = function (label, query) {
    const text = String(label == null ? '' : label);
    if (!query || !query.trim()) return escapeHtml(text);
    const q = query.toLowerCase().trim();
    const indices = [];
    let qi = 0;
    for (let li = 0; li < text.length && qi < q.length; li++) {
      if (text[li].toLowerCase() === q[qi]) {
        indices.push(li);
        qi++;
      }
    }
    if (qi < q.length) return escapeHtml(text);
    let result = '';
    let lastIdx = 0;
    indices.forEach(function (idx) {
      result += escapeHtml(text.slice(lastIdx, idx)) + '<mark>' + escapeHtml(text[idx]) + '</mark>';
      lastIdx = idx + 1;
    });
    return result + escapeHtml(text.slice(lastIdx));
  };

  // What a screen reader is told after each keystroke. Arrow-key movement is
  // announced by aria-activedescendant; this covers the two things that have no
  // element to point at - how many rows appeared, and the empty states.
  const resultsAnnouncement = function (count, query) {
    const q = query && query.trim() ? query.trim() : '';
    if (count > 0) return count === 1 ? '1 result' : count + ' results';
    if (q) return 'No results for "' + q + '"';
    return 'Type to search commands';
  };

  const api = {
    escapeHtml: escapeHtml,
    highlightLabel: highlightLabel,
    resultsAnnouncement: resultsAnnouncement,
  };
  root.ycPaletteFormat = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
