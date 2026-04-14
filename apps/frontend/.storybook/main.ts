import type { StorybookConfig } from '@storybook/nextjs-vite';

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
  staticDirs: [
    { from: '../public/assets', to: '/assets' },
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
