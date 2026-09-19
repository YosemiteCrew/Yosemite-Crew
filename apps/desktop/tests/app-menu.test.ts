type Item = {
  label?: string;
  role?: string;
  type?: string;
  accelerator?: string;
  click?: () => void;
  submenu?: Item[];
};

let lastTemplate: Item[] = [];

const quit = jest.fn();
let mockPackaged = false;
jest.mock('electron', () => ({
  app: {
    name: 'Yosemite Crew PIMS',
    getLocale: () => 'en',
    quit: () => quit(),
    get isPackaged() {
      return mockPackaged;
    },
  },
  Menu: {
    buildFromTemplate: (tpl: Item[]) => {
      lastTemplate = tpl;
      return { tpl };
    },
    setApplicationMenu: jest.fn(),
  },
}));

const openExternal = jest.fn<Promise<void>, unknown[]>(() => Promise.resolve());
jest.mock('../src/shell/window-config', () => ({
  openExternal: (...a: unknown[]) => openExternal(...a),
}));

import { createAppMenu, type MenuActions } from '../src/ui/app-menu';
import { t } from '../src/utils/i18n';

const walk = (items: Item[], fn: (i: Item) => void): void => {
  for (const item of items) {
    fn(item);
    if (item.submenu) walk(item.submenu, fn);
  }
};

const collect = (): Item[] => {
  const out: Item[] = [];
  walk(lastTemplate, (i) => out.push(i));
  return out;
};

const clickAll = (): void =>
  walk(lastTemplate, (i) => {
    if (typeof i.click === 'function') i.click();
  });

const makeActions = (overrides: Partial<MenuActions> = {}): MenuActions => {
  const wc = {
    print: jest.fn(),
    getURL: jest.fn(() => 'https://yosemitecrew.com/here'),
    isDestroyed: jest.fn(() => false),
    send: jest.fn(),
    toggleDevTools: jest.fn(),
    navigationHistory: { goBack: jest.fn(), goForward: jest.fn() },
  };
  return {
    checkForUpdates: jest.fn(),
    openCommandPalette: jest.fn(),
    createSettingsWindow: jest.fn(),
    newTab: jest.fn(),
    closeActiveTab: jest.fn(),
    reopenClosedTab: jest.fn(),
    openTabSearch: jest.fn(),
    loadStartUrl: jest.fn(),
    activeContents: jest.fn(() => wc as never),
    setTabOrientation: jest.fn(),
    tabOrientation: () => 'horizontal',
    splitId: () => null,
    setSplitTab: jest.fn(),
    tabMode: () => true,
    attachedTabId: () => 'a',
    tabManager: { getState: () => ({ tabs: [{ id: 'a' }, { id: 'b' }] }) },
    isLocked: () => false,
    verifyAuditTrail: jest.fn(),
    exportCsDailyLog: jest.fn(),
    showDeaStatus: jest.fn(),
    generateDeaReportAction: jest.fn(),
    showPmpStatus: jest.fn(),
    openVaultWindow: jest.fn(),
    showVaultInfo: jest.fn(),
    backUpNow: jest.fn(),
    savePageAsPdf: jest.fn(() => Promise.resolve()),
    openOnSecondScreen: jest.fn(),
    showPrintStatus: jest.fn(),
    startTelehealth: jest.fn(() => 'url'),
    telehealthProviderName: 'Start Telehealth (GetStream)',
    showCheatsheet: jest.fn(),
    exportDiagnostics: jest.fn(),
    mainWindow: {} as never,
    helpLinks: [{ label: 'Docs', url: 'https://docs.example.com' }],
    productName: 'Yosemite Crew PIMS',
    startUrl: 'https://yosemitecrew.com/signin',
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    ...overrides,
  };
};

