type CompanionHistoryRouteSource = 'appointments' | 'companions';

type BuildCompanionHistoryHrefParams = {
  companionId?: string | null;
  source: CompanionHistoryRouteSource;
  appointmentId?: string | null;
  backTo?: string | null;
};

const normalizeValue = (value?: string | null): string => String(value ?? '').trim();

export const buildCompanionHistoryHref = ({
  companionId,
  source,
  appointmentId,
  backTo,
}: BuildCompanionHistoryHrefParams): string => {
  const resolvedCompanionId = normalizeValue(companionId);
  if (!resolvedCompanionId) return '/companions/history';

  const params = new URLSearchParams({
    companionId: resolvedCompanionId,
    source,
  });

  const resolvedAppointmentId = normalizeValue(appointmentId);
  if (resolvedAppointmentId) {
    params.set('appointmentId', resolvedAppointmentId);
  }

  const resolvedBackTo = normalizeValue(backTo);
  if (resolvedBackTo) {
    params.set('backTo', resolvedBackTo);
  }

  return `/companions/history?${params.toString()}`;
};

export const buildAppointmentCompanionHistoryHref = (
  appointmentId?: string | null,
  companionId?: string | null,
  backTo = '/appointments'
): string =>
  buildCompanionHistoryHref({
    companionId,
    source: 'appointments',
    appointmentId,
    backTo,
  });

export const buildCompanionOverviewHref = (companionId?: string | null, backTo = ''): string =>
  buildCompanionHistoryHref({
    companionId,
    source: 'companions',
    backTo,
  });
