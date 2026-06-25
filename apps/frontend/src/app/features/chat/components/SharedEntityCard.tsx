'use client';

/**
 * Renders a PIMS record shared into the chat (from message.sharedEntity, posted
 * server-side by the share endpoint). The COMPANION label is the only one that
 * carries the org-configurable animal noun, applied via useCompanionTerminologyText
 * ("Companion record" -> "Patient record" etc.). "Pet parent" is never rewritten.
 */

import clsx from 'clsx';
import type { IconType } from 'react-icons';
import {
  LuStethoscope,
  LuCalendar,
  LuReceipt,
  LuClipboardList,
  LuPill,
  LuFileText,
} from 'react-icons/lu';
import Text from '@/app/ui/Text';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';

export type SharedEntityData = {
  entityType: string;
  entityId: string;
  title?: string | null;
  snapshot?: Record<string, unknown> | null;
};

const ICONS: Record<string, IconType> = {
  COMPANION: LuStethoscope,
  APPOINTMENT: LuCalendar,
  INVOICE: LuReceipt,
  FORM: LuClipboardList,
  PRESCRIPTION: LuPill,
  DOCUMENT: LuFileText,
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
  mine,
}: Readonly<{ entity: SharedEntityData; mine?: boolean }>) {
  const rewrite = useCompanionTerminologyText();
  const Icon = ICONS[entity.entityType] ?? LuFileText;
  const baseLabel = LABELS[entity.entityType] ?? 'Shared item';
  const label = entity.entityType === 'COMPANION' ? rewrite(baseLabel) : baseLabel;
  const subtitle =
    typeof entity.snapshot?.subtitle === 'string' ? entity.snapshot.subtitle : undefined;

  return (
    <div
      className={clsx(
        'flex w-64 max-w-full items-start gap-3 rounded-2xl border p-3',
        mine ? 'border-primary-300 bg-neutral-0' : 'border-chat-divider bg-neutral-0'
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-chat-panel text-primary-600">
        <Icon className="h-5 w-5" />
      </span>
      <div className="flex min-w-0 flex-col">
        <Text as="span" variant="caption-2" className="uppercase tracking-wide text-neutral-400">
          {label}
        </Text>
        <Text as="span" variant="body-4-emphasis" className="truncate text-neutral-900">
          {entity.title || label}
        </Text>
        {subtitle && (
          <Text as="span" variant="caption-1" className="truncate text-neutral-500">
            {subtitle}
          </Text>
        )}
      </div>
    </div>
  );
}

export default SharedEntityCard;
