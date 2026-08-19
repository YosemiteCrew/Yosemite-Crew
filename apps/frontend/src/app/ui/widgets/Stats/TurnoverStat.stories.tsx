import type { Meta, StoryObj } from '@storybook/react';
import AnnualInventoryTurnoverStat from './AnnualInventoryTurnoverStat';
import IndividualProductTurnoverStat from './IndividualProductTurnoverStat';

const meta = {
  title: 'Widgets/Stats/TurnoverStat',
  component: AnnualInventoryTurnoverStat,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The two inventory-turnover dashboard cards: `AnnualInventoryTurnoverStat` (a month-by-month ' +
          'bar column, with the in-progress month drawn in `--divider` so a partial month never reads ' +
          'as a drop) and `IndividualProductTurnoverStat` (per-product horizontal bars plus a trend ' +
          'footnote). Both read live analytics through `useDashboardAnalytics`, which returns zeroed ' +
          'defaults and makes no request when no org is signed in - so in Storybook they render the ' +
          'shared "No data available" empty state and the card shell geometry is what is under review here.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AnnualInventoryTurnoverStat>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AnnualInventoryTurnover: Story = {
  name: 'Annual inventory turnover',
};

export const ProductTurnover: Story = {
  name: 'Product turnover',
  render: () => <IndividualProductTurnoverStat />,
  parameters: {
    docs: {
      description: {
        story:
          'Same shell, different header title and duration pill. Both cards are locked to the ' +
          '"Last 1 year" option, so the header pill is static rather than a picker.',
      },
    },
  },
};
