import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import type { Appointment } from '@yosemite-crew/types';
import {
  LuCalendarDays,
  LuCheck,
  LuClock,
  LuDownload,
  LuExternalLink,
  LuEye,
  LuEyeOff,
  LuFlaskConical,
  LuPrinter,
  LuRefreshCw,
  LuShare,
  LuTestTube,
  LuTrash2,
} from 'react-icons/lu';
import { HiUser } from 'react-icons/hi2';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import SearchDropdown from '@/app/ui/inputs/SearchDropdown';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import FormDesc from '@/app/ui/inputs/FormDesc/FormDesc';
import PdfPreviewOverlay from '@/app/ui/overlays/PdfPreviewOverlay';
import { YosemiteLoader } from '@/app/ui/overlays/Loader';
import Close from '@/app/ui/primitives/Icons/Close';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';
import {
  useLabTests,
  resolveOrderUiUrl,
  resolveOrderPdfUrl,
  formatTestPrice,
  getTestTurnaround,
  getTestSpecimen,
  toTitleCase,
  LabResultCategoryTable,
  type UseLabTestsReturn,
} from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/LabTests';
import type { IdexxTest } from '@/app/features/integrations/services/types';
import type { DiagnosticOrder } from '@/app/features/appointments/types/workspace';
import { getSafeIdexxIframeUrl } from '@/app/lib/urls';
import { formatDateTimeLocal } from '@/app/lib/date';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import {
  getAppointmentWorkspaceBootstrap,
  normalizeWorkspaceBootstrapForEncounter,
} from '@/app/features/appointments/services/workspaceAggregateService';
import { getIdexxCombinedResultsPdfBlob } from '@/app/features/integrations/services/idexxService';

type DiagnosticProvider = 'IDEXX' | 'RAD_ANALYZER';

type DiagnosticsStepProps = {
  appointment: Appointment;
  readOnly?: boolean;
  onOpenTreatment: () => void;
};

type ProviderOption = {
  key: DiagnosticProvider;
  label: string;
  available: boolean;
  unavailableReason?: string;
};

const PROVIDERS: ProviderOption[] = [
  { key: 'IDEXX', label: 'IDEXX', available: true },
  {
    key: 'RAD_ANALYZER',
    label: 'RadAnalyzer',
    available: false,
    unavailableReason: 'RadAnalyzer diagnostics are coming soon for the appointment workspace.',
  },
];

const ProviderContent = ({ provider }: { provider: ProviderOption }) => {
  if (provider.key === 'IDEXX') {
    return (
      <Image
        src={MEDIA_SOURCES.futureAssets.idexxLogoUrl}
        alt="IDEXX"
        width={94}
        height={40}
        className="h-4 w-auto object-contain"
      />
    );
  }
  return <span>{provider.label}</span>;
};

const getIntegrationPillClass = (disabled: boolean, active: boolean): string => {
  if (disabled) return 'cursor-not-allowed border-neutral-300 text-text-secondary opacity-60';
  if (active) return 'border-text-brand bg-primary-100 text-text-brand';
  return 'border-neutral-300 text-text-primary hover:bg-neutral-100';
};

const IntegrationPills = ({
  selected,
  onSelect,
}: {
  selected: DiagnosticProvider;
  onSelect: (provider: DiagnosticProvider) => void;
}) => (
  <div className="flex flex-wrap items-center gap-3">
    {PROVIDERS.map((provider) => {
      const active = selected === provider.key;
      const disabled = !provider.available;
      return (
        <button
          key={provider.key}
          type="button"
          aria-pressed={active}
          disabled={disabled}
          title={disabled ? provider.unavailableReason : undefined}
          onClick={() => {
            if (!disabled) onSelect(provider.key);
          }}
          className={`inline-flex h-12 items-center gap-2 rounded-2xl border px-5 text-body-4 font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand ${getIntegrationPillClass(
            disabled,
            active
          )}`}
        >
          <ProviderContent provider={provider} />
          {disabled ? (
            <span className="text-caption-2 text-text-secondary">Coming soon</span>
          ) : (
            active && <LuExternalLink size={14} aria-hidden="true" />
          )}
        </button>
      );
    })}
  </div>
);

