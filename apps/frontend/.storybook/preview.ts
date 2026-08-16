import type { Preview } from '@storybook/react';
import React from 'react';
import '../src/app/globals.css';

/**
 * Newsreader and Satoshi both resolve from `globals.css` @font-face rules served
 * out of the `/fonts` staticDir, so no build-time network fetch is involved and
 * the serif is the real brand face rather than a Georgia fallback.
 */
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
