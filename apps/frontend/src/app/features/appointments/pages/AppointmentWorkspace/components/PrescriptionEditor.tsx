import React, { useMemo, useState } from 'react';
import { LuChevronDown, LuCopy, LuPrinter, LuShield, LuTrash2 } from 'react-icons/lu';
import SearchResultsDropdown from '@/app/features/appointments/pages/AppointmentWorkspace/components/SearchResultsDropdown';
import WorkspaceSearchResultRow from '@/app/features/appointments/pages/AppointmentWorkspace/components/WorkspaceSearchResultRow';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import Search from '@/app/ui/inputs/Search';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import type { DropdownOption } from '@/app/hooks/useDropdown';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import { RxBadge } from '@/app/features/appointments/pages/AppointmentWorkspace/components/RxBadge';
import { StockHealthPill } from '@/app/features/appointments/pages/AppointmentWorkspace/components/StockHealthPill';
import { TitleAddIcon } from '@/app/features/appointments/pages/AppointmentWorkspace/components/TitleAddIcon';
import BilledBadge from '@/app/features/appointments/pages/AppointmentWorkspace/components/BilledBadge';
import { formatMoney } from '@/app/lib/money';
import { AdminstrationOptions, FormOptions } from '@/app/features/inventory/pages/Inventory/types';
import {
  DURATION_UNIT_OPTIONS,
  FREQUENCY_OPTIONS,
  validatePrescriptionItem,
} from '@/app/features/appointments/lib/inventoryPrescription';
import type {
  PrescriptionFulfillment,
  PrescriptionItem,
} from '@/app/features/appointments/types/workspace';
import type { PrescriptionTemplateOption } from '@/app/features/appointments/services/workspaceTemplateService';

type PrescriptionEditorProps = {
  items: PrescriptionItem[];
  catalogItems?: Omit<PrescriptionItem, 'id'>[];
  templateItems?: PrescriptionTemplateOption[];
  readOnly: boolean;
  deleteLocked?: boolean;
  onAddItem: (item: Omit<PrescriptionItem, 'id'>) => void;
  onApplyTemplate?: (template: PrescriptionTemplateOption) => void;
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
const EMPTY_TEMPLATE_ITEMS: PrescriptionTemplateOption[] = [];

const formatCents = (cents: number): string => formatMoney(cents / 100, 'USD');

const copyValue = (value?: string) => {
  if (!value || !globalThis.navigator?.clipboard) return;
  globalThis.navigator.clipboard.writeText(value).catch(() => undefined);
};

const joinValue = (...parts: Array<string | undefined>): string | undefined => {
  const joined = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' ');
  return joined || undefined;
};

/** Build {label,value} options for LabelDropdown, including the current value if off-list. */
const toOptions = (values: string[], current?: string): DropdownOption[] => {
  const trimmed = current?.trim();
  const merged = trimmed && !values.includes(trimmed) ? [trimmed, ...values] : values;
  return merged.map((value) => ({ label: value, value }));
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

/** Small neutral pill that surfaces an inventory-owned fact (read-only). */
const FactChip = ({ label, value }: { label: string; value?: string }) => {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-2xl bg-neutral-100 px-2.5 py-1 text-caption-2 text-text-secondary">
      <span className="font-medium text-text-primary">{label}:</span>
      {value}
    </span>
  );
};

/** Amber controlled-drug pill, optionally annotated with the DEA schedule. */
const ControlledPill = ({ schedule }: { schedule?: string }) => (
  <span className="inline-flex items-center gap-1 rounded-2xl border border-pill-warning-text bg-pill-warning-bg px-2 py-0.5 text-caption-2 font-medium text-pill-warning-text">
    <LuShield size={12} aria-hidden="true" />
    {schedule ? `Controlled · ${schedule}` : 'Controlled'}
  </span>
);

/** Editable cell using the shared floating-label input, with inline validation. */
const EditableCell = ({
  label,
  value,
  readOnly,
  error,
  onChange,
}: {
  label: string;
  value: string;
  readOnly: boolean;
  error?: string;
  onChange: (value: string) => void;
}) => (
  <FormInput
    intype="text"
    inlabel={label}
    value={value}
    readonly={readOnly}
    error={error}
    onChange={(e) => onChange(e.target.value)}
  />
);

