import type { Meta, StoryObj } from '@storybook/react';
import { expect } from 'storybook/test';

import './PhoneShell.css';

/**
 * The `[data-yc-app] #main-content` reservation, on its own.
 *
 * Every rule in `PhoneShell.css` sits behind `max-width: 767px`, so the viewport
 * is pinned; and the selector needs a `data-yc-app` ancestor, which the preview
 * decorator supplies on non-marketing stories.
 */
const MainContentFixture = () => (
  <div id="main-content" style={{ background: 'var(--inset)' }}>
    <p style={{ margin: 0 }}>Route content sits inside this element.</p>
  </div>
);

const meta = {
  title: 'ui/layout/PhoneShell/MainContentInset',
  component: MainContentFixture,
  globals: { viewport: { value: 'mobile', isRotated: false } },
} satisfies Meta<typeof MainContentFixture>;

export default meta;
type Story = StoryObj<typeof meta>;

const bottomPx = () =>
  Number.parseFloat(
    globalThis.getComputedStyle(document.querySelector('#main-content') as Element).paddingBottom
  );

export const ReservesTheConsentStrip: Story = {
  name: 'Reserves the consent strip as well as the tab bar',
  play: async () => {
    const root = document.documentElement;
    const main = document.querySelector('#main-content');
    await expect(main).not.toBeNull();

    // With no card, the reserve is the tab bar. env(safe-area-inset-bottom) is 0
    // in a headless browser, so this is 72 there and larger on a device - read it
    // rather than asserting the literal.
    const barOnly = bottomPx();
    await expect(barOnly).toBeGreaterThanOrEqual(72);

    try {
      // Taller than the bar, so `max` must pick it.
      root.style.setProperty('--yc-consent-inset', '252px');
      await expect(bottomPx()).toBe(252);

      // Shorter than the bar: the bar still wins, which is the half a sum gets
      // wrong by adding the two together.
      root.style.setProperty('--yc-consent-inset', '20px');
      await expect(bottomPx()).toBe(barOnly);

      root.style.setProperty('--yc-consent-inset', '0px');
      await expect(bottomPx()).toBe(barOnly);
    } finally {
      root.style.removeProperty('--yc-consent-inset');
    }
  },
};
