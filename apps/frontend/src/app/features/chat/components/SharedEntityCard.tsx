'use client';

/**
 * Renders a PIMS record shared into the chat (from message.sharedEntity, posted
 * server-side by the share endpoint). The COMPANION label is the only one that
 * carries the org-configurable animal noun, applied via useCompanionTerminologyText
 * ("Companion record" -> "Patient record" etc.). "Pet parent" is never rewritten.
 *
 * Design ("Chat extended", shared entity card): a 340px / 16px-radius card split
 * by a --hairline rule into a header row (34px blue-soft glyph, 13px/700 title,
 * 11px subtitle, optional status pill) and a value row (tabular amount + a
 * "View in …" deep link), the latter rendered only when the snapshot carries one.
 */

import type { IconType } from 'react-icons';
import {
  IoArrowForward,
  IoCalendarOutline,
  IoClipboardOutline,
  IoDocumentTextOutline,
  IoMedkitOutline,
  IoReceiptOutline,
} from 'react-icons/io5';
import Text from '@/app/ui/Text';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';

export type SharedEntityData = {
  entityType: string;
  entityId: string;
  title?: string | null;
  snapshot?: Record<string, unknown> | null;
};

const ICONS: Record<string, IconType> = {
  COMPANION: IoMedkitOutline,
  APPOINTMENT: IoCalendarOutline,
  INVOICE: IoReceiptOutline,
  FORM: IoClipboardOutline,
  PRESCRIPTION: IoMedkitOutline,
  DOCUMENT: IoDocumentTextOutline,
};

const LABELS: Record<string, string> = {
  COMPANION: 'Companion record',
  APPOINTMENT: 'Appointment',
  INVOICE: 'Invoice',
  FORM: 'Form',
  PRESCRIPTION: 'Prescription',
  DOCUMENT: 'Document',
};

/** Where the value row's "View in …" link points, per shared entity type. */
const DEEP_LINKS: Record<string, { href: string; label: string }> = {
  COMPANION: { href: '/companions', label: 'View in Companions' },
  APPOINTMENT: { href: '/appointments', label: 'View in Appointments' },
  INVOICE: { href: '/finance', label: 'View in Finance' },
  FORM: { href: '/forms', label: 'View in Forms' },
};

/** Status pills reuse the shared appointment/invoice status token trio. */
const STATUS_TONES: Record<string, string> = {
  PAID: 'completed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  'NO-SHOW': 'no-show',
  'CHECKED-IN': 'checked-in',
  'IN-PROGRESS': 'in-progress',
  UPCOMING: 'upcoming',
  REQUESTED: 'requested',
};

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

export function SharedEntityCard({
  entity,
}: Readonly<{ entity: SharedEntityData; mine?: boolean }>) {
  const rewrite = useCompanionTerminologyText();
  const Icon = ICONS[entity.entityType] ?? IoDocumentTextOutline;
  const baseLabel = LABELS[entity.entityType] ?? 'Shared item';
  const label = entity.entityType === 'COMPANION' ? rewrite(baseLabel) : baseLabel;
  const subtitle = readString(entity.snapshot?.subtitle);
  const amount = readString(entity.snapshot?.amount);
  const status = readString(entity.snapshot?.status);
  const statusTone = status ? STATUS_TONES[status.toUpperCase()] : undefined;
  const deepLink = DEEP_LINKS[entity.entityType];
  const deepLinkLabel =
    deepLink && entity.entityType === 'COMPANION' ? rewrite(deepLink.label) : deepLink?.label;
  const showValueRow = Boolean(amount || deepLink);

  return (
    <div className="w-64 max-w-full overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)] xl:w-[340px]">
      <div
        className={
          showValueRow
            ? 'flex items-center gap-2.5 border-b border-[var(--hairline)] px-3.5 py-3'
            : 'flex items-center gap-2.5 px-3.5 py-3'
        }
      >
        <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[var(--blue-soft)] text-[var(--blue-text)]">
          <Icon className="h-[15px] w-[15px]" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <Text
            as="span"
            variant="body-4-emphasis"
            className="truncate text-[13px] font-bold text-[var(--ink)]"
          >
            {entity.title || label}
          </Text>
          {subtitle && (
            <Text
              as="span"
              variant="caption-1"
              className="truncate text-[11px] text-[var(--ink-faint)]"
            >
              {subtitle}
            </Text>
          )}
        </span>
        {status && (
          <span
            className="inline-flex shrink-0 items-center rounded-full border px-[9px] py-[3px] text-[9.5px] font-bold uppercase"
            style={{
              background: `var(--status-${statusTone ?? 'requested'}-bg)`,
              color: `var(--status-${statusTone ?? 'requested'}-text)`,
              borderColor: `var(--status-${statusTone ?? 'requested'}-border)`,
            }}
          >
            {status}
          </span>
        )}
      </div>
      {showValueRow && (
        <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
          {amount ? (
            <Text
              as="span"
              variant="body-3-emphasis"
              className="text-[15px] font-bold tabular-nums text-[var(--ink)]"
            >
              {amount}
            </Text>
          ) : (
            <span />
          )}
          {deepLink && (
            <a
              href={deepLink.href}
              className="flex shrink-0 items-center gap-[5px] text-xs font-semibold text-[var(--blue-text)]"
            >
              {deepLinkLabel}
              <IoArrowForward className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default SharedEntityCard;
