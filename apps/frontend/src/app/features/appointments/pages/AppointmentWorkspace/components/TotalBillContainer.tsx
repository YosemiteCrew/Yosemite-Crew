import React, { use, useMemo, useRef, useState } from 'react';
import { IoAddOutline, IoInformationCircleOutline, IoTrashOutline } from 'react-icons/io5';
import SearchResultsDropdown from '@/app/features/appointments/pages/AppointmentWorkspace/components/SearchResultsDropdown';
import WorkspaceSearchResultRow from '@/app/features/appointments/pages/AppointmentWorkspace/components/WorkspaceSearchResultRow';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import Search from '@/app/ui/inputs/Search';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import PackageBreakdownTooltip from '@/app/features/appointments/pages/AppointmentWorkspace/components/PackageBreakdownTooltip';
import type { BillableKind, InvoiceLineItem } from '@/app/features/appointments/types/workspace';
import { formatMoney } from '@/app/lib/money';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import {
  OVERALL_DISCOUNT_ERROR_ID,
  overallDiscountCapMessage,
} from '@/app/features/appointments/pages/AppointmentWorkspace/components/totalBillMessages';
import TableHead from '@/app/ui/tables/TableHead';

export type BillableSearchItem = Omit<InvoiceLineItem, 'id'> & { kind?: BillableKind };

const KIND_LABELS: Record<BillableKind, string> = {
  EXISTING_TREATMENT: 'Existing treatment',
  IN_HOUSE_PRESCRIPTION: 'In-house prescription',
  PACKAGE_COMPONENT: 'Package component',
  BILLING_ONLY: 'Billing-only',
  INVENTORY: 'Stock item',
};

const KIND_PILL_CLASSES: Record<BillableKind, string> = {
  EXISTING_TREATMENT: 'border-pill-info-border bg-pill-info-bg text-pill-info-text',
  IN_HOUSE_PRESCRIPTION: 'border-pill-warning-border bg-pill-warning-bg text-pill-warning-text',
  PACKAGE_COMPONENT: 'border-pill-success-border bg-pill-success-bg text-pill-success-text',
  BILLING_ONLY: 'border-card-border bg-neutral-100 text-text-secondary',
  INVENTORY: 'border-card-border bg-neutral-100 text-text-secondary',
};

const KindPill = ({ kind }: { kind: BillableKind }) => (
  <span
    className={`inline-flex shrink-0 rounded-2xl border px-2 py-0.5 text-caption-2 ${KIND_PILL_CLASSES[kind]}`}
  >
    {KIND_LABELS[kind]}
  </span>
);

const InfoTooltipIcon = ({
  label,
  content,
  maxWidth = 320,
}: {
  label: string;
  content: React.ReactNode;
  maxWidth?: number;
}) => (
  <GlassTooltip content={content} side="bottom" maxWidth={maxWidth}>
    <button
      type="button"
      aria-label={label}
      className="inline-flex size-4 shrink-0 translate-y-px items-center justify-center text-text-secondary transition-colors hover:text-blue-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
    >
      <IoInformationCircleOutline aria-hidden="true" size={14} />
    </button>
  </GlassTooltip>
);

type TotalBillContainerProps = {
  items: InvoiceLineItem[];
  billableItems: BillableSearchItem[];
  /** Lower-cased names of billed medications missing prescription details; these
   *  rows get an (i) "Fill information in previous step" hint. */
  incompleteItemNames?: Set<string>;
  /** ISO currency code for money formatting (from the encounter/finance). */
  currency?: string;
  depositCents: number;
  withdrawDeposit: boolean;
  overallDiscountPercent: number;
  /** Backend tax rate for this bill; drives the exclusive-of-tax footer copy. */
  taxPercent?: number;
  /** The organisation's overall-discount cap. Null/undefined = no cap configured. */
  maxOverallDiscountPercent?: number | null;
  onToggleWithdrawDeposit: (value: boolean) => void;
  onChangeOverallDiscount: (percent: number) => void;
  onAddItem: (item: Omit<InvoiceLineItem, 'id'>) => void;
  onUpdateItem: (id: string, patch: Partial<InvoiceLineItem>) => void;
  onRemoveItem: (id: string) => void;
};