/**
 * Maps a lab order / result status string to the shared design-system pill
 * tokens (border + bg + text), matching the Invoice section's StatusPill.
 */
const getStatusPillClasses = (status: string): string => {
  const key = status.toLowerCase();
  if (key.includes('complete') || key.includes('final') || key.includes('submitted')) {
    return 'border-pill-success-border bg-pill-success-bg text-pill-success-text';
  }
  if (key.includes('process') || key.includes('progress') || key.includes('pending')) {
    return 'border-pill-info-border bg-pill-info-bg text-pill-info-text';
  }
  if (key.includes('error') || key.includes('fail') || key.includes('cancel')) {
    return 'border-pill-warning-border bg-pill-warning-bg text-pill-warning-text';
  }
  return 'border-pill-neutral-border bg-pill-neutral-bg text-pill-neutral-text';
};

const getIvlsConfirmationLabel = (confirmed: boolean): string =>
  confirmed ? 'Confirmed for selected device' : 'Pending for selected device';

const StatusPill = ({ status }: { status: string }) => (
  <span
    className={`inline-flex rounded-2xl border px-3 py-1 text-caption-1 ${getStatusPillClasses(status)}`}
  >
    {status}
  </span>
);

const MODALITY_LABELS: Record<string, string> = {
  REFERENCE_LAB: 'Reference lab',
  INHOUSE: 'In-house',
  IN_HOUSE: 'In-house',
};

/** "REFERENCE_LAB" → "Reference lab", "INHOUSE"/"IN_HOUSE" → "In-house". */
const formatModality = (modality?: string | null): string | null => {
  if (!modality) return null;
  return MODALITY_LABELS[modality.trim().toUpperCase()] ?? null;
};

const getOrderActionLabel = (order: { status?: string | null }): string => {
  const statusKey = String(order.status ?? '')
    .trim()
    .toUpperCase()
    .replaceAll(/\s+/g, '_');
  if (statusKey === 'SUBMITTED') return 'Follow up';
  if (statusKey === 'CREATED' || !statusKey) return 'Continue';
  return 'Open IDEXX';
};

const getOrderActionSource = (order: { status?: string | null }): 'order' | 'followup' =>
  String(order.status ?? '')
    .trim()
    .toUpperCase()
    .replaceAll(/\s+/g, '_') === 'SUBMITTED'
    ? 'followup'
    : 'order';

/** Small neutral/info origin badge (provider, modality, package origin, billing). */
const MetaPill = ({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'info' }) => (
  <span
    className={`inline-flex shrink-0 rounded-2xl border px-2 py-0.5 text-caption-2 ${
      tone === 'info'
        ? 'border-pill-info-border bg-pill-info-bg text-pill-info-text'
        : 'border-pill-neutral-border bg-pill-neutral-bg text-pill-neutral-text'
    }`}
  >
    {label}
  </span>
);

/**
 * Shared column templates (mirrors InvoiceStep): every fr track is wrapped in
 * minmax(0,…) so heading and row grids resolve to identical widths and never
 * shift on long content. The Actions track is fixed so its buttons stay aligned.
 */
const ORDER_STATUS_COLS =
  'sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(320px,1.6fr)]';
const ORDER_STATUS_ROW_GRID = `grid gap-3 ${ORDER_STATUS_COLS} sm:items-center`;

const RESULTS_COLS = 'sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_minmax(0,1fr)_132px]';
const RESULTS_ROW_GRID = `grid gap-3 ${RESULTS_COLS} sm:items-center`;

const TableHeadings = ({ rowGrid, columns }: { rowGrid: string; columns: string[] }) => (
  <div
    className={`${rowGrid} hidden border border-transparent px-4 text-caption-2 font-medium tracking-wide text-text-secondary uppercase [&>span]:truncate sm:grid`}
  >
    {columns.map((column, index) => (
      <span key={column} className={index === columns.length - 1 ? 'text-right' : undefined}>
        {column}
      </span>
    ))}
  </div>
);

