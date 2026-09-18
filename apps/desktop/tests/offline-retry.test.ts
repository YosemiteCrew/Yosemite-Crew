import { getDesktopConfig } from '../src/core/navigation-policy';
import { createOfflineRetryTargets, type RetryContents } from '../src/shell/offline-retry';

const config = getDesktopConfig({});
const START = config.startUrl.href;

const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as never;

const OFFLINE_PAGE = 'file:///app/pages/offline.html';

const makeContents = (id: number, url = 'https://yosemitecrew.com/patients/42') => {
  const destroyListeners: Array<() => void> = [];
  let current = url;
  return {
    id,
    getURL: jest.fn(() => current),
    loadURL: jest.fn((next: string) => {
      current = next;
      return Promise.resolve();
    }),
    once: jest.fn((_event: 'destroyed', listener: () => void) => {
      destroyListeners.push(listener);
    }),
    // What the shell does right after recording the failure.
    showOfflinePage: () => {
      current = `${OFFLINE_PAGE}?reason=ERR_INTERNET_DISCONNECTED`;
    },
    destroy: () => destroyListeners.forEach((fn) => fn()),
  };
};

const targets = () => createOfflineRetryTargets({ config, logger, offlinePageUrl: OFFLINE_PAGE });

describe('createOfflineRetryTargets', () => {
  test('a retry reloads the page that failed, in the tab that failed it', () => {
    const t = targets();
    const failed = makeContents(1);
    const other = makeContents(2, 'https://yosemitecrew.com/inbox');

    t.remember(failed, 'https://yosemitecrew.com/patients/42/labs');
    failed.showOfflinePage();
    t.retry(failed);

    expect(failed.loadURL).toHaveBeenCalledWith('https://yosemitecrew.com/patients/42/labs');
    // #3288: the countdown can fire after the user has moved to another tab.
    expect(other.loadURL).not.toHaveBeenCalled();
  });

  test('a retry never loads the start URL over the page that failed', () => {
    const t = targets();
    const wc = makeContents(1);
    t.remember(wc, 'https://yosemitecrew.com/patients/42/labs');
    wc.showOfflinePage();
    t.retry(wc);
    expect(wc.loadURL).not.toHaveBeenCalledWith(START);
  });

  test('each tab retries its own page', () => {
    const t = targets();
    const a = makeContents(1);
    const b = makeContents(2);
    t.remember(a, 'https://yosemitecrew.com/a');
    t.remember(b, 'https://yosemitecrew.com/b');
    a.showOfflinePage();
    b.showOfflinePage();
    t.retry(b);
    t.retry(a);
    expect(b.loadURL).toHaveBeenCalledWith('https://yosemitecrew.com/b');
    expect(a.loadURL).toHaveBeenCalledWith('https://yosemitecrew.com/a');
  });

  test('with no reported URL it falls back to the page the tab was on', () => {
    const t = targets();
    const wc = makeContents(1, 'https://yosemitecrew.com/appointments');
    expect(t.remember(wc)).toBe('https://yosemitecrew.com/appointments');
  });

  test('a URL outside the allow-list is refused at record time', () => {
    const t = targets();
    const wc = makeContents(1, 'https://example.com/phish');
    expect(t.remember(wc, 'https://example.com/phish')).toBe(START);
    wc.showOfflinePage();
    t.retry(wc);
    expect(wc.loadURL).toHaveBeenCalledWith(START);
  });

  test('a blocked reported URL does not discard a usable current page', () => {
    const t = targets();
    const wc = makeContents(1, 'https://yosemitecrew.com/appointments');
    expect(t.remember(wc, 'file:///etc/passwd')).toBe('https://yosemitecrew.com/appointments');
  });

  // The welcome screen shares yc:open-in-browser with the offline page, and
  // there its meaning is "open the app", not "open whatever this window failed
  // to load earlier".
  test('a recovered page does not keep answering for the tab that failed it', () => {
    const t = targets();
    const wc = makeContents(1);
    t.remember(wc, 'https://yosemitecrew.com/patients/42/labs');
    wc.showOfflinePage();
    expect(t.targetFor(wc)).toBe('https://yosemitecrew.com/patients/42/labs');

    t.retry(wc);
    expect(t.targetFor(wc)).toBe(START);
  });

  test('a tab that never failed retries the start URL rather than nothing', () => {
    const t = targets();
    const wc = makeContents(9);
    expect(t.targetFor(wc)).toBe(START);
  });

  test('the latest failure wins and the destroy hook is registered once', () => {
    const t = targets();
    const wc = makeContents(1);
    t.remember(wc, 'https://yosemitecrew.com/first');
    t.remember(wc, 'https://yosemitecrew.com/second');
    wc.showOfflinePage();
    expect(t.targetFor(wc)).toBe('https://yosemitecrew.com/second');
    expect(wc.once).toHaveBeenCalledTimes(1);
  });

  test('a closed tab does not leave its target behind for a reused id', () => {
    const t = targets();
    const wc = makeContents(1);
    t.remember(wc, 'https://yosemitecrew.com/first');
    wc.showOfflinePage();
    wc.destroy();
    expect(t.targetFor(makeContents(1) as RetryContents)).toBe(START);
  });
});
