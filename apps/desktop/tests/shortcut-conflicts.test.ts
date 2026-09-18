type Item = {
  label?: string;
  role?: string;
  accelerator?: string;
  submenu?: Item[];
};

jest.mock('electron', () => ({
  app: { name: 'Yosemite Crew PIMS', getLocale: () => 'en', quit: jest.fn() },
  Menu: { buildFromTemplate: jest.fn(), setApplicationMenu: jest.fn() },
}));

jest.mock('../src/shell/window-config', () => ({
  openExternal: jest.fn(() => Promise.resolve()),
}));

import { buildMenuTemplate, type MenuActions } from '../src/ui/app-menu';
import { SHORTCUTS } from '../src/ui/keyboard-shortcuts';
import { WINDOW_SHORTCUTS } from '../src/ui/window-shortcuts';

// Roles carry an accelerator Electron supplies, which never appears in the
// template. A shortcut that lands on one is shadowed just the same, so they are
// part of the set the app has to stay clear of.
const ROLE_ACCELERATORS: Record<string, string | { darwin: string; other?: string }> = {
  undo: 'CmdOrCtrl+Z',
  redo: { darwin: 'Shift+Cmd+Z', other: 'Ctrl+Y' },
  cut: 'CmdOrCtrl+X',
  copy: 'CmdOrCtrl+C',
  paste: 'CmdOrCtrl+V',
  selectAll: 'CmdOrCtrl+A',
  reload: 'CmdOrCtrl+R',
  forceReload: 'Shift+CmdOrCtrl+R',
  resetZoom: 'CmdOrCtrl+0',
  zoomIn: 'CmdOrCtrl+Plus',
  zoomOut: 'CmdOrCtrl+-',
  togglefullscreen: { darwin: 'Ctrl+Cmd+F', other: 'F11' },
  minimize: 'CmdOrCtrl+M',
  close: 'CmdOrCtrl+W',
  quit: 'CmdOrCtrl+Q',
  hide: { darwin: 'Cmd+H' },
  hideOthers: { darwin: 'Cmd+Alt+H' },
};

const MODIFIERS: Record<string, string> = {
  cmdorctrl: 'mod',
  commandorcontrol: 'mod',
  cmd: 'cmd',
  command: 'cmd',
  meta: 'cmd',
  super: 'cmd',
  ctrl: 'ctrl',
  control: 'ctrl',
  alt: 'alt',
  option: 'alt',
  altgr: 'altgr',
  shift: 'shift',
};

// CmdOrCtrl and Cmd are the same key on macOS and different keys elsewhere, and
// the modifiers may be written in any order, so compare the resolved set.
const normalize = (accelerator: string, platform: string): string => {
  const parts = accelerator.split('+');
  const key = (parts.pop() as string).toLowerCase();
  const mods = parts.map((part) => {
    const mod = MODIFIERS[part.toLowerCase()] ?? part.toLowerCase();
    if (mod !== 'mod') return mod;
    return platform === 'darwin' ? 'cmd' : 'ctrl';
  });
  return `${[...new Set(mods)].sort().join('+')}|${key}`;
};

const roleAccelerator = (role: string, platform: string): string | null => {
  const entry = ROLE_ACCELERATORS[role];
  if (!entry) return null;
  if (typeof entry === 'string') return entry;
  return platform === 'darwin' ? entry.darwin : (entry.other ?? null);
};

const menuAccelerators = (platform: string): Map<string, string> => {
  Object.defineProperty(process, 'platform', { value: platform });
  const found = new Map<string, string>();
  const duplicates: string[] = [];

  const walk = (items: Item[]): void => {
    for (const item of items) {
      const accelerator =
        item.accelerator ?? (item.role ? roleAccelerator(item.role, platform) : null);
      if (accelerator) {
        const key = normalize(accelerator, platform);
        const label = item.label ?? item.role ?? '(unnamed)';
        if (found.has(key)) duplicates.push(`${accelerator}: ${found.get(key)} / ${label}`);
        else found.set(key, label);
      }
      if (item.submenu) walk(item.submenu);
    }
  };

  walk(buildMenuTemplate(makeActions()) as Item[]);
  expect(duplicates).toEqual([]);
  return found;
};

const makeActions = (): MenuActions =>
  new Proxy({} as MenuActions, {
    get: (_target, prop) => {
      if (prop === 'telehealthProviderName') return 'Telehealth';
      if (prop === 'productName') return 'Yosemite Crew PIMS';
      if (prop === 'startUrl') return 'https://yosemitecrew.com/signin';
      if (prop === 'helpLinks') return [];
      if (prop === 'mainWindow' || prop === 'tabManager') return null;
      return jest.fn();
    },
  });

describe('no app shortcut is shadowed by a menu item', () => {
  const original = process.platform;
  afterAll(() => Object.defineProperty(process, 'platform', { value: original }));

  test.each(['darwin', 'win32'])('%s: global shortcuts are clear of the menu', (platform) => {
    const menu = menuAccelerators(platform);
    const clashes = SHORTCUTS.filter((s) => menu.has(normalize(s.accelerator, platform))).map(
      (s) => `${s.accelerator} (${s.label}) is also ${menu.get(normalize(s.accelerator, platform))}`
    );

    expect(clashes).toEqual([]);
  });

  test.each(['darwin', 'win32'])('%s: window shortcuts are clear of the menu', (platform) => {
    const menu = menuAccelerators(platform);
    const clashes = WINDOW_SHORTCUTS.filter((a) => menu.has(normalize(a, platform)));

    expect(clashes).toEqual([]);
  });

  test.each(['darwin', 'win32'])('%s: no two global shortcuts share a key', (platform) => {
    const seen = new Set<string>();
    const clashes = SHORTCUTS.filter((s) => {
      const key = normalize(s.accelerator, platform);
      if (seen.has(key)) return true;
      seen.add(key);
      return false;
    }).map((s) => s.accelerator);

    expect(clashes).toEqual([]);
  });

  test('the menu owns the keys the shortcut list promises for it', () => {
    const menu = menuAccelerators('darwin');
    for (const accelerator of [
      'CmdOrCtrl+Shift+T',
      'CmdOrCtrl+Shift+E',
      'CmdOrCtrl+Shift+B',
      'CmdOrCtrl+P',
      'CmdOrCtrl+/',
    ]) {
      expect(menu.has(normalize(accelerator, 'darwin'))).toBe(true);
    }
  });

  test('normalize resolves the platform modifier and the written order', () => {
    expect(normalize('CmdOrCtrl+Shift+T', 'darwin')).toBe(normalize('Shift+Cmd+T', 'darwin'));
    expect(normalize('CmdOrCtrl+Shift+T', 'win32')).toBe(normalize('Shift+Ctrl+T', 'win32'));
    expect(normalize('CmdOrCtrl+T', 'darwin')).not.toBe(normalize('Ctrl+T', 'darwin'));
  });
});
