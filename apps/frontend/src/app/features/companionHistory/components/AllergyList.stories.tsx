import type { Meta, StoryObj } from '@storybook/react';
import AllergyList from './AllergyList';
import type { PatientAllergy } from '@/app/features/companionHistory/services/patientAllergyService';

const allergy = (over: Partial<PatientAllergy>): PatientAllergy => ({
  id: over.id ?? 'a-1',
  organisationId: 'org-1',
  patientId: 'pat-1',
  allergen: over.allergen ?? 'Allergen',
  allergyType: over.allergyType ?? 'DRUG',
  severity: over.severity ?? 'MILD',
  reaction: over.reaction ?? null,
  status: over.status ?? 'ACTIVE',
  onsetDate: over.onsetDate ?? null,
  resolvedDate: over.resolvedDate ?? null,
  notes: over.notes ?? null,
  recordedBy: null,
  createdAt: '2026-01-10T09:00:00.000Z',
  updatedAt: '2026-01-10T09:00:00.000Z',
  ...over,
});

const SAMPLE: PatientAllergy[] = [
  allergy({
    id: 'a-1',
    allergen: 'Penicillin',
    allergyType: 'DRUG',
    status: 'ACTIVE',
    severity: 'LIFE_THREATENING',
    reaction: 'Anaphylaxis, facial swelling',
    onsetDate: '2025-11-02T00:00:00.000Z',
    notes: 'Confirmed by intradermal test.',
  }),
  allergy({
    id: 'a-2',
    allergen: 'Chicken protein',
    allergyType: 'FOOD',
    status: 'ACTIVE',
    severity: 'MODERATE',
    reaction: 'Chronic pruritus',
    onsetDate: '2026-01-04T00:00:00.000Z',
  }),
  allergy({
    id: 'a-3',
    allergen: 'Grass pollen',
    allergyType: 'ENVIRONMENTAL',
    status: 'UNCONFIRMED',
    severity: 'MILD',
  }),
  allergy({
    id: 'a-4',
    allergen: 'Flea saliva',
    allergyType: 'OTHER',
    status: 'RESOLVED',
    severity: 'MODERATE',
    onsetDate: '2025-08-01T00:00:00.000Z',
    resolvedDate: '2025-08-20T00:00:00.000Z',
  }),
];

const meta = {
  title: 'CompanionHistory/AllergyList',
  component: AllergyList,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  args: {
    canEdit: true,
    allergies: SAMPLE,
    onCreate: async () => true,
    onResolve: () => {},
  },
} satisfies Meta<typeof AllergyList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};

export const ReadOnly: Story = {
  args: { canEdit: false },
};

export const Empty: Story = {
  args: { allergies: [] },
};

export const Loading: Story = {
  args: { allergies: [], loading: true },
};

export const WithError: Story = {
  args: { error: 'Could not load the allergy list. Please try again.' },
};
