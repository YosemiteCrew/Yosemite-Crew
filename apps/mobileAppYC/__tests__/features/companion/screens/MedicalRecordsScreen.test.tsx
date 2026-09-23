import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import {mockTheme} from '../../../setup/mockTheme';
import {MedicalRecordsScreen} from '@/features/companion/screens/MedicalRecordsScreen';
import {medicalRecordApi} from '@/features/companion/services/medicalRecordService';
import {getFreshStoredTokens} from '@/features/auth/sessionManager';
import en from '@/localization/resources/en/common.json';
import es from '@/localization/resources/es/common.json';

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));
const mockTranslation = {
  t: (key: string, values?: {date?: string; defaultValue?: string}) =>
    values?.date
      ? `${key}:${values.date}`
      : /^medicalRecords\.(labels|problemLabels)\./.test(key)
        ? `translated:${key}`
        : (values?.defaultValue ?? key),
};
jest.mock('react-i18next', () => ({useTranslation: () => mockTranslation}));
jest.mock('@/features/auth/sessionManager', () => ({
  getFreshStoredTokens: jest.fn(),
}));
jest.mock('@/features/companion/services/medicalRecordService', () => ({
  medicalRecordApi: {fetchAllergies: jest.fn(), fetchProblems: jest.fn()},
}));
jest.mock('@/shared/components/common/SafeArea/SafeArea', () => ({
  SafeArea: ({children}: {children: React.ReactNode}) => {
    const RN = require('react-native');
    return <RN.View>{children}</RN.View>;
  },
}));
jest.mock('@/shared/components/common/Header/Header', () => ({
  Header: ({title, onBack}: {title: string; onBack?: () => void}) => {
    const RN = require('react-native');
    return <RN.Text onPress={onBack}>{title}</RN.Text>;
  },
}));
jest.mock('@/shared/components/common', () => ({
  GifLoader: () => {
    const RN = require('react-native');
    return <RN.Text>loading</RN.Text>;
  },
}));

const mockTokens = getFreshStoredTokens as jest.Mock;
const mockFetchAllergies = medicalRecordApi.fetchAllergies as jest.Mock;
const mockFetchProblems = medicalRecordApi.fetchProblems as jest.Mock;

const navigation = {goBack: jest.fn()};
const route = {params: {companionId: 'pet-1'}};

const renderFor = (companionId: string) => (
  <MedicalRecordsScreen
    navigation={navigation as never}
    route={{params: {companionId}} as never}
  />
);

const allergy = (allergen: string) => ({
  id: allergen,
  allergen,
  allergyType: 'FOOD',
  severity: 'MILD',
  status: 'ACTIVE',
});

const deferred = () => {
  let resolve!: (value: unknown[]) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<unknown[]>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {promise, resolve, reject};
};

