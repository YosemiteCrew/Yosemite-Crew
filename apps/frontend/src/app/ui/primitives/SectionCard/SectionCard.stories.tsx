import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { IoAdd } from 'react-icons/io5';
import SectionCard from './SectionCard';

const SectionBody = ({ text }: { text: string }) => (
  <div
    className="text-body-4 text-text-secondary"
    style={{
      borderRadius: 18,
      border: '1px solid var(--hairline)',
      background: 'var(--screen)',
      padding: '16px 20px',
    }}
  >
    {text}
  </div>
);

const meta = {
  title: 'Primitives/SectionCard',
  component: SectionCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A titled section of the organisation page: heading on the left, the section action on ' +
          'the right, content below. Deliberately never collapses — the design lays every section ' +
          'out flat. The `finance` variant (billing portal / upgrade) is omitted from these ' +
          'stories because it reads live subscription state.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    showButton: { control: 'boolean' },
    finance: { table: { disable: true } },
  },
  args: {
    title: 'Documents',
    buttonClick: fn(),
    showButton: true,
    finance: false,
    children: (
      <SectionBody text="Consent forms, discharge notes and lab reports for this practice." />
    ),
  },
} satisfies Meta<typeof SectionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithAction: Story = {
  name: 'With an Add action',
  args: {
    buttonTitle: 'Add',
    buttonIcon: <IoAdd />,
  },
};

export const HeadingOnly: Story = {
  name: 'No action (read-only member)',
  args: {
    title: 'Online booking',
    showButton: false,
    children: <SectionBody text="Owners can request appointments from your public booking page." />,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Pages pass `showButton={canEdit…}`, so this is the read-only view. Without an action ' +
          'the card takes the taller 20px vertical padding, since the pill is no longer setting ' +
          'the header height.',
      },
    },
  },
};

export const CustomActions: Story = {
  name: 'Custom actions slot',
  args: {
    title: 'Linked medical devices',
    showButton: false,
    actions: (
      <span
        className="text-caption-1"
        style={{
          padding: '4px 12px',
          borderRadius: 9999,
          border: '1px solid var(--hairline)',
          color: 'var(--ink-muted)',
        }}
      >
        Last polled 4 min ago
      </span>
    ),
    children: (
      <SectionBody text="IDEXX analyser and two in-house imaging units are reporting in." />
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          '`actions` takes any node and sits beside the standard button, for sections whose ' +
          'control is a status chip or a bespoke toggle rather than a CTA.',
      },
    },
  },
};

export const LongTitle: Story = {
  name: 'Long title beside the action',
  args: {
    title: 'Specialties, services & packages available for online booking',
    buttonTitle: 'Manage',
  },
  parameters: {
    docs: {
      description: {
        story:
          'The heading is `min-w-0 flex-1` and the action row is `shrink-0`, so a long title wraps ' +
          'instead of squeezing the pill into two lines.',
      },
    },
  },
};