// One currency per bill; share it via context so the nested footer/row helpers
// format money without prop-drilling through every layout wrapper.
const CurrencyContext = React.createContext<string>('USD');

const formatCents = (cents: number, currency = 'USD'): string => formatMoney(cents / 100, currency);

const useCurrency = () => use(CurrencyContext);

// Totals are estimated exclusive of tax — the backend operates in exclusive-tax
// mode, finalising tax via the finance/tax provider at invoice finalisation. The
// footer copy reflects the backend tax rate (taxPercent) rather than asserting a
// flat "exclusive of taxes" when no rate applies.
const buildTotals = (
  items: InvoiceLineItem[],
  discountPercent: number,
  depositCents: number,
  withdrawDeposit: boolean
) => {
  const subtotalCents = items.reduce((sum, item) => sum + item.grossCents, 0);
  const lineDiscountCents = items.reduce((sum, item) => sum + item.discountCents, 0);
  const overallDiscountCents = Math.round((subtotalCents * discountPercent) / 100);
  const discountedCents = Math.max(0, subtotalCents - lineDiscountCents - overallDiscountCents);
  const estimatedTotalCents = discountedCents;
  const remainingDepositCents = withdrawDeposit
    ? Math.max(0, depositCents - estimatedTotalCents)
    : depositCents;
  return {
    subtotalCents,
    overallDiscountCents,
    estimatedTotalCents,
    remainingDepositCents,
  };
};

/**
 * Shared column template for the heading row and every line row. The headings
 * and the rows live in separate grids, so the template must resolve to identical
 * track widths in both — that means NO content-driven `auto` track (the delete
 * column is a fixed 36px, the width of the circle button) and the flexible first
 * column is the only fr track. Every other column is a fixed px width.
 */
const ROW_GRID =
  'grid gap-3 sm:grid-cols-[minmax(0,1.7fr)_110px_72px_130px_150px_120px_36px] sm:items-center';

/**
 * Each heading's text starts exactly where its value-box text starts: the value
 * boxes have an inner px-3, so the headings carry the same px-3 inset. The label
 * therefore sits at the start of its column, directly above the value below it.
 */
const BILL_COLUMNS = [
  { key: 'item', label: 'Item Name' },
  { key: 'unit', label: 'Unit Price' },
  { key: 'qty', label: 'Qnt.' },
  { key: 'gross', label: 'Gross Amt.' },
  { key: 'discount', label: 'Discount' },
  { key: 'amount', label: 'Amount' },
  { key: 'actions', label: '' },
] as const;

/* Not sticky: this sits inside the appointment side modal, where a sticky band
   resolves against the drawer's transformed parent and strands itself. */
const ColumnHeadings = () => (
  <TableHead
    columns={BILL_COLUMNS}
    track="minmax(0,1.7fr) 110px 72px 130px 150px 120px 36px"
    gap="12px"
    sticky={false}
    // Flush: the BillRows below carry no outer padding, so the recipe's 20px
    // would start the headings 20px right of their values and resolve the
    // flexible column against a width 40px narrower than the rows.
    className="yc-table-head--flush rounded-lg [&>span]:px-3"
  />
);

/** Plain (non-editable) text cell for line values that the user cannot change. */
type TextCellProps = React.HTMLAttributes<HTMLSpanElement> & {
  children?: React.ReactNode;
};

const TextCell = ({ children, className, ...rest }: TextCellProps) => (
  <span
    className={`flex h-10 items-center px-3 text-body-4 text-text-primary ${className ?? ''}`}
    {...rest}
  >
    {children}
  </span>
);

/** Shared editable box style for the qty + discount inputs (with a leading prefix). */
const EDITABLE_BOX =
  'h-10 w-full rounded-xl border border-input-border-default bg-transparent pl-7 pr-3 text-body-4 text-text-primary focus-visible:border-input-border-active focus-visible:outline-none';

/** Editable quantity box with a permanent leading "×"; re-derives gross/amount. */
const QtyInput = ({
  item,
  onUpdateItem,
}: {
  item: InvoiceLineItem;
  onUpdateItem: (id: string, patch: Partial<InvoiceLineItem>) => void;
}) => (
  <div className="relative">
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-body-4 text-text-secondary"
    >
      ×
    </span>
    <input
      type="number"
      min={1}
      value={item.qty}
      aria-label={`Quantity for ${item.name}`}
      onChange={(e) => {
        const qty = Math.max(1, Number.parseInt(e.target.value, 10) || 1);
        onUpdateItem(item.id, { qty });
      }}
      className={EDITABLE_BOX}
    />
  </div>
);