const TestQueueCard = ({
  test,
  readOnly,
  onRemove,
}: {
  test: IdexxTest;
  readOnly: boolean;
  onRemove: () => void;
}) => (
  <article className="flex min-h-52 flex-col gap-4 rounded-2xl border border-card-border bg-neutral-0 p-5 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <h4 className="text-body-3-emphasis text-text-primary">{test.display}</h4>
      {!readOnly && (
        <CircleIconButton
          icon={<LuTrash2 size={16} aria-hidden="true" />}
          label={`Remove ${test.display}`}
          variant="danger"
          onClick={onRemove}
        />
      )}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="rounded-sm bg-primary-100 px-2 py-1 text-heading-4 text-text-brand">
        {formatTestPrice(test)}
      </span>
      <span className="text-body-4 text-text-primary">Code: {test.code}</span>
    </div>
    <div className="mt-auto flex flex-col gap-2 text-caption-1 text-text-primary">
      <p className="flex gap-2">
        <LuClock className="mt-0.5 shrink-0 text-text-brand" aria-hidden="true" />
        <span>
          <strong>Turnaround time:</strong>
          <br />
          {getTestTurnaround(test)}
        </span>
      </p>
      <p className="flex gap-2">
        <LuTestTube className="mt-0.5 shrink-0 text-text-brand" aria-hidden="true" />
        <span>
          <strong>Specimen:</strong>
          <br />
          {getTestSpecimen(test)}
        </span>
      </p>
    </div>
  </article>
);

const TestTypeSelect = ({ s }: { s: UseLabTestsReturn }) => (
  <LabelDropdown
    placeholder="Test Type"
    options={s.modalityOptions}
    defaultOption={s.modality}
    searchable={false}
    onSelect={(option) => s.setModality(option.value as 'REFERENCE_LAB' | 'INHOUSE')}
  />
);

const ReferenceOrderBuilder = ({ s }: { s: UseLabTestsReturn }) => (
  <div className="grid items-stretch gap-5 lg:grid-cols-[1fr_320px]">
    <div className="flex flex-col gap-4">
      <SearchDropdown
        placeholder="Search for lab tests"
        options={s.tests.map((test) => ({
          value: test.code,
          label: `${test.display} (${test.code})`,
          meta: test,
        }))}
        onSelect={s.addTest}
        query={s.selectedTestLabel || s.query}
        setQuery={(value: string) => {
          s.setSelectedTestLabel(value);
          s.setQuery(value);
        }}
        minChars={0}
        onReachEnd={s.loadMoreTests}
        hasMore={s.testsHasMore}
        isLoadingMore={s.testsLoadingMore}
        optionClassName="w-full text-start rounded-2xl! border border-card-border bg-white px-3 py-2 mb-2 last:mb-0 hover:bg-white transition-colors"
        renderOption={(option) => {
          const test = option.meta as IdexxTest | undefined;
          if (!test) return option.label;
          return (
            <div className="flex flex-col gap-1">
              <div className="flex items-start justify-between gap-2">
                <span className="pr-2 text-body-4 text-text-primary">{test.display}</span>
                <span className="whitespace-nowrap rounded bg-primary-100 px-2 py-1 text-label-xsmall text-text-brand">
                  {formatTestPrice(test)}
                </span>
              </div>
              <span className="text-caption-1 text-text-secondary">Code: {test.code}</span>
            </div>
          );
        }}
      />
      <p className="max-w-2xl text-body-4 text-text-secondary">
        IDEXX test reference data does not explicitly flag tests as in-house vs device-specific in
        this contract. Use reference lab for external IDEXX ordering.
      </p>
      <div className="flex min-h-24 flex-1 [&>div]:h-full [&>div>div]:h-full [&_textarea]:h-full [&_textarea]:resize-none">
        <FormDesc
          intype="text"
          inname="lab-notes"
          inlabel="Notes"
          value={s.notes}
          onChange={(e) => s.setNotes(e.target.value)}
        />
      </div>
    </div>
    <div className="flex flex-col gap-3">
      <TestTypeSelect s={s} />
      <FormInput
        intype="date"
        inname="lab-specimen-date"
        inlabel="Collection Date"
        value={s.specimenCollectionDate}
        onChange={(e) => s.setSpecimenCollectionDate(e.target.value)}
      />
      <LabelDropdown
        placeholder="Veterinarian"
        options={s.practitionerOptions}
        defaultOption={s.veterinarian}
        icon={<HiUser aria-hidden="true" />}
        onSelect={(option) => s.setVeterinarian(option.value)}
      />
      <LabelDropdown
        placeholder="Technician"
        options={s.practitionerOptions}
        defaultOption={s.technician}
        icon={<HiUser aria-hidden="true" />}
        onSelect={(option) => s.setTechnician(option.value)}
      />
    </div>
  </div>
);

