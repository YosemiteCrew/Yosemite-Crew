import {resolveListPhase} from '@/shared/utils/listPhase';

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