const formatPercent = (value: number): number => Number(value.toFixed(2));

const getDiscountPercent = (item: InvoiceLineItem): number => {
  if (item.grossCents <= 0) return 0;
  return (item.discountCents / item.grossCents) * 100;
};

const getMaxDiscountPercent = (item: InvoiceLineItem): number | undefined => {
  if (item.maxDiscountPercent != null) return item.maxDiscountPercent;
  if (item.maxDiscountCents == null || item.grossCents <= 0) return undefined;
  return (item.maxDiscountCents / item.grossCents) * 100;
};

/** Editable per-line discount as a percentage; the money value is read-only. */
const DiscountInput = ({
  item,
  onUpdateItem,
}: {
  item: InvoiceLineItem;
  onUpdateItem: (id: string, patch: Partial<InvoiceLineItem>) => void;
}) => {
  const currency = useCurrency();
  const maxPercent = getMaxDiscountPercent(item);
  const discountPercent = getDiscountPercent(item);
  return (
    <div className="flex w-22 flex-col items-center gap-1">
      <span className="relative inline-flex w-22 items-center">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-body-4 text-pill-success-text"
        >
          %
        </span>
        <input
          type="number"
          min={0}
          max={maxPercent}
          step={0.01}
          value={formatPercent(discountPercent)}
          aria-label={`Discount percent for ${item.name}`}
          onChange={(e) => {
            const percent = Math.max(0, Number.parseFloat(e.target.value) || 0);
            const capped = maxPercent == null ? percent : Math.min(percent, maxPercent);
            onUpdateItem(item.id, { discountCents: Math.round((item.grossCents * capped) / 100) });
          }}
          className={`${EDITABLE_BOX} pr-7 pl-3 text-right text-pill-success-text`}
        />
      </span>
      {maxPercent != null && maxPercent > 0 ? (
        <span className="w-max max-w-40 text-center text-caption-2 text-text-secondary">
          Max discount {formatPercent(maxPercent)}% /{' '}
          {formatCents(Math.round((item.grossCents * maxPercent) / 100), currency)}
        </span>
      ) : null}
    </div>
  );
};

const GrossAmountCell = ({ item, currency }: { item: InvoiceLineItem; currency: string }) => {
  return (
    <TextCell className="flex-col! items-start! justify-center font-medium">
      <span>{formatCents(item.grossCents, currency)}</span>
      {item.discountCents > 0 ? (
        <span className="truncate text-caption-2 text-pill-success-text">
          − {formatCents(item.discountCents, currency)}
        </span>
      ) : null}
    </TextCell>
  );
};

const AmountCell = ({ item, currency }: { item: InvoiceLineItem; currency: string }) => (
  <TextCell className="self-start font-medium">{formatCents(item.amountCents, currency)}</TextCell>
);

const BillRow = ({
  item,
  incomplete = false,
  onUpdateItem,
  onRemoveItem,
}: {
  item: InvoiceLineItem;
  incomplete?: boolean;
  onUpdateItem: (id: string, patch: Partial<InvoiceLineItem>) => void;
  onRemoveItem: (id: string) => void;
}) => {
  const currency = useCurrency();
  // Rows with a max-discount hint need extra bottom space so the absolutely
  // positioned "Max $X" caption doesn't collide with the next row.
  const hasMaxHint = item.maxDiscountCents != null && item.maxDiscountCents > 0;
  const hasDiscountMeta = hasMaxHint || item.discountCents > 0;
  return (
    <li className={`${ROW_GRID} text-body-4 text-text-primary ${hasDiscountMeta ? 'pb-2' : ''}`}>
      <TextCell className="min-w-0">
        <span className="inline-flex min-w-0 items-center gap-1">
          <span className="truncate">{item.name}</span>
          <PackageBreakdownTooltip item={item} currency={currency} />
          {incomplete && (
            <InfoTooltipIcon
              label="Fill information in previous step"
              content="Fill prescription information in the Treatment step before finalizing this invoice."
            />
          )}
        </span>
      </TextCell>
      <TextCell>{formatCents(item.unitPriceCents, currency)}</TextCell>
      <QtyInput item={item} onUpdateItem={onUpdateItem} />
      <GrossAmountCell item={item} currency={currency} />
      <DiscountInput item={item} onUpdateItem={onUpdateItem} />
      <AmountCell item={item} currency={currency} />
      {item.removable === false ? (
        // The booked appointment service/consultation can't be removed from the bill — keep the
        // trash column's width with an empty placeholder so the grid stays aligned.
        <span aria-hidden="true" className="inline-block size-9" />
      ) : (
        <CircleIconButton
          icon={<IoTrashOutline aria-hidden="true" />}
          label={`Remove ${item.name}`}
          variant="danger"
          onClick={() => onRemoveItem(item.id)}
        />
      )}
    </li>
  );
};

