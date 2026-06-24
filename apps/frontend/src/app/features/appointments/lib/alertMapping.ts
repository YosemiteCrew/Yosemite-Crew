import type { AlertSeverity, CompanionAlert } from '@/app/features/appointments/types/workspace';

type StoredAlert = {
  title?: string;
  severity?: string;
};

const ALERT_SEVERITIES = new Set<AlertSeverity>(['low', 'medium', 'high', 'critical']);

export const isAlertSeverity = (value: string | undefined): value is AlertSeverity =>
  value !== undefined && ALERT_SEVERITIES.has(value as AlertSeverity);

export const storedAlertsToCompanionAlerts = (
  alerts: StoredAlert[] | undefined,
  prefix: string
): CompanionAlert[] =>
  (alerts ?? []).flatMap((alert, index) => {
    const title = alert.title?.trim();
    if (!title || !isAlertSeverity(alert.severity)) {
      return [];
    }
    return [
      {
        id: `${prefix}-${index}`,
        label: title,
        severity: alert.severity,
      },
    ];
  });

export const companionAlertsToStoredAlerts = (
  alerts: Array<Pick<CompanionAlert, 'label' | 'severity'>>
) =>
  alerts.map((alert) => ({
    title: alert.label,
    severity: alert.severity,
  }));
