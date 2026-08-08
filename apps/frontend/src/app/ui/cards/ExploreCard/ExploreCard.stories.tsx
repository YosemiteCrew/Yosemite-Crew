import type { Meta, StoryObj } from '@storybook/react';
import ExploreCard from './ExploreCard';

const meta = {
  title: 'Cards/ExploreCard',
  component: ExploreCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Dashboard "Explore" stat tiles with the CardHeader period filter. Geometry scales per the design breakpoints: phone/tablet 14px radius · 12/14 padding · 11–11.5px label · 19–20px value; desktop (xl) 16px radius · 14/18 padding · 12.5px label · 24px value, on the soft card shadow. Values come from live dashboard analytics; without a signed-in org the tiles render zeroed placeholders so the tile geometry can still be verified.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ExploreCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
