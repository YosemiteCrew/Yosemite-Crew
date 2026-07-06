import type {FormField} from '@yosemite-crew/types';
import type {AppointmentFormEntry} from '@/features/forms';

export const normalizeAvatarUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const lower = trimmed.toLowerCase();
  if (lower === 'null' || lower === 'undefined') {
    return null;
  }
  return trimmed;
};

export const toImageSource = (value: unknown): {uri: string} | undefined => {
  if (!value) {
    return undefined;
  }
  if (typeof value === 'object' && value !== null && 'uri' in value) {
    const uri = normalizeAvatarUrl((value as {uri?: unknown}).uri);
    return uri ? {uri} : undefined;
  }
  const uri = normalizeAvatarUrl(value);
  return uri ? {uri} : undefined;
};

export const getCancellationNote = (
  isCancelledOrNoShow: boolean,
  isCashPaid: boolean,
): string | null => {
  if (!isCancelledOrNoShow) {
    return null;
  }
  if (isCashPaid) {
    return 'This appointment was paid in cash. If a refund is needed after cancellation, please contact the service provider directly because cash refunds are handled by the provider organization.';
  }
  return "This appointment was cancelled. Refunds, if applicable, are processed per the provider organization's policy and card network timelines.";
};

export const resolveEmployeeAvatar = (
  employee: any,
  apt: any,
  displayName?: string | null,
) => {
  const directSources = [
    employee?.avatar,
    employee?.profileUrl,
    employee?.profileImage,
    employee?.profileImageUrl,
    employee?.profilePicture,
    employee?.profilePictureUrl,
    employee?.imageUrl,
    employee?.imageURL,
    employee?.photo,
    apt?.employeeAvatar,
  ];

  for (const source of directSources) {
    const resolved = toImageSource(source);
    if (resolved) {
      return resolved;
    }
  }

  const safeName = String(displayName ?? '').trim();
  if (!safeName) {
    return undefined;
  }

  return {
    uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(safeName)}`,
  };
};

export const buildEmployeeDisplay = ({
  employee,
  apt,
  department,
  statusFlags,
}: {
  employee: any;
  apt: any;
  department: string | null;
  statusFlags: any;
}) => {
  const resolvedEmployeeName =
    employee?.name ?? apt.employeeName ?? 'Assigned provider';
  const resolvedEmployeeAvatar = resolveEmployeeAvatar(
    employee,
    apt,
    resolvedEmployeeName,
  );
  const employeeFallback =
    !employee && (apt.employeeName || apt.employeeTitle)
      ? {
          id: apt.employeeId ?? 'provider',
          businessId: apt.businessId,
          name: resolvedEmployeeName,
          title: apt.employeeTitle ?? '',
          specialization: apt.employeeTitle ?? department ?? '',
          avatar: resolvedEmployeeAvatar,
        }
      : null;
  const employeeWithAvatar = employee
    ? {
        ...employee,
        specialization: apt.employeeTitle ?? employee.specialization,
        avatar: resolvedEmployeeAvatar,
      }
    : null;
  const shouldShowEmployee = statusFlags.isUpcoming;
  return shouldShowEmployee
    ? (employeeWithAvatar ?? employeeFallback ?? null)
    : null;
};

export const formatAppointmentDateTime = (apt: any) => {
  const resolvedTime = apt.time ?? '00:00';
  const formattedTime =
    apt.time?.length === 5 ? `${resolvedTime}:00` : resolvedTime;
  const fallbackIso = `${apt.date}T${formattedTime}`;
  const localStartDate = apt?.start
    ? new Date(apt.start)
    : new Date(fallbackIso);
  const dateLabel = Number.isNaN(localStartDate.getTime())
    ? apt.date
    : localStartDate.toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
  const timeLabel =
    apt.time && !Number.isNaN(localStartDate.getTime())
      ? localStartDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        })
      : (apt.time ?? '');
  const dateTimeLabel = timeLabel ? `${dateLabel} • ${timeLabel}` : dateLabel;
  return {dateTimeLabel};
};

export const formatAppointmentFormValue = (
  field: FormField,
  value: any,
): string => {
  if (value === undefined || value === null) {
    return '—';
  }
  if (field.type === 'date') {
    const dateObj = value instanceof Date ? value : new Date(value);
    return Number.isNaN(dateObj.getTime()) ? '—' : dateObj.toLocaleDateString();
  }
  if (field.type === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (Array.isArray(value)) {
    return value.map(v => `${v}`).join(', ') || '—';
  }
  if (typeof value === 'object') {
    if ('url' in value && value.url) {
      return String(value.url);
    }
    return JSON.stringify(value);
  }
  return `${value}`;
};

export const getAppointmentFormAction = (
  entry: AppointmentFormEntry,
): {label: string; mode: 'view' | 'fill'; allowSign: boolean} => {
  const isSigned = entry.status === 'signed';
  if (isSigned) {
    return {label: 'View form', mode: 'view', allowSign: false};
  }
  if (entry.submission && entry.signingRequired) {
    return {label: 'View & Sign', mode: 'view', allowSign: true};
  }
  if (entry.submission) {
    return {label: 'View form', mode: 'view', allowSign: false};
  }
  return {
    label: entry.signingRequired ? 'Fill & Sign' : 'Fill form',
    mode: 'fill',
    allowSign: entry.signingRequired,
  };
};

export const getAppointmentFormAnswerRows = (
  entry: AppointmentFormEntry,
): Array<{id: string; label: string; value: string}> => {
  if (!entry.submission) {
    return [];
  }
  const rows: Array<{id: string; label: string; value: string}> = [];
  const collect = (fields: FormField[]) => {
    fields.forEach(f => {
      if (f.type === 'group') {
        collect(f.fields);
        return;
      }
      rows.push({
        id: f.id,
        label: f.label ?? f.id,
        value: formatAppointmentFormValue(f, entry.submission?.answers?.[f.id]),
      });
    });
  };
  if (entry.form.schema?.length) {
    collect(entry.form.schema);
  }
  const filtered = rows.filter(r => r.value !== '—' && r.value !== '');
  if (filtered.length) {
    return filtered;
  }
  const rawAnswers = entry.submission.answers ?? {};
  const capitalize = (text: string) => {
    if (!text.length) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
  };
  return Object.entries(rawAnswers).flatMap(([key, val]) =>
    val !== undefined && val !== null && `${val}`.trim() !== ''
      ? [
          {
            id: key,
            label: capitalize(key.replaceAll('_', ' ')),
            value: `${val}`,
          },
        ]
      : [],
  );
};
