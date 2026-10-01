import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import {mockTheme} from '../../../setup/mockTheme';
import {getFreshStoredTokens} from '@/features/auth/sessionManager';
import {careReminderApi} from '@/features/companion/services/careReminderService';
import {CareRemindersScreen} from '@/features/companion/screens/CareRemindersScreen';

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
jest.mock('@/features/companion/services/careReminderService', () => ({
  careReminderApi: {list: jest.fn()},
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
const mockList = careReminderApi.list as jest.Mock;
const navigation = {goBack: jest.fn()};
const reminder = {
  id: 'care-1',
  patientId: 'pet-1',
  patientName: 'Milo',
  organisationId: 'org-1',
  reminderType: 'VACCINATION_BOOSTER' as const,
  message: 'Milo is due for a vaccination.',
  dueDate: '2026-09-20T00:00:00.000Z',
  overdue: true,
  status: 'PENDING' as const,
};

const renderScreen = (companionId = 'pet-1') =>
  render(
    <CareRemindersScreen
      navigation={navigation as never}
      route={{params: {companionId}} as never}
    />,
  );

describe('CareRemindersScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTokens.mockResolvedValue({accessToken: 'token'});
    mockList.mockResolvedValue([reminder]);
  });

  it('shows loading while the owner list is fetched', async () => {
    let resolve!: (items: (typeof reminder)[]) => void;
    mockList.mockReturnValue(new Promise(res => (resolve = res)));
    renderScreen();
    expect(screen.getByText('loading')).toBeTruthy();
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    resolve([reminder]);
    await waitFor(() =>
      expect(screen.getByText('Milo is due for a vaccination.')).toBeTruthy(),
    );
  });

  it('shows only reminders for the selected companion with due context', async () => {
    mockList.mockResolvedValue([
      reminder,
      {
        ...reminder,
        id: 'care-other',
        patientId: 'pet-2',
        patientName: 'Luna',
        message: 'Luna is due for a vaccination.',
      },
    ]);
    renderScreen();

    expect(
      await screen.findByText('careReminders.types.VACCINATION_BOOSTER'),
    ).toBeTruthy();
    expect(screen.getByText('Milo is due for a vaccination.')).toBeTruthy();
    expect(screen.getByText(/careReminders\.overdue:/)).toBeTruthy();
    expect(screen.queryByText('Luna is due for a vaccination.')).toBeNull();
    expect(screen.getByText('careReminders.scheduled')).toBeTruthy();
  });

  it('labels upcoming reminders and already-sent reminders', async () => {
    mockList.mockResolvedValue([
      {...reminder, overdue: false, status: 'SENT' as const},
    ]);
    renderScreen();

    expect(await screen.findByText(/careReminders\.due:/)).toBeTruthy();
    expect(screen.getByText('careReminders.sent')).toBeTruthy();
  });

  it('uses a safe label for an unrecognized reminder type', async () => {
    mockList.mockResolvedValue([
      {
        ...reminder,
        reminderType: 'UNKNOWN' as unknown as typeof reminder.reminderType,
      },
    ]);
    renderScreen();

    expect(await screen.findByText('careReminders.types.CUSTOM')).toBeTruthy();
  });

  it('shows an empty state when no care is due for this companion', async () => {
    mockList.mockResolvedValue([]);
    renderScreen();
    expect(await screen.findByText('careReminders.empty')).toBeTruthy();
  });

  it('returns to the companion profile from the header', () => {
    renderScreen();
    fireEvent.press(screen.getByRole('button', {name: 'careReminders.title'}));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('asks the owner to sign in again when no access token is available', async () => {
    mockTokens.mockResolvedValue(null);
    renderScreen();
    expect(await screen.findByText('careReminders.signInAgain')).toBeTruthy();
    expect(mockList).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', {name: 'careReminders.retry'}),
    ).toBeNull();
  });

  it('offers retry after an API failure and reloads the list', async () => {
    mockList
      .mockRejectedValueOnce(new Error('Unavailable'))
      .mockResolvedValueOnce([reminder]);
    renderScreen();
    fireEvent.press(
      await screen.findByRole('button', {name: 'careReminders.retry'}),
    );
    expect(
      await screen.findByText('Milo is due for a vaccination.'),
    ).toBeTruthy();
    expect(mockList).toHaveBeenCalledTimes(2);
  });

  it('does not show a previous companion list while the next companion loads', async () => {
    const {rerender} = renderScreen();
    await screen.findByText('Milo is due for a vaccination.');
    let resolve!: (items: (typeof reminder)[]) => void;
    mockList.mockReturnValueOnce(new Promise(res => (resolve = res)));
    rerender(
      <CareRemindersScreen
        navigation={navigation as never}
        route={{params: {companionId: 'pet-2'}} as never}
      />,
    );
    expect(screen.getByText('loading')).toBeTruthy();
    expect(screen.queryByText('Milo is due for a vaccination.')).toBeNull();
    resolve([]);
    expect(await screen.findByText('careReminders.empty')).toBeTruthy();
  });

  it('ignores an in-flight response after leaving the screen', async () => {
    let resolve!: (items: (typeof reminder)[]) => void;
    mockList.mockReturnValue(new Promise(res => (resolve = res)));
    const {unmount} = renderScreen();
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    unmount();
    resolve([reminder]);
  });

  it('ignores missing credentials after leaving the screen', async () => {
    let resolve!: (tokens: {accessToken: string} | null) => void;
    mockTokens.mockReturnValue(new Promise(res => (resolve = res)));
    const {unmount} = renderScreen();
    unmount();
    resolve(null);
    await waitFor(() => expect(mockTokens).toHaveBeenCalled());
  });

  it('ignores a failed request after leaving the screen', async () => {
    let reject!: (error: Error) => void;
    mockList.mockReturnValue(new Promise((_, fail) => (reject = fail)));
    const {unmount} = renderScreen();
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    unmount();
    reject(new Error('Unavailable'));
  });
});
