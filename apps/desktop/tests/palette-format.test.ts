// The palette page is a plain browser script loaded over file:// under a strict
// CSP, so its helper is required here rather than imported as a module -
// untyped, hence the surface restated below for the type checker.
import untypedFormat from '../src/pages/palette-format.js';

const fmt: {
  escapeHtml: (value: unknown) => string;
  highlightLabel: (label: string, query: string) => string;
  resultsAnnouncement: (count: number, query: string) => string;
} = untypedFormat;

describe('highlightLabel', () => {
  // A contiguous occurrence wins and is marked as one run, not as one <mark>
  // per character: the run is the common case and the one that reads cleanly.
  test('marks a contiguous occurrence of the query as a single run', () => {
    expect(fmt.highlightLabel('Patients', 'pat')).toBe('<mark>Pat</mark>ients');
  });

  test('the run is found anywhere in the label, not only at the start', () => {
    expect(fmt.highlightLabel('Pin current page', 'page')).toBe('Pin current <mark>page</mark>');
  });

  // No contiguous run, but every query character is there in order. scoreFuzzy
  // scores such rows, so they do appear in the list and these marks are what
  // explain why they matched.
  test('marks per character when the whole query is present but scattered', () => {
    expect(fmt.highlightLabel('Patients', 'pts')).toBe(
      '<mark>P</mark>a<mark>t</mark>ient<mark>s</mark>'
    );
  });

  // Issue #3302's sibling finding: a row is scored on its label, its
  // description AND its keywords, but only the label is rendered. Searching
  // "app" matched "Pin current page" on its description and then marked the
  // single "a" of "page", which reads as a claim the row matched on that
  // letter. The label has a "p" and an "a" but no second "p" after them, so
  // this is exactly the partial-subsequence case.
  test('leaves the label plain when only part of the query is in it', () => {
    expect(fmt.highlightLabel('Pin current page', 'app')).toBe('Pin current page');
  });

  test('a label with no query character at all is plain', () => {
    expect(fmt.highlightLabel('Patients', 'zzz')).toBe('Patients');
  });

  test('an empty or blank query never marks anything', () => {
    expect(fmt.highlightLabel('Patients', '')).toBe('Patients');
    expect(fmt.highlightLabel('Patients', '   ')).toBe('Patients');
  });

  test('matching is case-insensitive in both directions', () => {
    expect(fmt.highlightLabel('Patients', 'PAT')).toBe('<mark>Pat</mark>ients');
    expect(fmt.highlightLabel('PATIENTS', 'pat')).toBe('<mark>PAT</mark>IENTS');
  });

  // The result goes into innerHTML, so every path out of here - marked,
  // unmarked, and the unmarked slices between marks - has to be escaped.
  test('escapes the label on the contiguous-run path', () => {
    expect(fmt.highlightLabel('<b>a</b>', 'a')).toBe('&lt;b&gt;<mark>a</mark>&lt;/b&gt;');
  });

  test('escapes the label on the scattered path', () => {
    expect(fmt.highlightLabel('<b>ab</b>', 'ba')).toBe(
      '&lt;<mark>b</mark>&gt;<mark>a</mark>b&lt;/b&gt;'
    );
  });

  test('escapes the label on the plain path', () => {
    expect(fmt.highlightLabel('<img src=x>', 'zzz')).toBe('&lt;img src=x&gt;');
  });

  test('a missing label is not rendered as "null"', () => {
    expect(fmt.highlightLabel(undefined as unknown as string, 'a')).toBe('');
  });
});

describe('resultsAnnouncement', () => {
  test('counts results, singular and plural', () => {
    expect(fmt.resultsAnnouncement(1, 'pat')).toBe('1 result');
    expect(fmt.resultsAnnouncement(4, 'pat')).toBe('4 results');
  });

  test('a searched-for query with nothing behind it names the query', () => {
    expect(fmt.resultsAnnouncement(0, 'xyzzy')).toBe('No results for "xyzzy"');
  });

  test('an empty query prompts instead of reporting a failure', () => {
    expect(fmt.resultsAnnouncement(0, '')).toBe('Type to search commands');
    expect(fmt.resultsAnnouncement(0, '   ')).toBe('Type to search commands');
  });
});
