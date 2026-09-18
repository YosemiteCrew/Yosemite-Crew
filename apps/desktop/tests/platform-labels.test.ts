// The page helper is a plain browser script: the local pages load it over
// file:// under a strict CSP, and the sandboxed preload cannot share a compiled
// module with them either. It also assigns `module.exports`, so it imports here
// - untyped, hence the surface restated below for the type checker.
import untypedLabels from '../src/pages/platform-labels.js';

const labels: {
  shortcut: (accelerator: string, platform: string, style?: string) => string;
  revealLabel: (platform: string) => string;
  detectPlatform: (bridge: unknown, userAgent: string) => string;
} = untypedLabels;

const MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Electron/44 Safari/537.36';
const WINDOWS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Electron/44 Safari/537.36';
const LINUX_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Electron/44 Safari/537.36';

describe('shortcut', () => {
  describe('macOS renders the key glyphs', () => {
    test.each([
      ['Mod+T', '⌘T'],
      ['Mod+W', '⌘W'],
      ['Mod+Shift+T', '⌘⇧T'],
      ['Mod+Shift+Y', '⌘⇧Y'],
      ['Mod+1-9', '⌘1-9'],
      ['Mod+Shift+\\', '⌘⇧\\'],
      ['Mod+,', '⌘,'],
      ['Mod+/', '⌘/'],
      ['Mod+Alt+I', '⌘⌥I'],
    ])('%s renders as %s', (accelerator, expected) => {
      expect(labels.shortcut(accelerator, 'darwin', 'symbol')).toBe(expected);
    });
  });

  describe('Windows and Linux render key names', () => {
    test.each([
      ['win32', 'Mod+T', 'Ctrl+T'],
      ['win32', 'Mod+Shift+Y', 'Ctrl+Shift+Y'],
      ['win32', 'Mod+1-9', 'Ctrl+1-9'],
      ['win32', 'Mod+Alt+I', 'Ctrl+Alt+I'],
      ['linux', 'Mod+T', 'Ctrl+T'],
      ['linux', 'Mod+Shift+\\', 'Ctrl+Shift+\\'],
      ['linux', 'Mod+/', 'Ctrl+/'],
    ])('on %s, %s renders as %s', (platform, accelerator, expected) => {
      expect(labels.shortcut(accelerator, platform, 'symbol')).toBe(expected);
    });
  });

  test('never emits a Command glyph off macOS', () => {
    const rendered = ['Mod+T', 'Mod+Shift+Y', 'Mod+Alt+I']
      .flatMap((accelerator) => [
        labels.shortcut(accelerator, 'win32', 'symbol'),
        labels.shortcut(accelerator, 'win32', 'name'),
        labels.shortcut(accelerator, 'linux', 'symbol'),
        labels.shortcut(accelerator, 'linux', 'name'),
      ])
      .join(' ');
    // The control: the same accelerators on macOS do carry the glyphs, so an
    // empty render would not pass this pair.
    expect(labels.shortcut('Mod+Shift+Y', 'darwin', 'symbol')).toMatch(/[⌘⇧]/);
    expect(rendered).not.toMatch(/[⌘⇧⌥]/);
  });

  describe("the 'name' style spells the modifiers out", () => {
    test.each([
      ['darwin', 'Mod+T', 'Cmd+T'],
      ['darwin', 'Mod+Shift+Y', 'Cmd+Shift+Y'],
      ['darwin', 'Mod+Alt+I', 'Cmd+Option+I'],
      ['win32', 'Mod+T', 'Ctrl+T'],
      ['win32', 'Mod+Shift+Y', 'Ctrl+Shift+Y'],
      ['linux', 'Mod+Alt+I', 'Ctrl+Alt+I'],
    ])('on %s, %s renders as %s', (platform, accelerator, expected) => {
      expect(labels.shortcut(accelerator, platform, 'name')).toBe(expected);
    });
  });

  test('the style only changes the macOS rendering', () => {
    expect(labels.shortcut('Mod+Shift+Y', 'darwin', 'symbol')).not.toBe(
      labels.shortcut('Mod+Shift+Y', 'darwin', 'name')
    );
    expect(labels.shortcut('Mod+Shift+Y', 'win32', 'symbol')).toBe(
      labels.shortcut('Mod+Shift+Y', 'win32', 'name')
    );
  });

  test('defaults to the glyph style on macOS when none is given', () => {
    expect(labels.shortcut('Mod+T', 'darwin')).toBe('⌘T');
  });

  test('leaves an accelerator with no modifier alone', () => {
    expect(labels.shortcut('F5', 'darwin', 'symbol')).toBe('F5');
    expect(labels.shortcut('F5', 'win32', 'symbol')).toBe('F5');
  });
});

describe('revealLabel', () => {
  test.each([
    ['darwin', 'Reveal in Finder'],
    ['win32', 'Show in Explorer'],
    ['linux', 'Show in folder'],
    ['freebsd', 'Show in folder'],
  ])('on %s the button reads "%s"', (platform, expected) => {
    expect(labels.revealLabel(platform)).toBe(expected);
  });

  test('only macOS is told about Finder', () => {
    expect(labels.revealLabel('win32')).not.toMatch(/Finder/);
    expect(labels.revealLabel('linux')).not.toMatch(/Finder/);
  });
});

describe('detectPlatform', () => {
  test('prefers the value the preload reports', () => {
    // The macOS user agent is the one Electron sends; the bridge value has to
    // win over it, which is the whole point of adding it.
    expect(labels.detectPlatform({ platform: 'win32' }, MAC_UA)).toBe('win32');
    expect(labels.detectPlatform({ platform: 'linux' }, MAC_UA)).toBe('linux');
  });

  test.each([
    [MAC_UA, 'darwin'],
    [WINDOWS_UA, 'win32'],
    [LINUX_UA, 'linux'],
  ])('falls back to the user agent when the bridge is absent', (userAgent, expected) => {
    expect(labels.detectPlatform(undefined, userAgent)).toBe(expected);
  });

  test.each([
    ['a bridge without a platform', {}],
    ['an empty platform', { platform: '' }],
    ['a non-string platform', { platform: 42 }],
    ['no bridge', null],
  ])('falls back to the user agent given %s', (_label, bridge) => {
    expect(labels.detectPlatform(bridge, WINDOWS_UA)).toBe('win32');
  });

  test('answers with a platform even with nothing to go on', () => {
    expect(labels.detectPlatform(undefined, '')).toBe('linux');
  });
});
