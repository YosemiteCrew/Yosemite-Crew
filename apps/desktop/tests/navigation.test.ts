import {
  localPage,
  getIconPath,
  loadStartUrl,
  showOfflinePage,
  focusMainWindow,
  handleDeepLink,
  consumePendingDeepLink,
} from '../src/shell/navigation';
import { getDesktopConfig } from '../src/core/navigation-policy';

const makeLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const config = getDesktopConfig({});

const makeWc = () => ({
  loadURL: jest.fn(() => Promise.resolve()),
  loadFile: jest.fn(() => Promise.resolve()),
});

describe('navigation paths', () => {
  test('localPage and getIconPath return absolute html/asset paths', () => {
    expect(localPage('offline')).toMatch(/pages[\\/]offline\.html$/);
    expect(getIconPath()).toMatch(/resources[\\/]icon\.png$/);
  });
});

describe('loadStartUrl', () => {
  test('navigates the active contents to the start url', () => {
    const wc = makeWc();
    const logger = makeLogger();
    loadStartUrl({
      logger,
      config,
      mainWindow: null,
      tabMode: false,
      activeContents: () => wc as never,
    });
    expect(wc.loadURL).toHaveBeenCalledWith(config.startUrl.href);
    expect(logger.info).toHaveBeenCalledWith('navigation_home', expect.any(Object));
  });

  test('is a no-op when there is no active contents', () => {
    const logger = makeLogger();
    loadStartUrl({
      logger,
      config,
      mainWindow: null,
      tabMode: false,
      activeContents: () => null,
    });
    expect(logger.info).not.toHaveBeenCalled();
  });
});

describe('showOfflinePage', () => {
  test('loads the offline page with the reason query', () => {
    const wc = makeWc();
    const logger = makeLogger();
    showOfflinePage(
      {
        logger,
        config,
        mainWindow: null,
        tabMode: false,
        activeContents: () => wc as never,
      },
      'no-net'
    );
    expect(wc.loadFile).toHaveBeenCalledWith(expect.stringMatching(/offline\.html$/), {
      query: { reason: 'no-net' },
    });
    expect(logger.warn).toHaveBeenCalledWith('offline_page_shown', {
      reason: 'no-net',
    });
  });

  test('normalizes a missing reason to an empty string and no-ops without contents', () => {
    const wc = makeWc();
    showOfflinePage(
      {
        logger: makeLogger(),
        config,
        mainWindow: null,
        tabMode: false,
        activeContents: () => wc as never,
      },
      ''
    );
    expect(wc.loadFile).toHaveBeenCalledWith(expect.any(String), {
      query: { reason: '' },
    });

    const logger = makeLogger();
    showOfflinePage(
      {
        logger,
        config,
        mainWindow: null,
        tabMode: false,
        activeContents: () => null,
      },
      'x'
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe('focusMainWindow', () => {
  test('does nothing for null or destroyed windows', () => {
    expect(() => focusMainWindow(null)).not.toThrow();
    const destroyed = {
      isDestroyed: () => true,
      isMinimized: jest.fn(),
      restore: jest.fn(),
      focus: jest.fn(),
    };
    focusMainWindow(destroyed as never);
    expect(destroyed.focus).not.toHaveBeenCalled();
  });

  test('restores a minimized window and focuses it', () => {
    const mw = {
      isDestroyed: () => false,
      isMinimized: () => true,
      restore: jest.fn(),
      focus: jest.fn(),
    };
    focusMainWindow(mw as never);
    expect(mw.restore).toHaveBeenCalled();
    expect(mw.focus).toHaveBeenCalled();
  });

  test('focuses a non-minimized window without restoring', () => {
    const mw = {
      isDestroyed: () => false,
      isMinimized: () => false,
      restore: jest.fn(),
      focus: jest.fn(),
    };
    focusMainWindow(mw as never);
    expect(mw.restore).not.toHaveBeenCalled();
    expect(mw.focus).toHaveBeenCalled();
  });
});

describe('handleDeepLink', () => {
  const focus = jest.fn();

  test('loads a resolved deep link into the active contents and returns null', () => {
    const wc = makeWc();
    const logger = makeLogger();
    const result = handleDeepLink('yosemitecrew://appointments/1', {
      logger,
      config,
      mainWindow: {} as never,
      activeContents: () => wc as never,
      focusMainWindow: focus,
    });
    expect(wc.loadURL).toHaveBeenCalledWith('https://www.yosemitecrew.com/appointments/1');
    expect(focus).toHaveBeenCalled();
    expect(result).toBeNull();
  });

  test('returns the href when there is no active contents yet', () => {
    const logger = makeLogger();
    const result = handleDeepLink('yosemitecrew://inbox', {
      logger,
      config,
      mainWindow: null,
      activeContents: () => null,
      focusMainWindow: focus,
    });
    expect(result).toBe('https://www.yosemitecrew.com/inbox');
  });

  test('rejects an invalid deep link', () => {
    const logger = makeLogger();
    const result = handleDeepLink('not-a-deep-link', {
      logger,
      config,
      mainWindow: null,
      activeContents: () => null,
      focusMainWindow: focus,
    });
    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith('deep_link_rejected', {
      rawUrl: 'not-a-deep-link',
    });
  });
});

describe('consumePendingDeepLink', () => {
  const deps = (wc: unknown, mw: unknown) => ({
    logger: makeLogger(),
    config,
    mainWindow: mw as never,
    activeContents: () => wc as never,
    focusMainWindow: jest.fn(),
  });

  test('loads a pending link when the window is alive', () => {
    const wc = makeWc();
    consumePendingDeepLink('https://yosemitecrew.com/x', deps(wc, { isDestroyed: () => false }));
    expect(wc.loadURL).toHaveBeenCalledWith('https://yosemitecrew.com/x');
  });

  test('no-ops when nothing pending or window destroyed', () => {
    const wc = makeWc();
    consumePendingDeepLink(null, deps(wc, { isDestroyed: () => false }));
    consumePendingDeepLink('https://x', deps(wc, { isDestroyed: () => true }));
    consumePendingDeepLink('https://x', deps(wc, null));
    expect(wc.loadURL).not.toHaveBeenCalled();
  });
});
