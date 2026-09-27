import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CareRemindersPage from '@/app/features/care-reminders/pages/CareRemindersPage';
import { loadCompanionsForPrimaryOrg } from '@/app/features/companions/services/companionService';
import {
  createCareReminders,
  listCareReminders,
  sendCareReminder,
} from '@/app/services/careReminderService';

const mockOrgState = { primaryOrgId: 'org-1' as string | null };

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, isDisabled }: { text: string; isDisabled?: boolean }) => (
    <button type="submit" disabled={isDisabled}>
      {text}
    </button>
  ),
}));
jest.mock('@/app/features/companions/services/companionService', () => ({
  loadCompanionsForPrimaryOrg: jest.fn(),
}));
jest.mock('@/app/services/careReminderService', () => ({
  createCareReminders: jest.fn(),
  listCareReminders: jest.fn(),
  sendCareReminder: jest.fn(),
}));
jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: (state: { primaryOrgId: string | null }) => unknown) =>
    selector(mockOrgState),
}));
jest.mock('@/app/stores/companionStore', () => ({
  useCompanionStore: (selector: (state: unknown) => unknown) =>
    selector({
      companionsIdsByOrgId: { 'org-1': ['pet-1', 'pet-2'] },
      companionsById: {
        'pet-1': { id: 'pet-1', name: 'Milo' },
        'pet-2': { id: 'pet-2', name: 'Luna' },
      },
    }),
}));
jest.mock('@/app/lib/logger', () => ({ logger: { error: jest.fn() } }));

const reminder = {
  id: 'r1',
  patientId: 'pet-1',
  reminderType: 'ANNUAL_CHECKUP' as const,
  dueDate: '2026-10-01T00:00:00.000Z',
  sendAt: null,
  status: 'PENDING' as const,
  sendingAt: null,
  lastAttemptAt: null,
  lastDelivery: null,
};

const listMock = listCareReminders as jest.Mock;
const createMock = createCareReminders as jest.Mock;
const sendMock = sendCareReminder as jest.Mock;

const selectRecipients = (select: HTMLElement, selectedIds = ['pet-1', 'pet-2']) => {
  const element = select as HTMLSelectElement;
  Array.from(element.options).forEach((option) => {
    option.selected = selectedIds.includes(option.value);
  });
  fireEvent.change(element);
};

beforeEach(() => {
  jest.clearAllMocks();
  mockOrgState.primaryOrgId = 'org-1';
  (loadCompanionsForPrimaryOrg as jest.Mock).mockResolvedValue(undefined);
  listMock.mockResolvedValue([reminder]);
  createMock.mockResolvedValue({ created: 2 });
  sendMock.mockResolvedValue({ ...reminder, status: 'SENT' });
});

it('reviews recipients and shows persisted channel delivery results', async () => {
  listMock.mockResolvedValueOnce([
    {
      ...reminder,
      lastAttemptAt: '2026-09-27T10:00:00.000Z',
      lastDelivery: { push: 'delivered', email: 'failed' },
    },
  ]);
  render(<CareRemindersPage />);

  expect(await screen.findByText(/Push delivered · Email not delivered/)).toBeInTheDocument();
  selectRecipients(screen.getByLabelText('Companions'));
  expect(screen.getByText('Selected (2): Milo, Luna')).toBeInTheDocument();
});

it('flags an old in-progress send for review instead of implying it is still running', async () => {
  listMock.mockResolvedValueOnce([
    {
      ...reminder,
      status: 'SENDING',
      sendingAt: '2026-09-01T10:00:00.000Z',
    },
  ]);
  render(<CareRemindersPage />);

  expect(
    await screen.findByText('No result recorded — check delivery before retrying.')
  ).toBeInTheDocument();
  expect(screen.getByText('check delivery')).toBeInTheDocument();
});

