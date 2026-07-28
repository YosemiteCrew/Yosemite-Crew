import { InvoiceItem, RoomReferenceMapping } from '@yosemite-crew/types';
import { Team } from '@/app/features/organization/types/team';
import { getStatusBadgeStyle } from '@/app/features/inventory/pages/Inventory/utils';
import type { StatusTone } from '@/app/ui/primitives/StatusPill/StatusPill';

/* Design pager: discrete numbered page pills, collapsed behind an ellipsis once
   the run exceeds 7 pages so the footer never wraps. Shared by every table
   footer so the pill run reads the same everywhere. */
const PAGE_PILL_LIMIT = 7;

/** One slot in the pager run: a numbered pill, or the collapsed ellipsis when
 *  `page` is null. `key` is a stable React key — a page pill is identified by its
 *  own number and a gap by the page it follows, both unique within a run, so no
 *  slot has to fall back to its array position. */
export type PagerEntry = { key: string; page: number | null };

const toPagerPage = (page: number): PagerEntry => ({ key: `page-${page}`, page });

const toPagerGap = (afterPage: number): PagerEntry => ({
  key: `gap-after-${afterPage}`,
  page: null,
});

export const buildPagerPageList = (current: number, total: number): PagerEntry[] => {
  if (total <= PAGE_PILL_LIMIT)
    return Array.from({ length: total }, (_, index) => toPagerPage(index + 1));
  const wanted = [1, current - 1, current, current + 1, total].filter(
    (page) => page >= 1 && page <= total
  );
  const unique = [...new Set(wanted)].sort((a, b) => a - b);
  const list: PagerEntry[] = [];
  let previous = 0;
  for (const page of unique) {
    if (previous && page - previous > 1) list.push(toPagerGap(previous));
    list.push(toPagerPage(page));
    previous = page;
  }
  return list;
};

export const getInvoiceItemNames = (items: InvoiceItem[]): string => {
  return items
    .map((item) => item.name?.trim())
    .filter(Boolean)
    .join(', ');
};

export const getInvoiceStatusStyle = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'awaiting_payment':
      return {
        color: 'var(--color-pill-info-text)',
        backgroundColor: 'var(--color-pill-info-bg)',
        borderColor: 'var(--color-pill-info-border)',
      };
    case 'paid':
      return {
        color: 'var(--color-pill-success-text)',
        backgroundColor: 'var(--color-pill-success-bg)',
        borderColor: 'var(--color-pill-success-border)',
      };
    case 'failed':
    case 'cancelled':
      return {
        color: 'var(--color-pill-warning-text)',
        backgroundColor: 'var(--color-pill-warning-bg)',
        borderColor: 'var(--color-pill-warning-border)',
      };
    case 'refunded':
      return {
        color: 'var(--color-pill-progress-text)',
        backgroundColor: 'var(--color-pill-progress-bg)',
        borderColor: 'var(--color-pill-progress-border)',
      };
    case 'pending':
    default:
      return {
        color: 'var(--color-pill-neutral-text)',
        backgroundColor: 'var(--color-pill-neutral-bg)',
        borderColor: 'var(--color-pill-neutral-border)',
      };
  }
};

export const getInventoryStatusStyle = (status: string) => {
  return getStatusBadgeStyle(status);
};

export const formatWeeklyWorkingHours = (value: Team['weeklyWorkingHours']) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return value || '0';
  }
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(parsed);
};

export const getAvailabilityStatusStyle = (status: string) => {
  switch (status.toLowerCase()) {
    case 'available':
      return {
        color: 'var(--color-pill-success-text)',
        backgroundColor: 'var(--color-pill-success-bg)',
        borderColor: 'var(--color-pill-success-border)',
      };
    case 'consulting':
      return {
        color: 'var(--color-pill-progress-text)',
        backgroundColor: 'var(--color-pill-progress-bg)',
        borderColor: 'var(--color-pill-progress-border)',
      };
    case 'off-duty':
      return {
        color: 'var(--color-pill-warning-text)',
        backgroundColor: 'var(--color-pill-warning-bg)',
        borderColor: 'var(--color-pill-warning-border)',
      };
    case 'requested':
    default:
      return {
        color: 'var(--color-pill-neutral-text)',
        backgroundColor: 'var(--color-pill-neutral-bg)',
        borderColor: 'var(--color-pill-neutral-border)',
      };
  }
};

export const getAvailabilityStatusTone = (status: string): StatusTone => {
  switch (status.toLowerCase()) {
    case 'available':
      return 'success';
    case 'consulting':
      return 'progress';
    case 'off-duty':
      return 'warning';
    case 'requested':
    default:
      return 'neutral';
  }
};

