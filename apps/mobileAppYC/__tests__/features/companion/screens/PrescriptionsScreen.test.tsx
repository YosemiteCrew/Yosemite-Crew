import React from 'react';
import {Alert} from 'react-native';
import {
  render,
  fireEvent,
  screen,
  waitFor,
} from '@testing-library/react-native';
import {mockTheme} from '../../../setup/mockTheme';
import {PrescriptionsScreen} from '@/features/companion/screens/PrescriptionsScreen';
import {prescriptionApi} from '@/features/companion/services/prescriptionService';
import {getFreshStoredTokens} from '@/features/auth/sessionManager';

const mockTranslation = {
  t: (key: string, values?: {date?: string}) =>
    values?.date ? `${key}:${values.date}` : key,
};
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));
jest.mock('react-i18next', () => ({useTranslation: () => mockTranslation}));
jest.mock('@/features/auth/sessionManager', () => ({
  getFreshStoredTokens: jest.fn(),
}));
jest.mock('@/features/companion/services/prescriptionService', () => ({
  prescriptionApi: {list: jest.fn(), requestRefill: jest.fn()},
}));
jest.mock('@/shared/components/common/SafeArea/SafeArea', () => ({
  SafeArea: ({children}: {children: React.ReactNode}) => {
    const RN = require('react-native');
    return <RN.View>{children}</RN.View>;
  },
}));
jest.mock('@/shared/components/common/Header/Header', () => ({
  Header: ({title}: {title: string}) => {
    const RN = require('react-native');
    return <RN.Text>{title}</RN.Text>;
  },
}));
jest.mock('@/shared/components/common', () => ({
  GifLoader: () => {
    const RN = require('react-native');
    return <RN.Text>loading</RN.Text>;
  },
}));

const mockTokens = getFreshStoredTokens as jest.Mock;
const mockList = prescriptionApi.list as jest.Mock;
const mockRequest = prescriptionApi.requestRefill as jest.Mock;
const route = {params: {companionId: 'pet-1'}};
const navigation = {goBack: jest.fn()};
const prescription = {
  id: 'rx-1',
  patientId: 'pet-1',
  encounterId: 'enc-1',
  organisationId: 'org-1',
  status: 'SIGNED',
  createdAt: '2026-01-01T00:00:00Z',
  items: [
    {
      id: 'item-1',
      medication: 'Amoxicillin',
      dosage: '10mg',
      frequency: 'Daily',
    },
  ],
};

describe('PrescriptionsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockTokens.mockResolvedValue({accessToken: 'token'});
    mockList.mockResolvedValue([
      prescription,
      {
        ...prescription,
        id: 'rx-other',
        patientId: 'pet-2',
        items: [{...prescription.items[0], medication: 'Metronidazole'}],
      },
    ]);
    mockRequest.mockResolvedValue(undefined);
  });

  it('filters the owner prescription list to the selected companion', async () => {
    render(
      <PrescriptionsScreen
        navigation={navigation as never}
        route={route as never}
      />,
    );
    await waitFor(() =>
      expect(screen.getAllByText('Amoxicillin').length).toBeGreaterThan(0),
    );
    expect(screen.getByText('prescriptions.recorded:1/1/2026')).toBeTruthy();
    expect(screen.queryByText('Metronidazole')).toBeNull();
  });

  it('requests a refill for the selected prescription', async () => {
    render(
      <PrescriptionsScreen
        navigation={navigation as never}
        route={route as never}
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', {name: 'prescriptions.requestRefill'}),
      ).toBeTruthy(),
    );
    fireEvent.press(
      screen.getByRole('button', {name: 'prescriptions.requestRefill'}),
    );
    await waitFor(() =>
      expect(mockRequest).toHaveBeenCalledWith('rx-1', 'token'),
    );
    expect(Alert.alert).toHaveBeenCalledWith(
      'prescriptions.refillRequestedTitle',
      'prescriptions.refillRequestedBody',
    );
  });

  it('shows a translated load error for transport failures', async () => {
    mockList.mockRejectedValue(new Error('Forbidden'));
    render(
      <PrescriptionsScreen
        navigation={navigation as never}
        route={route as never}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText('prescriptions.loadFailed')).toBeTruthy(),
    );
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
