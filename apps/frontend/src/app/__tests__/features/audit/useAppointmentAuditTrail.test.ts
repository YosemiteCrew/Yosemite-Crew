import { renderHook, waitFor } from '@testing-library/react';
import type { AuditTrail } from '@/app/features/audit/types/audit';
import { getAppointmentAuditTrail } from '@/app/features/audit/services/auditService';
import { useAppointmentAuditTrail } from '@/app/features/audit/hooks/useAppointmentAuditTrail';

jest.mock('@/app/features/audit/services/auditService', () => ({
  getAppointmentAuditTrail: jest.fn(),
}));

const getAppointmentAuditTrailMock = getAppointmentAuditTrail as jest.MockedFunction<
  typeof getAppointmentAuditTrail
>;

describe('useAppointmentAuditTrail', () => {
  afterEach(() => jest.clearAllMocks());

  it('clears the previous trail when a later request fails', async () => {
    const entry: AuditTrail = {
      id: 'entry-1',
      organisationId: 'org-1',
      companionId: 'companion-1',
      eventType: 'APPOINTMENT_CREATED',
      occurredAt: new Date('2026-01-01T00:00:00Z'),
    };
    getAppointmentAuditTrailMock.mockResolvedValueOnce([entry]);
    getAppointmentAuditTrailMock.mockRejectedValueOnce(new Error('network failed'));

    const { result, rerender } = renderHook(
      ({ appointmentId }: { appointmentId: string }) => useAppointmentAuditTrail(appointmentId),
      { initialProps: { appointmentId: 'appointment-1' } }
    );

    await waitFor(() => expect(result.current).toEqual([entry]));
    rerender({ appointmentId: 'appointment-2' });
    await waitFor(() => expect(result.current).toEqual([]));
  });
});
