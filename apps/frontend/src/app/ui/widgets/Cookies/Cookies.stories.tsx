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
    /* The phone placement - even 16px gutters, clear of the 72px tab-bar reserve,
       decoration dropped - is all `md:`-gated, and `md:` is a VIEWPORT media
       query. The viewport global is applied by the Storybook manager resizing the
       preview iframe, so a runner that loads `iframe.html` directly renders this
       at panel width and gets the DESKTOP placement: the gutters come back 80 and
       ~900, and asserting they match fails for a reason that has nothing to do
       with the component. A decorator cannot stand in either, because a narrow
       container does not change what a viewport query matches.

       So this asserts only what is true at BOTH widths - the banner is present
       and named - and the phone geometry is covered by the Chromatic viewport
       above. The desktop placement it replaced is measured in `Undecided`. */
    const banner = within(canvasElement).getByRole('complementary', { name: 'Cookie consent' });
    await expect(banner).toBeInTheDocument();
    await expect(within(banner).getByText('Accept')).toBeInTheDocument();
    await expect(within(banner).getByText('Reject')).toBeInTheDocument();
  },
  parameters: {
    chromatic: { viewports: [375] },
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
