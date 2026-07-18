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
          'Dashboard "Explore" stat tiles (14px radius, 12/14 padding, 11.5px label, 20px value) with the CardHeader period filter. Values come from live dashboard analytics; without a signed-in org the tiles render zeroed placeholders so the tile geometry can still be verified.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ExploreCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
