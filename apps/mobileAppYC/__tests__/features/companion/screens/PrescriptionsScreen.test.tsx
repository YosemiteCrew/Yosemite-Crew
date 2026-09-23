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
const SIGNED_AT = '2026-02-20T12:00:00Z';
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

    await screen.findByRole('button', {name: REFILL_AMOXICILLIN});
    expect(screen.queryByText('prescriptions.empty')).toBeNull();
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });

  it('shows the loader until the list resolves', async () => {
    const pending = deferred<(typeof prescription)[]>();
    mockList.mockReturnValue(pending.promise);
    renderScreen();

    expect(screen.getByText('loading')).toBeTruthy();
    pending.resolve([prescription]);
    await screen.findByRole('button', {name: REFILL_AMOXICILLIN});
    expect(screen.queryByText('loading')).toBeNull();
  });

  it('filters the owner prescription list to the selected companion', async () => {
    renderScreen();
    await waitFor(() =>
      expect(screen.getAllByText('Amoxicillin').length).toBeGreaterThan(0),
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

  it('renders the optional summary, strength, route and instructions, dated by signature', async () => {
    mockList.mockResolvedValue([
      {
        ...prescription,
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
      },
    ]);
    renderScreen();

    await waitFor(() =>
      expect(screen.getByText('Meloxicam, Gabapentin')).toBeTruthy(),
    );
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

  it('omits the recorded line when the date is unparseable', async () => {
    mockList.mockResolvedValue([{...prescription, createdAt: 'not-a-date'}]);
    renderScreen();

    await waitFor(() =>
      expect(
        screen.getByRole('button', {name: REFILL_AMOXICILLIN}),
      ).toBeTruthy(),
    );
    expect(screen.queryByText(/prescriptions\.recorded/)).toBeNull();
  });

  it('says nothing is recorded when the companion has no prescriptions', async () => {
    mockList.mockResolvedValue([{...prescription, patientId: 'pet-2'}]);
    renderScreen();

    await waitFor(() =>
      expect(screen.getByText('prescriptions.empty')).toBeTruthy(),
    );
    expect(screen.getByText('prescriptions.intro')).toBeTruthy();
    expect(screen.queryByRole('button', {name: /requestRefillFor/})).toBeNull();
  });

  it('names the medication in each refill button label', async () => {
    mockList.mockResolvedValue([
      prescription,
      {
        ...prescription,
        id: 'rx-2',
        items: [{...prescription.items[0], id: 'i2', medication: 'Cefalexin'}],
      },
    ]);
    renderScreen();

    await waitFor(() =>
      expect(
        screen.getByRole('button', {name: REFILL_AMOXICILLIN}),
      ).toBeTruthy(),
    );
    expect(
      screen.getByRole('button', {
        name: 'prescriptions.requestRefillFor:Cefalexin',
      }),
    ).toBeTruthy();
  });

  it('requests a refill and marks only that button busy while in flight', async () => {
    const pending = deferred<void>();
    mockRequest.mockReturnValue(pending.promise);
    renderScreen();
    await waitFor(() =>
      expect(
        screen.getByRole('button', {name: REFILL_AMOXICILLIN}),
      ).toBeTruthy(),
    );

    fireEvent.press(screen.getByRole('button', {name: REFILL_AMOXICILLIN}));

    const busy = await screen.findByRole('button', {
      name: 'prescriptions.requestingFor:Amoxicillin',
    });
    expect(busy.props.accessibilityState).toEqual({disabled: true, busy: true});
    expect(screen.getByText('prescriptions.requesting')).toBeTruthy();
    expect(mockRequest).toHaveBeenCalledWith('rx-1', 'token');

    pending.resolve();
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'prescriptions.refillRequestedTitle',
        'prescriptions.refillRequestedBody',
      ),
    );
    const idle = screen.getByRole('button', {name: REFILL_AMOXICILLIN});
    expect(idle.props.accessibilityState).toEqual({
      disabled: false,
      busy: false,
    });
  });

  it('marks the button busy before the token lookup resolves', async () => {
    renderScreen();
    await waitFor(() =>
      expect(
        screen.getByRole('button', {name: REFILL_AMOXICILLIN}),
      ).toBeTruthy(),
    );
    const pendingTokens = deferred<{accessToken: string}>();
    mockTokens.mockReturnValue(pendingTokens.promise);

    fireEvent.press(screen.getByRole('button', {name: REFILL_AMOXICILLIN}));

    expect(
      await screen.findByRole('button', {
        name: 'prescriptions.requestingFor:Amoxicillin',
      }),
    ).toBeTruthy();
    expect(mockRequest).not.toHaveBeenCalled();
    pendingTokens.resolve({accessToken: 'token'});
    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1));
  });

  it('shows a translated failure when the refill request fails', async () => {
    mockRequest.mockRejectedValue(new Error('Network Error'));
    renderScreen();
    await waitFor(() =>
      expect(
        screen.getByRole('button', {name: REFILL_AMOXICILLIN}),
      ).toBeTruthy(),
    );

    fireEvent.press(screen.getByRole('button', {name: REFILL_AMOXICILLIN}));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'prescriptions.refillFailedTitle',
        'prescriptions.refillFailedBody',
      ),
    );
    expect(screen.getByRole('button', {name: REFILL_AMOXICILLIN})).toBeTruthy();
  });

  it('asks the owner to sign in again when the refill has no session', async () => {
    renderScreen();
    await waitFor(() =>
      expect(
        screen.getByRole('button', {name: REFILL_AMOXICILLIN}),
      ).toBeTruthy(),
    );
    mockTokens.mockResolvedValue(null);

    fireEvent.press(screen.getByRole('button', {name: REFILL_AMOXICILLIN}));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'prescriptions.refillFailedTitle',
        'prescriptions.signInAgain',
      ),
    );
    expect(mockRequest).not.toHaveBeenCalled();
    expect(screen.getByRole('button', {name: REFILL_AMOXICILLIN})).toBeTruthy();
  });

  it('shows a translated load error for transport failures and retries', async () => {
    mockList.mockRejectedValueOnce(new Error('Forbidden'));
    renderScreen();

    await waitFor(() =>
      expect(screen.getByText('prescriptions.loadFailed')).toBeTruthy(),
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByText('Forbidden')).toBeNull();

    fireEvent.press(screen.getByText('prescriptions.retry'));

    await waitFor(() =>
      expect(
        screen.getByRole('button', {name: REFILL_AMOXICILLIN}),
      ).toBeTruthy(),
    );
    expect(mockList).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('prescriptions.loadFailed')).toBeNull();
  });

  it('asks the owner to sign in again, without a retry, when there is no session', async () => {
    mockTokens.mockResolvedValue({accessToken: ''});
    renderScreen();

    await waitFor(() =>
      expect(screen.getByText('prescriptions.signInAgain')).toBeTruthy(),
    );
    expect(screen.queryByText('prescriptions.retry')).toBeNull();
    expect(mockList).not.toHaveBeenCalled();
  });

  it('goes back from the header', async () => {
    renderScreen();
    await screen.findByRole('button', {name: REFILL_AMOXICILLIN});

    fireEvent.press(screen.getByText('prescriptions.title'));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });
});
