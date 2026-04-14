import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { useState } from 'react';
import Labels from './Labels';

const BASIC_LABELS = [
  { key: 'overview', name: 'Overview' },
  { key: 'appointments', name: 'Appointments' },
  { key: 'billing', name: 'Billing' },
  { key: 'settings', name: 'Settings' },
];

const LABELS_WITH_SUB = [
  {
    key: 'general',
    name: 'General',
    labels: [
      { key: 'profile', name: 'Profile' },
      { key: 'preferences', name: 'Preferences' },
    ],
  },
  {
    key: 'security',
    name: 'Security',
    labels: [
      { key: 'password', name: 'Password' },
      { key: 'two-factor', name: '2FA' },
    ],
  },
];

const meta = {
  title: 'Widgets/Labels',
  component: Labels,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Tab-style navigation pills. Supports a two-level hierarchy with sub-labels. ' +
          '`statuses` map lets you show green/red dots on specific tabs (e.g. form validation state).',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Labels>;

export default meta;
type Story = StoryObj<typeof meta>;

function BasicLabelsStory() {
  const [active, setActive] = useState('overview');

  return <Labels labels={BASIC_LABELS} activeLabel={active} setActiveLabel={setActive} />;
}

function LabelsWithStatusesStory() {
  const [active, setActive] = useState('overview');

  return (
    <Labels
      labels={BASIC_LABELS}
      activeLabel={active}
      setActiveLabel={setActive}
      statuses={{ appointments: 'valid', billing: 'error' }}
    />
  );
}

function LabelsWithSubLabelsStory() {
  const [active, setActive] = useState('general');
  const [activeSub, setActiveSub] = useState('profile');

  return (
    <Labels
      labels={LABELS_WITH_SUB}
      activeLabel={active}
      setActiveLabel={setActive}
      activeSubLabel={activeSub}
      setActiveSubLabel={setActiveSub}
    />
  );
}

export const Basic: Story = {
  render: () => <BasicLabelsStory />,
};

export const WithStatuses: Story = {
  name: 'With validation statuses',
  render: () => <LabelsWithStatusesStory />,
  parameters: {
    docs: {
      description: {
        story: 'Green dot = valid, red dot = error. Used to show form section completion state.',
      },
    },
  },
};

export const WithSubLabels: Story = {
  name: 'With sub-labels',
  render: () => <LabelsWithSubLabelsStory />,
};

export const Disabled: Story = {
  render: () => (
    <Labels labels={BASIC_LABELS} activeLabel="overview" setActiveLabel={fn()} disableClicking />
  ),
  parameters: {
    docs: {
      description: {
        story: 'All tabs are non-interactive — used during loading or form submission.',
      },
    },
  },
};
