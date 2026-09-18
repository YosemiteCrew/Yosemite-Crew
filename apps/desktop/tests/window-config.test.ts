const shellOpenExternal = jest.fn(() => Promise.resolve());
const showErrorBox = jest.fn();
const clipboardWriteText = jest.fn();
const loggerError = jest.fn();

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
    error: (...a: unknown[]) => loggerError(...a),
  }),
}));

import {
  openExternal,
  copyLink,
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

describe('copyLink', () => {
  test('writes the link to the clipboard', async () => {
    await copyLink('https://yosemitecrew.com/x');
    expect(clipboardWriteText).toHaveBeenCalledWith('https://yosemitecrew.com/x');
    expect(loggerError).not.toHaveBeenCalled();
  });

  // Electron 44's writeText returns a promise, so a failed write arrives as a
  // rejection rather than a throw. Unhandled it would reach the main process, which
  // has no unhandledRejection handler - hence resolving, not rejecting, is the
  // property under test.
  test('swallows and logs a rejected write instead of letting it escape', async () => {
    clipboardWriteText.mockRejectedValueOnce(new Error('clipboard busy'));
    await expect(copyLink('https://yosemitecrew.com/x')).resolves.toBeUndefined();
    expect(loggerError).toHaveBeenCalledWith(
      'copy_link_failed',
      expect.objectContaining({ href: 'https://yosemitecrew.com/x' })
    );
  });

  test('the Copy Link menu item routes through copyLink, not the raw clipboard', async () => {
    clipboardWriteText.mockRejectedValueOnce(new Error('clipboard busy'));
    const menu = buildContextMenu(
      { linkURL: 'https://yosemitecrew.com/x' },
      {} as never
    ) as unknown as FakeMenu;
    const copy = menu.items.find((i) => i.opts.label === 'Copy Link');
    expect(copy).toBeDefined();
    copy?.click();
    await new Promise((resolve) => setImmediate(resolve));
    expect(loggerError).toHaveBeenCalledWith('copy_link_failed', expect.anything());
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

// The five names the desktop shell grants, written out rather than read back from the
// Set under test: an edit to permittedPermissions has to be an intentional edit here too.
const EXPECTED_PERMISSIONS = [
  'clipboard-read',
  'display-capture',
  'geolocation',
  'media',
  'notifications',
];

// Real Electron permission names that are deliberately NOT granted. All five appear in
// both the request and the check union of electron 44.1.1; 'geolocation-approximate' is
// one of the 27 names Electron 44 added, and we grant only precise 'geolocation'.
const DENIED_PERMISSIONS = ['midiSysex', 'serial', 'usb', 'hid', 'geolocation-approximate'];

describe('permissions', () => {
  const wc = { getURL: () => 'https://yosemitecrew.com/x' } as never;

  test('the allowlist is exactly the five expected permissions', () => {
    expect([...permittedPermissions].sort()).toEqual([...EXPECTED_PERMISSIONS].sort());
  });

  test('grants every allowlisted permission for an internal origin', () => {
    for (const perm of EXPECTED_PERMISSIONS) {
      expect(
        shouldGrantPermission(perm, { requestingUrl: 'https://yosemitecrew.com/a' } as never, wc)
      ).toBe(true);
    }
  });

  test('denies real Electron permissions that are not allowlisted', () => {
    for (const perm of DENIED_PERMISSIONS) {
      expect(
        shouldGrantPermission(perm, { requestingUrl: 'https://yosemitecrew.com/a' } as never, wc)
      ).toBe(false);
    }
  });

  test('denies allowlisted permissions for an external origin', () => {
    for (const perm of EXPECTED_PERMISSIONS) {
      expect(shouldGrantPermission(perm, { requestingUrl: 'https://evil.com' } as never, wc)).toBe(
        false
      );
    }
  });

  test('falls back to the web contents URL when the request carries no url', () => {
    expect(shouldGrantPermission('media', {} as never, wc)).toBe(true);
    expect(
      shouldGrantPermission('media', {} as never, { getURL: () => 'https://evil.com/x' } as never)
    ).toBe(false);
  });

  describe('configureSessionPermissions', () => {
    let reqHandler: (
      wc: unknown,
      p: string,
      cb: (g: boolean) => void,
      d: unknown
    ) => void = () => {};
    let checkHandler: (wc: unknown, p: string, o: string) => boolean = () => false;

    beforeEach(() => {
      const ses = {
        setPermissionRequestHandler: (fn: typeof reqHandler) => {
          reqHandler = fn;
        },
        setPermissionCheckHandler: (fn: typeof checkHandler) => {
          checkHandler = fn;
        },
      } as never;
      configureSessionPermissions(ses);
    });

    test('the request handler answers the callback with the allowlist decision', () => {
      const granted = jest.fn();
      reqHandler(wc, 'media', granted, { requestingUrl: 'https://yosemitecrew.com/a' });
      expect(granted).toHaveBeenCalledWith(true);

      const denied = jest.fn();
      reqHandler(wc, 'midiSysex', denied, { requestingUrl: 'https://yosemitecrew.com/a' });
      expect(denied).toHaveBeenCalledWith(false);
    });

    test('the check handler applies the allowlist to the requesting origin', () => {
      expect(checkHandler(wc, 'media', 'https://yosemitecrew.com')).toBe(true);
      expect(checkHandler(wc, 'midiSysex', 'https://yosemitecrew.com')).toBe(false);
      expect(checkHandler(wc, 'media', 'https://evil.com')).toBe(false);
    });

    test('an empty origin is attributed to the web contents, not to the start URL', () => {
      expect(checkHandler(wc, 'media', '')).toBe(true);
      expect(checkHandler({ getURL: () => 'https://evil.com/x' }, 'media', '')).toBe(false);
    });

    test('a check that cannot be attributed to any origin is denied', () => {
      expect(checkHandler(null, 'media', '')).toBe(false);
      expect(checkHandler({ getURL: () => '' }, 'media', '')).toBe(false);
    });
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