const InhouseOrderBuilder = ({ s }: { s: UseLabTestsReturn }) => {
  const terminologyText = useCompanionTerminologyText();

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-4">
        <p className="max-w-2xl text-body-4 text-text-secondary">
          {terminologyText(
            'In-house IDEXX workflow requires selecting an IVLS device, then adding the patient to census here. Complete ordering on the IDEXX machine after census is confirmed.'
          )}
        </p>
        <output
          className={`block rounded-2xl border p-4 text-body-4 ${
            s.companionInCensus
              ? 'border-pill-success-border bg-pill-success-bg text-pill-success-text'
              : 'border-card-border text-text-secondary'
          }`}
        >
          <p>
            {terminologyText(
              s.companionInCensus
                ? 'Patient is present in IDEXX census for this appointment patient.'
                : 'Patient is not yet in the IDEXX census.'
            )}
          </p>
          <p>
            IVLS confirmation:{' '}
            {s.selectedIvls === undefined || s.selectedIvls === ''
              ? 'Select an IVLS device to check confirmation state'
              : getIvlsConfirmationLabel(s.inHouseCensusConfirmed)}
          </p>
        </output>
      </div>
      <div className="flex flex-col gap-3">
        <TestTypeSelect s={s} />
        <LabelDropdown
          placeholder="Select Device"
          options={s.devices.map((device) => ({
            label: `${device.displayName || 'IVLS'} (${device.deviceSerialNumber})`,
            value: device.deviceSerialNumber,
          }))}
          defaultOption={s.selectedIvls}
          onSelect={(option) => s.setSelectedIvls(option.value)}
        />
      </div>
    </div>
  );
};

const OrderBuilderSection = ({ s, readOnly }: { s: UseLabTestsReturn; readOnly: boolean }) => {
  const isInHouse = s.modality === 'INHOUSE';
  return (
    <SectionContainer
      titleClassName="text-yc-20-b-primary"
      title="Order Builder"
      className="flex flex-col gap-5"
    >
      {isInHouse ? <InhouseOrderBuilder s={s} /> : <ReferenceOrderBuilder s={s} />}
      {isInHouse && !readOnly && (
        <div className="flex flex-wrap justify-end gap-3">
          <Secondary
            text={s.companionInCensus ? 'Added to Census' : 'Add to Census'}
            icon={<LuCheck aria-hidden="true" />}
            onClick={s.handleAddToCensus}
            isDisabled={s.updatingCensus || !s.selectedIvls || s.companionInCensus}
          />
          <Primary
            text={s.updatingCensus ? 'Refreshing…' : 'Refresh Census'}
            icon={<LuRefreshCw aria-hidden="true" />}
            onClick={() => void s.refreshCensus()}
            isDisabled={s.updatingCensus}
          />
        </div>
      )}
    </SectionContainer>
  );
};

const ORIGIN_LABELS: Record<string, string> = {
  PRODUCT_ITEM: 'Service',
  PACKAGE_ITEM: 'Package',
};

