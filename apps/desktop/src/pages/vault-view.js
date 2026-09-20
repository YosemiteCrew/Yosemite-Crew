'use strict';

// Presentation decisions for the Document Vault page: which placeholder the
// list shows, what it says, and which glyph a file gets.
//
// This is a plain browser script rather than a module under src/: the local
// pages load it over file:// under a strict CSP, and the sandboxed preload
// cannot require a compiled module either, so a shared TypeScript module would
// reach neither. The unit tests require this file directly. Same arrangement as
// platform-labels.js.
(function (root) {
  const ICON_IMAGE = '\u{1F5BC}';
  const ICON_TEXT = '\u{1F4DD}';
  const ICON_PDF = '\u{1F4D1}';
  const ICON_SHEET = '\u{1F4CA}';
  const ICON_FILE = '\u{1F4C4}';

  /*
   * Order matters, and the spreadsheet test has to come first. `text/csv` is
   * both a spreadsheet and a `text/*` type, so with the generic text rule
   * ahead of it every CSV in the vault - lab results, for one - took the notes
   * glyph and never reached the spreadsheet rule at all (issue #3297).
   */
  const fileIcon = function (mime) {
    const type = typeof mime === 'string' ? mime : '';
    if (/spreadsheet|excel|csv/.test(type)) return ICON_SHEET;
    if (type.startsWith('image/')) return ICON_IMAGE;
    if (/pdf/.test(type)) return ICON_PDF;
    if (/^text\/|^application\/(json|xml|javascript)/.test(type)) return ICON_TEXT;
    return ICON_FILE;
  };

  const isImage = function (mime) {
    return typeof mime === 'string' && mime.startsWith('image/');
  };

  /*
   * Which of the two placeholders the list shows, decided by the counts rather
   * than by whether the search box has text in it. A search that matches
   * nothing used to raise "No documents in the vault" - with the header beside
   * it still reading "4 documents" (issue #3297).
   */
  const listPlaceholder = function (matchCount, totalCount) {
    if (matchCount > 0) return 'none';
    return totalCount > 0 ? 'no-results' : 'empty-vault';
  };

  const noResultsTitle = function (query) {
    const q = typeof query === 'string' ? query.trim() : '';
    return q ? 'No documents match "' + q + '"' : 'No documents match your search';
  };

  const api = {
    fileIcon: fileIcon,
    isImage: isImage,
    listPlaceholder: listPlaceholder,
    noResultsTitle: noResultsTitle,
    ICON_IMAGE: ICON_IMAGE,
    ICON_TEXT: ICON_TEXT,
    ICON_PDF: ICON_PDF,
    ICON_SHEET: ICON_SHEET,
    ICON_FILE: ICON_FILE,
  };
  root.ycVaultView = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
