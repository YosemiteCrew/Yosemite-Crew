'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { useOrgStore } from '@/app/stores/orgStore';
import { useParentStore } from '@/app/stores/parentStore';
import { formatMoneyPrecise } from '@/app/lib/money';
import { formatDisplayDate } from '@/app/lib/date';
import { PERMISSIONS } from '@/app/lib/permissions';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import Fallback from '@/app/ui/overlays/Fallback';
import {
  listOverdueClientInvoices,
  markClientInvoiceReviewed,
  saveClientPaymentTerms,
} from '@/app/features/finance/services/clientCollectionsService';
import type { OverdueClientInvoice } from '@/app/features/finance/types/clientCollections';

type ClientGroup = { parentId: string; invoices: OverdueClientInvoice[] };

// `dueDate` is already the practice's calendar date, so it is formatted as a
// date and never shifted into the viewer's time zone.
const formatDueDate = (dueDate: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${dueDate}T00:00:00.000Z`));

const termsByParent = (rows: OverdueClientInvoice[]) =>
  Object.fromEntries(rows.map((row) => [row.parentId, row.netDays]));

const clientName = (parent: { firstName?: string; lastName?: string; name?: string } | null) => {
  const name = [parent?.firstName, parent?.lastName].filter(Boolean).join(' ').trim();
  return name || parent?.name?.trim() || 'Client account';
};

const ClientCollections = () => {
  const organisationId = useOrgStore((state) => state.primaryOrgId);
  const parentsById = useParentStore((state) => state.parentsById);
  const { can } = usePermissions();
  const canEditBilling = can(PERMISSIONS.BILLING_EDIT_ANY);
  const [invoices, setInvoices] = useState<OverdueClientInvoice[]>([]);
  const [terms, setTerms] = useState<Record<string, number>>({});
  const [draftDays, setDraftDays] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(Boolean(organisationId));
  const [error, setError] = useState<string | null>(null);
  const [savingParent, setSavingParent] = useState<string | null>(null);
  const [reviewingInvoice, setReviewingInvoice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const applyRows = useCallback((rows: OverdueClientInvoice[]) => {
    const loadedTerms = termsByParent(rows);
    setInvoices(rows);
    setTerms(loadedTerms);
    setDraftDays(
      Object.fromEntries(
        Object.entries(loadedTerms).map(([parentId, netDays]) => [parentId, String(netDays)])
      )
    );
  }, []);

  const reload = useCallback(async () => {
    if (!organisationId) return;
    setLoading(true);
    setError(null);
    try {
      applyRows(await listOverdueClientInvoices(organisationId));
    } catch {
      setError('Unable to load overdue accounts. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [applyRows, organisationId]);

  useEffect(() => {
    if (!organisationId) return;
    let active = true;
    listOverdueClientInvoices(organisationId)
      .then((rows) => {
        if (active) applyRows(rows);
      })
      .catch(() => {
        if (active) setError('Unable to load overdue accounts. Please try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applyRows, organisationId]);

  const groups = useMemo<ClientGroup[]>(() => {
    const byParent = new Map<string, OverdueClientInvoice[]>();
    invoices.forEach((invoice) => {
      const group = byParent.get(invoice.parentId) ?? [];
      group.push(invoice);
      byParent.set(invoice.parentId, group);
    });
    return [...byParent].map(([parentId, rows]) => ({ parentId, invoices: rows }));
  }, [invoices]);

  const saveTerms = async (parentId: string) => {
    if (!organisationId) return;
    const netDays = Number(draftDays[parentId]);
    if (!Number.isInteger(netDays) || netDays < 0 || netDays > 365) {
      setActionError('Enter a whole number from 0 to 365 days.');
      return;
    }
    setSavingParent(parentId);
    setActionError(null);
    try {
      const saved = await saveClientPaymentTerms(organisationId, parentId, netDays);
      setTerms((current) => ({ ...current, [parentId]: saved.netDays }));
      setDraftDays((current) => ({ ...current, [parentId]: String(saved.netDays) }));
    } catch {
      setActionError('Unable to save payment terms. Please try again.');
    } finally {
      setSavingParent(null);
    }
  };

  const reviewInvoice = async (invoiceId: string) => {
    if (!organisationId) return;
    setReviewingInvoice(invoiceId);
    setActionError(null);
    try {
      const result = await markClientInvoiceReviewed(organisationId, invoiceId);
      setInvoices((current) =>
        current.map((invoice) =>
          invoice.invoiceId === invoiceId
            ? {
                ...invoice,
                reviewedAt: result.collectionsReviewedAt,
                reviewedBy: result.collectionsReviewedBy,
              }
            : invoice
        )
      );
    } catch {
      setActionError('Unable to update this account. Refresh the list and try again.');
    } finally {
      setReviewingInvoice(null);
    }
  };

  const renderReviewAction = (invoice: OverdueClientInvoice) => {
    if (invoice.reviewedAt) {
      return (
        <span className="rounded-full bg-success-100 px-3 py-1 text-caption-2 font-semibold text-[var(--success-text)]">
          Reviewed {formatDisplayDate(invoice.reviewedAt)}
        </span>
      );
    }
    if (!canEditBilling)
      return <span className="text-caption-2 text-text-secondary">Needs review</span>;
    return (
      <Primary
        text={reviewingInvoice === invoice.invoiceId ? 'Saving…' : 'Mark reviewed'}
        ariaLabel={`Mark invoice ${invoice.invoiceId.slice(0, 8)} reviewed`}
        isDisabled={reviewingInvoice === invoice.invoiceId}
        onClick={() => void reviewInvoice(invoice.invoiceId)}
      />
    );
  };

  let queueContent: React.ReactNode;
  if (error) {
    queueContent = (
      <section className="rounded-2xl border border-card-border p-6">
        <output className="block text-body-3 text-text-primary">{error}</output>
        <Secondary
          text="Retry"
          onClick={() => void reload()}
          ariaLabel="Retry loading overdue accounts"
        />
      </section>
    );
  } else if (loading) {
    queueContent = (
      <output className="block text-body-3 text-text-secondary">Loading overdue accounts…</output>
    );
  } else if (groups.length === 0) {
    queueContent = (
      <section className="rounded-2xl border border-card-border p-8 text-center">
        <h2 className="text-heading-2 text-text-primary">You’re all caught up</h2>
        <p className="mt-2 text-body-4 text-text-secondary">
          There are no unpaid invoices past their due dates.
        </p>
      </section>
    );
  } else {
    queueContent = (
      <div className="flex flex-col gap-4">
        {groups.map(({ parentId, invoices: rows }) => {
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
                    {rows.length} overdue {rows.length === 1 ? 'invoice' : 'invoices'}
                  </p>
                </div>
                {canEditBilling ? (
                  <form
                    className="flex flex-wrap items-end gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void saveTerms(parentId);
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
                          onChange={(event) =>
                            setDraftDays((current) => ({
                              ...current,
                              [parentId]: event.target.value,
                            }))
                          }
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
                {rows.map((invoice) => (
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
                    {renderReviewAction(invoice)}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <PermissionGate allOf={[PERMISSIONS.BILLING_VIEW_ANY]} fallback={<Fallback />}>
      <div className="flex min-w-0 flex-col gap-6 p-4 md:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-page-title">Overdue accounts</h1>
            <p className="mt-1 text-body-4 text-text-secondary">
              Review balances before deciding whether to contact a client. No reminders are sent
              from this page.
            </p>
          </div>
          <Secondary href="/finance" text="Back to invoices" ariaLabel="Back to invoices" />
        </header>

        {actionError && (
          <p className="rounded-xl bg-danger-100 p-3 text-body-4 text-text-error" role="alert">
            {actionError}
          </p>
        )}
        {queueContent}
      </div>
    </PermissionGate>
  );
};

export default ClientCollections;
