import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProtectedCareReminders, {
  CareRemindersPage,
} from '@/app/features/care-reminders/pages/CareRemindersPage';
import { setPreferredTimeZone } from '@/app/lib/timezone';
import { loadCompanionsForPrimaryOrg } from '@/app/features/companions/services/companionService';
import {
  createCareReminders,
  listCareReminders,
  sendCareReminder,
} from '@/app/services/careReminderService';

const mockOrgState = { primaryOrgId: 'org-1' as string | null };
const mockCompanionIds = ['pet-1', 'pet-2'];
const mockCompanionState = {
  companionsIdsByOrgId: { 'org-1': mockCompanionIds },
  companionsById: {
    'pet-1': { id: 'pet-1', name: 'Milo' },
    'pet-2': { id: 'pet-2', name: 'Luna' },
  },
};

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="protected-route">{children}</div>
  ),
}));
jest.mock('@/app/ui/layout/guards/OrgGuard', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="org-guard">{children}</div>
  ),
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
  useCompanionStore: (selector: (state: unknown) => unknown) => selector(mockCompanionState),
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
  mockCompanionState.companionsIdsByOrgId = { 'org-1': mockCompanionIds };
  (loadCompanionsForPrimaryOrg as jest.Mock).mockResolvedValue(undefined);
  listMock.mockResolvedValue([reminder]);
  createMock.mockResolvedValue({ created: 2 });
  sendMock.mockResolvedValue({ ...reminder, status: 'SENT' });
});

afterEach(() => {
  globalThis.localStorage.clear();
});

it('only renders behind the sign-in and practice guards', async () => {
  render(<ProtectedCareReminders />);

  const orgGuard = screen.getByTestId('org-guard');
  expect(screen.getByTestId('protected-route')).toContainElement(orgGuard);
  expect(
    await screen.findByRole('heading', { name: 'Care reminders', level: 1 })
  ).toBeInTheDocument();
  expect(orgGuard).toContainElement(screen.getByRole('heading', { level: 1 }));
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

it('shows dates on the calendar day of the preferred time zone', async () => {
  setPreferredTimeZone('America/Los_Angeles');
  listMock.mockResolvedValueOnce([
    { ...reminder, dueDate: '2026-10-01T19:00:00.000Z', sendAt: '2026-09-30T16:00:00.000Z' },
  ]);
  render(<CareRemindersPage />);

  expect(await screen.findByText(/Due Oct 1, 2026/)).toBeInTheDocument();
  expect(screen.getByText(/sends Sep 30, 2026, 09:00 AM/)).toBeInTheDocument();
});

it('filters companion records in one pass', async () => {
  const companionIds = [...mockCompanionIds, 'missing'];
  mockCompanionState.companionsIdsByOrgId['org-1'] = companionIds;
  const flatMap = jest.spyOn(companionIds, 'flatMap');
  const { rerender } = render(<CareRemindersPage />);

  expect(await screen.findByText('Milo · Annual check-up')).toBeInTheDocument();
  expect(flatMap).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Companions').querySelectorAll('option')).toHaveLength(2);

  Reflect.deleteProperty(mockCompanionState.companionsIdsByOrgId, 'org-1');
  rerender(<CareRemindersPage />);
  expect(screen.getByLabelText('Companions').querySelectorAll('option')).toHaveLength(0);
});

it('says the result is unknown when an earlier send never finished', async () => {
  listMock.mockResolvedValueOnce([
    { ...reminder, lastAttemptAt: '2026-09-01T10:00:00.000Z', lastDelivery: null },
  ]);
  render(<CareRemindersPage />);

  expect(
    await screen.findByText(
      'The last send did not finish, so its result is unknown. Check with the owner before sending again.'
    )
  ).toBeInTheDocument();
  expect(screen.getByText('Pending')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Retry send' })).toBeInTheDocument();
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
  expect(screen.getByText('Sending')).toBeInTheDocument();
  expect(screen.getByText(/sends Sep/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /send/i })).not.toBeInTheDocument();
});

it('schedules the reviewed recipient set and refreshes the list', async () => {
  setPreferredTimeZone('America/Los_Angeles');
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
        dueDate: '2026-10-01T19:00:00.000Z',
        sendAt: '2026-09-30T16:00:00.000Z',
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
  const { container } = render(<CareRemindersPage />);
  expect(screen.getByText('Select a practice to view care reminders.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  const form = container.querySelector('form');
  if (form) fireEvent.submit(form);
  expect(listMock).not.toHaveBeenCalled();
  expect(createMock).not.toHaveBeenCalled();
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
