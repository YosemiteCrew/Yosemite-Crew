import React, { useMemo, useState } from 'react';
import { LuChevronDown, LuCopy, LuPrinter, LuTrash2 } from 'react-icons/lu';
import SearchResultsDropdown from '@/app/features/appointments/pages/AppointmentWorkspace/components/SearchResultsDropdown';
import WorkspaceSearchResultRow from '@/app/features/appointments/pages/AppointmentWorkspace/components/WorkspaceSearchResultRow';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import Search from '@/app/ui/inputs/Search';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import { RxBadge } from '@/app/features/appointments/pages/AppointmentWorkspace/components/RxBadge';
import { StockHealthPill } from '@/app/features/appointments/pages/AppointmentWorkspace/components/StockHealthPill';
import { TitleAddIcon } from '@/app/features/appointments/pages/AppointmentWorkspace/components/TitleAddIcon';
import BilledBadge from '@/app/features/appointments/pages/AppointmentWorkspace/components/BilledBadge';
import { formatMoney } from '@/app/lib/money';
import type {
  PrescriptionFulfillment,
  PrescriptionItem,
} from '@/app/features/appointments/types/workspace';

type PrescriptionEditorProps = {
  items: PrescriptionItem[];
  catalogItems?: Omit<PrescriptionItem, 'id'>[];
  readOnly: boolean;
  deleteLocked?: boolean;
  onAddItem: (item: Omit<PrescriptionItem, 'id'>) => void;
  onUpdateItem: (id: string, patch: Partial<PrescriptionItem>) => void;
  onRemoveItem: (id: string) => void;
  onPrint: () => void;
};

const FULFILLMENT_LABELS: Record<PrescriptionFulfillment, string> = {
  IN_HOUSE: 'In-house fulfilled',
  PRESCRIPTION_ONLY: 'Prescription only',
};

const FULFILLMENT_OPTIONS = Object.keys(FULFILLMENT_LABELS) as PrescriptionFulfillment[];
const EMPTY_CATALOG_ITEMS: Omit<PrescriptionItem, 'id'>[] = [];

/**
 * Compact editable fields (shared floating input). Strength comes from the inventory item; Qty is
 * the number of units to dispense (definable in the template, editable here). The remaining
 * prescribing fields are filled by the clinician when not preset by the template.
 */
const EDITABLE_FIELDS: { key: keyof PrescriptionItem; label: string; width: string }[] = [
  { key: 'dosage', label: 'Strength', width: 'w-full sm:w-28' },
  { key: 'route', label: 'Route', width: 'w-full sm:w-28' },
  { key: 'frequency', label: 'Freq.', width: 'w-full sm:w-24' },
  { key: 'durationDays', label: 'Duration', width: 'w-full sm:w-28' },
  { key: 'qty', label: 'Qty', width: 'w-full sm:w-20' },
  { key: 'refill', label: 'Refill', width: 'w-full sm:w-24' },
];

const formatCents = (cents: number): string => formatMoney(cents / 100, 'USD');

const copyValue = (value?: string) => {
  if (!value || !globalThis.navigator?.clipboard) return;
  globalThis.navigator.clipboard.writeText(value).catch(() => undefined);
};

/**
 * Compact fulfillment pill dropdown (In-house fulfilled / Prescription only),
 * styled like the workspace status pills with a small caret.
 */
const FulfillmentDropdown = ({
  value,
  disabled,
  onChange,
}: {
  value: PrescriptionFulfillment;
  disabled: boolean;
  onChange: (value: PrescriptionFulfillment) => void;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <select
        aria-label="Fulfillment"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value as PrescriptionFulfillment)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="flex appearance-none items-center gap-1 rounded-2xl border border-neutral-500 bg-neutral-0 py-1.5 pr-10 pl-4 text-[14px] leading-[120%] font-medium text-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {FULFILLMENT_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {FULFILLMENT_LABELS[option]}
          </option>
        ))}
      </select>
      <LuChevronDown
        size={16}
        aria-hidden="true"
        className={`pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 transition-transform ${open ? 'rotate-180' : ''}`}
      />
    </div>
  );
};

/**
 * Editable cell using the shared floating-label input (FormInput) — the same
 * style used across the app. Editable and view-only both keep the floating label
 * + bordered box; view-only just renders the field read-only.
 */