it('shows an active send and the scheduled time', async () => {
  listMock.mockResolvedValueOnce([
    {
      ...reminder,
      status: 'SENDING',
      sendingAt: new Date().toISOString(),
      sendAt: '2026-09-30T09:00:00.000Z',
    },
  ]);
  render(<CareRemindersPage />);

  expect(await screen.findByText('Delivery in progress')).toBeInTheDocument();
  expect(screen.getByText(/sends Sep/)).toBeInTheDocument();
});

it('schedules the reviewed recipient set and refreshes the list', async () => {
  render(<CareRemindersPage />);
  await screen.findByText('Milo · Annual check-up');
  selectRecipients(screen.getByLabelText('Companions'));
  fireEvent.change(screen.getByLabelText('Care due date'), { target: { value: '2026-10-01' } });
  fireEvent.change(screen.getByLabelText('Send at (optional)'), {
    target: { value: '2026-09-30T09:00' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Schedule 2 reminders' }));

  await waitFor(() =>
    expect(createMock).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({
        patientIds: ['pet-1', 'pet-2'],
        reminderType: 'ANNUAL_CHECKUP',
        sendAt: expect.any(String),
      })
    )
  );
  expect(await screen.findByRole('status')).toHaveTextContent('Reminders scheduled.');
});

it('uses the singular label for one selected recipient and supports custom care', async () => {
  render(<CareRemindersPage />);
  await screen.findByText('Milo · Annual check-up');
  fireEvent.change(screen.getByLabelText('Care type'), { target: { value: 'CUSTOM' } });
  selectRecipients(screen.getByLabelText('Companions'), ['pet-1']);

  expect(screen.getByText('Selected (1): Milo')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Schedule 1 reminder' })).toBeDisabled();
});

it('sends a pending reminder and refreshes its result', async () => {
  render(<CareRemindersPage />);
  await screen.findByText('Milo · Annual check-up');
  fireEvent.click(screen.getByRole('button', { name: 'Send now' }));
  await waitFor(() => expect(sendMock).toHaveBeenCalledWith('org-1', 'r1'));
  expect(listMock).toHaveBeenCalledTimes(2);
});

it('shows a helpful empty state and can refresh reminders', async () => {
  listMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
  render(<CareRemindersPage />);
  expect(await screen.findByText('No care reminders yet.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
});

it('does not request clinic reminders without an active practice', async () => {
  mockOrgState.primaryOrgId = null;
  render(<CareRemindersPage />);
  expect(screen.getByText('Select a practice to view care reminders.')).toBeInTheDocument();
  expect(listMock).not.toHaveBeenCalled();
});

it('shows a save error and a busy label while scheduling', async () => {
  let finishCreate: (() => void) | undefined;
  createMock.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finishCreate = resolve;
      })
  );
  render(<CareRemindersPage />);
  await screen.findByText('Milo · Annual check-up');
  selectRecipients(screen.getByLabelText('Companions'));
  fireEvent.change(screen.getByLabelText('Care due date'), { target: { value: '2026-10-01' } });
  fireEvent.click(screen.getByRole('button', { name: 'Schedule 2 reminders' }));
  expect(await screen.findByRole('button', { name: 'Scheduling…' })).toBeDisabled();
  finishCreate?.();
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Reminders scheduled.'));

  createMock.mockRejectedValueOnce(new Error('offline'));
  selectRecipients(screen.getByLabelText('Companions'));
  fireEvent.change(screen.getByLabelText('Care due date'), { target: { value: '2026-10-02' } });
  fireEvent.click(screen.getByRole('button', { name: 'Schedule 2 reminders' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not schedule these reminders. Please try again.'
  );
});

it('shows an error when a manual send fails', async () => {
  sendMock.mockRejectedValueOnce(new Error('offline'));
  render(<CareRemindersPage />);
  await screen.findByText('Milo · Annual check-up');
  fireEvent.click(screen.getByRole('button', { name: 'Send now' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not send this reminder. Please try again.'
  );
});

it('shows a retryable error when the reminder list cannot be loaded', async () => {
  listMock.mockRejectedValueOnce(new Error('offline'));
  render(<CareRemindersPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not load care reminders. Please try again.'
  );
});