const FOOTER_AMOUNT_ROW = 'grid min-h-8 grid-cols-[minmax(0,1fr)_max-content] items-center gap-4';
const FOOTER_BREAKDOWN_ROW =
  'grid min-h-8 grid-cols-[5.5rem_minmax(0,1fr)_7rem] items-center gap-3';
const FOOTER_FONT = '"Satoshi Variable", var(--font-satoshi), sans-serif';
const NEUTRAL_TEXT = 'var(--color-neutral-900)';
const PRIMARY_TEXT = 'var(--color-text-brand)';
const DISCOUNT_TEXT = 'var(--color-success-700)';

const FOOTER_HELPER_TEXT_STYLE: React.CSSProperties = {
  color: NEUTRAL_TEXT,
  fontFamily: FOOTER_FONT,
  fontSize: 14,
  fontStyle: 'normal',
  fontWeight: 500,
  lineHeight: '120%',
};

const FOOTER_LABEL_STYLE: React.CSSProperties = {
  color: NEUTRAL_TEXT,
  fontFamily: FOOTER_FONT,
  fontSize: 16,
  fontStyle: 'normal',
  fontWeight: 400,
  lineHeight: '120%',
};

const FOOTER_VALUE_STYLE: React.CSSProperties = {
  color: NEUTRAL_TEXT,
  fontFamily: FOOTER_FONT,
  fontSize: 16,
  fontStyle: 'normal',
  fontWeight: 700,
  lineHeight: '120%',
};

const FOOTER_TOTAL_VALUE_STYLE: React.CSSProperties = {
  color: 'var(--ink)',
  fontFamily: FOOTER_FONT,
  fontSize: 26,
  fontStyle: 'normal',
  fontWeight: 700,
  letterSpacing: '-0.03em',
  lineHeight: '120%',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};

const FOOTER_DISCOUNT_VALUE_STYLE: React.CSSProperties = {
  ...FOOTER_VALUE_STYLE,
  color: DISCOUNT_TEXT,
};

const FooterAmountRow = ({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value: string;
  valueStyle?: React.CSSProperties;
}) => (
  <div className={FOOTER_AMOUNT_ROW}>
    <span className="min-w-0" style={FOOTER_LABEL_STYLE}>
      {label}
    </span>
    <span className="text-right" style={{ ...FOOTER_VALUE_STYLE, ...valueStyle }}>
      {value}
    </span>
  </div>
);

const FooterBreakdownRow = ({
  label,
  value,
  valueStyle,
  leftSlot,
}: {
  label: string;
  value: string;
  valueStyle?: React.CSSProperties;
  leftSlot?: React.ReactNode;
}) => (
  <div className={FOOTER_BREAKDOWN_ROW}>
    <span className="flex items-center">{leftSlot}</span>
    <span className="min-w-0" style={FOOTER_LABEL_STYLE}>
      {label}
    </span>
    <span className="text-right" style={{ ...FOOTER_VALUE_STYLE, ...valueStyle }}>
      {value}
    </span>
  </div>
);

/**
 * Controlled state for the overall-discount field.
 *
 * An entry above the organisation's cap is REJECTED, not clamped: a silently
 * reduced discount is indistinguishable from the number the clinician meant to
 * type, and the invoice would then be collected as if the smaller figure was
 * intended. The typed value stays on screen next to the reason it was refused,
 * and the bill keeps the last accepted discount. The finance API enforces the
 * same cap server-side; this is the message, not the control.
 */
