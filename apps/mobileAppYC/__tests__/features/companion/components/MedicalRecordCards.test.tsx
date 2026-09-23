import React from 'react';
import {render, screen} from '@testing-library/react-native';
import {mockTheme} from '../../../setup/mockTheme';
import {
  AllergyCard,
  ProblemCard,
} from '@/features/companion/components/MedicalRecordCards';
import en from '@/localization/resources/en/common.json';
import es from '@/localization/resources/es/common.json';

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// Like i18next: a key in the catalogue renders as itself, so the assertions
// name the key; a key that is missing falls back to `defaultValue`.
const inCatalogue = (key: string): boolean =>
  key
    .split('.')
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      en,
    ) !== undefined;
const mockTranslation = {
  t: (key: string, values?: {date?: string; defaultValue?: string}) => {
    if (values?.date) return `${key}:${values.date}`;
    return inCatalogue(key) ? key : (values?.defaultValue ?? key);
  },
};
jest.mock('react-i18next', () => ({useTranslation: () => mockTranslation}));

const baseAllergy = {
  id: 'a1',
  allergen: 'Chicken',
  allergyType: 'FOOD',
  severity: 'SEVERE',
  status: 'ACTIVE' as const,
  recordedAt: '2025-01-01T00:00:00.000Z',
};
const baseProblem = {
  id: 'p1',
  name: 'Arthritis',
  status: 'ACTIVE' as const,
  recordedAt: '2025-01-01T00:00:00.000Z',
};
const since = (year: string) => new RegExp(`^medicalRecords\\.since:.*${year}`);

describe('AllergyCard', () => {
  it('shows a suspected allergy with its severity, type, reaction and onset', () => {
    render(
      <AllergyCard
        allergy={{
          ...baseAllergy,
          status: 'UNCONFIRMED',
          reaction: 'Hives',
          onsetDate: '2025-01-02',
        }}
      />,
    );

    expect(screen.getByText('Chicken')).toBeTruthy();
    expect(
      screen.getByText(
        'medicalRecords.labels.SEVERE · medicalRecords.labels.FOOD · medicalRecords.suspected',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Hives')).toBeTruthy();
    expect(screen.getByText(since('2025'))).toBeTruthy();
  });

  it('leaves out suspected, reaction and onset when the record has none', () => {
    render(<AllergyCard allergy={{...baseAllergy, onsetDate: 'bad-date'}} />);

    expect(
      screen.getByText(
        'medicalRecords.labels.SEVERE · medicalRecords.labels.FOOD',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/medicalRecords\.suspected/)).toBeNull();
    expect(screen.queryByText(/medicalRecords\.since/)).toBeNull();
  });

  it('falls back to readable English for a value the catalogue lacks', () => {
    render(
      <AllergyCard allergy={{...baseAllergy, allergyType: 'INSECT_BITE'}} />,
    );

    expect(
      screen.getByText('medicalRecords.labels.SEVERE · Insect Bite'),
    ).toBeTruthy();
  });
});

describe('ProblemCard', () => {
  it('shows a dormant problem with its own severity label and onset', () => {
    render(
      <ProblemCard
        problem={{
          ...baseProblem,
          status: 'INACTIVE',
          severity: 'MODERATE',
          onsetDate: '2024-03-04',
        }}
      />,
    );

    expect(screen.getByText('Arthritis')).toBeTruthy();
    expect(
      screen.getByText(
        'medicalRecords.dormant · medicalRecords.problemLabels.MODERATE',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/medicalRecords\.labels\./)).toBeNull();
    expect(screen.getByText(since('2024'))).toBeTruthy();
  });

  it('shows an active problem with no severity and no readable onset', () => {
    render(<ProblemCard problem={{...baseProblem, onsetDate: 'bad-date'}} />);

    expect(screen.getByText('medicalRecords.active')).toBeTruthy();
    expect(screen.queryByText(/medicalRecords\.since/)).toBeNull();
  });

  it('has a severity label for every problem severity in both locales', () => {
    for (const severity of ['MILD', 'MODERATE', 'SEVERE'] as const) {
      expect(en.medicalRecords.problemLabels[severity]).toBeTruthy();
      expect(es.medicalRecords.problemLabels[severity]).toBeTruthy();
    }
    // "el problema" is masculine; the allergy label agrees with "la alergia".
    expect(es.medicalRecords.problemLabels.MODERATE).toBe('Moderado');
    expect(es.medicalRecords.labels.MODERATE).toBe('Moderada');
  });
});
