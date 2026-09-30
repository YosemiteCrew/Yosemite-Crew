'use client';

import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { formatMoneyPrecise } from '@/app/lib/money';
import { formatDisplayDate } from '@/app/lib/date';
import type { OverdueClientInvoice } from '@/app/features/finance/types/clientCollections';

type ClientGroup = { parentId: string; invoices: OverdueClientInvoice[] };
type ClientSummary = { firstName?: string; lastName?: string; name?: string };

const clientName = (parent: ClientSummary | null | undefined) => {
  const name = [parent?.firstName, parent?.lastName].filter(Boolean).join(' ').trim();
  return name || parent?.name?.trim() || 'Client account';
};

const formatDueDate = (dueDate: string) =>
  DUE_DATE_FORMAT.format(new Date(`${dueDate}T00:00:00.000Z`));

// `dueDate` is already the practice's calendar date, so it is formatted as a
// date and never shifted into the viewer's time zone.
const DUE_DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

type Props = {
  error: string | null;
  loading: boolean;
  groups: ClientGroup[];
  parentsById: Record<string, ClientSummary | undefined>;
  canEditBilling: boolean;
  terms: Record<string, number>;
  draftDays: Record<string, string>;
  savingParent: string | null;
  reviewingInvoice: string | null;
  onReload: () => void;
  onSaveTerms: (parentId: string) => void;
  onReviewInvoice: (invoiceId: string) => void;
  onDraftDaysChange: (parentId: string, value: string) => void;
};

const ClientCollectionsQueue = ({
  error,
  loading,
  groups,
  parentsById,
  canEditBilling,
  terms,
  draftDays,
  savingParent,
  reviewingInvoice,
  onReload,
  onSaveTerms,
  onReviewInvoice,
  onDraftDaysChange,
}: Props) => {
  if (error) {
    return (
      <section className="rounded-2xl border border-card-border p-6">
        <output className="block text-body-3 text-text-primary">{error}</output>
        <Secondary text="Retry" onClick={onReload} ariaLabel="Retry loading overdue accounts" />
      </section>
    );
  }
  if (loading) {
    return (
      <output className="block text-body-3 text-text-secondary">Loading overdue accounts…</output>
    );
  }
  if (groups.length === 0) {
    return (
      <section className="rounded-2xl border border-card-border p-8 text-center">
        <h2 className="text-heading-2 text-text-primary">You’re all caught up</h2>
        <p className="mt-2 text-body-4 text-text-secondary">
          There are no unpaid invoices past their due dates.
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map(({ parentId, invoices }) => {
        const parent = parentsById[parentId];
        return (
          <section
            key={parentId}
            className="overflow-hidden rounded-2xl border border-card-border bg-card"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-card-border px-4 py-4 md:px-5">
              <div>
                <h2 className="text-heading-3 text-text-primary">{clientName(parent)}</h2>
                <p className="text-caption-2 text-text-secondary">
                  {invoices.length} overdue {invoices.length === 1 ? 'invoice' : 'invoices'}
                </p>
              </div>
              {canEditBilling ? (
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    onSaveTerms(parentId);
                  }}
                >
                  <label
                    className="flex flex-col gap-1 text-caption-2 text-text-secondary"
                    htmlFor={`terms-${parentId}`}
                  >
                    <span>Payment due after</span>
                    <span className="flex items-center gap-2">
                      <input
                        id={`terms-${parentId}`}
                        type="number"
                        min="0"
                        max="365"
                        step="1"
                        required
                        aria-describedby={`terms-hint-${parentId}`}
                        value={draftDays[parentId] ?? String(terms[parentId] ?? 0)}
                        onChange={(event) => onDraftDaysChange(parentId, event.target.value)}
                        className="w-20 rounded-xl border border-input-border-default bg-transparent px-3 py-2 text-body-4 text-text-primary focus:border-input-border-active focus:outline-none"
                      />
                      <span>days</span>
                    </span>
                  </label>
                  <Primary
                    type="submit"
                    text={savingParent === parentId ? 'Saving…' : 'Save terms'}
                    ariaLabel={`Save payment terms for ${clientName(parent)}`}
                    isDisabled={savingParent === parentId}
                  />
                  <p
                    id={`terms-hint-${parentId}`}
                    className="basis-full text-caption-2 text-text-tertiary"
                  >
                    Applies to invoices finalized from now on.
                  </p>
                </form>
              ) : (
                <p className="text-body-4 text-text-secondary">
                  Payment due after {terms[parentId] ?? 0} days
                </p>
              )}
            </div>
            <ul className="divide-y divide-card-border">
              {invoices.map((invoice) => {
                let reviewAction;
                if (invoice.reviewedAt) {
                  reviewAction = (
                    <span className="rounded-full bg-success-100 px-3 py-1 text-caption-2 font-semibold text-[var(--success-text)]">
                      Reviewed {formatDisplayDate(invoice.reviewedAt)}
                    </span>
                  );
                } else if (!canEditBilling) {
                  reviewAction = (
                    <span className="text-caption-2 text-text-secondary">Needs review</span>
                  );
                } else {
                  reviewAction = (
                    <Primary
                      text={reviewingInvoice === invoice.invoiceId ? 'Saving…' : 'Mark reviewed'}
                      ariaLabel={`Mark invoice ${invoice.invoiceId.slice(0, 8)} reviewed`}
                      isDisabled={reviewingInvoice === invoice.invoiceId}
                      onClick={() => onReviewInvoice(invoice.invoiceId)}
                    />
                  );
                }

                return (
                  <li
                    key={invoice.invoiceId}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-5"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-body-3 font-semibold text-text-primary">
                        {formatMoneyPrecise(invoice.balance, invoice.currency)}
                      </span>
                      <span className="text-body-4 text-text-secondary">
                        Due {formatDueDate(invoice.dueDate)}
                      </span>
                      <span className="text-caption-2 text-text-tertiary">
                        Invoice {invoice.invoiceId.slice(0, 8)}
                      </span>
                    </div>
                    {reviewAction}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
};

export default ClientCollectionsQueue;
