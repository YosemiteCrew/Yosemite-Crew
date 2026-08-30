import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import Cookies from './Cookies';
import { getStorageItem, removeStorageItem, setStorageItem } from '../../../lib/browserStorage';
import { COOKIE_CONSENT_KEY } from '../../../lib/posthog';

/**
 * The banner is driven entirely by one localStorage key, read through
 * `useSyncExternalStore`. Seeding or clearing that key is the only setup a story
 * needs — there is no provider and no network call behind it.
 */
const withConsent = (value: 'true' | 'false' | null) => () => {
  const previous = getStorageItem('local', COOKIE_CONSENT_KEY);
  if (value === null) {
    removeStorageItem('local', COOKIE_CONSENT_KEY);
  } else {
    setStorageItem('local', COOKIE_CONSENT_KEY, value);
  }
  return () => {
    if (previous === null) {
      removeStorageItem('local', COOKIE_CONSENT_KEY);
    } else {
      setStorageItem('local', COOKIE_CONSENT_KEY, previous);
    }
  };
};

const meta = {
  title: 'Widgets/Cookies',
  component: Cookies,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The cookie consent notice for public pages. It is pinned to the bottom-left of the ' +
          'viewport with the illustrated cookie tucked underneath, and it explains exactly what ' +
          'accepting turns on: one consent cookie, plus PostHog analytics with masking. Either ' +
          'answer is recorded in localStorage and the banner never returns for that browser.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ minHeight: 620, background: 'var(--page)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Cookies>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Undecided: Story = {
  name: 'Awaiting a choice',
  beforeEach: withConsent(null),
  parameters: {
    docs: {
      description: {
        story:
          'What a first-time visitor sees. Accept and Reject are stacked and equally weighted — ' +
          'rejecting is one click, not a settings detour.',
      },
    },
  },
};

export const Accepted: Story = {
  name: 'Already answered',
  beforeEach: withConsent('true'),
  parameters: {
    docs: {
      description: {
        story:
          'Once a choice is stored the component returns `null`, so nothing renders here — that is ' +
          'the expected result. Rejecting produces the same empty state; the stored value only ' +
          'decides whether analytics load, not whether the banner comes back.',
      },
    },
  },
};

/**
 * The banner sits in the ROOT layout, so it is on top of every PIMS screen -
 * phone included - until a choice is stored. It used to carry only the desktop
 * placement: a fixed 80px left offset with a 300px card, which on a 390px phone
 * left an 80px gutter on one side and 10px on the other, and hung the
 * illustration 250px below the card, straight across the tab bar's Home and
 * Schedule labels.
 */
export const Phone: Story = {
  name: 'Phone: even gutters, clear of the tab bar',
  beforeEach: withConsent(null),
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const banner = within(canvasElement).getByRole('complementary', { name: 'Cookie consent' });
    const box = banner.getBoundingClientRect();

    /* Measured as a RELATION, not against a hardcoded 375/390: the assertion has
       to hold at whatever width the harness gives the story, and "the two
       gutters match" is the actual design rule. A one-sided offset is what the
       desktop-only placement produced. */
    const left = Math.round(box.left);
    const right = Math.round(window.innerWidth - box.right);
    await expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
    await expect(left).toBeGreaterThan(0);

    // Clear of the 72px tab-bar reserve rather than sitting on top of it.
    await expect(window.innerHeight - box.bottom).toBeGreaterThanOrEqual(72);

    // The decoration is dropped rather than left to collide with the bar.
    for (const image of banner.querySelectorAll('img')) {
      await expect(image.getBoundingClientRect().height).toBe(0);
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          'Below 768px the card docks to the bottom with even 16px gutters and clears the phone ' +
          'tab bar, and the illustration is dropped - there is no room for it above the bar. The ' +
          'play function measures the two gutters against each other rather than against a fixed ' +
          'width, so it still holds on any phone size.',
      },
    },
  },
};
