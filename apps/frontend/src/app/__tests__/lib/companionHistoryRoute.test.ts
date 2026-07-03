import {
  buildAppointmentCompanionHistoryHref,
  buildCompanionHistoryHref,
  buildCompanionOverviewHref,
} from '@/app/lib/companionHistoryRoute';

describe('companionHistoryRoute', () => {
  it('builds appointment companion history links', () => {
    expect(buildAppointmentCompanionHistoryHref('appt-1', 'comp-1')).toBe(
      '/companions/history?companionId=comp-1&source=appointments&appointmentId=appt-1&backTo=%2Fappointments'
    );
  });

  it('builds companion overview links', () => {
    expect(buildCompanionOverviewHref('comp-9', '/companions?companionId=comp-9')).toBe(
      '/companions/history?companionId=comp-9&source=companions&backTo=%2Fcompanions'
    );
  });

  it('preserves non-modal companion list filters when building overview links', () => {
    expect(
      buildCompanionOverviewHref('comp-9', '/companions?status=active&companionId=comp-9')
    ).toBe(
      '/companions/history?companionId=comp-9&source=companions&backTo=%2Fcompanions%3Fstatus%3Dactive'
    );
  });

  it('falls back to the base history page when companion id is missing', () => {
    expect(
      buildCompanionHistoryHref({
        companionId: '',
        source: 'appointments',
      })
    ).toBe('/companions/history');
  });
});