const useOverallDiscountInput = ({
  overallDiscountPercent,
  maxOverallDiscountPercent,
  onChangeOverallDiscount,
}: {
  overallDiscountPercent: number;
  maxOverallDiscountPercent?: number | null;
  onChangeOverallDiscount: (percent: number) => void;
}) => {
  const [draft, setDraft] = useState(String(overallDiscountPercent));
  const [capError, setCapError] = useState<string | null>(null);

  // Re-sync the field when the accepted discount changes elsewhere (hydration,
  // another edit path) so the input never drifts from the bill it describes.
  const [prevPercent, setPrevPercent] = useState(overallDiscountPercent);
  if (prevPercent !== overallDiscountPercent) {
    setPrevPercent(overallDiscountPercent);
    setDraft(String(overallDiscountPercent));
    setCapError(null);
  }

  const handleChange = (raw: string) => {
    setDraft(raw);
    const percent = Math.max(0, Number.parseFloat(raw) || 0);
    if (maxOverallDiscountPercent != null && percent > maxOverallDiscountPercent) {
      setCapError(overallDiscountCapMessage(maxOverallDiscountPercent));
      return;
    }
    setCapError(null);
    onChangeOverallDiscount(percent);
  };

  return { draft, capError, handleChange };
};

const TotalsFooter = ({
  totals,
  depositCents,
  overallDiscountPercent,
  maxOverallDiscountPercent,
  withdrawDeposit,
  taxPercent,
  onToggleWithdrawDeposit,
  onChangeOverallDiscount,
}: {
  totals: ReturnType<typeof buildTotals>;
  depositCents: number;
  overallDiscountPercent: number;
  maxOverallDiscountPercent?: number | null;
  withdrawDeposit: boolean;
  taxPercent: number;
  onToggleWithdrawDeposit: (value: boolean) => void;
  onChangeOverallDiscount: (percent: number) => void;
}) => {
  const currency = useCurrency();
  const money = (cents: number) => formatCents(cents, currency);
  const { draft, capError, handleChange } = useOverallDiscountInput({
    overallDiscountPercent,
    maxOverallDiscountPercent,
    onChangeOverallDiscount,
  });
  return (
    <div className="-mx-5 -mb-5 grid gap-5 rounded-b-2xl border-t border-neutral-300 bg-pill-success-bg px-5 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(13rem,0.8fr)_minmax(0,1fr)] lg:items-stretch">
      <div className="flex h-full flex-col justify-center gap-2">
        <label className="flex min-h-8 items-center gap-2">
          <input
            type="checkbox"
            checked={withdrawDeposit}
            onChange={(e) => onToggleWithdrawDeposit(e.target.checked)}
            className="size-4 accent-pill-success-text"
          />
          <span style={FOOTER_HELPER_TEXT_STYLE}>Withdraw from deposit</span>
        </label>
        <FooterAmountRow label="Total Deposit" value={money(depositCents)} />
        <FooterAmountRow
          label="Invoice Amount"
          value={money(totals.estimatedTotalCents)}
          valueStyle={{ color: PRIMARY_TEXT }}
        />
        <FooterAmountRow label="Remaining Deposit" value={money(totals.remainingDepositCents)} />
      </div>

      <div className="flex h-full items-center justify-center py-1 lg:py-0">
        <div className="text-center">
          <p style={FOOTER_LABEL_STYLE}>Total Amount</p>
          <p className="text-right" style={FOOTER_TOTAL_VALUE_STYLE}>
            {money(totals.estimatedTotalCents)}
          </p>
        </div>
      </div>

      <div className="flex h-full flex-col justify-center gap-2">
        <FooterBreakdownRow label="Subtotal:" value={money(totals.subtotalCents)} />
        <FooterBreakdownRow
          label="Overall Discount:"
          value={`− ${money(totals.overallDiscountCents)}`}
          valueStyle={FOOTER_DISCOUNT_VALUE_STYLE}
          leftSlot={
            <span className="relative inline-flex h-8 w-20 items-center">
              <input
                type="number"
                min={0}
                max={maxOverallDiscountPercent ?? 100}
                value={draft}
                aria-label="Overall discount percent"
                aria-invalid={capError ? true : undefined}
                aria-describedby={capError ? OVERALL_DISCOUNT_ERROR_ID : undefined}
                onChange={(e) => handleChange(e.target.value)}
                className="h-full w-full rounded-xl border bg-transparent pr-6 pl-2 text-right focus-visible:outline-none"
                style={{
                  ...FOOTER_DISCOUNT_VALUE_STYLE,
                  borderColor: capError ? 'var(--color-danger-600)' : DISCOUNT_TEXT,
                }}
              />
              <span
                className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2"
                style={FOOTER_DISCOUNT_VALUE_STYLE}
              >
                %
              </span>
            </span>
          }
        />
        {capError && (
          <p
            id={OVERALL_DISCOUNT_ERROR_ID}
            role="alert"
            className="text-right text-caption-2 text-danger-700"
          >
            {capError}
          </p>
        )}
        <FooterBreakdownRow label="Estimated Total:" value={money(totals.estimatedTotalCents)} />
        <p className="text-right" style={FOOTER_HELPER_TEXT_STYLE}>
          {taxPercent > 0 ? `Exclusive of ${taxPercent}% tax` : 'No tax applied'}
        </p>
      </div>
    </div>
  );
};

