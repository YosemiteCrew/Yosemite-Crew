import type { Meta, StoryObj } from '@storybook/react';
import PossibleDuplicates from '@/app/features/companions/pages/PossibleDuplicates/PossibleDuplicates';
import possibleDuplicatesMeta from '@/app/features/companions/pages/PossibleDuplicates/PossibleDuplicates.stories';

const meta = {
  title: 'Companions/PossibleDuplicatesRoute',
  component: PossibleDuplicates,
  parameters: { layout: 'fullscreen' },
  beforeEach: possibleDuplicatesMeta.beforeEach,
} satisfies Meta<typeof PossibleDuplicates>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReviewQueue: Story = {};
