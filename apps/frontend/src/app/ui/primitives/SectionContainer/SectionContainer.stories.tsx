import type { Meta, StoryObj } from '@storybook/react';
import { IoAddCircleOutline } from 'react-icons/io5';

import SectionContainer from './SectionContainer';

const Body = () => (
  <div className="flex flex-col gap-2 text-[13px] text-[var(--ink-body)]">
    <p>Any form fields, tables or editors go here.</p>
    <p className="text-[var(--ink-muted)]">
      The container only owns the border, the radius and the header row.
    </p>
  </div>
);

const meta = {
  title: 'Primitives/SectionContainer',
  component: SectionContainer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Bordered card that groups a titled block of form fields. The title is plain static text ' +
          '(15px/700 on `--ink`, 14px when `nested`) with an optional leading icon and an optional ' +
          'right-aligned slot; the border turns `--input-border-active` on `focus-within` so the ' +
          'section highlights while a field inside it is focused. Pass `disableFocusBorder` when the ' +
          'child owns its own focus affordance, and `compactTop` to pull the header closer to the top edge.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    nested: { control: 'boolean' },
    disableFocusBorder: { control: 'boolean' },
    compactTop: { control: 'boolean' },
  },
  args: {
    title: 'Companion details',
    children: <Body />,
  },
} satisfies Meta<typeof SectionContainer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithTitleSlot: Story = {
  name: 'Title slot + leading icon',
  args: {
    title: 'Vaccinations',
    titleIcon: <IoAddCircleOutline size={16} color="var(--blue)" aria-hidden="true" />,
    titleSlot: <span className="text-[12px] text-[var(--ink-faint)]">3 records</span>,
  },
  parameters: {
    docs: {
      description: {
        story: 'The slot is pinned right and never shrinks; the title takes the remaining width.',
      },
    },
  },
};

export const Nested: Story = {
  name: 'Nested (14px title)',
  args: { title: 'Dosage', nested: true },
};

export const LongTitle: Story = {
  name: 'Long title truncates',
  args: {
    title: 'Pre-anaesthetic bloodwork, imaging and consent paperwork for the scheduled procedure',
    titleSlot: <span className="text-[12px] text-[var(--ink-faint)]">Required</span>,
  },
  parameters: {
    docs: {
      description: {
        story: 'A long title stays on one line and truncates rather than wrapping under the slot.',
      },
    },
  },
};
