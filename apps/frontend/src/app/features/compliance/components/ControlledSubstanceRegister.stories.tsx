import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';

import ControlledSubstanceRegister from './ControlledSubstanceRegister';
import type { ControlledSubstanceLog } from '@/app/features/compliance/types/controlledSubstance';

const entry = (overrides: Partial<ControlledSubstanceLog>): ControlledSubstanceLog => ({
  id: 'log-1',
  organisationId: 'org-1',
  patientId: 'pat-1',
  encounterId: null,
  loggedAt: '2026-09-03T14:30:00.000Z',
  drug: 'Ketamine',
  deaSchedule: 'III',
  lotNumber: 'LOT-4471',
  strength: 100,
  unit: 'MG',
  amountDrawn: 2,
  amountAdministered: 1.5,
  amountWasted: 0.5,
  wastedWitness: 'Dr. Alvarez',
  balanceBefore: 20,
  balanceAfter: 18,
  administeredBy: 'Dr. Reyes',
  notes: 'Sedation for laceration repair.',
  createdAt: '2026-09-03T14:31:00.000Z',
  updatedAt: '2026-09-03T14:31:00.000Z',
  ...overrides,
});

const SAMPLE: ControlledSubstanceLog[] = [
  entry({
    id: 'log-1',
    drug: 'Fentanyl citrate',
    deaSchedule: 'II',
    unit: 'ML',
    strength: 0.05,
    amountDrawn: 2,
    amountAdministered: 1.5,
    amountWasted: 0.5,
    wastedWitness: 'Dr. Alvarez',
    balanceBefore: 10,
    balanceAfter: 8,
  }),
  entry({
    id: 'log-2',
    drug: 'Ketamine',
    deaSchedule: 'III',
    unit: 'MG',
    amountDrawn: 100,
    amountAdministered: 80,
    amountWasted: 20,
    // Compliance red flag: waste with no witness recorded.
    wastedWitness: null,
    balanceBefore: 500,
    balanceAfter: 400,
    administeredBy: 'Dr. Reyes',
    notes: 'Induction.',
  }),
  entry({
    id: 'log-3',
    drug: 'Diazepam',
    deaSchedule: 'IV',
    unit: 'ML',
    strength: 5,
    amountDrawn: 1,
    amountAdministered: 1,
    amountWasted: 0,
    wastedWitness: null,
    balanceBefore: 12,
    balanceAfter: 11,
    notes: null,
  }),
  entry({
    id: 'log-4',
    drug: 'Phenobarbital',
    deaSchedule: 'V',
    unit: 'TABLET',
    strength: null,
    amountDrawn: 3,
    amountAdministered: 3,
    amountWasted: 0,
    wastedWitness: null,
    balanceBefore: null,
    balanceAfter: null,
    administeredBy: null,
  }),
];

const meta: Meta<typeof ControlledSubstanceRegister> = {
  title: 'Features/Compliance/ControlledSubstanceRegister',
  component: ControlledSubstanceRegister,
  parameters: { layout: 'fullscreen' },
  args: {
    dateRange: {},
    onDateRangeChange: fn(),
    canRecord: true,
    creating: false,
    createError: null,
    onCreate: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ height: '80vh', padding: 24 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof ControlledSubstanceRegister>;

export const Populated: Story = {
  args: { entries: SAMPLE, loading: false, error: null },
};

export const ReadOnly: Story = {
  args: { entries: SAMPLE, loading: false, error: null, canRecord: false },
};

export const Empty: Story = {
  args: { entries: [], loading: false, error: null },
};

export const Loading: Story = {
  args: { entries: [], loading: true, error: null },
};

export const ErrorState: Story = {
  args: {
    entries: [],
    loading: false,
    error: 'Unable to load the controlled substance register.',
  },
};
