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

// The screen runs the real useMedicalRecords hook and the real record cards;
// only the session, the API and the chrome around the body are mocked.
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));
const mockTranslation = {
  t: (key: string, values?: {date?: string}) =>
    values?.date ? `${key}:${values.date}` : key,
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
  const promise = new Promise<unknown[]>(res => {
    resolve = res;
  });
  return {promise, resolve};
};

describe('MedicalRecordsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTokens.mockResolvedValue({accessToken: 'token'});
    mockFetchAllergies.mockResolvedValue([]);
    mockFetchProblems.mockResolvedValue([]);
  });

  it('lays out the allergies and problems for the companion', async () => {
    mockFetchAllergies.mockResolvedValue([allergy('Chicken')]);
    mockFetchProblems.mockResolvedValue([
      {id: 'p1', name: 'Arthritis', status: 'INACTIVE'},
    ]);

    render(renderFor('pet-1'));

    expect(screen.getByText('loading')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Chicken')).toBeTruthy());
    expect(screen.getByText('Arthritis')).toBeTruthy();
    expect(screen.getAllByRole('header')).toHaveLength(2);
    expect(screen.getByText('medicalRecords.intro')).toBeTruthy();
    expect(screen.getByText('medicalRecords.flagsNotice')).toBeTruthy();
    expect(screen.queryByText('medicalRecords.noAllergies')).toBeNull();
    expect(screen.queryByText('medicalRecords.noProblems')).toBeNull();
    expect(mockFetchAllergies).toHaveBeenCalledWith('pet-1', 'token');
  });

  it('shows empty states when no records exist', async () => {
    render(renderFor('pet-1'));

    await waitFor(() =>
      expect(screen.getByText('medicalRecords.noAllergies')).toBeTruthy(),
    );
    expect(screen.getByText('medicalRecords.noProblems')).toBeTruthy();
  });

  it('shows translated load copy and retries into the recovered records', async () => {
    mockFetchAllergies
      .mockRejectedValueOnce(new Error('Request failed with status code 403'))
      .mockResolvedValueOnce([allergy('Beef')]);

    render(renderFor('pet-1'));

    await waitFor(() =>
      expect(screen.getByText('medicalRecords.loadFailed')).toBeTruthy(),
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByText(/status code 403/)).toBeNull();
    fireEvent.press(screen.getByRole('button', {name: 'medicalRecords.retry'}));
    await waitFor(() => expect(screen.getByText('Beef')).toBeTruthy());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('asks an unauthenticated owner to sign in without exposing a retry loop', async () => {
    mockTokens.mockResolvedValue(null);

    render(renderFor('pet-1'));

    await waitFor(() =>
      expect(screen.getByText('medicalRecords.signInAgain')).toBeTruthy(),
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(mockFetchAllergies).not.toHaveBeenCalled();
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

  it('uses the header back action to leave the screen', async () => {
    render(renderFor('pet-1'));
    await waitFor(() =>
      expect(screen.getByText('medicalRecords.noAllergies')).toBeTruthy(),
    );
    fireEvent.press(screen.getByText('medicalRecords.title'));
    expect(navigation.goBack).toHaveBeenCalled();
  });
});
