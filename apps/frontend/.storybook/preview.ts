import type { Preview } from '@storybook/react';
import '../src/app/globals.css';

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
    backgrounds: {
      default: 'white',
      values: [
        { name: 'white', value: '#ffffff' },
        { name: 'subtle', value: '#eaeaea' },
        { name: 'dark', value: '#1d1c1b' },
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
