import type { Preview } from '@storybook/react';
import React from 'react';
import { Newsreader } from 'next/font/google';
import '../src/app/globals.css';

/**
 * Newsreader is loaded exactly as `src/app/layout.tsx` loads it, because that is
 * the only place production gets it: `globals.css` ships no Newsreader
 * @font-face, and `public/fonts/` contains Satoshi only. The token chain is
 * `--font-newsreader: var(--font-newsreader-src, 'Newsreader'), Georgia, …`, so
 * without this the variable is unset, the bare family name matches nothing, and
 * every serif heading in Storybook silently renders as Georgia — measured:
 * identical glyph widths to Georgia and zero registered Newsreader font faces.
 * Snapshot baselines taken in that state would be confidently wrong.
 */
const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-newsreader-src',
  display: 'swap',
});

/**
 * Viewport presets matching the app's responsive breakpoints.
 */
const viewports = {
  mobile: {
    name: 'Mobile (375)',
    styles: { width: '375px', height: '812px' },
    type: 'mobile' as const,
  },
  mobileLg: {
    name: 'Mobile L (430)',
    styles: { width: '430px', height: '932px' },
    type: 'mobile' as const,
  },
  tablet: {
    name: 'Tablet (768)',
    styles: { width: '768px', height: '1024px' },
    type: 'tablet' as const,
  },
  laptop: {
    name: 'Laptop (1280)',
    styles: { width: '1280px', height: '800px' },
    type: 'desktop' as const,
  },
  desktop: {
    name: 'Desktop (1440)',
    styles: { width: '1440px', height: '900px' },
    type: 'desktop' as const,
  },
  wide: {
    name: 'Wide (1920)',
    styles: { width: '1920px', height: '1080px' },
    type: 'desktop' as const,
  },
};

const preview: Preview = {
  decorators: [
    /**
     * Stamps `data-theme` on <html> the way `ThemeScript` does at runtime, so the
     * `html[data-theme='dark']` token block in globals.css actually resolves.
     * Without it every dark-mode override in the design system is unreachable
     * from Storybook and half the system cannot be reviewed.
     */
    (Story, context) => {
      const theme = context.globals.theme === 'dark' ? 'dark' : 'light';
      const reduce = context.globals.reducedMotion === 'reduce';
      // Applied synchronously rather than from an effect: a decorator body is a
      // plain function, not a component, so hooks in it do not reliably run.
      // Both have to land on <html> — the dark tokens are keyed on
      // `html[data-theme='dark']`, and next/font scopes --font-newsreader-src to
      // its generated class, so the class must sit above every story.
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', theme);
        newsreader.variable
          .split(' ')
          .filter(Boolean)
          .forEach((cls) => {
            document.documentElement.classList.add(cls);
          });
      }

      return React.createElement(
        'main',
        {
          'aria-labelledby': 'storybook-story-title',
          // The declared reducedMotion control had no consumer, so the toolbar
          // toggle silently did nothing. Honour it by disabling animation.
          style: reduce
            ? ({
                '--dur-fast': '0ms',
                '--dur-base': '0ms',
                '--dur-slow': '0ms',
              } as React.CSSProperties)
            : undefined,
          className: reduce ? 'motion-reduce' : undefined,
        },
        React.createElement(
          'h1',
          {
            id: 'storybook-story-title',
            className: 'sr-only',
          },
          `${context.title} - ${context.name}`
        ),
        React.createElement(Story)
      );
    },
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /date$/i,
      },
    },
    viewport: {
      viewports,
      defaultViewport: 'laptop',
    },
    /**
     * The product has no pure-white surface. These are the real token values:
     * --page/--screen/--inset in light, and --page in dark (globals.css).
     */
    backgrounds: {
      default: 'page',
      values: [
        { name: 'page', value: '#efe8dc' },
        { name: 'screen (card)', value: '#f7f3ec' },
        { name: 'inset', value: '#eae2d5' },
        { name: 'page (dark)', value: '#201c18' },
        { name: 'screen (dark)', value: '#2f271e' },
      ],
    },
    a11y: {
      // Storybook a11y checks run on every story by default.
      // Override per-story with parameters.a11y.config if needed.
      config: {},
      options: {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
        },
      },
    },
    docs: {
      toc: true,
    },
  },

  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Warm-bone light or espresso dark',
      defaultValue: 'light',
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
    reducedMotion: {
      name: 'Reduced Motion',
      description: 'Simulate prefers-reduced-motion',
      defaultValue: 'no-preference',
      toolbar: {
        icon: 'accessibility',
        items: [
          { value: 'no-preference', title: 'No preference' },
          { value: 'reduce', title: 'Reduce' },
        ],
        dynamicTitle: true,
      },
    },
  },
};

export default preview;
