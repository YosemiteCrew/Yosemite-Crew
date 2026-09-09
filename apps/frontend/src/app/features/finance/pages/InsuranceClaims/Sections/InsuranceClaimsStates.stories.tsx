import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import InsuranceClaimsStates from './InsuranceClaimsStates';

const insuranceClaimsStatesMeta = {
  title: 'InsuranceClaims/InsuranceClaimsStates',
  component: InsuranceClaimsStates,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "The insurance claims list's loading, error and empty placeholders. The three states " +
          'are mutually exclusive with the claims table and with each other - loading wins over ' +
          'error, error wins over empty - so the component returns null once there are claims to ' +
          'show, letting the page read as `<States/>` then the table rather than three inline ' +
          'branches in the page itself.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    loading: { control: 'boolean' },
    error: { control: 'text' },
    isEmpty: { control: 'boolean' },
    emptyMessage: { control: 'text' },
  },
  args: {
    loading: false,
    error: null,
    isEmpty: false,
    emptyMessage: 'No claims match the current filters.',
    onReload: fn(),
  },
} satisfies Meta<typeof InsuranceClaimsStates>;

export default insuranceClaimsStatesMeta;
type InsuranceClaimsStatesStory = StoryObj<typeof insuranceClaimsStatesMeta>;

export const Default: InsuranceClaimsStatesStory = {
  name: 'Claims present (renders nothing)',
};

export const Loading: InsuranceClaimsStatesStory = {
  args: { loading: true },
};

export const Error: InsuranceClaimsStatesStory = {
  args: { error: 'Could not load insurance claims. Please try again.' },
};

export const Empty: InsuranceClaimsStatesStory = {
  args: { isEmpty: true },
};

export const EmptyFromFilter: InsuranceClaimsStatesStory = {
  name: 'Empty from an active filter',
  args: {
    isEmpty: true,
    emptyMessage: 'No claims match "Trupanion" in Submitted.',
  },
};
