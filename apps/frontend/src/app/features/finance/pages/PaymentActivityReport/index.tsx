'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import Fallback from '@/app/ui/overlays/Fallback';
import { PERMISSIONS } from '@/app/lib/permissions';
import { useOrgStore } from '@/app/stores/orgStore';
import { formatMoneyPrecise } from '@/app/lib/money';
import Text from '@/app/ui/Text';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import GenericTable, { type Column } from '@/app/ui/tables/GenericTable/GenericTable';
import {
  downloadPaymentActivityReport,
  fetchPaymentActivityReport,
  type PaymentActivityReport as PaymentActivityReportData,
} from '@/app/features/finance/services/paymentActivityReportService';

const REPORT_PAGE_SKELETON = <PageSkeleton variant="list" />;

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

const getDefaultDateRange = () => {
  const to = new Date();
  to.setUTCHours(23, 59, 59, 999);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 29);
  from.setUTCHours(0, 0, 0, 0);
  return { from: isoDate(from), to: isoDate(to) };
};

const dateStart = (date: string) => `${date}T00:00:00.000Z`;
const dateEnd = (date: string) => `${date}T23:59:59.999Z`;

// The API refuses a period with more entries than one report returns; trying
// again would fail the same way, so say what to change instead.
const errorMessage = (error: unknown) =>
  axios.isAxiosError(error) && error.response?.status === 422
    ? 'The selected period has too many entries. Choose a shorter date range.'
    : 'The report could not be loaded. Try again.';

const statusLabels: Record<string, string> = {
  SUCCEEDED: 'Completed',
  PARTIALLY_REFUNDED: 'Partially refunded',
  REFUNDED: 'Refunded',
  PENDING: 'Pending',
  FAILED: 'Failed',
  CANCELED: 'Canceled',
};

const providerLabels: Record<string, string> = {
  STRIPE: 'Online',
  MANUAL: 'Manual',
};
const MAX_REPORT_RANGE_MS = 366 * 24 * 60 * 60 * 1000;

const reportColumns: Column<PaymentActivityReportData['rows'][number]>[] = [
  {
    label: 'Date (UTC)',
    key: 'date',
    width: '165px',
    render: (row) => (
      <span className="whitespace-nowrap text-text-secondary">
        {new Date(row.date).toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'UTC',
        })}
      </span>
    ),
  },
  { label: 'Type', key: 'type', width: '90px', render: (row) => row.type },
  {
    label: 'Status',
    key: 'status',
    width: '140px',
    render: (row) => statusLabels[row.status] ?? 'Needs review',
  },
  {
    label: 'Provider',
    key: 'provider',
    width: '105px',
    render: (row) => providerLabels[row.provider] ?? 'Other',
  },
  {
    label: 'Amount',
    key: 'amount',
    width: '145px',
    render: (row) => (
      <span className="whitespace-nowrap tabular-nums text-text-primary">
        {row.type === 'Refund' && row.status === 'SUCCEEDED' ? '−' : ''}
        {formatMoneyPrecise(row.amount, row.currency)}
      </span>
    ),
  },
  {
    label: 'Invoice',
    key: 'invoiceId',
    width: '150px',
    render: (row) => (
      <span className="font-mono text-caption-2 text-text-tertiary">{row.invoiceId}</span>
    ),
  },
];

