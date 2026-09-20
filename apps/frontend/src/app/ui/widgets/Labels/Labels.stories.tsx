import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';
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
    /* `padded`, not `centered`. The strip is `w-full` inside an `inline-flex` root, and
       the centered layout hands the story a shrink-to-fit box - so `w-full` resolved
       against a container that was itself sized by its content, the row grew to its
       max-content and its own `overflow-x-auto` never engaged. On a 390px canvas that
       put 55px of pills past the edge of a component built specifically to scroll them.
       The component centres its own pills when there are three or fewer
       (`useCenteredLayout`); it needs a real width from the page, not from the canvas. */
    layout: 'padded',
    docs: {
      description: {
        component:
          'Tab-style navigation pills. Supports a two-level hierarchy with sub-labels. ' +
          '`statuses` map marks specific tabs with a check or alert icon (e.g. form validation state).',
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
        story:
          'Check icon = valid, alert icon = error. Distinct shapes, not just hues, so the state survives greyscale and colour-blind vision. Used to show form section completion state.',
      },
    },
  },
};

export const WithSubLabels: Story = {
  name: 'With sub-labels',
  render: () => <LabelsWithSubLabelsStory />,
};

/**
 * The strip in a box narrower than its pills. Four labels are past
 * `useCenteredLayout`, so this is the scrolling branch.
 */
export const NarrowFrame: Story = {
  name: 'In a 320px frame',
  render: () => <BasicLabelsStory />,
  decorators: [
    /* A container, not the mobile viewport global: that global is applied by the
       Storybook manager to the preview iframe and is inert for a runner loading
       iframe.html directly. Nothing here depends on a media query anyway - the
       overflow is decided by the box the strip is given. */
    (Story) => (
      <div data-frame="" style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const frame = canvasElement.querySelector('[data-frame]') as HTMLElement;
    const strip = within(canvasElement).getByRole('tablist');

    // There is genuinely more here than fits, or the rest of this asserts nothing.
    await expect(strip.scrollWidth).toBeGreaterThan(strip.clientWidth);

    /* And the strip absorbs it instead of the page. This is the failure the story
       layout hid: under `layout: 'centered'` the strip sat in a shrink-to-fit box,
       so `w-full` resolved against its own content, the row grew to max-content and
       `overflow-x-auto` had nothing left to do. */
    await expect(strip.getBoundingClientRect().width).toBeLessThanOrEqual(
      frame.getBoundingClientRect().width
    );
  },
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
