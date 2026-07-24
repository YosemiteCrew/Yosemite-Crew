import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkspaceTreatmentSummary from '@/app/features/appointments/pages/AppointmentWorkspace/components/WorkspaceTreatmentSummary';

describe('WorkspaceTreatmentSummary', () => {
  it('sums treatment items and prescriptions into a running total with a carry-forward note', () => {
    render(
      <WorkspaceTreatmentSummary
        treatmentCount={2}
        treatmentCents={9000}
        prescriptionCount={2}
        prescriptionCents={3000}
        currency="USD"
      />
    );
    const card = screen.getByLabelText('Treatment summary');
    // app formats whole dollars (maximumFractionDigits: 0); running total = 9000 + 3000 = 12000
    expect(within(card).getByText(/\$120\b/)).toBeInTheDocument();
    expect(within(card).getByText(/2 .*\$90\b/)).toBeInTheDocument();
    expect(within(card).getByText(/2 .*\$30\b/)).toBeInTheDocument();
    expect(
      screen.getByText('2 treatment items + 2 prescriptions will be carried to the invoice step.')
    ).toBeInTheDocument();
  });

  it('pluralizes correctly for a single item and single prescription', () => {
    render(
      <WorkspaceTreatmentSummary
        treatmentCount={1}
        treatmentCents={5000}
        prescriptionCount={1}
        prescriptionCents={1000}
        currency="USD"
      />
    );
    expect(
      screen.getByText('1 treatment item + 1 prescription will be carried to the invoice step.')
    ).toBeInTheDocument();
  });

  it('prompts to add items when nothing has been built yet', () => {
    render(
      <WorkspaceTreatmentSummary
        treatmentCount={0}
        treatmentCents={0}
        prescriptionCount={0}
        prescriptionCents={0}
        currency="USD"
      />
    );
    expect(
      screen.getByText('Add treatment items or prescriptions to build the invoice.')
    ).toBeInTheDocument();
  });

  it('lists only the categories that have entries in the carry note', () => {
    render(
      <WorkspaceTreatmentSummary
        treatmentCount={3}
        treatmentCents={9000}
        prescriptionCount={0}
        prescriptionCents={0}
        currency="USD"
      />
    );
    expect(
      screen.getByText('3 treatment items will be carried to the invoice step.')
    ).toBeInTheDocument();
  });
});
