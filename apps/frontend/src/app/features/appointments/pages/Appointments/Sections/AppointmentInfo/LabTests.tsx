import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { IoOpenOutline } from 'react-icons/io5';
import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import SearchDropdown from '@/app/ui/inputs/SearchDropdown';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import Close from '@/app/ui/primitives/Icons/Close';
import PdfPreviewOverlay from '@/app/ui/overlays/PdfPreviewOverlay';
import { YosemiteLoader } from '@/app/ui/overlays/Loader';
import LabResultValue from '@/app/ui/widgets/LabResultValue';
import { Appointment } from '@yosemite-crew/types';
import { useOrgStore } from '@/app/stores/orgStore';
import { useIntegrationByProviderForPrimaryOrg } from '@/app/hooks/useIntegrations';
import {
  addPatientToIdexxCensus,
  createIdexxLabOrder,
  getApiErrorMessage,
  getIdexxCensus,
  getIdexxOrderById,
  getIdexxResultPdfBlob,
  listIdexxIvlsDevices,
  listIdexxResults,
  listIdexxTests,
} from '@/app/features/integrations/services/idexxService';
import {
  CensusEntry,
  IdexxTest,
  IvlsDevice,
  LabOrder,
  LabResultTest,
  LabResult,
} from '@/app/features/integrations/services/types';
import { getIdexxTestSearchProps } from '@/app/features/appointments/pages/AppointmentWorkspace/steps/idexxTestSearchProps';
import { formatDateTimeLocal } from '@/app/lib/date';
import {
  formatTestPrice,
  getOrderStatusTone,
  getTestSpecimen,
  getTestTurnaround,
  resolveOrderPdfUrl,
  resolveOrderUiUrl,
  toTitleCase,
} from './labTestsUtils';
import {
  formatCensusIvlsDevices,
  formatOrderStatus,
  getMeterMeta,
  getNormalizedLifecycleStatus,
  getOrderActionLabel,
  getOrderActionSource,
  getOrderResultProgressFromResults,
  getResultOrderId,
  listIdexxOrdersWithFallback,
  mergeUniqueTests,
  normalizeOrders,
  resolveLatestOrder,
  shouldCloseOrderIframe,
} from './LabTests.helpers';
import BreedSubstitutionNotice from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/BreedSubstitutionNotice';

const TESTS_PAGE_SIZE = 25;
const IDEXX_REGIONAL_AVAILABILITY_DISCLAIMER =
  'IDEXX integration availability is currently limited to the USA, Canada, and the UK.';

// ---------- Sub-components ----------

const LabResultMeter = ({ test }: { test: LabResultTest }) => {
  const meter = getMeterMeta(test);
  if (!meter.canRender) {
    return <span className="text-caption-1 text-text-secondary">N/A</span>;
  }
  return (
    <div className="relative h-2 w-48 bg-card-hover rounded-full">
      <div
        className={`absolute top-1/2 -translate-y-1/2 w-1.5 h-4 rounded ${meter.markerClass}`}
        style={{ left: `calc(${meter.percent}% - 3px)` }}
      />
    </div>
  );
};

