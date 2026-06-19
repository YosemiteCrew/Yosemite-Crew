import path from 'node:path';
import { desktopLocalPage, desktopPreloadPath, desktopResourcePath } from '../src/shell/paths';

const normalize = (value: string): string => value.split(path.sep).join('/');

describe('desktop shell runtime paths', () => {
  test('local pages resolve from the desktop runtime root, not shell/pages', () => {
    const welcomePath = normalize(desktopLocalPage('welcome'));

    expect(welcomePath).toMatch(/\/pages\/welcome\.html$/);
    expect(welcomePath).not.toContain('/shell/pages/');
  });

  test('preload resolves from the desktop runtime root, not shell/preload.js', () => {
    const preloadPath = normalize(desktopPreloadPath());

    expect(preloadPath).toMatch(/\/preload\.js$/);
    expect(preloadPath).not.toContain('/shell/preload.js');
  });

  test('resources resolve outside the compiled source root', () => {
    const iconPath = normalize(desktopResourcePath('icon.png'));

    expect(iconPath).toMatch(/\/resources\/icon\.png$/);
    expect(iconPath).not.toContain('/src/resources/');
    expect(iconPath).not.toContain('/build/resources/');
  });
});
