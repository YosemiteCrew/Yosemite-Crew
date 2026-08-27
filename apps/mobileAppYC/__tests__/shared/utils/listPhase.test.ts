import {isListStale, resolveListPhase} from '@/shared/utils/listPhase';

describe('resolveListPhase', () => {
  // The bug this closes: eight screens asked only `items.length === 0` and
  // rendered "add your first X" for every one of these cases.
  it('distinguishes a failed load from a genuinely empty list', () => {
    expect(
      resolveListPhase({itemCount: 0, hasLoaded: true, loadError: 'boom'}),
    ).toBe('error');
    expect(resolveListPhase({itemCount: 0, hasLoaded: true})).toBe('empty');
  });

  it('reports loading before anything has arrived', () => {
    expect(resolveListPhase({itemCount: 0, loading: true})).toBe('loading');
  });

  it('never claims empty without a successful fetch to prove it', () => {
    // hasLoaded false and not loading: still not proof the account is empty.
    expect(resolveListPhase({itemCount: 0})).toBe('loading');
  });

  it('reports ready as soon as there is anything to render', () => {
    expect(resolveListPhase({itemCount: 3, hasLoaded: true})).toBe('ready');
  });

  it('keeps existing items visible during a background refresh', () => {
    expect(
      resolveListPhase({itemCount: 3, loading: true, hasLoaded: true}),
    ).toBe('ready');
  });

  it('keeps existing items visible when a refresh fails', () => {
    // Replacing a readable list with a full-screen error is worse than leaving
    // the stale list up.
    expect(
      resolveListPhase({itemCount: 3, loadError: 'boom', hasLoaded: true}),
    ).toBe('ready');
  });

  it('prefers error over loading so a failed retry keeps its retry control', () => {
    expect(
      resolveListPhase({itemCount: 0, loading: true, loadError: 'boom'}),
    ).toBe('error');
  });

  it('treats an empty-string error as no error', () => {
    expect(
      resolveListPhase({itemCount: 0, hasLoaded: true, loadError: ''}),
    ).toBe('empty');
    expect(
      resolveListPhase({itemCount: 0, hasLoaded: true, loadError: null}),
    ).toBe('empty');
  });
});

describe('isListStale', () => {
  // The other half of "existing items win". resolveListPhase keeps a readable
  // list readable; this reports the failure it deliberately did not promote, so
  // the screen can say the content may be out of date instead of staying silent.
  it('is true when a refresh failed over content that is still on screen', () => {
    expect(isListStale({loadError: 'boom', itemCount: 3})).toBe(true);
  });

  it('is false when the list is empty, because that is the error phase', () => {
    expect(isListStale({loadError: 'boom', itemCount: 0})).toBe(false);
    expect(resolveListPhase({loadError: 'boom', itemCount: 0})).toBe('error');
  });

  it('is false when nothing failed', () => {
    expect(isListStale({itemCount: 3})).toBe(false);
    expect(isListStale({loadError: null, itemCount: 3})).toBe(false);
    expect(isListStale({loadError: '', itemCount: 3})).toBe(false);
  });

  // The pair is what makes the ordering honest: 'ready' still renders the list,
  // and the staleness is reported next to it rather than discarded.
  it('coexists with a ready phase rather than replacing it', () => {
    const input = {loadError: 'boom', itemCount: 3, hasLoaded: true};

    expect(resolveListPhase(input)).toBe('ready');
    expect(isListStale(input)).toBe(true);
  });
});