export const LabResultCategoryTable = ({
  category,
  resultId,
}: {
  category: { name: string; tests: LabResultTest[] };
  resultId: string;
}) => (
  <div key={`${resultId}-${category.name}`} className="rounded-xl border border-card-border p-2">
    <div className="text-body-4 text-text-primary mb-2">{category.name}</div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px]">
        <thead>
          <tr className="border-b border-card-border">
            <th className="text-left text-caption-1 text-text-tertiary py-1 pr-2">Test</th>
            <th className="text-left text-caption-1 text-text-tertiary py-1 pr-2">Value</th>
            <th className="text-left text-caption-1 text-text-tertiary py-1 pr-2">Reference</th>
            <th className="text-left text-caption-1 text-text-tertiary py-1">Meter</th>
          </tr>
        </thead>
        <tbody>
          {category.tests.map((test, idx) => (
            <tr
              key={`${category.name}-${test.name}-${idx}`}
              className="border-b border-card-border last:border-0"
            >
              <td className="text-caption-1 text-text-primary py-2 pr-2">{test.name}</td>
              <td
                className={`text-caption-1 py-2 pr-2 ${test.outOfRange ? 'text-text-error' : 'text-text-primary'}`}
              >
                <LabResultValue test={test} />
              </td>
              <td className="text-caption-1 text-text-secondary py-2 pr-2">
                {test.referenceRange ?? '-'}
              </td>
              <td className="py-2">
                <LabResultMeter test={test} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const PastOrderCard = ({
  order,
  resultProgressByOrderId,
  getOrderDisplayStatus,
  openOrderIframe,
  openResultPdfForOrder,
  openOrderAcknowledgement,
  setActiveOrderForActions,
}: {
  order: LabOrder;
  resultProgressByOrderId: Map<string, string>;
  getOrderDisplayStatus: (o: LabOrder) => string;
  openOrderIframe: (
    source: 'order' | 'followup',
    statusOverride?: string | null,
    targetOrder?: LabOrder
  ) => void;
  openResultPdfForOrder: (o: LabOrder) => void;
  openOrderAcknowledgement: (o: LabOrder) => void;
  setActiveOrderForActions: (o: LabOrder) => void;
}) => (
  <div className="rounded-xl border border-card-border p-3 flex flex-col gap-2">
    <div className="flex items-start justify-between gap-2">
      <div>
        <div className="text-body-4 text-text-primary">Order {order.idexxOrderId}</div>
        <div className="text-caption-1 text-text-secondary">
          Updated: {formatDateTimeLocal(order.updatedAt, '-')}
        </div>
      </div>
      <StatusPill
        className="w-fit"
        tone={getOrderStatusTone(order, resultProgressByOrderId)}
        label={getOrderDisplayStatus(order)}
      />
    </div>
    <BreedSubstitutionNotice substitution={order.breedSubstitution} />
    <div className="flex flex-wrap items-center gap-2 justify-end">
      {getOrderDisplayStatus(order) === 'Complete' ? (
        <Primary href="#" text="Result PDF" onClick={() => openResultPdfForOrder(order)} />
      ) : (
        <Primary
          href="#"
          text={getOrderActionLabel(order)}
          onClick={() => {
            setActiveOrderForActions(order);
            openOrderIframe(getOrderActionSource(order), order.status, order);
          }}
          isDisabled={!resolveOrderUiUrl(order)}
        />
      )}
      <Secondary
        href="#"
        text="Acknowledgment PDF"
        onClick={() => openOrderAcknowledgement(order)}
        isDisabled={!resolveOrderPdfUrl(order)}
      />
    </div>
  </div>
);

// ---------- Custom hook ----------

export const useLabTests = (activeAppointment: Appointment | null) => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const idexxIntegration = useIntegrationByProviderForPrimaryOrg('IDEXX');
  const integrationEnabled = idexxIntegration?.status === 'enabled';
  const [devices, setDevices] = useState<IvlsDevice[]>([]);
  const [tests, setTests] = useState<IdexxTest[]>([]);
  const [testsPage, setTestsPage] = useState(1);
  const [testsHasMore, setTestsHasMore] = useState(false);
  const [testsLoadingMore, setTestsLoadingMore] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedTestLabel, setSelectedTestLabel] = useState('');
  const [selectedTests, setSelectedTests] = useState<IdexxTest[]>([]);
  const [pendingTest, setPendingTest] = useState<IdexxTest | null>(null);
  const [appointmentOrders, setAppointmentOrders] = useState<LabOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [modality, setModality] = useState<'REFERENCE_LAB' | 'INHOUSE'>('REFERENCE_LAB');
  const [selectedIvls, setSelectedIvls] = useState('');
  const defaultLeadName = (activeAppointment?.lead?.name ?? '').trim();
  const defaultTechnicianName = (activeAppointment?.supportStaff ?? [])
    .map((staff) => (staff.name ?? '').trim())
    .find((name) => name && name !== defaultLeadName);
  const [veterinarian, setVeterinarian] = useState(defaultLeadName);
  const [technician, setTechnician] = useState(defaultTechnicianName ?? '');
  const [notes, setNotes] = useState('');
  const [specimenCollectionDate, setSpecimenCollectionDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [latestOrder, setLatestOrder] = useState<LabOrder | null>(null);
  const [results, setResults] = useState<LabResult[]>([]);
  const [censusEntries, setCensusEntries] = useState<CensusEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [updatingCensus, setUpdatingCensus] = useState(false);
  const [refreshingResults, setRefreshingResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOrderIframe, setShowOrderIframe] = useState(false);
  const [iframeInitialStatus, setIframeInitialStatus] = useState<string | null>(null);
  const [iframeInitialOrderId, setIframeInitialOrderId] = useState<string | null>(null);
  const [iframeOrderUiUrl, setIframeOrderUiUrl] = useState<string | null>(null);
  const [iframeOpenSource, setIframeOpenSource] = useState<'order' | 'followup'>('order');
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewTitle, setPdfPreviewTitle] = useState('IDEXX PDF');
  const [pdfPreviewLoadingId, setPdfPreviewLoadingId] = useState<string | null>(null);

  const appointmentId = activeAppointment?.id;
  const companionId = activeAppointment?.companion?.id;
  const parentId = activeAppointment?.companion?.parent?.id;
  const [prevAppointmentStaffKey, setPrevAppointmentStaffKey] = useState<string | null>(null);

  // Stable ref so callbacks can read the latest appointmentOrders without
  // listing the array as a dep (new array ref every render → infinite loop).
  const appointmentOrdersRef = React.useRef(appointmentOrders);
  useEffect(() => {
    appointmentOrdersRef.current = appointmentOrders;
  });
  const normalizedOrderStatus = getNormalizedLifecycleStatus(latestOrder);
  const needsInitialOrderPlacement = normalizedOrderStatus === 'CREATED';

  const resultProgressByOrderId = useMemo(() => {
    const map = new Map<string, string>();
    appointmentOrders.forEach((order) => {
      const orderId = String(order.idexxOrderId ?? '').trim();
      if (!orderId) return;
      const progress = getOrderResultProgressFromResults(results, orderId);
      if (progress) map.set(orderId, progress);
    });
    return map;
  }, [appointmentOrders, results]);

  const canOpenFollowUpInCurrentOrder = Boolean(
    latestOrder &&
    resolveOrderUiUrl(latestOrder) &&
    !['INHOUSE', 'IN_HOUSE'].includes(String(latestOrder.modality ?? '').toUpperCase()) &&
    normalizedOrderStatus === 'SUBMITTED'
  );

  const getOrderDisplayStatus = useCallback(
    (order: LabOrder) =>
      resultProgressByOrderId.get(String(order.idexxOrderId ?? '').trim()) ||
      formatOrderStatus(order),
    [resultProgressByOrderId]
  );

  const upsertAppointmentOrder = useCallback((order: LabOrder) => {
    setAppointmentOrders((prev) => {
      const next = [order, ...prev.filter((item) => item._id !== order._id)];
      return normalizeOrders(next);
    });
  }, []);

  const appointmentStaffKey = `${activeAppointment?.id ?? ''}:${defaultLeadName}:${(activeAppointment?.supportStaff ?? []).map((staff) => staff.id ?? staff.name ?? '').join('|')}`;
  if (prevAppointmentStaffKey === null || appointmentStaffKey !== prevAppointmentStaffKey) {
    setPrevAppointmentStaffKey(appointmentStaffKey);
    if (veterinarian !== defaultLeadName) {
      setVeterinarian(defaultLeadName);
    }
    const nextTechnician = defaultTechnicianName ?? '';
    if (technician !== nextTechnician) {
      setTechnician(nextTechnician);
    }
  }

  useEffect(() => {
    const run = async () => {
      if (!primaryOrgId || !integrationEnabled) {
        setDevices([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const ivls = await listIdexxIvlsDevices(primaryOrgId);
        setDevices(ivls.ivlsDeviceList ?? []);
      } catch (e) {
        setDevices([]);
        setError(getApiErrorMessage(e, 'Unable to load IDEXX integration/device state.'));
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [primaryOrgId, integrationEnabled]);

  /* Guards against an out-of-order response. The backend now filters on `query`
     server-side, so two in-flight searches return DIFFERENT result sets - and a
     slower earlier one landing last would overwrite the newer results, leaving
     the picker showing tests for text the user has already changed. While every
     response was the same unfiltered page this could not be observed, which is
     why the debounce alone was enough before. Compared rather than aborted so a
     superseded request still settles harmlessly. */
  const testsRequestSeq = React.useRef(0);

  const fetchTestsPage = useCallback(
    async (page: number, append: boolean) => {
      if (!primaryOrgId || !integrationEnabled) return;
      const seq = ++testsRequestSeq.current;
      if (append) setTestsLoadingMore(true);
      try {
        const res = await listIdexxTests({
          organisationId: primaryOrgId,
          query,
          page,
          limit: TESTS_PAGE_SIZE,
        });
        if (seq !== testsRequestSeq.current) return;
        const nextBatch = res.tests ?? [];
        setTests((prev) => (append ? mergeUniqueTests(prev, nextBatch) : nextBatch));
        setTestsPage(page);
        setTestsHasMore(nextBatch.length >= TESTS_PAGE_SIZE);
      } catch (e) {
        if (seq !== testsRequestSeq.current) return;
        if (!append) setTests([]);
        setError(getApiErrorMessage(e, 'Unable to load IDEXX tests.'));
      } finally {
        /* Only the newest request owns the spinner; an older one clearing it
           would hide that a newer fetch is still running. */
        if (append && seq === testsRequestSeq.current) setTestsLoadingMore(false);
      }
    },
    [integrationEnabled, primaryOrgId, query]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchTestsPage(1, false);
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchTestsPage, query]);

  const loadMoreTests = useCallback(() => {
    if (!testsHasMore || testsLoadingMore) return;
    void fetchTestsPage(testsPage + 1, true);
  }, [fetchTestsPage, testsHasMore, testsLoadingMore, testsPage]);

  // refreshResultsRef lets refreshAppointmentOrders call refreshResults without
  // creating a circular dep — refreshResults is defined after this callback.
  const refreshResultsRef = React.useRef<() => Promise<void>>(async () => undefined);

  const refreshAppointmentOrders = useCallback(async () => {
    if (!primaryOrgId || !integrationEnabled || !appointmentId) {
      setAppointmentOrders([]);
      setLatestOrder(null);
      return;
    }
    setOrdersLoading(true);
    setError(null);
    try {
      const orders = await listIdexxOrdersWithFallback(primaryOrgId, appointmentId, companionId);
      const normalized = normalizeOrders(orders);
      setAppointmentOrders(normalized);
      appointmentOrdersRef.current = normalized;
      setLatestOrder((prev) => {
        if (!normalized.length) return null;
        if (!prev) return normalized[0];
        return normalized.find((order) => order._id === prev._id) ?? normalized[0];
      });
      await refreshResultsRef.current();
    } catch (e) {
      setAppointmentOrders([]);
      setLatestOrder(null);
      setError(getApiErrorMessage(e, 'Unable to load appointment lab orders.'));
    } finally {
      setOrdersLoading(false);
    }
  }, [appointmentId, companionId, integrationEnabled, primaryOrgId]);

  const refreshCensus = useCallback(async () => {
    if (!primaryOrgId || !integrationEnabled) return;
    try {
      const entries = await getIdexxCensus(primaryOrgId);
      setCensusEntries(entries);
    } catch (e) {
      setCensusEntries([]);
      setError(getApiErrorMessage(e, 'Unable to load IDEXX census.'));
    }
  }, [integrationEnabled, primaryOrgId]);

  const refreshResults = useCallback(async () => {
    if (!primaryOrgId || !integrationEnabled) return;
    setRefreshingResults(true);
    try {
      const appointmentOrderIds = new Set(
        appointmentOrdersRef.current.flatMap((order) => {
          const orderId = String(order.idexxOrderId ?? '').trim();
          return orderId ? [orderId] : [];
        })
      );
      if (appointmentOrderIds.size === 0) {
        setResults([]);
        return;
      }
      const allResults = await listIdexxResults(primaryOrgId);
      const filtered = allResults.filter((result) => {
        const companionMatch = companionId ? result.patientId === companionId : true;
        const resultOrderId = getResultOrderId(result);
        return companionMatch && appointmentOrderIds.has(resultOrderId);
      });
      setResults(filtered);
    } catch (e) {
      setResults([]);
      setError(getApiErrorMessage(e, 'Unable to load IDEXX results.'));
    } finally {
      setRefreshingResults(false);
    }
  }, [companionId, integrationEnabled, primaryOrgId]);

  // Keep the ref current so refreshAppointmentOrders can call the latest version.
  useEffect(() => {
    refreshResultsRef.current = refreshResults;
  });

  useEffect(() => {
    const run = async () => {
      await refreshResults();
    };
    void run();
  }, [refreshResults]);
  useEffect(() => {
    const run = async () => {
      await refreshCensus();
    };
    void run();
  }, [refreshCensus]);
  useEffect(() => {
    const run = async () => {
      await refreshAppointmentOrders();
    };
    void run();
  }, [refreshAppointmentOrders]);

  useEffect(() => {
    if (!showOrderIframe) return;
    if (!primaryOrgId || !iframeInitialOrderId) return;

    const interval = setInterval(async () => {
      try {
        const next = await getIdexxOrderById({
          organisationId: primaryOrgId,
          idexxOrderId: iframeInitialOrderId,
        });
        setLatestOrder(next);
        upsertAppointmentOrder(next);

        if (iframeOpenSource === 'followup' && activeAppointment?.id) {
          let newestKnownOrderId = String(next.idexxOrderId ?? '').trim();
          const appointmentOrderIds = new Set(
            appointmentOrdersRef.current.flatMap((order) => {
              const orderId = String(order.idexxOrderId ?? '').trim();
              return orderId ? [orderId] : [];
            })
          );
          if (appointmentOrderIds.size > 0) {
            const allResults = await listIdexxResults(primaryOrgId);
            const filtered = allResults.filter((result) => {
              const companionMatch = companionId ? result.patientId === companionId : true;
              const resultOrderId = getResultOrderId(result);
              return companionMatch && appointmentOrderIds.has(resultOrderId);
            });
            setResults(filtered);
          }

          const refreshedOrders = await listIdexxOrdersWithFallback(
            primaryOrgId,
            activeAppointment.id,
            companionId
          );
          const normalizedOrders = normalizeOrders(refreshedOrders);
          if (normalizedOrders.length > 0) {
            setAppointmentOrders(normalizedOrders);
            setLatestOrder((prev) => resolveLatestOrder(prev, normalizedOrders));
            newestKnownOrderId = String(normalizedOrders[0].idexxOrderId ?? '').trim();
          }
          const nextHasAcknowledgement = Boolean(resolveOrderPdfUrl(next));
          if (
            shouldCloseOrderIframe({
              source: iframeOpenSource,
              initialStatus: iframeInitialStatus,
              nextStatus: getNormalizedLifecycleStatus(next),
              nextHasAcknowledgement,
              initialOrderId: iframeInitialOrderId,
              newestKnownOrderId,
            })
          ) {
            setShowOrderIframe(false);
            void refreshAppointmentOrders();
            return;
          }
          return;
        }

        const nextStatus = getNormalizedLifecycleStatus(next);
        const nextHasAcknowledgement = Boolean(resolveOrderPdfUrl(next));
        if (
          shouldCloseOrderIframe({
            source: iframeOpenSource,
            initialStatus: iframeInitialStatus,
            nextStatus,
            nextHasAcknowledgement,
            initialOrderId: iframeInitialOrderId,
            newestKnownOrderId: String(next.idexxOrderId ?? '').trim(),
          })
        ) {
          setShowOrderIframe(false);
          void refreshAppointmentOrders();
          return;
        }
      } catch (e) {
        setError(getApiErrorMessage(e, 'Unable to poll order status while IDEXX frame is open.'));
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [
    showOrderIframe,
    primaryOrgId,
    activeAppointment?.id,
    iframeInitialOrderId,
    iframeOpenSource,
    iframeInitialStatus,
    upsertAppointmentOrder,
    companionId,
    refreshAppointmentOrders,
  ]);

  const openOrderIframe = useCallback(
    (source: 'order' | 'followup', statusOverride?: string | null, targetOrder?: LabOrder) => {
      const orderForFrame = targetOrder ?? latestOrder;
      const frameOrderId = String(orderForFrame?.idexxOrderId ?? '').trim();
      const frameUiUrl = resolveOrderUiUrl(orderForFrame);
      if (!frameOrderId || !frameUiUrl) {
        setError('IDEXX order frame is not available for this order.');
        return;
      }
      setIframeOpenSource(source);
      setIframeInitialStatus((statusOverride ?? orderForFrame?.status ?? '').toUpperCase() || null);
      setIframeInitialOrderId(frameOrderId);
      setIframeOrderUiUrl(frameUiUrl);
      setShowOrderIframe(true);
    },
    [latestOrder]
  );

  const closeOrderIframeManually = useCallback(() => {
    setShowOrderIframe(false);
    void refreshAppointmentOrders();
  }, [refreshAppointmentOrders]);

  const closePdfPreview = useCallback(() => {
    setShowPdfPreview(false);
    if (pdfPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(pdfPreviewUrl);
    setPdfPreviewUrl(null);
    setPdfPreviewTitle('IDEXX PDF');
  }, [pdfPreviewUrl]);

  const openResultPdfPreview = useCallback(
    async (resultId: string) => {
      if (!primaryOrgId || !resultId || pdfPreviewLoadingId === resultId) return;
      setPdfPreviewLoadingId(resultId);
      setError(null);
      try {
        const pdfBlob = await getIdexxResultPdfBlob({ organisationId: primaryOrgId, resultId });
        const objectUrl = URL.createObjectURL(pdfBlob);
        if (pdfPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(pdfPreviewUrl);
        setPdfPreviewUrl(objectUrl);
        setPdfPreviewTitle(`IDEXX Result PDF #${resultId}`);
        setShowPdfPreview(true);
      } catch (e) {
        setError(getApiErrorMessage(e, 'Unable to load IDEXX PDF preview.'));
      } finally {
        setPdfPreviewLoadingId(null);
      }
    },
    [primaryOrgId, pdfPreviewLoadingId, pdfPreviewUrl]
  );

  const openResultPdfForOrder = useCallback(
    async (order: LabOrder) => {
      const orderId = String(order.idexxOrderId ?? '').trim();
      if (!orderId) return;
      const candidates = results
        .filter((result) => getResultOrderId(result) === orderId)
        .sort((a, b) => {
          const aTime = Date.parse(a.updatedAt ?? a.createdAt ?? '');
          const bTime = Date.parse(b.updatedAt ?? b.createdAt ?? '');
          return bTime - aTime;
        });
      const latest = candidates[0];
      if (!latest?.resultId) {
        setError('Result PDF is not available for this order yet.');
        return;
      }
      await openResultPdfPreview(latest.resultId);
    },
    [openResultPdfPreview, results]
  );

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(pdfPreviewUrl);
    };
  }, [pdfPreviewUrl]);

  const openOrderAcknowledgement = useCallback((order: LabOrder) => {
    const pdfUrl = resolveOrderPdfUrl(order);
    if (!pdfUrl) {
      setError('Acknowledgment PDF is not available for this order.');
      return;
    }
    setError(null);
    setPdfPreviewTitle(`IDEXX Order Acknowledgment #${order.idexxOrderId}`);
    setPdfPreviewUrl(pdfUrl);
    setShowPdfPreview(true);
  }, []);

  const setActiveOrderForActions = useCallback((order: LabOrder) => {
    setLatestOrder(order);
  }, []);

  const findTestByValue = useCallback(
    (value: string) => tests.find((test) => test.code === value || test._id === value),
    [tests]
  );

  // Single source of truth for "put this test in the queue, deduped by code" -
  // both the direct-add and confirm-pending paths below route through it so
  // they can't diverge.
  const queueTest = useCallback((test: IdexxTest) => {
    setSelectedTests((prev) => (prev.some((t) => t.code === test.code) ? prev : [...prev, test]));
  }, []);

  const addTest = useCallback(
    (value: string) => {
      const match = findTestByValue(value);
      if (!match) return;
      setSelectedTestLabel('');
      setQuery('');
      queueTest(match);
    },
    [findTestByValue, queueTest]
  );

  const removeTest = useCallback((code: string) => {
    setSelectedTests((prev) => prev.filter((test) => test.code !== code));
  }, []);

  // Search selection only stages a candidate test - it does not queue it. The
  // workspace Diagnostics step requires the explicit "Add to Queue" action
  // below before a searched test lands in the Test Queue (bug #1973).
  const selectSearchResult = useCallback(
    (value: string) => {
      const match = findTestByValue(value);
      if (!match) return;
      setPendingTest(match);
      const label = `${match.display} (${match.code})`;
      setSelectedTestLabel(label);
      setQuery(label);
    },
    [findTestByValue]
  );

  const confirmPendingTest = useCallback(() => {
    if (pendingTest) queueTest(pendingTest);
    setPendingTest(null);
    setSelectedTestLabel('');
    setQuery('');
  }, [pendingTest, queueTest]);

  const cancelPendingTest = useCallback(() => {
    setPendingTest(null);
    setSelectedTestLabel('');
    setQuery('');
  }, []);

  const handleCreateOrder = useCallback(async () => {
    if (!primaryOrgId || !companionId || selectedTests.length === 0) return;
    setCreatingOrder(true);
    setError(null);
    try {
      const payload = {
        patientId: companionId,
        appointmentId,
        tests: selectedTests.map((test) => test.code),
        modality,
        veterinarian: veterinarian || undefined,
        technician: technician || undefined,
        notes: notes || undefined,
        specimenCollectionDate: specimenCollectionDate || undefined,
      };
      const created = await createIdexxLabOrder({ organisationId: primaryOrgId, payload });
      setLatestOrder(created);
      upsertAppointmentOrder(created);
      setSelectedTests([]);
      setPendingTest(null);
      setSelectedTestLabel('');
      setQuery('');
      setNotes('');
      openOrderIframe('order', created.status, created);
      await refreshAppointmentOrders();
      await refreshResults();
    } catch (e) {
      setError(getApiErrorMessage(e, 'Unable to create IDEXX lab order.'));
    } finally {
      setCreatingOrder(false);
    }
  }, [
    primaryOrgId,
    companionId,
    selectedTests,
    appointmentId,
    modality,
    veterinarian,
    technician,
    notes,
    specimenCollectionDate,
    upsertAppointmentOrder,
    openOrderIframe,
    refreshAppointmentOrders,
    refreshResults,
  ]);

  const handleAddToCensus = useCallback(async () => {
    if (!primaryOrgId || !companionId) return;
    setUpdatingCensus(true);
    setError(null);
    try {
      await addPatientToIdexxCensus({
        organisationId: primaryOrgId,
        payload: {
          patientId: companionId,
          parentId: parentId || undefined,
          veterinarian: veterinarian || undefined,
          ivls: selectedIvls ? [selectedIvls] : undefined,
        },
      });
      await refreshCensus();
    } catch (e) {
      setError(getApiErrorMessage(e, 'Unable to add companion to IDEXX census.'));
    } finally {
      setUpdatingCensus(false);
    }
  }, [primaryOrgId, companionId, parentId, veterinarian, selectedIvls, refreshCensus]);

  const modalityOptions = useMemo(
    () => [
      { label: 'Reference lab', value: 'REFERENCE_LAB' },
      { label: 'In-house', value: 'INHOUSE' },
    ],
    []
  );

  const practitionerOptions = useMemo(() => {
    const options: Array<{ label: string; value: string }> = [];
    const seen = new Set<string>();
    const addOption = (name?: string) => {
      const trimmed = String(name ?? '').trim();
      if (!trimmed || seen.has(trimmed)) return;
      seen.add(trimmed);
      options.push({ label: trimmed, value: trimmed });
    };
    addOption(activeAppointment?.lead?.name);
    (activeAppointment?.supportStaff ?? []).forEach((staff) => addOption(staff.name));
    return options;
  }, [activeAppointment?.lead?.name, activeAppointment?.supportStaff]);

  const companionInCensus = useMemo(
    () => censusEntries.some((entry) => entry.patient?.patientId === companionId),
    [censusEntries, companionId]
  );

  const companionCensusEntry = useMemo(
    () => censusEntries.find((entry) => entry.patient?.patientId === companionId) ?? null,
    [censusEntries, companionId]
  );

  const selectedDeviceInCensus = useMemo(() => {
    if (!companionCensusEntry || !selectedIvls) return false;
    return (companionCensusEntry.ivls ?? []).some(
      (device) => String(device.serialNumber ?? '').trim() === selectedIvls
    );
  }, [companionCensusEntry, selectedIvls]);

  const inHouseCensusConfirmed = useMemo(() => {
    if (!companionCensusEntry) return false;
    const confirmedBy = companionCensusEntry.confirmedBy ?? [];
    if (selectedIvls) return confirmedBy.includes(selectedIvls);
    return Boolean(companionCensusEntry.confirmed || confirmedBy.length > 0);
  }, [companionCensusEntry, selectedIvls]);

  const needsSelectedDeviceCensusAdd = useMemo(() => {
    if (!selectedIvls) return false;
    return !companionInCensus;
  }, [companionInCensus, selectedIvls]);

  return {
    // state
    integrationEnabled,
    loading,
    error,
    devices,
    tests,
    testsHasMore,
    testsLoadingMore,
    query,
    setQuery,
    selectedTestLabel,
    setSelectedTestLabel,
    selectedTests,
    pendingTest,
    modality,
    setModality,
    selectedIvls,
    setSelectedIvls,
    veterinarian,
    setVeterinarian,
    technician,
    setTechnician,
    notes,
    setNotes,
    specimenCollectionDate,
    setSpecimenCollectionDate,
    latestOrder,
    appointmentOrders,
    ordersLoading,
    results,
    censusEntries,
    creatingOrder,
    updatingCensus,
    refreshingResults,
    showOrderIframe,
    iframeOrderUiUrl,
    iframeOpenSource,
    showPdfPreview,
    pdfPreviewUrl,
    pdfPreviewTitle,
    pdfPreviewLoadingId,
    // derived
    needsInitialOrderPlacement,
    canOpenFollowUpInCurrentOrder,
    resultProgressByOrderId,
    companionInCensus,
    selectedDeviceInCensus,
    inHouseCensusConfirmed,
    needsSelectedDeviceCensusAdd,
    modalityOptions,
    practitionerOptions,
    companionId,
    // actions
    loadMoreTests,
    refreshAppointmentOrders,
    refreshCensus,
    refreshResults,
    openOrderIframe,
    closeOrderIframeManually,
    closePdfPreview,
    openResultPdfPreview,
    openResultPdfForOrder,
    openOrderAcknowledgement,
    setActiveOrderForActions,
    addTest,
    selectSearchResult,
    confirmPendingTest,
    cancelPendingTest,
    removeTest,
    handleCreateOrder,
    handleAddToCensus,
    getOrderDisplayStatus,
  };
};

// ---------- Sub-components ----------

export type UseLabTestsReturn = ReturnType<typeof useLabTests>;

const getCensusStatusLabel = (selectedIvls: string, companionInCensus: boolean): string => {
  if (selectedIvls) return companionInCensus ? 'Already added to census' : 'Not added to census';
  return companionInCensus ? 'Added' : 'Not added';
};

const getCensusDescription = (selectedIvls: string, companionInCensus: boolean): string => {
  if (selectedIvls) {
    return companionInCensus
      ? 'Companion already exists in IDEXX census. IDEXX only allows one census entry per patient.'
      : 'Add this companion to IDEXX census before running in-house diagnostics.';
  }
  return companionInCensus
    ? 'Companion is present in IDEXX census for this appointment companion.'
    : 'Add this companion to IDEXX census before running in-house diagnostics.';
};

const getIvlsConfirmationLabel = (
  selectedIvls: string,
  inHouseCensusConfirmed: boolean
): string => {
  if (!selectedIvls) return 'Select an IVLS device to check confirmation state';
  return inHouseCensusConfirmed ? 'Confirmed for selected device' : 'Pending for selected device';
};

const getAppointmentStateLabel = (
  selectedIvls: string,
  companionInCensus: boolean,
  selectedDeviceInCensus: boolean,
  inHouseCensusConfirmed: boolean
): string => {
  if (!selectedIvls) return 'Select an IVLS device';
  if (!companionInCensus) return 'Not yet added to census';
  if (!selectedDeviceInCensus) return 'Already in census under another device';
  return inHouseCensusConfirmed
    ? 'Ready on selected IVLS device'
    : 'Added to selected device census, awaiting IVLS confirmation';
};

const InhouseCensusStatus = ({ s }: { s: UseLabTestsReturn }) => {
  const censusStatusLabel = getCensusStatusLabel(s.selectedIvls, s.companionInCensus);
  const censusDescription = getCensusDescription(s.selectedIvls, s.companionInCensus);
  const ivlsConfirmationLabel = getIvlsConfirmationLabel(s.selectedIvls, s.inHouseCensusConfirmed);
  const appointmentStateLabel = getAppointmentStateLabel(
    s.selectedIvls,
    s.companionInCensus,
    s.selectedDeviceInCensus,
    s.inHouseCensusConfirmed
  );
  const censusEntry =
    s.censusEntries.find((entry) => entry.patient?.patientId === s.companionId) ?? null;

  return (
    <div
      className={`rounded-2xl border p-3 ${s.companionInCensus ? 'border-pill-success-border bg-pill-success-bg' : 'border-card-border'}`}
    >
      <div className="text-body-4 text-text-primary">
        Companion census status: {censusStatusLabel}
      </div>
      <div className="text-caption-1 text-text-secondary mt-1">{censusDescription}</div>
      {s.companionInCensus && (
        <div className="text-caption-1 text-text-secondary mt-1">
          IVLS confirmation: {ivlsConfirmationLabel}
        </div>
      )}
      {s.companionInCensus && (
        <div className="text-caption-1 text-text-secondary mt-1">
          Census device ID: {formatCensusIvlsDevices(censusEntry)}
        </div>
      )}
      <div className="text-caption-1 text-text-secondary mt-1">
        Current appointment state: {appointmentStateLabel}
      </div>
      {s.needsSelectedDeviceCensusAdd && (
        <div className="mt-3">
          <Primary
            href="#"
            text={s.updatingCensus ? 'Adding to census...' : 'Add to census'}
            onClick={s.handleAddToCensus}
            isDisabled={s.updatingCensus || !s.companionId || !s.selectedIvls}
          />
        </div>
      )}
    </div>
  );
};

const ReferenceLabForm = ({ s }: { s: UseLabTestsReturn }) => (
  <>
    {/* text-body-4, matching the In-house note in the sibling form below and the
        same paragraph on the workspace step. These two notes are a pair and were
        rendering at different type scales. */}
    <div className="text-body-4 text-text-secondary">
      Reference lab tests are submitted to IDEXX for processing. Add the tests you need and place
      the order; results attach to this appointment when IDEXX returns them.
    </div>
    <SearchDropdown
      placeholder="Search IDEXX tests"
      {...getIdexxTestSearchProps(s)}
      onSelect={s.addTest}
      renderOption={(option) => {
        const test = option.meta as IdexxTest | undefined;
        if (!test) return option.label;
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-start justify-between gap-2">
              <div className="text-body-4 text-text-primary pr-2">{test.display}</div>
              <StatusPill tone="info" label={formatTestPrice(test)} />
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-caption-1 text-text-secondary">
              <span>Code: {test.code}</span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-caption-1 text-text-secondary">
              <span>Turnaround time: {getTestTurnaround(test)}</span>
              <span>Specimen: {getTestSpecimen(test)}</span>
            </div>
          </div>
        );
      }}
    />

    <div className="flex flex-wrap gap-2">
      {s.selectedTests.length === 0 ? (
        <div className="text-body-4 text-text-secondary">No tests selected yet.</div>
      ) : (
        s.selectedTests.map((test) => (
          <button
            key={test.code}
            type="button"
            onClick={() => s.removeTest(test.code)}
            className="rounded-xl! border border-card-border bg-neutral-0 px-3 py-2 text-left min-w-55 max-w-70 transition-colors hover:bg-neutral-0"
            title="Remove test from selection"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-body-4 text-text-primary truncate">{test.display}</div>
              <StatusPill tone="info" label={formatTestPrice(test)} />
            </div>
            <div className="mt-0.5 text-caption-1 text-text-secondary truncate">
              {test.code} • Turnaround time: {getTestTurnaround(test)}
            </div>
          </button>
        ))
      )}
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <LabelDropdown
        placeholder="Veterinarian"
        options={s.practitionerOptions}
        defaultOption={s.veterinarian}
        onSelect={(option) => s.setVeterinarian(option.value)}
      />
      <LabelDropdown
        placeholder="Technician"
        options={s.practitionerOptions}
        defaultOption={s.technician}
        onSelect={(option) => s.setTechnician(option.value)}
      />
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <FormInput
        intype="date"
        inname="lab-specimen-date"
        inlabel="Specimen collection date"
        value={s.specimenCollectionDate}
        onChange={(e) => s.setSpecimenCollectionDate(e.target.value)}
      />
      <FormInput
        intype="text"
        inname="lab-notes"
        inlabel="Notes"
        value={s.notes}
        onChange={(e) => s.setNotes(e.target.value)}
      />
    </div>

    <Primary
      href="#"
      text={s.creatingOrder ? 'Creating lab order…' : 'Create lab order'}
      onClick={s.handleCreateOrder}
      isDisabled={s.creatingOrder || s.loading || s.selectedTests.length === 0 || !s.companionId}
    />
  </>
);

const InhouseLabForm = ({ s }: { s: UseLabTestsReturn }) => (
  <>
    <div className="text-body-4 text-text-secondary">
      In-house tests run on your IVLS device. Select the device and add the companion to census
      here, then complete the order on the IDEXX machine.
    </div>
    <LabelDropdown
      placeholder="Select IVLS device"
      options={s.devices.map((device) => ({
        label: `${device.displayName || 'IVLS'} (${device.deviceSerialNumber})`,
        value: device.deviceSerialNumber,
      }))}
      defaultOption={s.selectedIvls}
      onSelect={(option) => s.setSelectedIvls(option.value)}
    />
    <InhouseCensusStatus s={s} />
    <Secondary href="#" text="Refresh census" onClick={() => void s.refreshCensus()} />
  </>
);

const LabOrderForm = ({ s }: { s: UseLabTestsReturn }) => (
  <Accordion title="Create lab order" defaultOpen showEditIcon={false} isEditing>
    <div className="flex flex-col gap-3 py-2">
      <LabelDropdown
        placeholder="Modality"
        options={s.modalityOptions}
        defaultOption={s.modality}
        onSelect={(option) => s.setModality(option.value as 'REFERENCE_LAB' | 'INHOUSE')}
      />
      {s.modality === 'REFERENCE_LAB' ? <ReferenceLabForm s={s} /> : <InhouseLabForm s={s} />}
    </div>
  </Accordion>
);

const LabOrderStatus = ({ s }: { s: UseLabTestsReturn }) => (
  <Accordion title="Order status and requisition" defaultOpen showEditIcon={false} isEditing>
    <div className="flex flex-col gap-3 py-2">
      <div className="flex items-center justify-end">
        <Secondary
          href="#"
          text={s.ordersLoading ? 'Refreshing orders...' : 'Refresh appointment orders'}
          onClick={() => void s.refreshAppointmentOrders()}
          isDisabled={s.ordersLoading}
        />
      </div>
      {s.latestOrder ? (
        <>
          <div className="rounded-2xl border border-card-border p-3 bg-neutral-0 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-1">
                <div className="text-body-3 text-text-primary">
                  Order {s.latestOrder.idexxOrderId}
                </div>
                <div className="text-caption-1 text-text-secondary">
                  Updated: {formatDateTimeLocal(s.latestOrder.updatedAt, '-')}
                </div>
              </div>
              <StatusPill
                className="w-fit"
                tone={getOrderStatusTone(s.latestOrder, s.resultProgressByOrderId)}
                label={s.getOrderDisplayStatus(s.latestOrder)}
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Primary
                href="#"
                text={
                  s.getOrderDisplayStatus(s.latestOrder) === 'Complete'
                    ? 'Result PDF'
                    : getOrderActionLabel(s.latestOrder)
                }
                onClick={() => {
                  if (!s.latestOrder) return;
                  if (s.getOrderDisplayStatus(s.latestOrder) === 'Complete') {
                    void s.openResultPdfForOrder(s.latestOrder);
                    return;
                  }
                  s.openOrderIframe(
                    getOrderActionSource(s.latestOrder),
                    s.latestOrder.status,
                    s.latestOrder
                  );
                }}
                isDisabled={
                  s.getOrderDisplayStatus(s.latestOrder) === 'Complete'
                    ? false
                    : !resolveOrderUiUrl(s.latestOrder)
                }
              />
              <Secondary
                href="#"
                text="Acknowledgment PDF"
                onClick={() => s.openOrderAcknowledgement(s.latestOrder!)}
                isDisabled={!resolveOrderPdfUrl(s.latestOrder)}
              />
            </div>
          </div>
          {s.appointmentOrders.length > 1 ? (
            <div className="rounded-2xl border border-card-border p-3 flex flex-col gap-2">
              <div className="text-body-4 text-text-primary">Past orders in this appointment</div>
              {s.appointmentOrders.flatMap((order) =>
                order._id === s.latestOrder!._id
                  ? []
                  : [
                      <PastOrderCard
                        key={order._id}
                        order={order}
                        resultProgressByOrderId={s.resultProgressByOrderId}
                        getOrderDisplayStatus={s.getOrderDisplayStatus}
                        openOrderIframe={s.openOrderIframe}
                        openResultPdfForOrder={s.openResultPdfForOrder}
                        openOrderAcknowledgement={s.openOrderAcknowledgement}
                        setActiveOrderForActions={s.setActiveOrderForActions}
                      />,
                    ]
              )}
            </div>
          ) : null}
        </>
      ) : (
        <div className="text-body-4 text-text-secondary">
          {s.ordersLoading
            ? 'Loading appointment lab orders...'
            : 'No lab orders found for this appointment yet.'}
        </div>
      )}
    </div>
  </Accordion>
);

const LabResultsList = ({ s }: { s: UseLabTestsReturn }) => (
  <Accordion title="Results" defaultOpen showEditIcon={false} isEditing>
    <div className="flex flex-col gap-3 py-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-caption-1 text-text-secondary">
          Results are filtered for this companion and all orders mapped to this appointment.
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Primary
            href="#"
            text={s.refreshingResults ? 'Refreshing...' : 'Refresh'}
            onClick={() => void s.refreshResults()}
            isDisabled={s.refreshingResults}
          />
          <Link
            href="/appointments/idexx-workspace"
            aria-label="Open IDEXX Hub"
            className="size-8 rounded-full border border-card-border bg-neutral-0 text-text-secondary hover:text-blue-text hover:border-text-brand transition-colors inline-flex items-center justify-center"
          >
            <IoOpenOutline size={16} />
          </Link>
        </div>
      </div>

      {s.results.length === 0 ? (
        <div className="text-body-4 text-text-secondary">No results available yet.</div>
      ) : (
        s.results.map((result, index) => (
          <div
            key={result.resultId}
            className="rounded-2xl border border-card-border p-3 flex flex-col gap-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-body-3 text-text-primary">Result {index + 1}</div>
                <div className="text-caption-1 text-text-secondary">
                  ID: {result.resultId} | Status: {toTitleCase(result.status)} | Order:{' '}
                  {result.orderId ?? '-'}
                </div>
              </div>
              <Primary
                href="#"
                text={s.pdfPreviewLoadingId === result.resultId ? '...' : 'PDF'}
                onClick={() => void s.openResultPdfPreview(result.resultId)}
                isDisabled={s.pdfPreviewLoadingId === result.resultId}
              />
            </div>

            {(result.rawPayload?.categories ?? []).map((category) => (
              <LabResultCategoryTable
                key={`${result.resultId}-${category.name}`}
                category={category}
                resultId={result.resultId}
              />
            ))}
          </div>
        ))
      )}
      <div className="text-caption-2 text-text-extra">{IDEXX_REGIONAL_AVAILABILITY_DISCLAIMER}</div>
    </div>
  </Accordion>
);

// ---------- Main component ----------

type IdexxOrderIframeOverlayProps = {
  url: string;
  title: string;
  onClose: () => void;
};

const IdexxOrderIframeOverlay = ({ url, title, onClose }: IdexxOrderIframeOverlayProps) => {
  const [loaded, setLoaded] = useState(false);
  const isFollowUp = title.toLowerCase().includes('follow-up');
  return (
    <div
      // --sh55, matching the two other copies of this overlay (DiagnosticsStep:753
      // and IdexxWorkspace:731). bg-black/60 is a hardcoded scrim: the token is
      // a warm rgba(29,28,27,.55) in light and a heavier rgba(0,0,0,.8) in dark,
      // so this copy was both the wrong hue in light and too weak in dark.
      className="fixed inset-0 z-[5000] flex items-center justify-center bg-[var(--sh55)] p-4 backdrop-blur-sm"
      data-signing-overlay="true"
      style={{ pointerEvents: 'auto' }}
    >
      <div className="relative bg-neutral-0 rounded-2xl shadow-2xl size-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-card-border">
          <div className="flex flex-col">
            <div className="text-body-2 text-text-primary">{title}</div>
            {isFollowUp ? (
              <div className="text-caption-1 text-text-secondary">
                If IDEXX shows the order was submitted and this window stays open, close it with the
                top-right cross arrow to refresh this appointment.
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-card-hover rounded-full transition-colors cursor-pointer"
            aria-label="Close IDEXX order frame"
            style={{ pointerEvents: 'auto' }}
          >
            <Close iconOnly />
          </button>
        </div>
        <div className="relative flex-1">
          {loaded ? null : (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-0">
              <YosemiteLoader label="Loading IDEXX" size={120} testId="idexx-order-loader" />
            </div>
          )}
          <iframe
            key={url}
            src={url}
            title="IDEXX order UI"
            className="size-full border-0"
            loading="lazy"
            sandbox="allow-scripts allow-popups allow-forms allow-same-origin"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            style={{ pointerEvents: 'auto' }}
            onLoad={() => setLoaded(true)}
          />
        </div>
      </div>
    </div>
  );
};

type LabTestsProps = {
  activeAppointment: Appointment | null;
};

const LabTests = ({ activeAppointment }: LabTestsProps) => {
  const s = useLabTests(activeAppointment);

  if (s.loading) {
    return <div className="text-body-4 text-text-secondary">Loading IDEXX integration…</div>;
  }

  if (!s.integrationEnabled) {
    return (
      <div className="flex flex-col gap-3 w-full">
        <div className="text-body-3 text-text-primary">
          IDEXX integration is not enabled for this organization.
        </div>
        <Link
          href="/integrations"
          className="text-body-4 text-blue-text underline underline-offset-2"
        >
          Enable IDEXX in Integrations
        </Link>
      </div>
    );
  }

  const iframeTitle =
    s.iframeOpenSource === 'followup' ? 'IDEXX follow-up ordering' : 'IDEXX ordering';
  const orderIframeUrl = s.iframeOrderUiUrl || resolveOrderUiUrl(s.latestOrder);

  return (
    <>
      {s.showOrderIframe && orderIframeUrl && typeof document !== 'undefined'
        ? createPortal(
            <IdexxOrderIframeOverlay
              url={orderIframeUrl}
              title={iframeTitle}
              onClose={s.closeOrderIframeManually}
            />,
            document.body
          )
        : null}
      <PdfPreviewOverlay
        open={s.showPdfPreview}
        pdfUrl={s.pdfPreviewUrl}
        title={s.pdfPreviewTitle}
        closeLabel="Close IDEXX PDF preview"
        onClose={s.closePdfPreview}
      />

      <div className="flex flex-col gap-4 w-full">
        {s.error ? <div className="text-body-4 text-text-error">{s.error}</div> : null}
        <LabOrderForm s={s} />
        <LabOrderStatus s={s} />
        <LabResultsList s={s} />
      </div>
    </>
  );
};

export default LabTests;