/**
 * Diagnostics included in this appointment's services/packages, preloaded from
 * the workspace bootstrap's diagnostic queue so the clinician sees what to order.
 */
const PreloadedDiagnosticsSection = ({ items }: { items: DiagnosticOrder[] }) => {
  if (items.length === 0) return null;
  return (
    <SectionContainer
      titleClassName="text-yc-20-b-primary"
      title="Preloaded from Services & Packages"
      className="flex flex-col gap-3"
    >
      <p className="text-body-4 text-text-secondary">
        Diagnostics included in this appointment&apos;s services and packages. Order them with the
        provider when ready.
      </p>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center gap-2 rounded-2xl border border-card-border p-4"
          >
            <span className="font-medium text-text-primary">{item.name ?? item.orderCode}</span>
            {item.sourceKind && ORIGIN_LABELS[item.sourceKind] && (
              <MetaPill label={ORIGIN_LABELS[item.sourceKind]} />
            )}
            {item.provider && <MetaPill label={item.provider} tone="info" />}
          </li>
        ))}
      </ul>
    </SectionContainer>
  );
};

const TestQueueSection = ({
  s,
  readOnly,
  onCreateOrder,
}: {
  s: UseLabTestsReturn;
  readOnly: boolean;
  onCreateOrder: () => void;
}) => (
  <SectionContainer
    titleClassName="text-yc-20-b-primary"
    title="Test Queue"
    className="flex flex-col gap-5"
  >
    {s.selectedTests.length === 0 ? (
      <p className="rounded-2xl bg-neutral-100 p-5 text-body-4 text-text-secondary">
        {readOnly
          ? 'No draft lab tests were selected before this appointment was locked.'
          : 'No tests selected yet. Search and add tests from the Order Builder.'}
      </p>
    ) : (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {s.selectedTests.map((test) => (
          <TestQueueCard
            key={test.code}
            test={test}
            readOnly={readOnly}
            onRemove={() => s.removeTest(test.code)}
          />
        ))}
      </div>
    )}
    {!readOnly && (
      <div className="flex justify-end">
        <Primary
          text={s.creatingOrder ? 'Creating Lab Order…' : 'Create Lab Order'}
          icon={<LuFlaskConical aria-hidden="true" />}
          onClick={onCreateOrder}
          isDisabled={
            s.creatingOrder || s.loading || s.selectedTests.length === 0 || !s.companionId
          }
        />
      </div>
    )}
  </SectionContainer>
);

