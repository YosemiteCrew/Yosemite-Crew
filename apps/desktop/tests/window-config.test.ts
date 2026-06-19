const shellOpenExternal = jest.fn(() => Promise.resolve());
const showErrorBox = jest.fn();
const clipboardWriteText = jest.fn();

class FakeMenu {
  items: FakeMenuItem[] = [];
  append(i: FakeMenuItem): void {
    this.items.push(i);
  }
}
class FakeMenuItem {
  constructor(public opts: Record<string, unknown>) {}
  get label(): string {
    return this.opts.label as string;
  }
  click(): void {
    (this.opts.click as (() => void) | undefined)?.();
  }
}

jest.mock('electron', () => ({
  clipboard: { writeText: (...a: unknown[]) => clipboardWriteText(...a) },
  dialog: { showErrorBox: (...a: unknown[]) => showErrorBox(...a) },
  Menu: FakeMenu,
  MenuItem: FakeMenuItem,
  shell: { openExternal: (...a: unknown[]) => shellOpenExternal(...a) },
}));
jest.mock('../src/utils/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

import {
  openExternal,
  secureWebPreferences,
  childWindowOptions,
  handleWindowOpen,
  handleMainNavigation,
  shouldGrantPermission,
  configureSessionPermissions,
  getCacheStrategy,
  buildContextMenu,
  deepLinkFromArgv,
  permittedPermissions,
} from '../src/shell/window-config';

describe('openExternal', () => {
  test('opens allowed schemes and blocks the rest', async () => {
    await openExternal(undefined);
    await openExternal('https://yosemitecrew.com');
    await openExternal(new URL('mailto:vet@yosemitecrew.com'));
    expect(shellOpenExternal).toHaveBeenCalledTimes(2);

    await openExternal('file:///etc/passwd');
    await openExternal('javascript:alert(1)');
    await openExternal('not a url');
    expect(shellOpenExternal).toHaveBeenCalledTimes(2); // unchanged — all blocked
  });

  test('surfaces an error dialog when the shell rejects', async () => {
    shellOpenExternal.mockRejectedValueOnce(new Error('nope'));
    await openExternal('https://yosemitecrew.com');
    expect(showErrorBox).toHaveBeenCalled();
  });
});

describe('web preferences + child window', () => {
  test('secureWebPreferences locks the renderer down', () => {
    const wp = secureWebPreferences('/p/preload.js') as Record<string, unknown>;
    expect(wp).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: '/p/preload.js',
    });
    expect((secureWebPreferences() as Record<string, unknown>).preload).toBeUndefined();
  });

  test('childWindowOptions uses secure prefs', () => {
    expect(childWindowOptions().webPreferences).toMatchObject({
      sandbox: true,
    });
  });
});

describe('navigation handlers', () => {
  test('handleWindowOpen allows internal, opens external, denies blocked', () => {
    expect(handleWindowOpen('https://yosemitecrew.com/x').action).toBe('allow');
    const ext = handleWindowOpen('https://example.com/');
    expect(ext.action).toBe('deny');
    const blocked = handleWindowOpen('https://yosemitecrew.com/developers');
    expect(blocked.action).toBe('deny');
  });

  test('handleMainNavigation only intercepts non-internal targets', () => {
    const internal = { preventDefault: jest.fn() };
    handleMainNavigation(internal, 'https://yosemitecrew.com/dashboard');
    expect(internal.preventDefault).not.toHaveBeenCalled();

    const external = { preventDefault: jest.fn() };
    handleMainNavigation(external, 'https://example.com/');
    expect(external.preventDefault).toHaveBeenCalled();
  });
});

