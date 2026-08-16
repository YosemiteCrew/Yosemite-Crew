import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

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
