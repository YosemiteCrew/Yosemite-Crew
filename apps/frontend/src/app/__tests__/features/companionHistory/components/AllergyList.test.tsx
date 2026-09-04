import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import AllergyList from '@/app/features/companionHistory/components/AllergyList';
import type { PatientAllergy } from '@/app/features/companionHistory/services/patientAllergyService';

const allergy = (
  over: Partial<PatientAllergy> & { id: string; allergen: string }
): PatientAllergy => ({
  organisationId: 'org-1',
  patientId: 'pat-1',
  allergyType: 'DRUG',
  severity: 'MILD',
  reaction: null,
  status: 'ACTIVE',
  onsetDate: null,
  resolvedDate: null,
  notes: null,
  recordedBy: null,
  createdAt: '2026-01-10T09:00:00.000Z',
  updatedAt: '2026-01-10T09:00:00.000Z',
  ...over,
});

const ALLERGIES: PatientAllergy[] = [
  allergy({
    id: 'a-1',
    allergen: 'Penicillin',
    status: 'ACTIVE',
    severity: 'LIFE_THREATENING',
    allergyType: 'DRUG',
    reaction: 'Anaphylaxis',
    onsetDate: '2025-11-02T00:00:00.000Z',
  }),
  allergy({
    id: 'a-2',
    allergen: 'Chicken protein',
    status: 'ACTIVE',
    severity: 'MODERATE',
    allergyType: 'FOOD',
    notes: 'Switch to hydrolysed diet.',
  }),
  allergy({
    id: 'a-3',
    allergen: 'Flea saliva',
    status: 'RESOLVED',
    severity: 'MODERATE',
    resolvedDate: '2025-08-20T00:00:00.000Z',
  }),
];

describe('AllergyList', () => {
  it('renders active and resolved allergies with status and severity pills', () => {
    render(<AllergyList allergies={ALLERGIES} canEdit />);

    expect(screen.getByText('Penicillin')).toBeInTheDocument();
    expect(screen.getByText('Flea saliva')).toBeInTheDocument();

    // Status pills: two active, one resolved.
    expect(screen.getAllByText('Active')).toHaveLength(2);
    expect(screen.getByText('Resolved')).toBeInTheDocument();

    // Severity labels, with LIFE_THREATENING reading as its own label.
    expect(screen.getByText('Life-threatening')).toBeInTheDocument();
    expect(screen.getAllByText('Moderate')).toHaveLength(2);

    // Reaction, notes and onset metadata rendered.
    expect(screen.getByText(/Reaction: Anaphylaxis/)).toBeInTheDocument();
    expect(screen.getByText('Switch to hydrolysed diet.')).toBeInTheDocument();
    expect(screen.getByText(/Onset\b.*2025/)).toBeInTheDocument();

    // Active count summary.
    expect(screen.getByText('2 active')).toBeInTheDocument();
  });

  it('shows a resolve action only for active allergies and fires onResolve', async () => {
    const onResolve = jest.fn();
    render(<AllergyList allergies={ALLERGIES} canEdit onResolve={onResolve} />);

    const resolveButtons = screen.getAllByRole('button', { name: /^Resolve / });
    // Only the two ACTIVE allergies get a resolve control, not the RESOLVED one.
    expect(resolveButtons).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: 'Resolve Penicillin' }));
    expect(onResolve).toHaveBeenCalledWith(expect.objectContaining({ id: 'a-1' }));
  });

  it('opens the add form and submits collected values, then closes on success', async () => {
    const onCreate = jest.fn().mockResolvedValue(true);
    render(<AllergyList allergies={ALLERGIES} canEdit onCreate={onCreate} />);

    // Form is hidden until the affordance is used.
    expect(screen.queryByLabelText('Allergen')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Add allergy/ }));

    const allergenInput = screen.getByLabelText('Allergen');
    expect(allergenInput).toBeInTheDocument();

    await userEvent.type(allergenInput, 'Latex');
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'ENVIRONMENTAL');
    await userEvent.selectOptions(screen.getByLabelText('Severity'), 'SEVERE');
    await userEvent.type(screen.getByLabelText('Reaction'), 'Contact dermatitis');
    fireEvent.change(screen.getByLabelText('Onset date'), { target: { value: '2026-02-01' } });
    await userEvent.type(screen.getByLabelText('Notes'), 'Gloves only');

    await userEvent.click(screen.getByRole('button', { name: 'Save allergy' }));

    expect(onCreate).toHaveBeenCalledWith({
      allergen: 'Latex',
      allergyType: 'ENVIRONMENTAL',
      severity: 'SEVERE',
      reaction: 'Contact dermatitis',
      onsetDate: '2026-02-01',
      notes: 'Gloves only',
    });

    // A resolved create clears and closes the form.
    await waitFor(() => expect(screen.queryByLabelText('Allergen')).not.toBeInTheDocument());
  });

  it('keeps the form open when the create fails', async () => {
    const onCreate = jest.fn().mockResolvedValue(false);
    render(<AllergyList allergies={[]} canEdit onCreate={onCreate} />);

    await userEvent.click(screen.getByRole('button', { name: /Add allergy/ }));
    await userEvent.type(screen.getByLabelText('Allergen'), 'Retry me');
    await userEvent.click(screen.getByRole('button', { name: 'Save allergy' }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Allergen')).toBeInTheDocument();
  });

  it('renders the empty state when there are no allergies', () => {
    render(<AllergyList allergies={[]} canEdit />);
    expect(screen.getByText(/No allergies recorded/)).toBeInTheDocument();
    expect(screen.queryByText('2 active')).not.toBeInTheDocument();
  });

  it('renders a loading skeleton instead of the empty copy', () => {
    render(<AllergyList allergies={[]} loading canEdit />);
    expect(screen.queryByText(/No allergies recorded/)).not.toBeInTheDocument();
  });

  it('surfaces an error banner', () => {
    render(
      <AllergyList allergies={[]} error="Could not load the allergy list. Please try again." />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load the allergy list');
  });

  it('hides the add and resolve controls when the member cannot edit', () => {
    render(<AllergyList allergies={ALLERGIES} canEdit={false} />);
    expect(screen.queryByRole('button', { name: /Add allergy/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Resolve / })).not.toBeInTheDocument();
  });
});
