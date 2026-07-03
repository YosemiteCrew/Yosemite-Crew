type CompanionHistoryRouteSource = 'appointments' | 'companions';

type BuildCompanionHistoryHrefParams = {
  companionId?: string | null;
  source: CompanionHistoryRouteSource;
  appointmentId?: string | null;
  backTo?: string | null;
};

const normalizeValue = (value?: string | null): string => String(value ?? '').trim();

const removeCompanionDeepLinkParam = (path: string): string => {
  if (!path.startsWith('/') || path.startsWith('//')) return path;

  const url = new URL(path, 'https://yosemite.local');
  if (url.pathname !== '/companions') return path;

  url.searchParams.delete('companionId');
  const search = url.searchParams.toString();
  const query = search ? `?${search}` : '';
  return `${url.pathname}${query}${url.hash}`;
};

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
    backTo: removeCompanionDeepLinkParam(backTo || '/companions'),
  });
