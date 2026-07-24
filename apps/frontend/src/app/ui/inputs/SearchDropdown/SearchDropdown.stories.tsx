import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import SearchDropdown from './index';

const COMPANIONS = [
  { value: 'poppy', label: 'Poppy — Beagle' },
  { value: 'bruno', label: 'Bruno — German Shepherd' },
  { value: 'miso', label: 'Miso — Ragdoll' },
  { value: 'waffle', label: 'Waffle — Corgi' },
];

const StatefulSearchDropdown = (args: ComponentProps<typeof SearchDropdown>) => {
  const [query, setQuery] = useState(args.query);
  return <SearchDropdown {...args} query={query} setQuery={setQuery} />;
};

const meta = {
  title: 'Inputs/SearchDropdown',
  component: SearchDropdown,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Type-ahead search field with a results dropdown. The field matches the design search ' +
          'pattern: 40px tall, 12px radius, 1.5px hairline border, --field-bg fill, a leading ' +
          '15px search glyph, and 12.5px text. Results appear after `minChars` (default 2).',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    minChars: { control: 'number' },
    error: { control: 'text' },
  },
  args: {
    options: COMPANIONS,
    placeholder: 'Search companions',
    label: 'Search companions',
    query: '',
    setQuery: () => {},
    onSelect: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  render: (args) => <StatefulSearchDropdown {...args} />,
} satisfies Meta<typeof SearchDropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithQuery: Story = {
  args: { query: 'b' },
  parameters: {
    docs: { story: 'Below the 2-character threshold — results stay hidden until the query grows.' },
  },
};

export const WithError: Story = {
  args: { error: 'Pick a companion from the list.' },
};
