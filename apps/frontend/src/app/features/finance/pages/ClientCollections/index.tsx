'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Secondary } from '@/app/ui/primitives/Buttons';
import { useOrgStore } from '@/app/stores/orgStore';
import { useParentStore } from '@/app/stores/parentStore';
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
import ClientCollectionsQueue from './ClientCollectionsQueue';

type ClientGroup = { parentId: string; invoices: OverdueClientInvoice[] };

const termsByParent = (rows: OverdueClientInvoice[]) =>
  Object.fromEntries(rows.map((row) => [row.parentId, row.netDays]));

type ClientCollectionsForOrganisationProps = { organisationId: string | null };

const ClientCollectionsForOrganisation = ({
  organisationId,
}: ClientCollectionsForOrganisationProps) => {
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
        <ClientCollectionsQueue
          error={error}
          loading={loading}
          groups={groups}
          parentsById={parentsById}
          canEditBilling={canEditBilling}
          terms={terms}
          draftDays={draftDays}
          savingParent={savingParent}
          reviewingInvoice={reviewingInvoice}
          onReload={() => void reload()}
          onSaveTerms={(parentId) => void saveTerms(parentId)}
          onReviewInvoice={(invoiceId) => void reviewInvoice(invoiceId)}
          onDraftDaysChange={(parentId, value) =>
            setDraftDays((current) => ({ ...current, [parentId]: value }))
          }
        />
      </div>
    </PermissionGate>
  );
};

const ClientCollections = () => {
  const organisationId = useOrgStore((state) => state.primaryOrgId);
  return (
    <ClientCollectionsForOrganisation
      key={organisationId ?? 'none'}
      organisationId={organisationId}
    />
  );
};

export default ClientCollections;