const OrderStatusSection = ({ s }: { s: UseLabTestsReturn }) => (
  <SectionContainer
    titleClassName="text-yc-20-b-primary"
    title="Order Status"
    className="flex flex-col gap-4"
  >
    {s.appointmentOrders.length === 0 ? (
      <p className="rounded-2xl bg-neutral-100 p-4 text-body-4 text-text-secondary">
        {s.ordersLoading
          ? 'Loading appointment lab orders…'
          : 'No lab orders for this appointment yet.'}
      </p>
    ) : (
      <div className="flex flex-col gap-3">
        <TableHeadings
          rowGrid={ORDER_STATUS_ROW_GRID}
          columns={['Order ID', 'Date & Time', 'Status', 'Actions']}
        />
        <ul className="flex flex-col gap-3">
          {s.appointmentOrders.map((order, index) => {
            const isComplete = s.getOrderDisplayStatus(order) === 'Complete';
            const orderActionLabel = isComplete ? 'Result PDF' : getOrderActionLabel(order);
            return (
              <li
                key={order._id ?? order.idexxOrderId ?? `order-${index}`}
                className={`${ORDER_STATUS_ROW_GRID} rounded-2xl border border-card-border p-4`}
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="truncate font-medium text-text-primary">
                    {index + 1}. Order {order.idexxOrderId}
                  </span>
                  <span className="flex flex-wrap items-center gap-1">
                    {order.provider && <MetaPill label={order.provider} tone="info" />}
                    {formatModality(order.modality) && (
                      <MetaPill label={formatModality(order.modality) as string} />
                    )}
                  </span>
                </span>
                <span className="truncate text-body-4 text-text-secondary">
                  {formatDateTimeLocal(order.updatedAt ?? order.createdAt, '-')}
                </span>
                <div className="flex">
                  <StatusPill status={s.getOrderDisplayStatus(order)} />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Secondary
                    text={orderActionLabel}
                    icon={isComplete ? undefined : <LuExternalLink aria-hidden="true" />}
                    ariaLabel={`${isComplete ? 'Open result PDF' : orderActionLabel} for order ${order.idexxOrderId}`}
                    onClick={() => {
                      s.setActiveOrderForActions(order);
                      if (isComplete) {
                        void s.openResultPdfForOrder(order);
                        return;
                      }
                      s.openOrderIframe(getOrderActionSource(order), order.status, order);
                    }}
                    isDisabled={!isComplete && !resolveOrderUiUrl(order)}
                  />
                  <Secondary
                    text="Acknowledgement"
                    icon={<LuEye aria-hidden="true" />}
                    ariaLabel={`View acknowledgement for order ${order.idexxOrderId}`}
                    onClick={() => s.openOrderAcknowledgement(order)}
                    isDisabled={!resolveOrderPdfUrl(order)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    )}
    <div className="flex justify-end">
      <Primary
        text={s.ordersLoading ? 'Refreshing…' : 'Refresh Orders'}
        icon={<LuRefreshCw aria-hidden="true" />}
        onClick={() => void s.refreshAppointmentOrders()}
        isDisabled={s.ordersLoading}
      />
    </div>
  </SectionContainer>
);

const ResultsSection = ({ s }: { s: UseLabTestsReturn }) => {
  // Mirror the Invoice section: the View (eye) toggle expands/collapses the
  // result breakdown below; default the first result open.
  const [expandedId, setExpandedId] = useState<string | null>(s.results[0]?.resultId ?? null);
  const toggle = (id: string) => setExpandedId((current) => (current === id ? null : id));

  return (
    <SectionContainer
      titleClassName="text-yc-20-b-primary"
      title="Results"
      className="flex flex-col gap-4"
    >
      {s.results.length === 0 ? (
        <p className="rounded-2xl bg-neutral-100 p-4 text-body-4 text-text-secondary">
          {s.refreshingResults ? 'Refreshing results…' : 'No results available yet.'}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <TableHeadings
            rowGrid={RESULTS_ROW_GRID}
            columns={['Order ID', 'Date & Time', 'Status', 'Actions']}
          />
          <ul className="flex flex-col gap-3">
            {s.results.map((result, index) => {
              const expanded = expandedId === result.resultId;
              return (
                <li
                  key={result.resultId}
                  className="flex flex-col gap-4 rounded-2xl border border-card-border p-4"
                >
                  <div className={RESULTS_ROW_GRID}>
                    <span className="truncate font-medium text-text-primary">
                      {index + 1}. Order {result.orderId ?? '-'}
                    </span>
                    <span className="truncate text-body-4 text-text-secondary">
                      {formatDateTimeLocal(result.updatedAt ?? result.createdAt, '-')}
                    </span>
                    <div className="flex">
                      <StatusPill status={toTitleCase(result.status)} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <CircleIconButton
                        icon={
                          expanded ? (
                            <LuEyeOff size={16} aria-hidden="true" />
                          ) : (
                            <LuEye size={16} aria-hidden="true" />
                          )
                        }
                        label={
                          expanded
                            ? `Hide results for result ${result.resultId}`
                            : `Show results for result ${result.resultId}`
                        }
                        variant="dark"
                        onClick={() => toggle(result.resultId)}
                      />
                      <CircleIconButton
                        icon={<LuDownload size={16} aria-hidden="true" />}
                        label={`Download results PDF for result ${result.resultId}`}
                        onClick={() => void s.openResultPdfPreview(result.resultId)}
                        disabled={s.pdfPreviewLoadingId === result.resultId}
                      />
                      <CircleIconButton
                        icon={<LuShare size={16} aria-hidden="true" />}
                        label={`Share results PDF for result ${result.resultId}`}
                        onClick={() => void s.openResultPdfPreview(result.resultId)}
                        disabled={s.pdfPreviewLoadingId === result.resultId}
                      />
                    </div>
                  </div>
                  {expanded &&
                    (result.rawPayload?.categories ?? []).map((category) => (
                      <LabResultCategoryTable
                        key={`${result.resultId}-${category.name}`}
                        category={category}
                        resultId={result.resultId}
                      />
                    ))}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </SectionContainer>
  );
};

const OrderIframeOverlay = ({ s }: { s: UseLabTestsReturn }) => {
  const url = s.iframeOrderUiUrl || resolveOrderUiUrl(s.latestOrder);
  const safeUrl = getSafeIdexxIframeUrl(url);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (s.showOrderIframe) setLoaded(false);
  }, [safeUrl, s.iframeOpenSource, s.showOrderIframe]);
  if (!s.showOrderIframe || !safeUrl || typeof document === 'undefined') return null;
  const title = s.iframeOpenSource === 'followup' ? 'IDEXX follow-up ordering' : 'IDEXX ordering';
  return createPortal(
    <div
      className="fixed inset-0 z-5000 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      data-signing-overlay="true"
    >
      <div className="relative flex size-full max-h-[95vh] max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-black/10 px-4 py-2">
          <span className="flex flex-col">
            <span className="text-body-2 text-text-primary">{title}</span>
            {s.iframeOpenSource === 'followup' ? (
              <span className="text-caption-1 text-text-secondary">
                If IDEXX shows the order was submitted and this window stays open, close it with the
                top-right cross arrow to refresh this appointment.
              </span>
            ) : null}
          </span>
          <button
            type="button"
            onClick={s.closeOrderIframeManually}
            className="cursor-pointer rounded-full p-2 transition-colors hover:bg-black/5"
            aria-label="Close IDEXX order frame"
          >
            <Close iconOnly />
          </button>
        </div>
        <div className="relative flex-1">
          {loaded ? null : (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
              <YosemiteLoader label="Loading IDEXX" size={120} testId="idexx-order-loader" />
            </div>
          )}
          <iframe
            key={safeUrl}
            src={safeUrl}
            title="IDEXX order UI"
            className="size-full border-0"
            loading="lazy"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => setLoaded(true)}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};

const IdexxNotEnabled = () => (
  <SectionContainer
    titleClassName="text-yc-20-b-primary"
    title="IDEXX Diagnostics"
    className="flex flex-col gap-3"
  >
    <p className="text-body-3 text-text-primary">
      IDEXX integration is not enabled for this organization.
    </p>
    <Secondary href="/integrations" text="Enable IDEXX in Integrations" />
  </SectionContainer>
);

/**
 * Diagnostics step — the new workspace UI (pills, Order Builder, Test Queue,
 * Order Status, Results) rendered directly on the live IDEXX backend via the
 * shared `useLabTests` hook (no logic duplication; same API as the legacy drawer).
 */
const DiagnosticsStep = ({
  appointment,
  readOnly = false,
  onOpenTreatment,
}: DiagnosticsStepProps) => {
  const s = useLabTests(appointment);
  const [selectedProvider, setSelectedProvider] = useState<DiagnosticProvider>('IDEXX');
  const mergeEncounterData = useAppointmentWorkspaceStore((store) => store.mergeEncounterData);
  const preloadedDiagnostics = useAppointmentWorkspaceStore((store) =>
    appointment.id ? store.encountersById[appointment.id]?.diagnosticOrders : undefined
  );
  // Diagnostics the backend preloaded from this appointment's services/packages
  // (PROVIDER_TEST items), surfaced so they are not silently dropped from the queue.
  const preloadedTests = useMemo(
    () => (preloadedDiagnostics ?? []).filter((item) => item.kind === 'PROVIDER_TEST'),
    [preloadedDiagnostics]
  );

  // Widen the post-order refresh beyond IDEXX orders/results: after a lab order is
  // created, re-hydrate the encounter so the diagnostic queue, invoice candidates,
  // and documents (requisitions) reflect the new order, not just the lab tables.
  const handleCreateOrder = useCallback(async () => {
    await s.handleCreateOrder();
    const organisationId = appointment.organisationId;
    const appointmentId = appointment.id;
    if (!organisationId || !appointmentId) return;
    try {
      const bootstrap = await getAppointmentWorkspaceBootstrap(organisationId, appointmentId);
      mergeEncounterData(appointmentId, normalizeWorkspaceBootstrapForEncounter(bootstrap));
    } catch (error) {
      console.error('Unable to refresh workspace after lab order:', error);
    }
  }, [s, appointment.organisationId, appointment.id, mergeEncounterData]);

  // "Print all Results": fetch one backend-merged PDF of every result and open it
  // in the preview overlay. Falls back to the browser print dialog when there are
  // no results yet or the combined PDF can't be built.
  const [combinedPdfUrl, setCombinedPdfUrl] = useState<string | null>(null);
  const [printingAll, setPrintingAll] = useState(false);

  const handlePrintAllResults = useCallback(async () => {
    if (printingAll) return;
    const organisationId = appointment.organisationId;
    const resultIds = s.results.map((result) => result.resultId).filter(Boolean);
    if (!organisationId || resultIds.length === 0) {
      globalThis.window.print();
      return;
    }
    setPrintingAll(true);
    try {
      const blob = await getIdexxCombinedResultsPdfBlob({ organisationId, resultIds });
      setCombinedPdfUrl(URL.createObjectURL(blob));
    } catch (error) {
      console.error('Unable to build combined results PDF:', error);
      globalThis.window.print();
    } finally {
      setPrintingAll(false);
    }
  }, [printingAll, appointment.organisationId, s.results]);

  const closeCombinedPdf = useCallback(() => {
    setCombinedPdfUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }, []);

  const renderIdexx = () => {
    if (s.loading) {
      return <p className="text-body-4 text-text-secondary">Loading IDEXX integration…</p>;
    }
    if (!s.integrationEnabled) return <IdexxNotEnabled />;
    return (
      <>
        {s.error ? <p className="text-body-4 text-text-error">{s.error}</p> : null}
        {!readOnly && <OrderBuilderSection s={s} readOnly={readOnly} />}
        <PreloadedDiagnosticsSection items={preloadedTests} />
        <TestQueueSection
          s={s}
          readOnly={readOnly}
          onCreateOrder={() => void handleCreateOrder()}
        />
        <OrderStatusSection s={s} />
        <ResultsSection s={s} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Secondary
            text={printingAll ? 'Preparing…' : 'Print all Results'}
            icon={<LuPrinter aria-hidden="true" />}
            onClick={() => void handlePrintAllResults()}
            isDisabled={printingAll}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Secondary
              href="/appointments/idexx-workspace"
              text="Open Labs"
              ariaLabel="Open labs workspace"
              icon={<LuExternalLink aria-hidden="true" />}
            />
            <Primary
              text="Treatment Plan"
              icon={<LuCalendarDays aria-hidden="true" />}
              onClick={onOpenTreatment}
            />
          </div>
        </div>
        <OrderIframeOverlay s={s} />
        <PdfPreviewOverlay
          open={s.showPdfPreview}
          pdfUrl={s.pdfPreviewUrl}
          title={s.pdfPreviewTitle}
          closeLabel="Close IDEXX PDF preview"
          onClose={s.closePdfPreview}
        />
        <PdfPreviewOverlay
          open={Boolean(combinedPdfUrl)}
          pdfUrl={combinedPdfUrl}
          title="All lab results"
          closeLabel="Close combined results PDF"
          onClose={closeCombinedPdf}
        />
      </>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <IntegrationPills selected={selectedProvider} onSelect={setSelectedProvider} />
      {renderIdexx()}
    </div>
  );
};

export default DiagnosticsStep;
