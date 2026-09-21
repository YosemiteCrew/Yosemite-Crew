// The page helper is a plain browser script: the Document Vault window loads it
// over file:// under a strict CSP, and the sandboxed preload cannot share a
// compiled module with it either. It also assigns `module.exports`, so it
// imports here - untyped, hence the surface restated below for the type
// checker.
import untypedView from '../src/pages/vault-view.js';

const view: {
  fileIcon: (mime: unknown) => string;
  isImage: (mime: unknown) => boolean;
  listPlaceholder: (matchCount: number, totalCount: number) => string;
  noResultsTitle: (query: unknown) => string;
  ICON_IMAGE: string;
  ICON_TEXT: string;
  ICON_PDF: string;
  ICON_SHEET: string;
  ICON_FILE: string;
} = untypedView;

describe('fileIcon', () => {
  /*
   * `text/csv` is both a spreadsheet type and a `text/*` type. With the generic
   * text rule tested first, every CSV in the vault - lab results, for one - took
   * the notes glyph and never reached the spreadsheet rule (issue #3297).
   */
  test('a CSV is a spreadsheet, not a note', () => {
    expect(view.fileIcon('text/csv')).toBe(view.ICON_SHEET);
    expect(view.fileIcon('text/csv')).not.toBe(view.ICON_TEXT);
  });

  test.each([
    ['application/vnd.ms-excel'],
    ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['application/vnd.oasis.opendocument.spreadsheet'],
  ])('%s is a spreadsheet', (mime) => {
    expect(view.fileIcon(mime)).toBe(view.ICON_SHEET);
  });

  test('the text rule still answers for text that is not a spreadsheet', () => {
    // The control for the reordering: moving the spreadsheet test to the front
    // must not take plain text with it.
    expect(view.fileIcon('text/plain')).toBe(view.ICON_TEXT);
    expect(view.fileIcon('text/markdown')).toBe(view.ICON_TEXT);
    expect(view.fileIcon('application/json')).toBe(view.ICON_TEXT);
    expect(view.fileIcon('application/xml')).toBe(view.ICON_TEXT);
  });

  test.each([
    ['image/png', 'ICON_IMAGE'],
    ['image/jpeg', 'ICON_IMAGE'],
    ['application/pdf', 'ICON_PDF'],
    ['application/octet-stream', 'ICON_FILE'],
  ])('%s takes %s', (mime, key) => {
    expect(view.fileIcon(mime)).toBe(view[key as 'ICON_IMAGE']);
  });

  test('every rule has a glyph of its own, so a wrong branch is visible', () => {
    const glyphs = [
      view.ICON_IMAGE,
      view.ICON_TEXT,
      view.ICON_PDF,
      view.ICON_SHEET,
      view.ICON_FILE,
    ];
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });

  test.each([[undefined], [null], [42], [{}]])('a missing mime type (%p) falls back', (mime) => {
    expect(view.fileIcon(mime)).toBe(view.ICON_FILE);
    expect(view.isImage(mime)).toBe(false);
  });
});

describe('listPlaceholder', () => {
  /*
   * An empty list has two causes and they need different words. The page showed
   * the empty-vault message for both, so a search matching nothing announced
   * "No documents in the vault" while the header beside it read "4 documents"
   * and the search count read "0/4" (issue #3297).
   */
  test('nothing matched but the vault holds documents is a no-results state', () => {
    expect(view.listPlaceholder(0, 4)).toBe('no-results');
  });

  test('an empty vault is an empty-vault state', () => {
    expect(view.listPlaceholder(0, 0)).toBe('empty-vault');
  });

  test('a list with rows in it shows no placeholder', () => {
    expect(view.listPlaceholder(1, 4)).toBe('none');
    expect(view.listPlaceholder(4, 4)).toBe('none');
  });

  test('the three states are distinct, so one cannot stand in for another', () => {
    const states = [
      view.listPlaceholder(0, 4),
      view.listPlaceholder(0, 0),
      view.listPlaceholder(1, 4),
    ];
    expect(new Set(states).size).toBe(3);
  });
});

describe('noResultsTitle', () => {
  test('quotes the search that found nothing', () => {
    expect(view.noResultsTitle('zzz')).toBe('No documents match "zzz"');
  });

  test('trims the query rather than quoting the whitespace', () => {
    expect(view.noResultsTitle('  rabies  ')).toBe('No documents match "rabies"');
  });

  test.each([[''], ['   '], [undefined], [null], [7]])(
    'a query of %p leaves no empty quotes on screen',
    (query) => {
      expect(view.noResultsTitle(query)).toBe('No documents match your search');
    }
  );
});
