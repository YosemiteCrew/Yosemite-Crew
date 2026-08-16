import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { StorybookConfig } from '@storybook/nextjs-vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '../src');

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/nextjs-vite',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  /**
   * Mirror the tsconfig `paths` for the production build.
   *
   * The dev server resolves `@/...` fine, so this looked healthy locally, but
   * `storybook:build` failed with `Rollup failed to resolve import
   * "@/app/ui/primitives/Buttons"` - which meant Chromatic could never publish.
   * The check had been skipping on a missing `CHROMATIC_CONFIGURED`, so nothing
   * surfaced the breakage until the gate was switched on.
   *
   * Order matters: the more specific aliases must precede the bare `@/`, or it
   * swallows them. They are kept byte-for-byte in step with tsconfig.json.
   */
  viteFinal: async (viteConfig) => {
    viteConfig.resolve = viteConfig.resolve ?? {};
    viteConfig.resolve.alias = [
      ...(Array.isArray(viteConfig.resolve.alias) ? viteConfig.resolve.alias : []),
      { find: /^@\/features\//, replacement: `${path.join(src, 'app/features')}/` },
      { find: /^@\/ui\//, replacement: `${path.join(src, 'app/ui')}/` },
      { find: /^@\/lib\//, replacement: `${path.join(src, 'app/lib')}/` },
      { find: /^@\/constants\//, replacement: `${path.join(src, 'app/constants')}/` },
      { find: /^@\//, replacement: `${src}/` },
    ];
    return viteConfig;
  },
  staticDirs: [
    { from: '../public/fonts', to: '/fonts' },
    { from: '../public/images', to: '/images' },
    { from: '../public/static', to: '/static' },
    { from: '../public/apple-touch-icon.png', to: '/apple-touch-icon.png' },
    { from: '../public/favicon-16x16.png', to: '/favicon-16x16.png' },
    { from: '../public/favicon-32x32.png', to: '/favicon-32x32.png' },
    { from: '../public/favicon.ico', to: '/favicon.ico' },
    { from: '../public/file.svg', to: '/file.svg' },
    { from: '../public/globe.svg', to: '/globe.svg' },
    { from: '../public/icon.svg', to: '/icon.svg' },
    { from: '../public/next.svg', to: '/next.svg' },
    { from: '../public/site.webmanifest', to: '/site.webmanifest' },
    { from: '../public/vercel.svg', to: '/vercel.svg' },
    { from: '../public/web-app-manifest-192x192.png', to: '/web-app-manifest-192x192.png' },
    { from: '../public/web-app-manifest-512x512.png', to: '/web-app-manifest-512x512.png' },
    { from: '../public/window.svg', to: '/window.svg' },
  ],
};

export default config;
