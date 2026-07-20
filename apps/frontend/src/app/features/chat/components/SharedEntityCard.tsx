'use client';

/**
 * Renders a PIMS record shared into the chat (from message.sharedEntity, posted
 * server-side by the share endpoint). The COMPANION label is the only one that
 * carries the org-configurable animal noun, applied via useCompanionTerminologyText
 * ("Companion record" -> "Patient record" etc.). "Pet parent" is never rewritten.
 */

import type { IconType } from 'react-icons';
import {
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

export function SharedEntityCard({
  entity,
}: Readonly<{ entity: SharedEntityData; mine?: boolean }>) {
  const rewrite = useCompanionTerminologyText();
  const Icon = ICONS[entity.entityType] ?? IoDocumentTextOutline;
  const baseLabel = LABELS[entity.entityType] ?? 'Shared item';
  const label = entity.entityType === 'COMPANION' ? rewrite(baseLabel) : baseLabel;
  const subtitle =
    typeof entity.snapshot?.subtitle === 'string' ? entity.snapshot.subtitle : undefined;

  return (
    <div className="flex w-64 max-w-full items-start gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] p-3 shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)] xl:w-[340px]">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--blue-soft)] text-[var(--blue-text)]">
        <Icon className="size-5" />
      </span>
      <div className="flex min-w-0 flex-col">
        <Text
          as="span"
          variant="caption-2"
          className="uppercase tracking-wide text-[var(--ink-faint)]"
        >
          {label}
        </Text>
        <Text as="span" variant="body-4-emphasis" className="truncate text-[var(--ink)]">
          {entity.title || label}
        </Text>
        {subtitle && (
          <Text as="span" variant="caption-1" className="truncate text-[var(--ink-faint)]">
            {subtitle}
          </Text>
        )}
      </div>
    </div>
  );
}

export default SharedEntityCard;
