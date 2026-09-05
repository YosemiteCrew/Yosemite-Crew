import type { Meta, StoryObj } from '@storybook/react';
import FlagList from './FlagList';
import type { PatientFlag } from '@/app/features/companionHistory/services/patientFlagService';

const flag = (overrides: Partial<PatientFlag>): PatientFlag => ({
  id: overrides.id ?? 'flag-1',
  organisationId: 'org-1',
  patientId: 'patient-1',
  flagType: overrides.flagType ?? 'SPECIAL_HANDLING',
  severity: overrides.severity ?? 'MEDIUM',
  title: overrides.title ?? 'Patient flag',
  description: overrides.description ?? null,
  isActive: overrides.isActive ?? true,
  createdBy: null,
  resolvedAt: overrides.resolvedAt ?? null,
  resolvedBy: null,
  createdAt: '2026-01-10T09:00:00.000Z',
  updatedAt: '2026-01-10T09:00:00.000Z',
  ...overrides,
});

const SAMPLE: PatientFlag[] = [
  flag({
    id: 'flag-1',
    title: 'Use a muzzle',
    flagType: 'AGGRESSION',
    severity: 'CRITICAL',
    description: 'Approach slowly and keep away from other dogs.',
  }),
  flag({
    id: 'flag-2',
    title: 'Keep both doors closed',
    flagType: 'ESCAPE_RISK',
    severity: 'HIGH',
  }),
  flag({
    id: 'flag-3',
    title: 'Needs a quiet room',
    flagType: 'ANXIETY',
    severity: 'MEDIUM',
  }),
  flag({
    id: 'flag-4',
    title: 'Isolation complete',
    flagType: 'QUARANTINE',
    severity: 'LOW',
    isActive: false,
    resolvedAt: '2026-02-02T00:00:00.000Z',
  }),
];

const meta = {
  title: 'CompanionHistory/FlagList',
  component: FlagList,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  args: {
    flags: SAMPLE,
    canEdit: true,
    onCreate: async () => true,
    onResolve: () => {},
  },
} satisfies Meta<typeof FlagList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};

export const ReadOnly: Story = {
  args: { canEdit: false },
};

export const Empty: Story = {
  args: { flags: [] },
};

export const Loading: Story = {
  args: { flags: [], loading: true },
};

export const WithError: Story = {
  args: { error: 'Could not load patient flags. Please try again.' },
};