export const getCompanionStatusStyle = (status: string) => {
  switch (status.toLowerCase()) {
    case 'active':
      return {
        color: 'var(--color-pill-success-text)',
        backgroundColor: 'var(--color-pill-success-bg)',
        borderColor: 'var(--color-pill-success-border)',
      };
    case 'archived':
      return {
        color: 'var(--color-pill-warning-text)',
        backgroundColor: 'var(--color-pill-warning-bg)',
        borderColor: 'var(--color-pill-warning-border)',
      };
    case 'inactive':
    default:
      return {
        color: 'var(--color-pill-neutral-text)',
        backgroundColor: 'var(--color-pill-neutral-bg)',
        borderColor: 'var(--color-pill-neutral-border)',
      };
  }
};

export const getCompanionStatusTone = (status?: string | null): StatusTone => {
  switch (String(status ?? '').toLowerCase()) {
    case 'active':
      return 'success';
    case 'archived':
      return 'warning';
    case 'inactive':
    default:
      return 'neutral';
  }
};

export const getFormsStatusStyle = (status: string) => {
  if (!status) {
    return {
      color: 'var(--color-pill-neutral-text)',
      backgroundColor: 'var(--color-pill-neutral-bg)',
      borderColor: 'var(--color-pill-neutral-border)',
    };
  }
  switch (status.toLowerCase()) {
    // Design: a live template is GREEN ("ACTIVE"), an archived one is the
    // neutral grey "requested" pill — neither is an alert state.
    case 'published':
      return {
        color: 'var(--color-pill-success-text)',
        backgroundColor: 'var(--color-pill-success-bg)',
        borderColor: 'var(--color-pill-success-border)',
      };
    case 'draft':
    case 'archived':
      return {
        color: 'var(--color-pill-neutral-text)',
        backgroundColor: 'var(--color-pill-neutral-bg)',
        borderColor: 'var(--color-pill-neutral-border)',
      };
    default:
      return {
        color: 'var(--color-pill-progress-text)',
        backgroundColor: 'var(--color-pill-progress-bg)',
        borderColor: 'var(--color-pill-progress-border)',
      };
  }
};

export const getInventoryTurnoverStatusStyle = (status?: string) => {
  const key = (status || '').toLowerCase();
  switch (key) {
    case 'excellent':
    case 'healthy':
      return {
        color: 'var(--color-pill-success-text)',
        backgroundColor: 'var(--color-pill-success-bg)',
        borderColor: 'var(--color-pill-success-border)',
      };
    case 'low':
    case 'out of stock':
      return {
        color: 'var(--color-pill-warning-text)',
        backgroundColor: 'var(--color-pill-warning-bg)',
        borderColor: 'var(--color-pill-warning-border)',
      };
    case 'moderate':
      return {
        color: 'var(--color-pill-progress-text)',
        backgroundColor: 'var(--color-pill-progress-bg)',
        borderColor: 'var(--color-pill-progress-border)',
      };
    default:
      return {
        color: 'var(--color-pill-neutral-text)',
        backgroundColor: 'var(--color-pill-neutral-bg)',
        borderColor: 'var(--color-pill-neutral-border)',
      };
  }
};

export const formatTurnoverStatus = (status?: string) => {
  const label = (status || '').toString().trim();
  if (!label) return '—';
  return label
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const getTaskStatusStyle = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'pending':
      return {
        color: 'var(--color-pill-neutral-text)',
        backgroundColor: 'var(--color-pill-neutral-bg)',
        borderColor: 'var(--color-pill-neutral-border)',
      };
    case 'in_progress':
      return {
        color: 'var(--color-pill-progress-text)',
        backgroundColor: 'var(--color-pill-progress-bg)',
        borderColor: 'var(--color-pill-progress-border)',
      };
    case 'completed':
      return {
        color: 'var(--color-pill-success-text)',
        backgroundColor: 'var(--color-pill-success-bg)',
        borderColor: 'var(--color-pill-success-border)',
      };
    default:
      return {
        color: 'var(--color-pill-warning-text)',
        backgroundColor: 'var(--color-pill-warning-bg)',
        borderColor: 'var(--color-pill-warning-border)',
      };
  }
};

export const getTaskStatusTone = (status: string): StatusTone => {
  switch (status?.toLowerCase()) {
    case 'pending':
      return 'neutral';
    case 'in_progress':
      return 'progress';
    case 'completed':
      return 'success';
    default:
      return 'warning';
  }
};

export const getOrganizationStatusStyle = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'active':
      return { color: 'var(--color-success-400)', backgroundColor: 'var(--color-success-100)' };
    case 'pending':
      return { color: 'var(--color-warning-600)', backgroundColor: 'var(--color-warning-100)' };
    default:
      return { color: 'var(--color-neutral-0)', backgroundColor: 'var(--color-badge-blue-bg)' };
  }
};

export const getServiceNames = (services: any[] = []): string =>
  services.map((s) => s.name).join(', ');

export const getStringified = (services: string[] = []): string => {
  return services.join(', ');
};

export const joinNames = (
  byId: Record<string, string>,
  ids: Array<string | RoomReferenceMapping> = []
) => {
  const names = ids
    .map((item) => (typeof item === 'string' ? byId[item] : item.name || byId[item.id]))
    .filter((name): name is string => Boolean(name));
  return names.length ? names.join(', ') : '-';
};
