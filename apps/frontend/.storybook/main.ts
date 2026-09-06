import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { StorybookConfig } from '@storybook/nextjs-vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '../src');

/**
 * `favicon` is implemented by Storybook but not published in its types.
 *
 * `core-server/presets/common-preset` defines a `favicon` preset that returns
 * an explicit value when given one. There is no type for it in 10.6.0:
 * `favicon` appears zero times across storybook's `.d.ts` files, while
 * `staticDirs` appears five times in the same file - so the search is not
 * silently broken, the field is genuinely untyped.
 *
 * `StorybookConfig` is a type alias (`Omit<...> & ...`), not an interface, so
 * declaration merging is unavailable. Adding the single field here keeps the
 * rest of the config fully checked rather than casting the object.
 */
type StorybookConfigWithFavicon = StorybookConfig & { favicon?: string };

const config: StorybookConfigWithFavicon = {
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
  /**
   * Deliberately empty, and the favicon set explicitly below.
   *
   * These sixteen entries used to copy `../public/{fonts,images,static,...}`
   * into the build. Every one of them was redundant: Vite's `publicDir`
   * defaults to `<root>/public`, `root` is `apps/frontend` (builder-vite sets
   * it to `resolve(configDir, '..')`), and nothing sets `publicDir` or
   * `copyPublicDir`. So Vite already copies the whole tree - including
   * `public/captions`, which `staticDirs` never listed and which appeared in
   * the output regardless.
   *
   * The redundancy was not harmless. Storybook's staticDirs copy and the Vite
   * preview build run in the SAME `Promise.all` in core-server, and Vite's
   * `copyDir` is fully synchronous (`mkdirSync`/`copyFileSync`) firing from
   * `prepareOutDirPlugin` at `renderStart`. So the async `fs/cp` walking
   * `public/static` could stat the destination as absent, yield, and resume
   * into `mkdir` after Vite had already created it:
   *
   *   Error: EEXIST: file already exists, mkdir './storybook-static/static'
   *
   * That flaked the play-function shards intermittently - #2779.
   *
   * Note what this does and does not remove. `common-preset` MERGES rather than
   * replaces - `staticDirs = (values = []) => [...defaultStaticDirs, ...values]`
   * - so the resolved value is one entry (`<storybook>/assets/browser` ->
   * `/sb-common-assets`), never zero, and core-server still runs that copy
   * alongside the Vite build. The concurrency remains; what goes away is the
   * SHARED DESTINATION. `fs.promises.cp` mkdirs its own destination leaf
   * non-recursively, which is what raises EEXIST when it loses that leaf, but
   * tolerates a parent appearing underneath it. The two remaining writers share
   * only `storybook-static/`, and `public/` contains no `sb-common-assets`, so
   * this error class is unreachable rather than merely less likely.
   * Verified: with this change the build output is byte-identical to before,
   * all 1575 files, and `storybook dev` serves every public path unchanged.
   */
  staticDirs: [],
  /**
   * Previously inferred, now stated.
   *
   * Storybook's `favicon` preset returns an explicit value if given one and
   * otherwise SCANS `staticDirs` for a `/favicon.ico` or `/favicon.svg`
   * target, falling back to its own `assets/browser/favicon.svg`. The manager
   * favicon was therefore a side effect of the entries above existing -
   * emptying `staticDirs` alone silently swapped the project favicon for
   * Storybook's default. Setting it here keeps `index.html` identical and
   * makes the intent explicit rather than discovered.
   *
   * `here` (not `__dirname`): this file is loaded as ESM, where `__dirname`
   * does not exist and Storybook fails with "main config ... does not seem to
   * be valid ESM".
   */
  favicon: path.resolve(here, '../public/favicon.ico'),
};

export default config;
