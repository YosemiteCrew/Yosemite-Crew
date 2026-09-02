import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import BreedSubstitutionNotice from './BreedSubstitutionNotice';
import type { LabBreedSubstitution } from '@/app/features/integrations/services/types';

const substitution = (overrides: Partial<LabBreedSubstitution> = {}): LabBreedSubstitution => ({
  requestedBreedCode: 'LABRADOR_RETRIEVER',
  usedBreedCode: 'CANINE_OTHER',
  usedTargetCode: 'CANINE',
  reason: 'UNMAPPED_BREED',
  ...overrides,
});

const meta = {
  title: 'Appointments/BreedSubstitutionNotice',
  component: BreedSubstitutionNotice,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Says which breed code actually reached the lab when it is not the one on the ' +
          "companion's record.\n\n" +
          'The substitution has always been recorded on the order - `resolveIdexxBreedCode` ' +
          'produces it and both the create and update paths persist it - but nothing displayed ' +
          'it, so a clinician reading the order back saw the breed they had chosen with no ' +
          'indication that a different code was transmitted. That is a clinical claim about the ' +
          'animal, and the requisition is what the lab acts on.\n\n' +
          '`MISMATCHED_BREED` is styled apart from the other two on purpose. `UNMAPPED_BREED` ' +
          "and `UNCODED_BREED` are gaps in the provider's vocabulary and nothing is wrong with " +
          "the record; a mismatch means the companion's stored breed code disagrees with its " +
          'species, which is a defect on the patient record that someone should correct.',
      },
    },
  },
  tags: ['autodocs'],
  args: { substitution: substitution() },
} satisfies Meta<typeof BreedSubstitutionNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

const notice = (canvasElement: HTMLElement) =>
  within(canvasElement).getByRole('note', { name: 'Breed substitution' });

export const UnmappedBreed: Story = {
  name: 'The lab has no code for this breed',
  play: async ({ canvasElement }) => {
    await expect(notice(canvasElement)).toHaveTextContent('CANINE_OTHER');
    await expect(notice(canvasElement)).toHaveTextContent('LABRADOR_RETRIEVER');
  },
};

export const UncodedBreed: Story = {
  name: 'The companion has no breed code at all',
  args: {
    substitution: substitution({ reason: 'UNCODED_BREED', requestedBreedCode: null }),
  },
  play: async ({ canvasElement }) => {
    // Nothing was requested, so the "recorded breed" clause is omitted rather
    // than printed empty.
    await expect(notice(canvasElement)).not.toHaveTextContent('recorded breed:');
  },
};

export const MismatchedBreed: Story = {
  name: 'Mismatch - a defect on the patient record',
  args: { substitution: substitution({ reason: 'MISMATCHED_BREED' }) },
  play: async ({ canvasElement }) => {
    await expect(notice(canvasElement)).toHaveTextContent('Breed code does not match the species');
    await expect(notice(canvasElement)).toHaveTextContent(
      'Correct the breed on the companion record'
    );
  },
};

export const NoSubstitution: Story = {
  name: 'No substitution - nothing is shown',
  args: { substitution: null },
  play: async ({ canvasElement }) => {
    // An order whose breed went through untouched must carry no notice at all.
    await expect(
      within(canvasElement).queryByRole('note', { name: 'Breed substitution' })
    ).not.toBeInTheDocument();
  },
};
