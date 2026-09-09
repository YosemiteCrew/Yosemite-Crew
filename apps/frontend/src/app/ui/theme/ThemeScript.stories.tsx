import type { Meta, StoryObj } from '@storybook/react';
import { headers } from 'next/headers';

import ThemeScript from './ThemeScript';

// Mirrors the private `NONCE_HEADER` constant in ThemeScript.tsx: the header
// middleware.ts sets to the per-request CSP nonce before this component reads it.
const NONCE_HEADER = 'x-nonce';

/**
 * `next/headers`'s real types describe a read-only, async header bag. Storybook's
 * Next.js framework substitutes a settable, synchronous mock at build time instead
 * (aliasing `next/headers` itself, so this is the same module instance ThemeScript
 * reads through) - this narrows just enough to seed or clear the nonce it carries.
 */
type HeadersMock = {
  (): { set(name: string, value: string): void };
  mockRestore(): void;
};

const mockedHeaders = headers as unknown as HeadersMock;

/**
 * ThemeScript is an async server component with no props: every render awaits
 * `headers()`, so there is no synchronous JSX to hand a story directly. Each story
 * below seeds (or clears) the mocked request headers - the seam ThemeScript reads
 * through, the same idea as mocking the shared axios client or a Zustand store for
 * a page story - inside its own `loader`, then calls the real, unmodified component
 * and hands the resolved element to `render`. That is the supported way to exercise
 * a Server Component client-side; resetting the mock first also keeps stories from
 * leaking a nonce into whichever runs next.
 */
const loadThemeScript = (nonce: string | undefined) => async () => {
  mockedHeaders.mockRestore();
  if (nonce !== undefined) {
    mockedHeaders().set(NONCE_HEADER, nonce);
  }
  return { element: await ThemeScript() };
};

const themeScriptMeta = {
  title: 'Theme/ThemeScript',
  component: ThemeScript,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Injects the pre-paint theme script so dark mode never flashes. Before the app paints, the ' +
          "inline script reads the explicit choice from localStorage's `yc-theme` key, falls back to " +
          'the OS `prefers-color-scheme`, and stamps `data-theme` on `<html>` - the same attribute ' +
          "these stories' own preview decorator sets, and the one every dark-mode token in " +
          'globals.css is keyed on.\n\n' +
          'App routes render behind a strict, per-request nonce CSP (see middleware.ts), so ' +
          "ThemeScript reads that request's nonce off the `x-nonce` header and tags the inline " +
          'script with it instead of relying on `unsafe-inline`. Public/marketing routes inline the ' +
          'same script without a nonce, authorised by CSP hash instead, because they prerender ' +
          'statically and have no per-request nonce to give it - see prePaintScript.ts.\n\n' +
          'ThemeScript takes no props. There is nothing visible in the canvas either - a `<script>` ' +
          "tag renders no box - the evidence for each story is the tag's own `nonce` attribute and " +
          '`__html`, visible in the source panel below.',
      },
    },
  },
  tags: ['autodocs'],
  render: (_args, { loaded }) => loaded.element,
} satisfies Meta<typeof ThemeScript>;

export default themeScriptMeta;
type ThemeScriptStory = StoryObj<typeof themeScriptMeta>;

export const Default: ThemeScriptStory = {
  name: 'Default (app route request)',
  loaders: [loadThemeScript('kR8mQ2vN5tXpL0scY7dFhw==')],
  parameters: {
    docs: {
      description: {
        story:
          'A typical `(app)` route request: middleware set an `x-nonce` header, and the rendered ' +
          'script carries it, authorising it under the strict CSP without `unsafe-inline`.',
      },
    },
  },
};

export const RotatedNonce: ThemeScriptStory = {
  name: 'A different request gets a different nonce',
  loaders: [loadThemeScript('p4Zt9CqWn2XeR6oLaVdMSw==')],
  parameters: {
    docs: {
      description: {
        story:
          'The nonce is per-request, not a static value: middleware mints a fresh one every time, and ' +
          "the script tag carries whatever this render's `x-nonce` header holds.",
      },
    },
  },
};

export const WithoutNonceHeader: ThemeScriptStory = {
  name: 'No x-nonce header (defensive fallback)',
  loaders: [loadThemeScript(undefined)],
  parameters: {
    docs: {
      description: {
        story:
          "`headers().get('x-nonce')` returns null when nothing set the header - the `?? undefined` " +
          'fallback in ThemeScript then renders the script with no `nonce` attribute at all, rather ' +
          'than the literal string "null".',
      },
    },
  },
};
