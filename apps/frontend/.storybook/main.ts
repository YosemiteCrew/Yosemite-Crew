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
  // No `docs.autodocs`: it was removed in Storybook 9 (this repo is on 10.5.7),
  // so it was inert config that also failed type-check as soon as a test
  // imported this file. Autodocs come from the `autodocs` tag on a story.
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
  viteFinal: (viteConfig) => {
    viteConfig.resolve = viteConfig.resolve ?? {};
    // Vite accepts either form, and the framework hands us the OBJECT one: it
    // arrives holding styled-jsx's preset aliases. Treating a non-array as
    // empty would silently drop those while fixing the `@/` paths, so both
    // forms are normalised to entries before appending.
    const existing = viteConfig.resolve.alias;
    const inherited = Array.isArray(existing)
      ? existing
      : Object.entries(existing ?? {}).map(([find, replacement]) => ({
          find,
          replacement: replacement as string,
        }));

    viteConfig.resolve.alias = [
      ...inherited,
      { find: /^@\/features\//, replacement: `${path.join(src, 'app/features')}/` },
      { find: /^@\/ui\//, replacement: `${path.join(src, 'app/ui')}/` },
      { find: /^@\/lib\//, replacement: `${path.join(src, 'app/lib')}/` },
      { find: /^@\/constants\//, replacement: `${path.join(src, 'app/constants')}/` },
      { find: /^@\//, replacement: `${src}/` },
    ];

    /**
     * Pin the Documenso origin at BUILD time, not from a story.
     *
     * `getSafeDocumensoIframeUrl` compares against
     * `process.env.NEXT_PUBLIC_DOCUMENSO_HOST`, and Next inlines every
     * `NEXT_PUBLIC_*` when it builds. A story that assigns to `process.env` at
     * runtime therefore works against `storybook dev` - whose shim is writable -
     * and silently does nothing in `storybook build`, which is what Chromatic
     * publishes: the guard falls back to the real host, rejects the fixture URL
     * and the iframe never mounts, while Storybook still reports the story as
     * finished.
     *
     * A reserved `.invalid` TLD never resolves, so the frame lays out its box
     * without a request leaving for the production portal.
     */
    viteConfig.define = {
      ...(viteConfig.define ?? {}),
      'process.env.NEXT_PUBLIC_DOCUMENSO_HOST': JSON.stringify(
        'https://documenso.storybook.invalid'
      ),
    };
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
