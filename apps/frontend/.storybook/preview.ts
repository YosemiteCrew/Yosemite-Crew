import type { Preview } from '@storybook/react';
import React from 'react';
import '../src/app/globals.css';
import { installOfflineGuard } from './offline-guard';

/**
 * Installed here, at preview module scope, rather than from a decorator or a
 * `beforeAll`: it has to be in place before the first story module is imported,
 * because the stories that stub the network capture the primitives at THEIR
 * module scope and restore what they captured. Installed first, the guard is
 * what they capture and put back; installed later, their cleanup would quietly
 * uninstall it for every story after them.
 */
installOfflineGuard();

/**
 * Newsreader and Satoshi both resolve from `globals.css` @font-face rules served
 * out of the `/fonts` staticDir, so no build-time network fetch is involved and
 * the serif is the real brand face rather than a Georgia fallback.
 */
/**
 * Viewport presets matching the app's responsive breakpoints.
 *
 * These are registered under `parameters.viewport.options`, which is the only
 * viewport parameter key Storybook 10 reads. The pre-10 spelling was
 * `parameters.viewport.viewports` plus `parameters.viewport.defaultViewport`,
 * and both were removed in 10 - `defaultViewport` now only logs a manager
 * warning and is otherwise inert. That is a silent failure worth naming: a
 * story pinned with the old keys still renders, still runs its play function
 * and still passes, it just renders at the full panel width. Every "Phone"
 * story here was drawing desktop markup at 1200px until this was corrected.
 *
 * Selection is a GLOBAL, not a parameter: `globals: { viewport: { value } }`
 * on the story. The `value` must name a key below - an unknown key (`phone`,
 * say) fails the same silent way.
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
      // Applied synchronously rather than from an effect: a decorator body is a
      // plain function, not a component, so hooks in it do not reliably run.
      // It has to land on <html> because the dark tokens are keyed on
      // `html[data-theme='dark']`.
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', theme);
      }

      // PIMS scopes its readable faint inks to `body:has([data-yc-app])`,
      // because the public marketing pages need the lighter values for their
      // always-dark --spot panels. Without the marker here, every story renders
      // the MARKETING values - so Storybook showed PIMS components with inks
      // that are unreadable in the product, and Chromatic could never catch a
      // regression in the scoped tokens. Marketing stories opt out with
      // `parameters: { surface: 'marketing' }`.
      // The selector matches a DESCENDANT, so the marker goes on this wrapper
      // rather than on <body> itself.
      const marketing = context.parameters?.surface === 'marketing';

      return React.createElement(
        'main',
        {
          'aria-labelledby': 'storybook-story-title',
          ...(marketing ? {} : { 'data-yc-app': '' }),
        },
        /* Names the story's landmark for the a11y addon. It is sr-only but it is REAL
           TEXT inside `canvasElement`, so a loose text query in a play function can
           match it: `getByText(/emergency/i)` in a story named "Emergency, ready to
           admit" matched both the banner and the badge. Worse than the ambiguity is the
           silent case - a query that matches only the banner passes with the component
           absent. Prefer exact strings or role queries in play functions. */
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
      options: viewports,
    },
    /**
     * Disabled on purpose. `globals.css` paints `body` from `var(--page)`, which
     * the theme decorator flips, so the canvas already tracks the active theme.
     * A swatch list here would duplicate token hex values and, worse, hold the
     * canvas on the light `#efe8dc` while the component tokens went dark.
     */
    backgrounds: { disable: true },
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

  /**
   * The project default. `laptop` matches the widest PIMS breakpoint the app
   * treats as desktop, so an unpinned story renders the desktop branch rather
   * than whatever width the preview panel happens to be.
   */
  initialGlobals: {
    viewport: { value: 'laptop', isRotated: false },
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
  },
};

export default preview;