describe('MedicalRecordsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTokens.mockResolvedValue({accessToken: 'token'});
    mockFetchAllergies.mockResolvedValue([]);
    mockFetchProblems.mockResolvedValue([]);
  });

  it('renders current allergies and problems with their safety status', async () => {
    mockFetchAllergies.mockResolvedValue([
      {
        id: 'a1',
        allergen: 'Chicken',
        allergyType: 'FOOD',
        severity: 'SEVERE',
        status: 'UNCONFIRMED',
        reaction: 'Hives',
      },
    ]);
    mockFetchProblems.mockResolvedValue([
      {
        id: 'p1',
        name: 'Arthritis',
        status: 'INACTIVE',
        severity: 'MODERATE',
        onsetDate: '2024-03-04',
      },
    ]);

    render(
      <MedicalRecordsScreen
        navigation={navigation as never}
        route={route as never}
      />,
    );

    await waitFor(() => expect(screen.getByText('Chicken')).toBeTruthy());
    expect(screen.getByText('Hives')).toBeTruthy();
    expect(screen.getByText('Arthritis')).toBeTruthy();
    expect(screen.getByText(/^medicalRecords\.since:.*2024/)).toBeTruthy();
    expect(screen.getByText(/medicalRecords\.suspected/)).toBeTruthy();
    expect(screen.getByText(/medicalRecords\.dormant/)).toBeTruthy();
    expect(
      screen.getByText(/translated:medicalRecords\.labels\.SEVERE/),
    ).toBeTruthy();
    expect(
      screen.getByText(/translated:medicalRecords\.problemLabels\.MODERATE/),
    ).toBeTruthy();
    expect(screen.queryByText(/medicalRecords\.labels\.MODERATE/)).toBeNull();
    expect(mockFetchAllergies).toHaveBeenCalledWith('pet-1', 'token');
    expect(mockFetchProblems).toHaveBeenCalledWith('pet-1', 'token');
  });

  it('shows empty states when no records exist', async () => {
    render(
      <MedicalRecordsScreen
        navigation={navigation as never}
        route={route as never}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('medicalRecords.noAllergies')).toBeTruthy(),
    );
    expect(screen.getByText('medicalRecords.noProblems')).toBeTruthy();
  });

  it('shows translated load copy and offers retry for transport failures', async () => {
    mockFetchAllergies.mockRejectedValue(new Error('Forbidden'));

    render(
      <MedicalRecordsScreen
        navigation={navigation as never}
        route={route as never}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('medicalRecords.loadFailed')).toBeTruthy(),
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(
      screen.getByRole('button', {name: 'medicalRecords.retry'}),
    ).toBeTruthy();
  });

  it('asks an unauthenticated owner to sign in without exposing a retry loop', async () => {
    mockTokens.mockResolvedValue(null);

    render(
      <MedicalRecordsScreen
        navigation={navigation as never}
        route={route as never}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('medicalRecords.signInAgain')).toBeTruthy(),
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(mockFetchAllergies).not.toHaveBeenCalled();
  });

  it('renders optional dates, reactions, and active records safely', async () => {
    mockFetchAllergies.mockResolvedValue([
      {
        id: 'a2',
        allergen: 'Dust',
        allergyType: 'OTHER',
        severity: 'MILD',
        status: 'CONFIRMED',
        onsetDate: '2025-01-02',
      },
    ]);
    mockFetchProblems.mockResolvedValue([
      {
        id: 'p2',
        name: 'Cough',
        status: 'ACTIVE',
        severity: undefined,
        onsetDate: 'bad-date',
      },
    ]);
    render(
      <MedicalRecordsScreen
        navigation={navigation as never}
        route={route as never}
      />,
    );
    await waitFor(() => expect(screen.getByText('Dust')).toBeTruthy());
    await waitFor(() => expect(screen.getByText('Cough')).toBeTruthy());
    expect(screen.getByText(/medicalRecords\.active/)).toBeTruthy();
    expect(
      screen.getByText(
        /medicalRecords\.since:1\/2\/2025|medicalRecords\.since:02\/01\/2025/,
      ),
    ).toBeTruthy();
  });

  it('retries a failed load and renders the recovered records', async () => {
    mockFetchAllergies
      .mockRejectedValueOnce(new Error('Forbidden'))
      .mockResolvedValueOnce([
        {
          id: 'a3',
          allergen: 'Beef',
          allergyType: 'FOOD',
          severity: 'MILD',
          status: 'CONFIRMED',
        },
      ]);
    render(
      <MedicalRecordsScreen
        navigation={navigation as never}
        route={route as never}
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', {name: 'medicalRecords.retry'}),
      ).toBeTruthy(),
    );
    fireEvent.press(screen.getByRole('button', {name: 'medicalRecords.retry'}));
    await waitFor(() => expect(screen.getByText('Beef')).toBeTruthy());
  });

  it('never shows a slow response for the previous companion', async () => {
    const pet1 = deferred();
    mockFetchAllergies.mockImplementation((id: string) =>
      id === 'pet-1' ? pet1.promise : Promise.resolve([allergy('Beef')]),
    );
    const view = render(renderFor('pet-1'));
    await waitFor(() =>
      expect(mockFetchAllergies).toHaveBeenCalledWith('pet-1', 'token'),
    );

    view.rerender(renderFor('pet-2'));
    await waitFor(() => expect(screen.getByText('Beef')).toBeTruthy());
    await act(async () => pet1.resolve([allergy('Chicken')]));

    expect(screen.queryByText('Chicken')).toBeNull();
    expect(screen.getByText('Beef')).toBeTruthy();
  });

  it('never shows a late failure for the previous companion', async () => {
    const pet1 = deferred();
    mockFetchAllergies.mockImplementation((id: string) =>
      id === 'pet-1' ? pet1.promise : Promise.resolve([allergy('Beef')]),
    );
    const view = render(renderFor('pet-1'));
    await waitFor(() =>
      expect(mockFetchAllergies).toHaveBeenCalledWith('pet-1', 'token'),
    );

    view.rerender(renderFor('pet-2'));
    await waitFor(() => expect(screen.getByText('Beef')).toBeTruthy());
    await act(async () => pet1.reject(new Error('timeout')));

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('medicalRecords.loadFailed')).toBeNull();
    expect(screen.getByText('Beef')).toBeTruthy();
  });

  it('hides the previous companion records while the next one loads', async () => {
    const pet2 = deferred();
    mockFetchAllergies.mockImplementation((id: string) =>
      id === 'pet-1' ? Promise.resolve([allergy('Chicken')]) : pet2.promise,
    );
    const view = render(renderFor('pet-1'));
    await waitFor(() => expect(screen.getByText('Chicken')).toBeTruthy());

    view.rerender(renderFor('pet-2'));

    expect(screen.queryByText('Chicken')).toBeNull();
    expect(screen.getByText('loading')).toBeTruthy();
    await act(async () => pet2.resolve([allergy('Beef')]));
    expect(screen.getByText('Beef')).toBeTruthy();
    expect(screen.queryByText('Chicken')).toBeNull();
  });

  it('has a problem severity label for every value in both locales', () => {
    for (const severity of ['MILD', 'MODERATE', 'SEVERE'] as const) {
      expect(en.medicalRecords.problemLabels[severity]).toBeTruthy();
      expect(es.medicalRecords.problemLabels[severity]).toBeTruthy();
    }
    // "el problema" is masculine; the allergy label agrees with "la alergia".
    expect(es.medicalRecords.problemLabels.MODERATE).toBe('Moderado');
    expect(es.medicalRecords.labels.MODERATE).toBe('Moderada');
  });

  it('uses the header back action to leave the screen', async () => {
    render(
      <MedicalRecordsScreen
        navigation={navigation as never}
        route={route as never}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText('medicalRecords.noAllergies')).toBeTruthy(),
    );
    fireEvent.press(screen.getByText('medicalRecords.title'));
    expect(navigation.goBack).toHaveBeenCalled();
  });
});
