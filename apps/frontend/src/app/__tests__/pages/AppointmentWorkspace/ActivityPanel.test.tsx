import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Appointment } from '@yosemite-crew/types';
import ActivityPanel from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/panels/ActivityPanel';
import type { AuditTrail } from '@/app/features/audit/types/audit';
import { getAppointmentAuditTrail } from '@/app/features/audit/services/auditService';

jest.mock('@/app/features/audit/services/auditService', () => ({
  getAppointmentAuditTrail: jest.fn(),
}));

// Render children so the timeline rows are visible; the fallback path is not exercised.
jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/app/ui/overlays/Fallback', () => ({
  __esModule: true,
  default: () => <div data-testid="fallback" />,
}));

// react-icons stubbed as spans (never buttons) so timeline chips stay inert.
jest.mock('react-icons/io5', () => ({
  IoChatbubbleEllipsesOutline: () => <span data-testid="chat-icon" />,
  IoFlaskOutline: () => <span data-testid="flask-icon" />,
  IoLogInOutline: () => <span data-testid="login-icon" />,
}));

const mockGetAuditTrail = getAppointmentAuditTrail as jest.Mock;

const appointment = (id?: string) => ({ id }) as unknown as Appointment;

// Loosely-typed builder so tests can exercise unknown actor/entity types.
const entry = (overrides: Partial<Record<string, unknown>>): AuditTrail =>
  ({
    id: 'evt-1',
    organisationId: 'org-1',
    companionId: 'comp-1',
    eventType: 'APPOINTMENT_CREATED',
    occurredAt: new Date('2026-07-09T09:18:00.000Z'),
    ...overrides,
  }) as unknown as AuditTrail;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ActivityPanel timeline', () => {
  it('renders a timeline row for each audit entry with actor, action and entity labels', async () => {
    mockGetAuditTrail.mockResolvedValue([
      entry({
        id: 'a1',
        actorName: 'Dr. Weber',
        actorType: 'PMS_USER',
        entityType: 'APPOINTMENT',
        eventType: 'APPOINTMENT_CREATED',
      }),
      entry({
        id: 'b1',
        actorName: '',
        actorType: 'PARENT',
        entityType: 'INVOICE',
        eventType: 'INVOICE_PAID',
      }),
      entry({
        // no id -> composite key fallback; unknown actor/entity types -> toTitle
        id: undefined,
        actorName: null,
        actorType: 'ROBOT',
        entityType: 'MEDICATION',
        eventType: 'DOCUMENT_ADDED',
      }),
      entry({
        // empty actor + missing entity -> System actor + timestamp-only detail line
        id: 'd1',
        actorName: '',
        actorType: undefined,
        entityType: undefined,
        eventType: 'FORM_SUBMITTED',
      }),
    ]);

    const { container } = render(<ActivityPanel appointment={appointment('appt-1')} />);

    // Actor names (bold spans) render, falling back to actor-type labels.
    expect(await screen.findByText('Dr. Weber')).toBeInTheDocument();
    expect(screen.getByText('Pet parent')).toBeInTheDocument();
    expect(screen.getByText('Robot')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();

    // Action text derives from toTitle(eventType).
    expect(screen.getByText('Appointment created')).toBeInTheDocument();
    expect(screen.getByText('Invoice paid')).toBeInTheDocument();
    expect(screen.getByText('Document added')).toBeInTheDocument();
    expect(screen.getByText('Form submitted')).toBeInTheDocument();

    // Detail line carries the entity label (known + unknown types).
    expect(screen.getByText(/^Appointment ·/)).toBeInTheDocument();
    expect(screen.getByText(/^Finance ·/)).toBeInTheDocument();
    expect(screen.getByText(/^Medication ·/)).toBeInTheDocument();

    // One row per entry.
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    // Connector spine on every row except the last.
    expect(container.querySelectorAll('.w-\\[1\\.5px\\]')).toHaveLength(3);
    // Per-actor chips: initials for a team member, a chat glyph for the parent and
    // the neutral login glyph for unknown/absent actor types.
    expect(screen.getByText('DW')).toBeInTheDocument();
    expect(screen.getByTestId('chat-icon')).toBeInTheDocument();
    expect(screen.getAllByTestId('login-icon')).toHaveLength(2);
  });

  it('shows the empty state when the audit trail is an empty array', async () => {
    mockGetAuditTrail.mockResolvedValue([]);
    render(<ActivityPanel appointment={appointment('appt-1')} />);
    expect(await screen.findByText('Nothing to show')).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('shows the empty state when the service resolves a nullish payload', async () => {
    mockGetAuditTrail.mockResolvedValue(undefined);
    render(<ActivityPanel appointment={appointment('appt-1')} />);
    expect(await screen.findByText('Nothing to show')).toBeInTheDocument();
  });

  it('falls back to the empty state when the fetch rejects', async () => {
    mockGetAuditTrail.mockRejectedValue(new Error('boom'));
    render(<ActivityPanel appointment={appointment('appt-1')} />);
    expect(await screen.findByText('Nothing to show')).toBeInTheDocument();
  });

  it('does not fetch and stays empty when the appointment has no id', async () => {
    render(<ActivityPanel appointment={appointment(undefined)} />);
    expect(await screen.findByText('Nothing to show')).toBeInTheDocument();
    expect(mockGetAuditTrail).not.toHaveBeenCalled();
  });

  it('ignores a resolved payload that arrives after unmount', async () => {
    let resolveFetch: (value: AuditTrail[]) => void = () => {};
    mockGetAuditTrail.mockReturnValue(
      new Promise<AuditTrail[]>((resolve) => {
        resolveFetch = resolve;
      })
    );

    const { unmount } = render(<ActivityPanel appointment={appointment('appt-1')} />);
    await waitFor(() => expect(mockGetAuditTrail).toHaveBeenCalled());
    unmount();

    await act(async () => {
      resolveFetch([entry({ id: 'late', actorName: 'Ghost' })]);
    });

    expect(screen.queryByText('Ghost')).not.toBeInTheDocument();
  });

  it('ignores a rejected fetch that settles after unmount', async () => {
    let rejectFetch: (reason?: unknown) => void = () => {};
    mockGetAuditTrail.mockReturnValue(
      new Promise<AuditTrail[]>((_, reject) => {
        rejectFetch = reject;
      })
    );

    const { unmount } = render(<ActivityPanel appointment={appointment('appt-1')} />);
    await waitFor(() => expect(mockGetAuditTrail).toHaveBeenCalled());
    unmount();

    await act(async () => {
      rejectFetch(new Error('late failure'));
    });

    expect(screen.queryByText('Nothing to show')).not.toBeInTheDocument();
  });
});
