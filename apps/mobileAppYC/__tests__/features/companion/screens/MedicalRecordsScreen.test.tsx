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

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));
const mockTranslation = {
  t: (key: string, values?: {date?: string; defaultValue?: string}) =>
    values?.date
      ? `${key}:${values.date}`
      : key.startsWith('medicalRecords.labels.')
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
      {id: 'p1', name: 'Arthritis', status: 'INACTIVE', severity: 'MODERATE'},
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
    expect(screen.getByText(/medicalRecords\.suspected/)).toBeTruthy();
    expect(screen.getByText(/medicalRecords\.dormant/)).toBeTruthy();
    expect(
      screen.getByText(/translated:medicalRecords\.labels\.SEVERE/),
    ).toBeTruthy();
    expect(
      screen.getByText(/translated:medicalRecords\.labels\.MODERATE/),
    ).toBeTruthy();
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

  it('ignores stale success and failure results after unmount', async () => {
    let resolveFetch!: (value: unknown[]) => void;
    let rejectFetch!: (error: Error) => void;
    mockFetchAllergies.mockImplementationOnce(
      () => new Promise(resolve => (resolveFetch = resolve)),
    );
    mockFetchProblems.mockImplementationOnce(
      () => new Promise((_resolve, reject) => (rejectFetch = reject)),
    );
    const view = render(
      <MedicalRecordsScreen
        navigation={navigation as never}
        route={route as never}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    view.unmount();
    await act(async () => {
      resolveFetch([
        {
          id: 'stale',
          allergen: 'Old',
          allergyType: 'FOOD',
          severity: 'MILD',
          status: 'ACTIVE',
        },
      ]);
      rejectFetch(new Error('stale failure'));
    });
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
