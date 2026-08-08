'use strict';

import path from 'node:path';

type DesktopPage =
  | 'loading'
  | 'offline'
  | 'welcome'
  | 'settings'
  | 'command-palette'
  | 'tabbar'
  | 'whats-new'
  | 'idle-lock'
  | 'vault';

const runtimeRoot = (): string => path.resolve(__dirname, '..');

export const desktopLocalPage = (page: DesktopPage): string =>
  path.join(runtimeRoot(), 'pages', `${page}.html`);

export const desktopPreloadPath = (): string => path.join(runtimeRoot(), 'preload.js');

export const desktopResourcePath = (asset: string): string =>
  path.join(runtimeRoot(), '..', 'resources', asset);
