import type { Meta, StoryObj } from '@storybook/react';
import ProblemList from './ProblemList';
import type { PatientProblem } from '@/app/features/companionHistory/services/patientProblemService';

const problem = (over: Partial<PatientProblem>): PatientProblem => ({
  id: over.id ?? 'p-1',
  organisationId: 'org-1',
  patientId: 'pat-1',
  encounterId: null,
  name: over.name ?? 'Problem',
  codeSystem: null,
  code: null,
  status: over.status ?? 'ACTIVE',
  severity: over.severity ?? null,
  onsetDate: over.onsetDate ?? null,
  resolvedDate: over.resolvedDate ?? null,
  notes: over.notes ?? null,
  recordedBy: null,
  createdAt: '2026-01-10T09:00:00.000Z',
  updatedAt: '2026-01-10T09:00:00.000Z',
  ...over,
});

const SAMPLE: PatientProblem[] = [
  problem({
    id: 'p-1',
    name: 'Chronic kidney disease',
    status: 'ACTIVE',
    severity: 'SEVERE',
    onsetDate: '2025-11-02T00:00:00.000Z',
    code: 'N18.9',
    notes: 'IRIS stage 3. Monitoring phosphate and blood pressure.',
  }),
  problem({
    id: 'p-2',
    name: 'Otitis externa (left ear)',
    status: 'ACTIVE',
    severity: 'MODERATE',
    onsetDate: '2026-01-04T00:00:00.000Z',
  }),
  problem({
    id: 'p-3',
    name: 'Mild dental tartar',
    status: 'ACTIVE',
    severity: 'MILD',
    onsetDate: '2025-09-18T00:00:00.000Z',
  }),
  problem({
    id: 'p-4',
    name: 'Post-operative wound',
    status: 'RESOLVED',
    severity: 'MODERATE',
    onsetDate: '2025-08-01T00:00:00.000Z',
    resolvedDate: '2025-08-20T00:00:00.000Z',
  }),
];

const meta = {
  title: 'CompanionHistory/ProblemList',
  component: ProblemList,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  args: {
    canEdit: true,
    problems: SAMPLE,
    onCreate: async () => true,
    onResolve: () => {},
  },
} satisfies Meta<typeof ProblemList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};

export const ReadOnly: Story = {
  args: { canEdit: false },
};

export const Empty: Story = {
  args: { problems: [] },
};

export const Loading: Story = {
  args: { problems: [], loading: true },
};

export const WithError: Story = {
  args: { error: 'Could not load the problem list. Please try again.' },
};