/** Searchable select cell using the shared room/unit-style LabelDropdown. */
const SelectCell = ({
  label,
  value,
  options,
  readOnly,
  onChange,
}: {
  label: string;
  value?: string;
  options: string[];
  readOnly: boolean;
  onChange: (value: string) => void;
}) =>
  readOnly ? (
    <FormInput intype="text" inlabel={label} value={value ?? ''} readonly onChange={() => {}} />
  ) : (
    <LabelDropdown
      placeholder={label}
      options={toOptions(options, value)}
      defaultOption={value ?? ''}
      onSelect={(option) => onChange(option.value)}
    />
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
  <div className="relative w-full flex-1 sm:min-w-56">
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
  const errors = validatePrescriptionItem(item);

  // Inventory-owned facts. Form/Route only become editable when inventory did not supply them.
  const strengthLabel = joinValue(item.strength, item.strengthUnit);
  const hasForm = Boolean(item.dosageForm?.trim());
  const hasRoute = Boolean(item.route?.trim());

  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-card-border p-4">
      {/* Header: number + name + brand + Rx badge on the left; pills, fulfillment
        dropdown and the remove button on the right. */}
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-text-primary">
            {index + 1}. {item.medicineName}
          </span>
          {item.brand && (
            <span className="rounded-2xl bg-primary-100 px-2 py-0.5 text-caption-2 font-medium text-text-brand">
              {item.brand}
            </span>
          )}
          <RxBadge />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {item.controlledSubstance && <ControlledPill schedule={item.drugSchedule} />}
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

      {/* Inventory-owned facts (read-only chips) — only rendered when present. */}
      {(item.genericName || strengthLabel || hasForm || hasRoute) && (
        <div className="flex flex-wrap items-center gap-2">
          <FactChip label="Generic" value={item.genericName} />
          <FactChip label="Strength" value={strengthLabel} />
          {hasForm && <FactChip label="Form" value={item.dosageForm} />}
          {hasRoute && <FactChip label="Route" value={item.route} />}
        </div>
      )}

      {/* Prescribing fields (clinician-entered) on one wrapping row. Each control is sized to its
        content — dropdowns wide enough for their longest option, number fields kept narrow — and
        Instructions flexes to fill the remaining space with the line price pinned to the end.
        Strength comes from inventory (chip above), so there is no separate Dose field. Form/Route
        appear here only when inventory did not define them (else they show as chips above). */}
      <div className="flex flex-wrap items-start gap-3">
        {/* Frequency dropdown: widest option is "TID (three times daily)". */}
        <div className="w-full sm:w-56">
          <SelectCell
            label="Frequency"
            value={item.frequency}
            options={FREQUENCY_OPTIONS}
            readOnly={rowReadOnly}
            onChange={(frequency) => onUpdateItem(item.id, { frequency })}
          />
        </div>
        <div className="w-24">
          <EditableCell
            label="Duration"
            value={item.durationDays ?? ''}
            readOnly={rowReadOnly}
            error={errors.durationDays}
            onChange={(durationDays) => onUpdateItem(item.id, { durationDays })}
          />
        </div>
        <div className="w-full sm:w-36">
          <SelectCell
            label="Unit"
            value={item.durationUnit ?? 'days'}
            options={DURATION_UNIT_OPTIONS}
            readOnly={rowReadOnly}
            onChange={(durationUnit) => onUpdateItem(item.id, { durationUnit })}
          />
        </div>
        <div className="w-20">
          <EditableCell
            label="Qty"
            value={item.qty ?? ''}
            readOnly={rowReadOnly}
            error={errors.qty}
            onChange={(qty) => onUpdateItem(item.id, { qty })}
          />
        </div>
        <div className="w-20">
          <EditableCell
            label="Refills"
            value={item.refill ?? ''}
            readOnly={rowReadOnly}
            error={errors.refill}
            onChange={(refill) => onUpdateItem(item.id, { refill })}
          />
        </div>
        {!hasForm && (
          <div className="w-full sm:w-36">
            <SelectCell
              label="Form"
              value={item.dosageForm}
              options={FormOptions}
              readOnly={rowReadOnly}
              onChange={(dosageForm) => onUpdateItem(item.id, { dosageForm })}
            />
          </div>
        )}
        {!hasRoute && (
          <div className="w-full sm:w-36">
            <SelectCell
              label="Route"
              value={item.route}
              options={AdminstrationOptions}
              readOnly={rowReadOnly}
              onChange={(route) => onUpdateItem(item.id, { route })}
            />
          </div>
        )}
        <InstructionsField
          value={item.instructions ?? ''}
          readOnly={rowReadOnly}
          onChange={(value) => onUpdateItem(item.id, { instructions: value })}
        />
        <span className="shrink-0 self-center text-body-3-emphasis font-bold text-text-primary">
          {item.priceCents == null ? '-' : formatCents(item.priceCents)}
        </span>
      </div>
    </li>
  );
};

const PrescriptionEditor = ({
  items,
  catalogItems = EMPTY_CATALOG_ITEMS,
  templateItems = EMPTY_TEMPLATE_ITEMS,
  readOnly,
  deleteLocked = readOnly,
  onAddItem,
  onApplyTemplate,
  onUpdateItem,
  onRemoveItem,
  onPrint,
}: PrescriptionEditorProps) => {
  const [search, setSearch] = useState('');
  const searchRef = React.useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query === '') return [];
    return catalogItems.filter((item) => {
      const haystack = [item.medicineName, item.brand, item.genericName, item.sku]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [catalogItems, search]);

  const templateMatches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query === '') return [];
    return templateItems.filter((template) => template.name.toLowerCase().includes(query));
  }, [search, templateItems]);

  const hasSearchMatches = matches.length > 0 || templateMatches.length > 0;

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
        {!readOnly && (
          <div ref={searchRef} className="relative w-full sm:max-w-90">
            <Search
              value={search}
              setSearch={setSearch}
              placeholder="Search medicines or prescription templates..."
              label="Search medicines or prescription templates"
              className="w-full!"
            />
            <SearchResultsDropdown
              anchorRef={searchRef}
              open={hasSearchMatches}
              onClose={() => setSearch('')}
            >
              <ul>
                {templateMatches.map((template) => (
                  <WorkspaceSearchResultRow
                    key={template.id}
                    name={template.name}
                    badge={
                      <span className="rounded-2xl bg-neutral-100 px-2 py-0.5 text-caption-2 font-medium text-text-secondary">
                        Template
                      </span>
                    }
                    origin={`${template.items.length} medication${template.items.length === 1 ? '' : 's'}`}
                    onSelect={() => {
                      onApplyTemplate?.(template);
                      setSearch('');
                    }}
                  />
                ))}
                {matches.map((item) => (
                  <WorkspaceSearchResultRow
                    key={`${item.medicineName}-${item.sku ?? ''}`}
                    name={
                      joinValue(item.medicineName, item.brand ? `(${item.brand})` : undefined) ??
                      item.medicineName
                    }
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
        )}
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