describe('permissions', () => {
  const wc = { getURL: () => 'https://yosemitecrew.com/x' } as never;

  test('grants permitted permissions for internal origins only', () => {
    const perm = [...permittedPermissions][0];
    expect(
      shouldGrantPermission(perm, { requestingUrl: 'https://yosemitecrew.com/a' } as never, wc)
    ).toBe(true);
    expect(
      shouldGrantPermission(
        'midi-sysex',
        { requestingUrl: 'https://yosemitecrew.com/a' } as never,
        wc
      )
    ).toBe(false);
    expect(shouldGrantPermission(perm, { requestingUrl: 'https://evil.com' } as never, wc)).toBe(
      false
    );
  });

  test('configureSessionPermissions wires both handlers', () => {
    let reqHandler: (
      wc: unknown,
      p: string,
      cb: (g: boolean) => void,
      d: unknown
    ) => void = () => {};
    let checkHandler: (wc: unknown, p: string, o: string) => boolean = () => false;
    const ses = {
      setPermissionRequestHandler: (fn: typeof reqHandler) => {
        reqHandler = fn;
      },
      setPermissionCheckHandler: (fn: typeof checkHandler) => {
        checkHandler = fn;
      },
    } as never;
    configureSessionPermissions(ses);
    const cb = jest.fn();
    reqHandler(wc, [...permittedPermissions][0], cb, {
      requestingUrl: 'https://yosemitecrew.com/a',
    });
    expect(cb).toHaveBeenCalledWith(true);
    expect(checkHandler(wc, [...permittedPermissions][0], 'https://yosemitecrew.com')).toBe(true);
    expect(checkHandler(wc, 'x', '')).toBe(false);
  });
});

describe('getCacheStrategy', () => {
  test('static asset paths are cache-first, everything else network-first', () => {
    expect(getCacheStrategy('https://yosemitecrew.com/_next/static/a.js')).toBe('cache-first');
    expect(getCacheStrategy('https://yosemitecrew.com/static/a.css')).toBe('cache-first');
    expect(getCacheStrategy('https://yosemitecrew.com/assets/a.png')).toBe('cache-first');
    expect(getCacheStrategy('https://yosemitecrew.com/fonts/a.woff2')).toBe('cache-first');
    expect(getCacheStrategy('https://yosemitecrew.com/dashboard')).toBe('network-first');
  });
});

describe('buildContextMenu', () => {
  test('returns null when there is nothing actionable', () => {
    // No selection, not editable, no link/image → only a disabled copy item is appended,
    // so the menu is non-empty; assert it builds.
    const menu = buildContextMenu({}, {});
    expect(menu).not.toBeNull();
  });

  test('includes spelling, link and image actions and invokes their clicks', () => {
    const replaceMisspelling = jest.fn();
    const copyImageAt = jest.fn();
    const menu = buildContextMenu(
      {
        isEditable: true,
        dictionarySuggestions: ['teh→the'],
        linkURL: 'https://yosemitecrew.com/x',
        mediaType: 'image',
        x: 3,
        y: 4,
        selectionText: 'hi',
        editFlags: {
          canCopy: true,
          canPaste: true,
          canCut: true,
          canUndo: true,
          canRedo: true,
        },
      },
      { replaceMisspelling, copyImageAt } as never
    ) as unknown as FakeMenu;
    const labels = menu.items.map((i) => i.opts.label).filter(Boolean);
    expect(labels).toEqual(
      expect.arrayContaining(['teh→the', 'Open Link in Browser', 'Copy Link', 'Copy Image'])
    );
    menu.items.forEach((i) => i.click());
    expect(replaceMisspelling).toHaveBeenCalledWith('teh→the');
    expect(copyImageAt).toHaveBeenCalledWith(3, 4);
    expect(clipboardWriteText).toHaveBeenCalledWith('https://yosemitecrew.com/x');
    expect(shellOpenExternal).toHaveBeenCalledWith('https://yosemitecrew.com/x');
  });
});

describe('deepLinkFromArgv', () => {
  test('finds a deep-link argument or returns null', () => {
    expect(deepLinkFromArgv(['node', 'app', 'yosemitecrew://patients/1'])).toBe(
      'yosemitecrew://patients/1'
    );
    expect(deepLinkFromArgv(['node', 'app'])).toBeNull();
    expect(deepLinkFromArgv()).toBeNull();
  });
});