describe('createAppMenu', () => {
  const original = process.platform;
  afterAll(() => Object.defineProperty(process, 'platform', { value: original }));
  afterEach(() => {
    mockPackaged = false;
  });

  const run = (platform: string, overrides: Partial<MenuActions> = {}) => {
    Object.defineProperty(process, 'platform', { value: platform });
    const actions = makeActions(overrides);
    createAppMenu(actions);
    return actions;
  };

  test('builds the menu and wires every click handler (macOS)', () => {
    const actions = run('darwin');
    expect(lastTemplate.length).toBeGreaterThan(0);
    clickAll();
    expect(actions.newTab).toHaveBeenCalled();
    expect(actions.openCommandPalette).toHaveBeenCalled();
    expect(actions.verifyAuditTrail).toHaveBeenCalled();
    expect(actions.startTelehealth).toHaveBeenCalled();
    expect(actions.exportDiagnostics).toHaveBeenCalledWith(actions.mainWindow);
    expect(openExternal).toHaveBeenCalledWith('https://docs.example.com');
    expect(actions.checkForUpdates).toHaveBeenCalled();
    expect(actions.showCheatsheet).toHaveBeenCalled();
  });

  test('builds the Windows/Linux variant and wires its clicks', () => {
    const actions = run('win32');
    clickAll();
    expect(actions.createSettingsWindow).toHaveBeenCalled();
    expect(actions.loadStartUrl).toHaveBeenCalled();
    // Open-in-browser uses the active tab URL.
    expect(openExternal).toHaveBeenCalledWith('https://yosemitecrew.com/here');
  });

  test('split-view toggles on when no split, and the close branch when active', () => {
    const withSplit = run('darwin', { splitId: () => 'b' });
    clickAll();
    expect(withSplit.setSplitTab).toHaveBeenCalledWith(null);

    const noSplit = run('darwin', { splitId: () => null });
    clickAll();
    expect(noSplit.setSplitTab).toHaveBeenCalledWith('b');
  });

  test('while the idle lock is up only Quit acts; the rest resume on unlock', () => {
    let locked = true;
    const actions = run('darwin', { isLocked: () => locked });
    const fns = Object.values(actions).filter((v): v is jest.Mock => jest.isMockFunction(v));

    clickAll();
    for (const fn of fns) expect(fn).not.toHaveBeenCalled();
    expect(openExternal).not.toHaveBeenCalled();
    expect(quit).toHaveBeenCalledTimes(1);

    // Read at click time: the same menu works again once unlocked.
    locked = false;
    clickAll();
    expect(actions.newTab).toHaveBeenCalled();
    expect(actions.activeContents).toHaveBeenCalled();
    expect(openExternal).toHaveBeenCalled();
  });

  test('the Windows/Linux menu is held the same way', () => {
    const actions = run('win32', { isLocked: () => true });
    clickAll();
    expect(actions.createSettingsWindow).not.toHaveBeenCalled();
    expect(actions.openCommandPalette).not.toHaveBeenCalled();
    expect(actions.activeContents).not.toHaveBeenCalled();
  });

  test('open-in-browser falls back to startUrl when no active contents', () => {
    run('darwin', { activeContents: jest.fn(() => null) });
    clickAll();
    expect(openExternal).toHaveBeenCalledWith('https://yosemitecrew.com/signin');
  });

  test('the macOS Quit item carries Cmd+Q and still quits', () => {
    run('darwin');
    const item = collect().find((i) => i.label === t('menu.quit', 'en'));
    expect(item).toBeDefined();
    expect(item?.accelerator).toBe('Cmd+Q');

    quit.mockClear();
    item?.click?.();
    expect(quit).toHaveBeenCalledTimes(1);
  });

  test('Cmd+Q reaches the item the idle lock exempts', () => {
    run('darwin', { isLocked: () => true });
    const item = collect().find((i) => i.accelerator === 'Cmd+Q');
    expect(item?.label).toBe(t('menu.quit', 'en'));

    quit.mockClear();
    item?.click?.();
    expect(quit).toHaveBeenCalledTimes(1);
  });

  const DEVTOOLS_KEYS = ['Alt+Cmd+I', 'Ctrl+Shift+I'];
  const devtoolsItems = () =>
    collect().filter(
      (i) =>
        /developer tools/i.test(i.label ?? '') ||
        DEVTOOLS_KEYS.includes(i.accelerator ?? '') ||
        /devtools/i.test(i.role ?? '')
    );

  test.each(['darwin', 'win32'])('a development build has Toggle Developer Tools (%s)', (os) => {
    const actions = run(os);
    const [item, ...more] = devtoolsItems();
    expect(more).toEqual([]);
    expect(item?.accelerator).toBe(os === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I');
    item?.click?.();
    expect(
      (actions.activeContents() as unknown as { toggleDevTools: jest.Mock }).toggleDevTools
    ).toHaveBeenCalledTimes(1);
  });

  test.each(['darwin', 'win32'])('a packaged build has no DevTools item or shortcut (%s)', (os) => {
    mockPackaged = true;
    run(os);
    expect(devtoolsItems()).toEqual([]);
    // The rest of the View menu is still there.
    expect(collect().some((i) => i.label === 'Toggle Vertical Tabs')).toBe(true);
  });

  test('Cmd+Q is declared once on macOS and never on Windows/Linux', () => {
    run('darwin');
    const mac = collect().filter((i) => i.accelerator === 'Cmd+Q');
    expect(mac).toHaveLength(1);

    run('win32');
    const other = collect();
    // Windows/Linux quit through `role: 'quit'`, which carries its own key.
    expect(other.filter((i) => i.accelerator === 'Cmd+Q')).toHaveLength(0);
    expect(other.some((i) => i.role === 'quit')).toBe(true);
  });
});
