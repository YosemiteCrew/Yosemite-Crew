import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import OrganisationAuditPage from '@/app/features/audit/OrganisationAuditPage';
import { getOrganisationAuditTrail } from '@/app/features/audit/services/auditService';

jest.mock('@/app/features/audit/services/auditService', () => ({
  getOrganisationAuditTrail: jest.fn(),
}));
let mockOrgId = 'org-a';
jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: (state: { primaryOrgId: string }) => unknown) =>
    selector({ primaryOrgId: mockOrgId }),
}));
jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/app/ui/layout/guards/OrgGuard', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));

const getFeed = getOrganisationAuditTrail as jest.Mock;
const row = {
  id: 'event-1',
  patientId: 'patient-1',
  eventType: 'TASK_STATUS_CHANGED',
  actorType: 'PMS_USER',
  actorName: 'Avery',
  entityType: 'TASK',
  occurredAt: '2026-09-28T09:00:00.000Z',
};

describe('OrganisationAuditPage', () => {
  beforeEach(() => {
    mockOrgId = 'org-a';
    jest.clearAllMocks();
  });

  it('shows organization-wide activity and pages with the server cursor', async () => {
    getFeed
      .mockResolvedValueOnce({ entries: [row], nextCursor: 'next-page' })
      .mockResolvedValueOnce({ entries: [{ ...row, id: 'event-2' }], nextCursor: null });

    render(<OrganisationAuditPage />);
    expect(await screen.findByText('Task updated')).toBeInTheDocument();
    expect(screen.getByText('patient-1')).toBeInTheDocument();
    expect(getFeed).toHaveBeenNthCalledWith(1, { limit: 50, cursor: undefined });

    fireEvent.click(screen.getByRole('button', { name: 'Load more activity' }));
    await waitFor(() =>
      expect(getFeed).toHaveBeenNthCalledWith(2, { limit: 50, cursor: 'next-page' })
    );
    await waitFor(() => expect(screen.getAllByText('patient-1')).toHaveLength(2));
  });

  it('requests the first page only once when the page opens', async () => {
    getFeed.mockResolvedValueOnce({ entries: [], nextCursor: null });

    render(<OrganisationAuditPage />);

    expect(await screen.findByText('No activity to show yet.')).toBeInTheDocument();
    expect(getFeed).toHaveBeenCalledTimes(1);
  });

  it('offers a retry after the feed fails', async () => {
    getFeed
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce({ entries: [], nextCursor: null });
    render(<OrganisationAuditPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(getFeed).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('No activity to show yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export loaded activity' })).toBeDisabled();
  });

  it('exports the currently loaded summary rows', async () => {
    const createUrl = jest.fn(() => 'blob:audit');
    const revokeUrl = jest.fn();
    const click = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeUrl });
    Object.defineProperty(HTMLAnchorElement.prototype, 'click', {
      configurable: true,
      value: click,
    });
    getFeed.mockResolvedValueOnce({ entries: [row], nextCursor: null });

    render(<OrganisationAuditPage />);
    expect(await screen.findByText('patient-1')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Export loaded activity' }));

    expect(createUrl).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'text/csv;charset=utf-8' })
    );
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeUrl).toHaveBeenCalledWith('blob:audit');
  });

  it('discards an earlier organization response after the active organization changes', async () => {
    let resolveFirst: (value: unknown) => void = () => {};
    getFeed
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
      )
      .mockResolvedValueOnce({
        entries: [{ ...row, id: 'org-b-event', patientId: 'patient-org-b' }],
        nextCursor: null,
      });
    const view = render(<OrganisationAuditPage />);
    await waitFor(() => expect(getFeed).toHaveBeenCalledTimes(1));

    mockOrgId = 'org-b';
    view.rerender(<OrganisationAuditPage />);
    expect(await screen.findByText('patient-org-b')).toBeInTheDocument();
    expect(getFeed).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveFirst({ entries: [row], nextCursor: null });
    });
    expect(screen.queryByText('patient-1')).not.toBeInTheDocument();
    expect(screen.getByText('patient-org-b')).toBeInTheDocument();
  });

  it('drops a pending next page from the previous organization', async () => {
    let resolveMore: (value: unknown) => void = () => {};
    getFeed
      .mockResolvedValueOnce({ entries: [row], nextCursor: 'next-page' })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveMore = resolve;
        })
      )
      .mockResolvedValueOnce({
        entries: [{ ...row, id: 'org-b-event', patientId: 'patient-org-b' }],
        nextCursor: null,
      });
    const view = render(<OrganisationAuditPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Load more activity' }));

    mockOrgId = 'org-b';
    view.rerender(<OrganisationAuditPage />);
    expect(await screen.findByText('patient-org-b')).toBeInTheDocument();

    await act(async () => {
      resolveMore({
        entries: [{ ...row, id: 'event-2', patientId: 'patient-2' }],
        nextCursor: null,
      });
    });
    expect(screen.queryByText('patient-2')).not.toBeInTheDocument();
    expect(screen.getByText('patient-org-b')).toBeInTheDocument();
  });
});
