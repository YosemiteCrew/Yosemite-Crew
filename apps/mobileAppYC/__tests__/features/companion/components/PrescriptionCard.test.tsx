import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react-native';
import {mockTheme} from '../../../setup/mockTheme';
import {PrescriptionCard} from '@/features/companion/components/PrescriptionCard';
import type {MobilePrescription} from '@/features/companion/services/prescriptionService';

// Interpolation values are appended to the key so a test can see which
// medication or date reached the label without depending on real copy.
const mockTranslation = {
  t: (key: string, values?: Record<string, string>) =>
    values ? `${key}:${Object.values(values).join('|')}` : key,
};
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));
jest.mock('react-i18next', () => ({useTranslation: () => mockTranslation}));

const CREATED_AT = '2026-01-15T12:00:00Z';
const SIGNED_AT = '2026-02-20T12:00:00Z';
const prescription: MobilePrescription = {
  id: 'rx-1',
  patientId: 'pet-1',
  encounterId: 'enc-1',
  organisationId: 'org-1',
  status: 'SIGNED',
  createdAt: CREATED_AT,
  items: [
    {
      id: 'item-1',
      medication: 'Amoxicillin',
      dosage: '10mg',
      frequency: 'Daily',
    },
  ],
};
const REFILL_AMOXICILLIN = 'prescriptions.requestRefillFor:Amoxicillin';

const renderCard = (
  overrides: Partial<MobilePrescription> = {},
  isRequesting = false,
) => {
  const onRequestRefill = jest.fn();
  render(
    <PrescriptionCard
      prescription={{...prescription, ...overrides}}
      isRequesting={isRequesting}
      onRequestRefill={onRequestRefill}
    />,
  );
  return onRequestRefill;
};

describe('PrescriptionCard', () => {
  it('renders the medication, dose line and recorded date', () => {
    renderCard();

    expect(screen.getAllByText('Amoxicillin')).toHaveLength(2);
    expect(screen.getByText('10mg · Daily')).toBeTruthy();
    expect(
      screen.getByText(
        `prescriptions.recorded:${new Date(CREATED_AT).toLocaleDateString()}`,
      ),
    ).toBeTruthy();
    expect(screen.getByText('prescriptions.requestRefill')).toBeTruthy();
  });

  it('renders the optional summary, strength, route and instructions, dated by signature', () => {
    renderCard({
      summary: 'Post-op course',
      signedAt: SIGNED_AT,
      items: [
        {
          id: 'item-1',
          medication: 'Meloxicam',
          strength: '1.5mg/ml',
          dosage: '0.1ml',
          route: 'Oral',
          frequency: 'Once daily',
          instructions: 'Give with food',
        },
        {id: 'item-2', medication: 'Gabapentin'},
      ],
    });

    expect(screen.getByText('Meloxicam, Gabapentin')).toBeTruthy();
    expect(screen.getByText('Post-op course')).toBeTruthy();
    expect(screen.getByText('Meloxicam · 1.5mg/ml')).toBeTruthy();
    expect(screen.getByText('0.1ml · Oral · Once daily')).toBeTruthy();
    expect(screen.getByText('Give with food')).toBeTruthy();
    expect(
      screen.getByText(
        `prescriptions.recorded:${new Date(SIGNED_AT).toLocaleDateString()}`,
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'prescriptions.requestRefillFor:Meloxicam, Gabapentin',
      }),
    ).toBeTruthy();
  });

  it('omits the recorded line when the date is unparseable', () => {
    renderCard({createdAt: 'not-a-date'});

    expect(screen.queryByText(/prescriptions\.recorded/)).toBeNull();
  });

  it('names the medication in an idle, enabled refill button and passes the id on press', () => {
    const onRequestRefill = renderCard();

    const button = screen.getByRole('button', {name: REFILL_AMOXICILLIN});
    expect(button.props.accessibilityState).toEqual({
      disabled: false,
      busy: false,
    });

    fireEvent.press(button);
    expect(onRequestRefill).toHaveBeenCalledWith('rx-1');
  });

  it('announces the in-flight state and ignores presses while requesting', () => {
    const onRequestRefill = renderCard({}, true);

    const button = screen.getByRole('button', {
      name: 'prescriptions.requestingFor:Amoxicillin',
    });
    expect(button.props.accessibilityState).toEqual({
      disabled: true,
      busy: true,
    });
    expect(screen.getByText('prescriptions.requesting')).toBeTruthy();

    fireEvent.press(button);
    expect(onRequestRefill).not.toHaveBeenCalled();
  });
});