const EditableCell = ({
  label,
  value,
  width,
  readOnly,
  onChange,
}: {
  label: string;
  value: string;
  width: string;
  readOnly: boolean;
  onChange: (value: string) => void;
}) => (
  <div className={width}>
    <FormInput
      intype="text"
      inlabel={label}
      value={value}
      readonly={readOnly}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

/** Instructions field: floating input with a copy icon docked inside the box. */
const InstructionsField = ({
  value,
  readOnly,
  onChange,
}: {
  value: string;
  readOnly: boolean;
  onChange: (value: string) => void;
}) => (
  <div className="relative w-full flex-1 sm:min-w-64">
    <FormInput
      intype="text"
      inlabel="Instructions"
      value={value}
      readonly={readOnly}
      onChange={(e) => onChange(e.target.value)}
      className="pr-11!"
    />
    <button
      type="button"
      aria-label="Copy instructions"
      onClick={() => copyValue(value)}
      className="absolute top-1/2 right-3 -translate-y-1/2 text-text-secondary hover:text-text-brand focus-visible:outline-none"
    >
      <LuCopy size={16} aria-hidden="true" />
    </button>
  </div>
);

const PrescriptionRow = ({
  item,
  index,
  readOnly,
  deleteLocked,
  onUpdateItem,
  onRemoveItem,
}: {
  item: PrescriptionItem;
  index: number;
  readOnly: boolean;
  deleteLocked: boolean;
  onUpdateItem: (id: string, patch: Partial<PrescriptionItem>) => void;
  onRemoveItem: (id: string) => void;
}) => {
  // Billed/paid items are locked: fields render read-only and there is no delete.
  const isBilled = Boolean(item.billed);
  const rowReadOnly = readOnly || isBilled;
  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-card-border p-4">
      {/* Header: number + name + Rx badge on the left; stock health, fulfillment
        dropdown and the remove button on the right. */}
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-text-primary">
            {index + 1}. {item.medicineName}
          </span>
          <RxBadge />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {item.stockQty != null && (
            <StockHealthPill qty={item.stockQty} low={item.lowStock ?? false} />
          )}
          {isBilled && <BilledBadge />}
          <FulfillmentDropdown
            value={item.fulfillment}
            disabled={rowReadOnly}
            onChange={(fulfillment) => onUpdateItem(item.id, { fulfillment })}
          />
          {isBilled ? null : (
            <CircleIconButton
              icon={<LuTrash2 aria-hidden="true" />}
              label={`Remove ${item.medicineName}`}
              variant="danger"
              disabled={deleteLocked}
              onClick={() => onRemoveItem(item.id)}
            />
          )}
        </div>
      </div>

      {/* Fields row: compact floating inputs, the instructions field, then the
        line price pinned to the right end. */}
      <div className="flex flex-wrap items-center gap-3">
        {EDITABLE_FIELDS.map((field) => (
          <EditableCell
            key={field.key}
            label={field.label}
            width={field.width}
            value={String(item[field.key] ?? '')}
            readOnly={rowReadOnly}
            onChange={(value) => onUpdateItem(item.id, { [field.key]: value })}
          />
        ))}
        <InstructionsField
          value={item.instructions ?? ''}
          readOnly={rowReadOnly}
          onChange={(value) => onUpdateItem(item.id, { instructions: value })}
        />
        <span className="ml-auto shrink-0 text-body-3-emphasis font-bold text-text-primary">
          {item.priceCents == null ? '-' : formatCents(item.priceCents)}
        </span>
      </div>
    </li>
  );
};

const PrescriptionEditor = ({
  items,
  catalogItems = EMPTY_CATALOG_ITEMS,
  readOnly,
  deleteLocked = readOnly,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onPrint,
}: PrescriptionEditorProps) => {
  const [search, setSearch] = useState('');
  const searchRef = React.useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query === '') return [];
    return catalogItems.filter((item) => item.medicineName.toLowerCase().includes(query));
  }, [catalogItems, search]);

  return (
    <div className="flex flex-col gap-3">
      {/* Search + print row sits above the floating container (matches the other
          steps); results surface as a dropdown on type. */}
      <div className="relative z-50 flex items-center justify-end gap-3">
        <CircleIconButton
          icon={<LuPrinter aria-hidden="true" />}
          label="Print Labels"
          onClick={onPrint}
        />
        <div ref={searchRef} className="relative w-full sm:max-w-90">
          <Search
            value={search}
            setSearch={setSearch}
            placeholder="Search by medicine name, composition..."
            label="Search medicines"
            className="w-full!"
          />
          <SearchResultsDropdown
            anchorRef={searchRef}
            open={matches.length > 0}
            onClose={() => setSearch('')}
          >
            <ul>
              {matches.map((item) => (
                <WorkspaceSearchResultRow
                  key={item.medicineName}
                  name={item.medicineName}
                  badge={
                    <span className="rounded-2xl bg-primary-100 px-2 py-0.5 text-caption-2 font-medium text-text-brand">
                      Medication
                    </span>
                  }
                  onSelect={() => {
                    onAddItem(item);
                    setSearch('');
                  }}
                />
              ))}
            </ul>
          </SearchResultsDropdown>
        </div>
      </div>

      <SectionContainer
        titleClassName="text-yc-20-b-primary"
        title="Prescription"
        titleIcon={<TitleAddIcon />}
        className="flex flex-col gap-5"
      >
        {items.length === 0 ? (
          <p className="rounded-2xl bg-neutral-100 p-4 text-body-4 text-text-secondary">
            No prescription items added yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item, index) => (
              <PrescriptionRow
                key={item.id}
                item={item}
                index={index}
                readOnly={readOnly}
                deleteLocked={deleteLocked}
                onUpdateItem={onUpdateItem}
                onRemoveItem={onRemoveItem}
              />
            ))}
          </ul>
        )}
      </SectionContainer>
    </div>
  );
};

export default PrescriptionEditor;