const PaymentActivityReportContent = () => {
  const organisationId = useOrgStore((state) => state.primaryOrgId);
  const [initialRange] = useState(getDefaultDateRange);
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [range, setRange] = useState(initialRange);
  const [reportState, setReportState] = useState<{
    key: string;
    data: PaymentActivityReportData;
  } | null>(null);
  const [downloading, setDownloading] = useState<'csv' | 'pdf' | null>(null);
  const [errorState, setErrorState] = useState<{ key: string; message: string } | null>(null);
  const reportKey = organisationId && range ? `${organisationId}:${range.from}:${range.to}` : null;
  const report = reportKey && reportState?.key === reportKey ? reportState.data : null;
  const error = reportKey && errorState?.key === reportKey ? errorState.message : null;
  const loading = Boolean(
    reportKey && reportState?.key !== reportKey && errorState?.key !== reportKey
  );

  useEffect(() => {
    if (!organisationId || !range) return;
    const key = `${organisationId}:${range.from}:${range.to}`;
    let current = true;
    fetchPaymentActivityReport(organisationId, dateStart(range.from), dateEnd(range.to))
      .then((result) => {
        if (current) setReportState({ key, data: result });
      })
      .catch((requestError: unknown) => {
        if (current) setErrorState({ key, message: errorMessage(requestError) });
      });
    return () => {
      current = false;
    };
  }, [organisationId, range]);

  const runReport = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !fromDate ||
      !toDate ||
      fromDate > toDate ||
      new Date(`${toDate}T00:00:00.000Z`).getTime() -
        new Date(`${fromDate}T00:00:00.000Z`).getTime() >=
        MAX_REPORT_RANGE_MS
    ) {
      if (reportKey)
        setErrorState({
          key: reportKey,
          message: 'Choose a valid date range of 366 days or less.',
        });
      return;
    }
    setErrorState(null);
    setRange({ from: fromDate, to: toDate });
  };

  const download = async (format: 'csv' | 'pdf') => {
    if (!organisationId || !range) return;
    setDownloading(format);
    if (reportKey) setErrorState(null);
    try {
      const blob = await downloadPaymentActivityReport(
        organisationId,
        dateStart(range.from),
        dateEnd(range.to),
        format
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payments-refunds-${range.from}-${range.to}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      if (reportKey) setErrorState({ key: reportKey, message: errorMessage(requestError) });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <main className="flex min-w-0 flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Text as="p" variant="caption-1" className="text-text-tertiary">
            Finance
          </Text>
          <Text as="h1" variant="page-title" className="text-text-primary">
            Payments and refunds
          </Text>
          <Text as="p" variant="body-4" className="mt-1 max-w-2xl text-text-secondary">
            Review recorded payment activity for your practice and export the selected period.
          </Text>
        </div>
        <Secondary href="/finance" text="Back to invoices" ariaLabel="Back to invoices" />
      </header>

      <form
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-card-border bg-card p-4"
        onSubmit={runReport}
      >
        <label className="flex min-w-40 flex-col gap-1 text-caption-2 font-bold text-text-secondary">
          {'From (UTC)'}
          <input
            aria-label="From date"
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            required
            className="h-10 rounded-xl border border-card-border bg-card px-3 text-body-4 text-text-primary"
          />
        </label>
        <label className="flex min-w-40 flex-col gap-1 text-caption-2 font-bold text-text-secondary">
          {'To (UTC)'}
          <input
            aria-label="To date"
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            required
            className="h-10 rounded-xl border border-card-border bg-card px-3 text-body-4 text-text-primary"
          />
        </label>
        <Primary type="submit" text="Run report" ariaLabel="Run report" isDisabled={loading} />
        <div className="ml-auto flex gap-2">
          <Secondary
            type="button"
            text={downloading === 'csv' ? 'Preparing CSV…' : 'Download CSV'}
            ariaLabel="Download CSV report"
            isDisabled={!report || loading || downloading !== null}
            onClick={() => void download('csv')}
          />
          <Secondary
            type="button"
            text={downloading === 'pdf' ? 'Preparing PDF…' : 'Download PDF'}
            ariaLabel="Download PDF report"
            isDisabled={!report || loading || downloading !== null}
            onClick={() => void download('pdf')}
          />
        </div>
      </form>

      {error ? (
        <Text
          as="p"
          variant="body-4"
          role="alert"
          className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] p-3 text-body-4 text-[var(--danger-text)]"
        >
          {error}
        </Text>
      ) : null}

      {loading ? (
        <Text as="p" variant="body-4" role="status" className="text-text-secondary">
          Loading report…
        </Text>
      ) : null}

      {report ? (
        <>
          <section aria-label="Report totals" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {report.totals.map((total) => (
              <article
                key={total.currency}
                className="rounded-2xl border border-card-border bg-card p-4"
              >
                <Text as="h2" variant="body-4-emphasis" className="text-text-primary">
                  {total.currency} activity
                </Text>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-caption-2">
                  <div>
                    <Text as="dt" variant="caption-2" className="text-text-tertiary">
                      Payments
                    </Text>
                    <Text
                      as="dd"
                      variant="caption-2"
                      className="mt-1 font-semibold text-text-primary"
                    >
                      {formatMoneyPrecise(total.payments, total.currency)}
                    </Text>
                  </div>
                  <div>
                    <Text as="dt" variant="caption-2" className="text-text-tertiary">
                      Refunds
                    </Text>
                    <Text
                      as="dd"
                      variant="caption-2"
                      className="mt-1 font-semibold text-text-primary"
                    >
                      {formatMoneyPrecise(total.refunds, total.currency)}
                    </Text>
                  </div>
                  <div>
                    <Text as="dt" variant="caption-2" className="text-text-tertiary">
                      Net
                    </Text>
                    <Text
                      as="dd"
                      variant="caption-2"
                      className="mt-1 font-semibold text-text-primary"
                    >
                      {formatMoneyPrecise(total.net, total.currency)}
                    </Text>
                  </div>
                </dl>
              </article>
            ))}
          </section>

          <section className="overflow-hidden rounded-2xl border border-card-border bg-card">
            <div className="flex items-center justify-between gap-3 border-b border-card-border p-4">
              <Text as="h2" variant="body-3-emphasis" className="text-text-primary">
                Activity
              </Text>
              <Text as="span" variant="caption-2" className="text-text-tertiary">
                {report.rows.length} {report.rows.length === 1 ? 'entry' : 'entries'}
              </Text>
            </div>
            <div className="overflow-x-auto">
              <GenericTable
                itemNoun="payment and refund entries"
                data={report.rows}
                columns={reportColumns}
                tableClassName="min-w-[795px]"
                caption="Payments and refunds recorded during the selected period"
                emptyTitle="No payments or refunds were recorded in this period."
              />
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
};

const PaymentActivityReportPage = () => (
  <ProtectedRoute skeleton={REPORT_PAGE_SKELETON}>
    <OrgGuard skeleton={REPORT_PAGE_SKELETON}>
      <PermissionGate allOf={[PERMISSIONS.BILLING_VIEW_ANY]} fallback={<Fallback />}>
        <PaymentActivityReportContent />
      </PermissionGate>
    </OrgGuard>
  </ProtectedRoute>
);

export default PaymentActivityReportPage;
