import type { Meta, StoryObj } from '@storybook/react';
import NurseHandover from '@/app/features/appointments/pages/NurseHandover/NurseHandover';
import handoverMeta from '@/app/features/appointments/pages/NurseHandover/NurseHandover.stories';

const meta = {
  title: 'Appointments/ShiftHandoverRoute',
  component: NurseHandover,
  parameters: { layout: 'fullscreen' },
  beforeEach: handoverMeta.beforeEach,
} satisfies Meta<typeof NurseHandover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ActiveVisits: Story = {};
