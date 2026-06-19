type Item = {
  label?: string;
  role?: string;
  type?: string;
  click?: () => void;
  submenu?: Item[];
};

let lastTemplate: Item[] = [];

jest.mock('electron', () => ({
  app: { name: 'Yosemite Crew PIMS', getLocale: () => 'en', quit: jest.fn() },
  Menu: {
    buildFromTemplate: (tpl: Item[]) => {
      lastTemplate = tpl;
      return { tpl };
    },
    setApplicationMenu: jest.fn(),
  },
}));

const openExternal = jest.fn(() => Promise.resolve());
jest.mock('../src/shell/window-config', () => ({
  openExternal: (...a: unknown[]) => openExternal(...a),
}));

import { createAppMenu, type MenuActions } from '../src/ui/app-menu';

const walk = (items: Item[], fn: (i: Item) => void): void => {
  for (const item of items) {
    fn(item);
    if (item.submenu) walk(item.submenu, fn);
  }
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

  test('open-in-browser falls back to startUrl when no active contents', () => {
    run('darwin', { activeContents: jest.fn(() => null) });
    clickAll();
    expect(openExternal).toHaveBeenCalledWith('https://yosemitecrew.com/signin');
  });
});
