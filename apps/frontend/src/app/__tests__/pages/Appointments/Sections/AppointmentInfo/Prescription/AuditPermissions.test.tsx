import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Audit from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/Audit';

/**
 * The sibling Audit test stubs PermissionGate out entirely, so nothing covered
 * the gate that actually decides whether the audit trail appears. That is why a
 * green suite still shipped an audit trail that rendered empty everywhere.
 *
 * These cases deliberately use the real PermissionGate, usePermissions and
 * resolveMembershipPermissions, driving them from the org store the app reads
 * at runtime, so the whole chain is exercised end to end.
 */

const getAppointmentAuditTrailMock = jest.fn();
const membershipMock = jest.fn<Record<string, unknown> | null, []>(() => null);

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) =>
    selector({
      primaryOrgId: 'org-1',
      status: 'loaded',
      membershipsByOrgId: { 'org-1': membershipMock() },
    }),
}));

jest.mock('@/app/ui/overlays/Fallback', () => ({
  __esModule: true,
  default: () => <div>fallback</div>,
}));

jest.mock('@/app/features/audit/services/auditService', () => ({
  getAppointmentAuditTrail: (...args: any[]) => getAppointmentAuditTrailMock(...args),
}));

jest.mock('@/app/lib/validators', () => ({
  toTitle: (value: string) => `TITLE:${value}`,
}));

jest.mock('@/app/lib/date', () => ({
  formatDateTimeLocal: (value: string) => `DATE:${value}`,
}));

const auditEntry = {
  id: 'a1',
  eventType: 'status_change',
  entityType: 'appointment',
  actorType: 'user',
  actorName: 'dr jane',
  occurredAt: '2025-01-01T00:00:00.000Z',
};

describe('Audit trail permission gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAppointmentAuditTrailMock.mockResolvedValue([auditEntry]);
  });

  it('renders for an owner whose stored permission snapshot is empty', async () => {
    // The reported bug: memberships persist effectivePermissions at save time,
    // so an owner row written before audit:view:any joined the role table keeps
    // an empty set and every audit surface rendered the fallback. Permissions
    // now derive from roleCode, so the trail appears.
    membershipMock.mockReturnValue({ roleCode: 'OWNER', effectivePermissions: [] });

    render(<Audit activeAppointment={{ id: 'appt-1' } as any} />);

    await waitFor(() => {
      expect(getAppointmentAuditTrailMock).toHaveBeenCalledWith('appt-1');
    });
    expect(await screen.findByText('TITLE:status_change')).toBeInTheDocument();
    expect(screen.getByText('Updated by: dr jane • TITLE:USER')).toBeInTheDocument();
    expect(screen.queryByText('fallback')).not.toBeInTheDocument();
  });

  it('renders for an admin, who also carries audit:view:any', async () => {
    membershipMock.mockReturnValue({ roleCode: 'ADMIN' });

    render(<Audit activeAppointment={{ id: 'appt-1' } as any} />);

    expect(await screen.findByText('TITLE:status_change')).toBeInTheDocument();
    expect(screen.queryByText('fallback')).not.toBeInTheDocument();
  });

  it('stays hidden for a role without audit:view:any', async () => {
    // Veterinarian carries analytics but not audit, so the gate must still deny.
    membershipMock.mockReturnValue({ roleCode: 'VETERINARIAN' });

    render(<Audit activeAppointment={{ id: 'appt-1' } as any} />);

    await waitFor(() => {
      expect(screen.getByText('fallback')).toBeInTheDocument();
    });
    expect(screen.queryByText('TITLE:status_change')).not.toBeInTheDocument();
  });

  it('stays hidden when the membership is deactivated', async () => {
    membershipMock.mockReturnValue({ roleCode: 'OWNER', active: false });

    render(<Audit activeAppointment={{ id: 'appt-1' } as any} />);

    await waitFor(() => {
      expect(screen.getByText('fallback')).toBeInTheDocument();
    });
  });
});
