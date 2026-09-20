import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import BreedSubstitutionNotice from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/BreedSubstitutionNotice';
import type { LabBreedSubstitution } from '@/app/features/integrations/services/types';

const substitution = (overrides: Partial<LabBreedSubstitution> = {}): LabBreedSubstitution => ({
  requestedBreedCode: 'LABRADOR_RETRIEVER',
  usedBreedCode: 'CANINE_OTHER',
  usedTargetCode: 'CANINE',
  reason: 'UNMAPPED_BREED',
  ...overrides,
});

const notice = () => screen.getByRole('note', { name: 'Breed substitution' });

describe('BreedSubstitutionNotice', () => {
  it('renders nothing when the order carries no substitution', () => {
    const { container } = render(<BreedSubstitutionNotice substitution={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the field is absent altogether', () => {
    const { container } = render(<BreedSubstitutionNotice substitution={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('names both the code that was sent and the breed on the record', () => {
    render(<BreedSubstitutionNotice substitution={substitution()} />);

    // The whole point: the order reads back showing the breed the clinician
    // chose, while the requisition named something else.
    expect(notice()).toHaveTextContent('CANINE_OTHER');
    expect(notice()).toHaveTextContent('LABRADOR_RETRIEVER');
  });

  it.each([
    ['UNMAPPED_BREED', 'the lab has no code for this breed'],
    ['UNCODED_BREED', 'no breed code is recorded for this companion'],
    ['MISMATCHED_BREED', "the companion's breed code does not match its species"],
  ] as const)('explains %s', (reason, expected) => {
    render(<BreedSubstitutionNotice substitution={substitution({ reason })} />);
    expect(notice()).toHaveTextContent(expected);
  });

  it('distinguishes a mismatch from a mapping gap', () => {
    // MISMATCHED_BREED is a defect on the patient record, not a gap in the
    // provider's vocabulary, so it must not read like the other two.
    const { unmount } = render(
      <BreedSubstitutionNotice substitution={substitution({ reason: 'MISMATCHED_BREED' })} />
    );
    expect(notice()).toHaveTextContent('Breed code does not match the species');
    expect(notice()).toHaveTextContent('Correct the breed on the companion record');
    expect(notice().className).toContain('bg-danger-100');
    unmount();

    render(<BreedSubstitutionNotice substitution={substitution({ reason: 'UNMAPPED_BREED' })} />);
    expect(notice()).toHaveTextContent('A different breed code was sent');
    expect(notice()).not.toHaveTextContent('Correct the breed on the companion record');
    expect(notice().className).not.toContain('bg-danger-100');
  });

  it('omits the recorded-breed clause when there is no recorded code', () => {
    render(
      <BreedSubstitutionNotice
        substitution={substitution({ reason: 'UNCODED_BREED', requestedBreedCode: null })}
      />
    );

    expect(notice()).toHaveTextContent('no breed code is recorded for this companion');
    expect(notice()).not.toHaveTextContent('recorded breed:');
  });
});
