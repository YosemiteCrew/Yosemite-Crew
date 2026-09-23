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
import apiClient from '@/shared/services/apiClient';

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
jest.mock('@/features/auth/sessionManager', () => ({
  getFreshStoredTokens: jest.fn(),
}));
jest.mock('@/features/companion/services/prescriptionService', () => ({
  prescriptionApi: {list: jest.fn(), requestRefill: jest.fn()},
}));
jest.mock('@/shared/services/apiClient', () => ({
  __esModule: true,
  ...jest.requireActual('@/shared/services/apiClient'),
  default: {get: jest.fn(), post: jest.fn()},
}));
jest.mock('@/shared/components/common/SafeArea/SafeArea', () => ({
  SafeArea: ({children}: {children: React.ReactNode}) => {
    const RN = require('react-native');
    return <RN.View>{children}</RN.View>;
  },
}));
jest.mock('@/shared/components/common/Header/Header', () => ({
  Header: ({title, onBack}: {title: string; onBack: () => void}) => {
    const RN = require('react-native');
    return (
      <RN.Pressable accessibilityRole="button" onPress={onBack}>
        <RN.Text>{title}</RN.Text>
      </RN.Pressable>
    );
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
const CREATED_AT = '2026-01-15T12:00:00Z';
const prescription = {
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
// The first render in a worker is cold. On a loaded runner it can land just
// past RNTL's 1s default, so waits here state their own budget.
const WAIT = {timeout: 5000};

const renderScreen = () =>
  render(
    <PrescriptionsScreen
      navigation={navigation as never}
      route={route as never}
    />,
  );

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => {
    resolve = res;
  });
  return {promise, resolve};
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

  // #3576 review: the list spans every companion the owner has, so the
  // selected one's rows can all sit past page 1. Real service, mocked HTTP.
  it('shows a companion whose prescriptions are only on a later page', async () => {
    const {prescriptionApi: actualApi} = jest.requireActual(
      '@/features/companion/services/prescriptionService',
    );
    mockList.mockImplementation(actualApi.list);
    (apiClient.get as jest.Mock)
      .mockResolvedValueOnce({
        data: {
          prescriptions: [{...prescription, id: 'rx-9', patientId: 'pet-2'}],
          nextCursor: 'c1',
          hasMore: true,
          limit: 100,
        },
      })
      .mockResolvedValueOnce({
        data: {
          prescriptions: [prescription],
          nextCursor: null,
          hasMore: false,
          limit: 100,
        },
      });
    renderScreen();

    await screen.findByRole('button', {name: REFILL_AMOXICILLIN}, WAIT);
    expect(screen.queryByText('prescriptions.empty')).toBeNull();
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });

  it('shows the loader until the list resolves', async () => {
    const pending = deferred<(typeof prescription)[]>();
    mockList.mockReturnValue(pending.promise);
    renderScreen();

    expect(screen.getByText('loading')).toBeTruthy();
    pending.resolve([prescription]);
    await screen.findByRole('button', {name: REFILL_AMOXICILLIN}, WAIT);
    expect(screen.queryByText('loading')).toBeNull();
  });

  it('filters the owner prescription list to the selected companion', async () => {
    renderScreen();
    await waitFor(
      () =>
        expect(screen.getAllByText('Amoxicillin').length).toBeGreaterThan(0),
      WAIT,
    );
    expect(mockList).toHaveBeenCalledWith('token');
    expect(
      screen.getByText(
        `prescriptions.recorded:${new Date(CREATED_AT).toLocaleDateString()}`,
      ),
    ).toBeTruthy();
    expect(screen.getByText('10mg · Daily')).toBeTruthy();
    expect(screen.queryByText('Metronidazole')).toBeNull();
    expect(screen.queryByText('prescriptions.empty')).toBeNull();
  });

  it('says nothing is recorded when the companion has no prescriptions', async () => {
    mockList.mockResolvedValue([{...prescription, patientId: 'pet-2'}]);
    renderScreen();

    await waitFor(
      () => expect(screen.getByText('prescriptions.empty')).toBeTruthy(),
      WAIT,
    );
    expect(screen.getByText('prescriptions.intro')).toBeTruthy();
    expect(screen.queryByRole('button', {name: /requestRefillFor/})).toBeNull();
  });

  // The screen decides which card is busy; the card and hook own the rest.
  it('requests a refill and marks only that card busy while in flight', async () => {
    mockList.mockResolvedValue([
      prescription,
      {
        ...prescription,
        id: 'rx-2',
        items: [{...prescription.items[0], id: 'i2', medication: 'Cefalexin'}],
      },
    ]);
    const pending = deferred<void>();
    mockRequest.mockReturnValue(pending.promise);
    renderScreen();
    await screen.findByRole('button', {name: REFILL_AMOXICILLIN}, WAIT);

    fireEvent.press(screen.getByRole('button', {name: REFILL_AMOXICILLIN}));

    const busy = await screen.findByRole(
      'button',
      {name: 'prescriptions.requestingFor:Amoxicillin'},
      WAIT,
    );
    expect(busy.props.accessibilityState).toEqual({disabled: true, busy: true});
    const other = screen.getByRole('button', {
      name: 'prescriptions.requestRefillFor:Cefalexin',
    });
    expect(other.props.accessibilityState).toEqual({
      disabled: false,
      busy: false,
    });
    expect(mockRequest).toHaveBeenCalledWith('rx-1', 'token');

    pending.resolve();
    await waitFor(
      () =>
        expect(Alert.alert).toHaveBeenCalledWith(
          'prescriptions.refillRequestedTitle',
          'prescriptions.refillRequestedBody',
        ),
      WAIT,
    );
    const idle = screen.getByRole('button', {name: REFILL_AMOXICILLIN});
    expect(idle.props.accessibilityState).toEqual({
      disabled: false,
      busy: false,
    });
  });

  it('shows a translated load error for transport failures and retries', async () => {
    mockList.mockRejectedValueOnce(new Error('Forbidden'));
    renderScreen();

    await waitFor(
      () => expect(screen.getByText('prescriptions.loadFailed')).toBeTruthy(),
      WAIT,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByText('Forbidden')).toBeNull();

    fireEvent.press(screen.getByText('prescriptions.retry'));

    await waitFor(
      () =>
        expect(
          screen.getByRole('button', {name: REFILL_AMOXICILLIN}),
        ).toBeTruthy(),
      WAIT,
    );
    expect(mockList).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('prescriptions.loadFailed')).toBeNull();
  });

  it('asks the owner to sign in again, without a retry, when there is no session', async () => {
    mockTokens.mockResolvedValue({accessToken: ''});
    renderScreen();

    await waitFor(
      () => expect(screen.getByText('prescriptions.signInAgain')).toBeTruthy(),
      WAIT,
    );
    expect(screen.queryByText('prescriptions.retry')).toBeNull();
    expect(mockList).not.toHaveBeenCalled();
  });

  it('goes back from the header', async () => {
    renderScreen();
    await screen.findByRole('button', {name: REFILL_AMOXICILLIN}, WAIT);

    fireEvent.press(screen.getByText('prescriptions.title'));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });
});