const TotalBillContainer = ({
  items,
  billableItems,
  incompleteItemNames,
  currency = 'USD',
  depositCents,
  withdrawDeposit,
  overallDiscountPercent,
  taxPercent = 0,
  maxOverallDiscountPercent,
  onToggleWithdrawDeposit,
  onChangeOverallDiscount,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
}: TotalBillContainerProps) => {
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return billableItems.filter((item) => item.name.toLowerCase().includes(query));
  }, [billableItems, search]);

  // Strip the display-only `kind` before the item enters the bill.
  const addCandidate = (item: BillableSearchItem) => {
    const { kind: _kind, ...lineItem } = item;
    onAddItem(lineItem);
  };

  const totals = buildTotals(items, overallDiscountPercent, depositCents, withdrawDeposit);

  return (
    <CurrencyContext.Provider value={currency}>
      <div className="flex flex-col gap-3">
        {/* Search row sits above the floating container, right-aligned and sized to
          match the other steps' search bars (SOAP / Services / Prescription). */}
        <div className="relative flex items-center justify-end gap-3">
          <CircleIconButton
            icon={<IoAddOutline aria-hidden="true" />}
            label="Add invoice item"
            variant="dark"
            onClick={() => {
              if (matches[0]) addCandidate(matches[0]);
            }}
          />
          <div ref={searchRef} className="relative w-full sm:max-w-130">
            <Search
              value={search}
              setSearch={setSearch}
              placeholder="Search services, packages, medicines, inventory..."
              label="Search invoice items"
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
                    key={item.name}
                    name={item.name}
                    badge={item.kind ? <KindPill kind={item.kind} /> : undefined}
                    meta={formatCents(item.amountCents, currency)}
                    onSelect={() => {
                      addCandidate(item);
                      setSearch('');
                    }}
                  />
                ))}
              </ul>
            </SearchResultsDropdown>
          </div>
        </div>

        <SectionContainer title="Total Bill" className="flex flex-col gap-5">
          {items.length === 0 ? (
            <p className="rounded-2xl bg-neutral-100 p-4 text-body-4 text-text-secondary">
              No invoice line items added yet.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="hidden sm:block">
                <ColumnHeadings />
              </div>
              <ul className="flex flex-col gap-3">
                {items.map((item) => (
                  <BillRow
                    key={item.id}
                    item={item}
                    incomplete={incompleteItemNames?.has(item.name.trim().toLowerCase())}
                    onUpdateItem={onUpdateItem}
                    onRemoveItem={onRemoveItem}
                  />
                ))}
              </ul>
            </div>
          )}

          <TotalsFooter
            totals={totals}
            depositCents={depositCents}
            overallDiscountPercent={overallDiscountPercent}
            maxOverallDiscountPercent={maxOverallDiscountPercent}
            withdrawDeposit={withdrawDeposit}
            taxPercent={taxPercent}
            onToggleWithdrawDeposit={onToggleWithdrawDeposit}
            onChangeOverallDiscount={onChangeOverallDiscount}
          />
        </SectionContainer>
      </div>
    </CurrencyContext.Provider>
  );
};

export default TotalBillContainer;
