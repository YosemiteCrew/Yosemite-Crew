import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import SearchDropdown from '@/app/ui/inputs/SearchDropdown';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import Close from '@/app/ui/primitives/Icons/Close';
import PdfPreviewOverlay from '@/app/ui/overlays/PdfPreviewOverlay';
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
  listIdexxOrders,
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

const TESTS_PAGE_SIZE = 25;

type LabTestsProps = {
  activeAppointment: Appointment | null;
};

const LabTests = ({ activeAppointment }: LabTestsProps) => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const idexxIntegration = useIntegrationByProviderForPrimaryOrg('IDEXX');
  const [integrationEnabled, setIntegrationEnabled] = useState(false);
  const [devices, setDevices] = useState<IvlsDevice[]>([]);
  const [tests, setTests] = useState<IdexxTest[]>([]);
  const [testsPage, setTestsPage] = useState(1);
  const [testsHasMore, setTestsHasMore] = useState(false);
  const [testsLoadingMore, setTestsLoadingMore] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedTestLabel, setSelectedTestLabel] = useState('');
  const [selectedTests, setSelectedTests] = useState<IdexxTest[]>([]);
  const [appointmentOrders, setAppointmentOrders] = useState<LabOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [modality, setModality] = useState<'REFERENCE_LAB' | 'INHOUSE'>('REFERENCE_LAB');
  const [selectedIvls, setSelectedIvls] = useState('');
  const [veterinarian, setVeterinarian] = useState('');
  const [technician, setTechnician] = useState('');
  const [notes, setNotes] = useState('');
  const [specimenCollectionDate, setSpecimenCollectionDate] = useState('');
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
  const [iframeInitialResultProgress, setIframeInitialResultProgress] = useState<string | null>(
    null
  );
  const [iframeInitialUpdatedAt, setIframeInitialUpdatedAt] = useState<string | null>(null);
  const [iframeOpenSource, setIframeOpenSource] = useState<'order' | 'followup'>('order');
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewTitle, setPdfPreviewTitle] = useState('IDEXX PDF');
  const [pdfPreviewLoadingId, setPdfPreviewLoadingId] = useState<string | null>(null);

  const companionId = activeAppointment?.companion?.id;
  const parentId = activeAppointment?.companion?.parent?.id;
  const resolveOrderUiUrl = (order: LabOrder | null) => {
    if (!order) return '';
    const nested = String(
      (order as unknown as { responsePayload?: { uiURL?: string } })?.responsePayload?.uiURL ?? ''
    ).trim();
    return String(order.uiUrl ?? '').trim() || nested;
  };
  const resolveOrderPdfUrl = (order: LabOrder | null) => {
    if (!order) return '';
    const nested = String(
      (order as unknown as { responsePayload?: { pdfURL?: string } })?.responsePayload?.pdfURL ?? ''
    ).trim();
    return String(order.pdfUrl ?? '').trim() || nested;
  };
  const getNormalizedLifecycleStatus = (order: LabOrder | null) =>
    String(order?.externalStatus ?? order?.status ?? '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_');
  const orderSortDate = (order: LabOrder) => order.updatedAt ?? order.createdAt ?? '';
  const normalizedOrderStatus = getNormalizedLifecycleStatus(latestOrder);
  const needsInitialOrderPlacement = normalizedOrderStatus === 'CREATED';
  const formatOrderStatus = (order: LabOrder) => {
    const status = String(order.status ?? '').trim();
    const external = String(order.externalStatus ?? '').trim();
    if (external && external.toLowerCase() !== status.toLowerCase()) {
      return `${toTitleCase(status || '-')} (${toTitleCase(external)})`;
    }
    return toTitleCase(status || '-');
  };
  const toTitleCase = (value?: string | null) => {
    const raw = String(value ?? '').trim();
    if (!raw) return '-';
    const normalized = raw.toLowerCase().replace(/[_-]+/g, ' ');
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  };
  const normalizeResultProgress = (status?: string | null) => {
    const key = String(status ?? '')
      .trim()
      .toUpperCase();
    if (!key) return '';
    if (key.includes('PARTIAL') || key.includes('INPROCESS') || key.includes('IN_PROCESS'))
      return 'In process';
    if (key.includes('PENDING') || key.includes('RUNNING')) return 'In process';
    if (key.includes('COMPLETE') || key.includes('FINAL')) return 'Complete';
    if (key.includes('ERROR') || key.includes('FAIL')) return 'Error';
    return '';
  };
  const getResultOrderId = (result: LabResult) => {
    const raw = result.rawPayload as
      | { orderId?: string | number; requisitionId?: string | number }
      | undefined;
    return String(
      result.orderId ?? result.requisitionId ?? raw?.orderId ?? raw?.requisitionId ?? ''
    ).trim();
  };
  const getOrderResultProgressFromResults = useCallback(
    (allResults: LabResult[], orderId: string) => {
      const statuses = allResults
        .filter((result) => getResultOrderId(result) === String(orderId).trim())
        .map((result) => {
          const raw = result.rawPayload as { status?: string; statusDetail?: string } | undefined;
          return normalizeResultProgress(
            result.statusDetail ?? result.status ?? raw?.statusDetail ?? raw?.status
          );
        })
        .filter(Boolean);
      if (statuses.includes('In process')) return 'In process';
      if (statuses.includes('Error')) return 'Error';
      if (statuses.includes('Complete')) return 'Complete';
      return '';
    },
    []
  );
  const resultProgressByOrderId = useMemo(() => {
    const map = new Map<string, string>();
    appointmentOrders.forEach((order) => {
      const orderId = String(order.idexxOrderId ?? '').trim();
      if (!orderId) return;
      const progress = getOrderResultProgressFromResults(results, orderId);
      if (progress) {
        map.set(orderId, progress);
      }
    });
    return map;
  }, [appointmentOrders, results, getOrderResultProgressFromResults]);
  const canOpenFollowUpInCurrentOrder = Boolean(
    latestOrder &&
    resolveOrderUiUrl(latestOrder) &&
    !['INHOUSE', 'IN_HOUSE'].includes(String(latestOrder.modality ?? '').toUpperCase()) &&
    normalizedOrderStatus !== 'CREATED'
  );
  const getOrderDisplayStatus = (order: LabOrder) =>
    resultProgressByOrderId.get(String(order.idexxOrderId ?? '').trim()) ||
    formatOrderStatus(order);
  const getOrderStatusBadgeClass = (order: LabOrder) => {
    const resultProgress = resultProgressByOrderId.get(String(order.idexxOrderId ?? '').trim());
    if (resultProgress === 'Complete') return 'bg-green-50 text-green-800';
    if (resultProgress === 'In process') return 'bg-amber-50 text-amber-700';
    if (resultProgress === 'Error') return 'bg-red-50 text-red-700';
    const key = String(order.status ?? '').toLowerCase();
    if (key.includes('submitted') || key.includes('complete') || key.includes('final'))
      return 'bg-green-50 text-green-800';
    if (key.includes('created') || key.includes('pending')) return 'bg-amber-50 text-amber-700';
    if (key.includes('error') || key.includes('failed') || key.includes('cancel'))
      return 'bg-red-50 text-red-700';
    return 'bg-card-hover text-text-secondary';
  };

  const normalizeOrders = useCallback((orders: LabOrder[]) => {
    return [...orders].sort((a, b) => {
      const aDate = new Date(orderSortDate(a)).getTime();
      const bDate = new Date(orderSortDate(b)).getTime();
      return bDate - aDate;
    });
  }, []);

  const upsertAppointmentOrder = useCallback(
    (order: LabOrder) => {
      setAppointmentOrders((prev) => {
        const next = [order, ...prev.filter((item) => item._id !== order._id)];
        return normalizeOrders(next);
      });
    },
    [normalizeOrders]
  );

  useEffect(() => {
    setSpecimenCollectionDate(new Date().toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    const leadName = activeAppointment?.lead?.name ?? '';
    const firstSupportName = activeAppointment?.supportStaff?.[0]?.name ?? '';
    setVeterinarian(leadName);
    setTechnician(firstSupportName || leadName);
  }, [activeAppointment?.id, activeAppointment?.lead?.name, activeAppointment?.supportStaff]);

  useEffect(() => {
    setIntegrationEnabled(idexxIntegration?.status === 'enabled');
  }, [idexxIntegration?.status]);

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

  const mergeUniqueTests = useCallback((current: IdexxTest[], incoming: IdexxTest[]) => {
    const seen = new Set(current.map((item) => item.code || item._id));
    const next = [...current];
    incoming.forEach((item) => {
      const key = item.code || item._id;
      if (!seen.has(key)) {
        seen.add(key);
        next.push(item);
      }
    });
    return next;
  }, []);

  const fetchTestsPage = useCallback(
    async (page: number, append: boolean) => {
      if (!primaryOrgId || !integrationEnabled) return;
      if (append) {
        setTestsLoadingMore(true);
      }
      try {
        const res = await listIdexxTests({
          organisationId: primaryOrgId,
          query,
          page,
          limit: TESTS_PAGE_SIZE,
        });
        const nextBatch = res.tests ?? [];
        setTests((prev) => (append ? mergeUniqueTests(prev, nextBatch) : nextBatch));
        setTestsPage(page);
        setTestsHasMore(nextBatch.length >= TESTS_PAGE_SIZE);
      } catch (e) {
        if (!append) {
          setTests([]);
        }
        setError(getApiErrorMessage(e, 'Unable to load IDEXX tests.'));
      } finally {
        if (append) {
          setTestsLoadingMore(false);
        }
      }
    },
    [integrationEnabled, mergeUniqueTests, primaryOrgId, query]
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

  const refreshAppointmentOrders = useCallback(async () => {
    if (!primaryOrgId || !integrationEnabled || !activeAppointment?.id) {
      setAppointmentOrders([]);
      setLatestOrder(null);
      return;
    }
    setOrdersLoading(true);
    setError(null);
    try {
      const orders = await listIdexxOrders({
        organisationId: primaryOrgId,
        appointmentId: activeAppointment.id,
      });
      const normalized = normalizeOrders(orders);
      setAppointmentOrders(normalized);
      setLatestOrder((prev) => {
        if (!normalized.length) return null;
        if (!prev) return normalized[0];
        return normalized.find((order) => order._id === prev._id) ?? normalized[0];
      });
    } catch (e) {
      setAppointmentOrders([]);
      setLatestOrder(null);
      setError(getApiErrorMessage(e, 'Unable to load appointment lab orders.'));
    } finally {
      setOrdersLoading(false);
    }
  }, [activeAppointment?.id, integrationEnabled, normalizeOrders, primaryOrgId]);

  const refreshCensus = async () => {
    if (!primaryOrgId || !integrationEnabled) return;
    try {
      const entries = await getIdexxCensus(primaryOrgId);
      setCensusEntries(entries);
    } catch (e) {
      setCensusEntries([]);
      setError(getApiErrorMessage(e, 'Unable to load IDEXX census.'));
    }
  };

  const refreshResults = async () => {
    if (!primaryOrgId || !integrationEnabled) return;
    setRefreshingResults(true);
    try {
      const appointmentOrderIds = new Set(
        appointmentOrders.map((order) => String(order.idexxOrderId ?? '').trim()).filter(Boolean)
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
  };

  useEffect(() => {
    void refreshResults();
  }, [primaryOrgId, integrationEnabled, companionId, appointmentOrders]);

  useEffect(() => {
    void refreshCensus();
  }, [primaryOrgId, integrationEnabled, companionId]);

  useEffect(() => {
    void refreshAppointmentOrders();
  }, [refreshAppointmentOrders]);

  useEffect(() => {
    if (!showOrderIframe) return;
    if (!primaryOrgId || !latestOrder?.idexxOrderId) return;

    const interval = setInterval(async () => {
      try {
        const next = await getIdexxOrderById({
          organisationId: primaryOrgId,
          idexxOrderId: latestOrder.idexxOrderId,
        });
        setLatestOrder(next);
        upsertAppointmentOrder(next);

        const appointmentOrderIds = new Set(
          appointmentOrders.map((order) => String(order.idexxOrderId ?? '').trim()).filter(Boolean)
        );
        if (appointmentOrderIds.size > 0) {
          const allResults = await listIdexxResults(primaryOrgId);
          const filtered = allResults.filter((result) => {
            const companionMatch = companionId ? result.patientId === companionId : true;
            const resultOrderId = getResultOrderId(result);
            return companionMatch && appointmentOrderIds.has(resultOrderId);
          });
          setResults(filtered);

          const nextProgress = getOrderResultProgressFromResults(filtered, next.idexxOrderId);
          if ((iframeInitialResultProgress ?? '') !== (nextProgress ?? '') && nextProgress) {
            setShowOrderIframe(false);
          }
        }

        const nextStatus = String(next.status ?? '').toUpperCase();
        if (iframeInitialStatus && nextStatus && nextStatus !== iframeInitialStatus) {
          setShowOrderIframe(false);
        }
        if (iframeInitialUpdatedAt && next.updatedAt && next.updatedAt !== iframeInitialUpdatedAt) {
          setShowOrderIframe(false);
        }
      } catch (e) {
        setError(getApiErrorMessage(e, 'Unable to poll order status while IDEXX frame is open.'));
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [
    showOrderIframe,
    primaryOrgId,
    latestOrder?.idexxOrderId,
    iframeInitialStatus,
    iframeInitialResultProgress,
    iframeInitialUpdatedAt,
    upsertAppointmentOrder,
    appointmentOrders,
    companionId,
    getOrderResultProgressFromResults,
  ]);

  const openOrderIframe = (
    source: 'order' | 'followup',
    statusOverride?: string | null,
    targetOrder?: LabOrder
  ) => {
    const orderForFrame = targetOrder ?? latestOrder;
    setIframeOpenSource(source);
    setIframeInitialStatus((statusOverride ?? orderForFrame?.status ?? '').toUpperCase() || null);
    setIframeInitialResultProgress(
      resultProgressByOrderId.get(String(orderForFrame?.idexxOrderId ?? '').trim()) ?? null
    );
    setIframeInitialUpdatedAt(orderForFrame?.updatedAt ?? null);
    setShowOrderIframe(true);
  };

  const closeOrderIframeManually = () => {
    setShowOrderIframe(false);
  };

  const closePdfPreview = () => {
    setShowPdfPreview(false);
    if (pdfPreviewUrl && pdfPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(pdfPreviewUrl);
    }
    setPdfPreviewUrl(null);
    setPdfPreviewTitle('IDEXX PDF');
  };

  const openResultPdfPreview = async (resultId: string) => {
    if (!primaryOrgId || !resultId || pdfPreviewLoadingId === resultId) return;
    setPdfPreviewLoadingId(resultId);
    setError(null);
    try {
      const pdfBlob = await getIdexxResultPdfBlob({ organisationId: primaryOrgId, resultId });
      const objectUrl = URL.createObjectURL(pdfBlob);
      if (pdfPreviewUrl && pdfPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(pdfPreviewUrl);
      }
      setPdfPreviewUrl(objectUrl);
      setPdfPreviewTitle(`IDEXX Result PDF #${resultId}`);
      setShowPdfPreview(true);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Unable to load IDEXX PDF preview.'));
    } finally {
      setPdfPreviewLoadingId(null);
    }
  };

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl && pdfPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(pdfPreviewUrl);
      }
    };
  }, [pdfPreviewUrl]);

  const openOrderAcknowledgement = (order: LabOrder) => {
    const pdfUrl = resolveOrderPdfUrl(order);
    if (!pdfUrl) {
      setError('Acknowledgment PDF is not available for this order.');
      return;
    }
    setError(null);
    setPdfPreviewTitle(`IDEXX Order Acknowledgment #${order.idexxOrderId}`);
    setPdfPreviewUrl(pdfUrl);
    setShowPdfPreview(true);
  };

  const setActiveOrderForActions = (order: LabOrder) => {
    setLatestOrder(order);
  };

  const addTest = (value: string) => {
    const match = tests.find((test) => test.code === value || test._id === value);
    if (!match) return;
    setSelectedTestLabel('');
    setQuery('');
    setSelectedTests((prev) => {
      if (prev.some((test) => test.code === match.code)) return prev;
      return [...prev, match];
    });
  };

  const removeTest = (code: string) => {
    setSelectedTests((prev) => prev.filter((test) => test.code !== code));
  };

  const handleCreateOrder = async () => {
    if (!primaryOrgId || !companionId || selectedTests.length === 0) return;
    setCreatingOrder(true);
    setError(null);
    try {
      const payload = {
        companionId,
        appointmentId: activeAppointment?.id,
        tests: selectedTests.map((test) => test.code),
        modality,
        veterinarian: veterinarian || undefined,
        technician: technician || undefined,
        notes: notes || undefined,
        specimenCollectionDate: specimenCollectionDate || undefined,
        ivls: modality === 'INHOUSE' && selectedIvls ? [selectedIvls] : undefined,
      };
      const created = await createIdexxLabOrder({ organisationId: primaryOrgId, payload });
      setLatestOrder(created);
      upsertAppointmentOrder(created);
      setSelectedTests([]);
      setSelectedTestLabel('');
      setQuery('');
      openOrderIframe('order', created.status);
      await refreshAppointmentOrders();
      await refreshResults();
    } catch (e) {
      setError(getApiErrorMessage(e, 'Unable to create IDEXX lab order.'));
    } finally {
      setCreatingOrder(false);
    }
  };

  const handleAddToCensus = async () => {
    if (!primaryOrgId || !companionId) return;
    setUpdatingCensus(true);
    setError(null);
    try {
      await addPatientToIdexxCensus({
        organisationId: primaryOrgId,
        payload: {
          companionId,
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
  };

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
  const inHouseCensusConfirmed = useMemo(() => {
    if (!companionCensusEntry) return false;
    const confirmedBy = companionCensusEntry.confirmedBy ?? [];
    if (selectedIvls) {
      return confirmedBy.includes(selectedIvls);
    }
    return Boolean(companionCensusEntry.confirmed || confirmedBy.length > 0);
  }, [companionCensusEntry, selectedIvls]);

  const formatTestPrice = (test: IdexxTest) => {
    const amount = String(test.meta?.listPrice ?? '').trim();
    if (!amount) return 'Rate unavailable';
    const currency = String(test.meta?.currencyCode ?? '').trim();
    if (!currency) return amount;
    if (currency.toUpperCase() === 'USD') return `$${amount}`;
    return `${currency} ${amount}`;
  };

  const getTestTurnaround = (test: IdexxTest) =>
    String(test.meta?.turnaround ?? '').trim() || 'TAT not listed';
  const getTestSpecimen = (test: IdexxTest) =>
    String(test.meta?.specimen ?? '').trim() || 'Specimen not listed';
  const parseFloatSafe = (value?: string): number | null => {
    if (!value) return null;
    const cleaned = String(value)
      .replace(/,/g, '.')
      .replace(/[^0-9.+-]/g, '');
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const parseReferenceRange = (range?: string): { min: number; max: number } | null => {
    if (!range) return null;
    const matches = range.match(/-?\d+(?:\.\d+)?/g);
    if (!matches || matches.length < 2) return null;
    const min = Number.parseFloat(matches[0]);
    const max = Number.parseFloat(matches[1]);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return null;
    return { min, max };
  };

  const getMeterMeta = (test: LabResultTest) => {
    const range = parseReferenceRange(test.referenceRange);
    const value = parseFloatSafe(test.result);
    if (!range || value == null) {
      return { canRender: false, percent: 0, markerClass: 'bg-text-secondary' };
    }
    const percent = Math.min(
      100,
      Math.max(0, ((value - range.min) / (range.max - range.min)) * 100)
    );
    const markerClass =
      test.outOfRange || percent < 0 || percent > 100 ? 'bg-red-500' : 'bg-text-primary';
    return { canRender: true, percent, markerClass };
  };

  if (loading) {
    return <div className="text-body-4 text-text-secondary">Loading IDEXX integration...</div>;
  }

  if (!integrationEnabled) {
    return (
      <div className="flex flex-col gap-3 w-full">
        <div className="text-body-3 text-text-primary">
          IDEXX integration is not enabled for this organization.
        </div>
        <Link
          href="/integrations"
          className="text-body-4 text-text-brand underline underline-offset-2"
        >
          Enable IDEXX in Integrations
        </Link>
      </div>
    );
  }

  return (
    <>
      {showOrderIframe && resolveOrderUiUrl(latestOrder) && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[5000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
              data-signing-overlay="true"
              style={{ pointerEvents: 'auto' }}
            >
              <div className="relative bg-white rounded-2xl shadow-2xl w-full h-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-black/10">
                  <div className="text-body-2 text-text-primary">
                    {iframeOpenSource === 'followup'
                      ? 'IDEXX follow-up ordering'
                      : 'IDEXX ordering'}
                  </div>
                  <button
                    type="button"
                    onClick={closeOrderIframeManually}
                    className="p-2 hover:bg-black/5 rounded-full transition-colors cursor-pointer"
                    aria-label="Close IDEXX order frame"
                    style={{ pointerEvents: 'auto' }}
                  >
                    <Close iconOnly />
                  </button>
                </div>
                <iframe
                  src={resolveOrderUiUrl(latestOrder)}
                  title="IDEXX order UI"
                  className="flex-1 w-full border-0"
                  loading="lazy"
                  allowFullScreen
                  style={{ pointerEvents: 'auto' }}
                />
              </div>
            </div>,
            document.body
          )
        : null}
      <PdfPreviewOverlay
        open={showPdfPreview}
        pdfUrl={pdfPreviewUrl}
        title={pdfPreviewTitle}
        closeLabel="Close IDEXX PDF preview"
        onClose={closePdfPreview}
      />

      <div className="flex flex-col gap-4 w-full">
        {error ? <div className="text-body-4 text-text-error">{error}</div> : null}

        <Accordion title="Create lab order" defaultOpen showEditIcon={false} isEditing>
          <div className="flex flex-col gap-3 py-2">
            <SearchDropdown
              placeholder="Search IDEXX tests"
              options={tests.map((test) => ({
                value: test.code,
                label: `${test.display} (${test.code})`,
                meta: test,
              }))}
              onSelect={addTest}
              query={selectedTestLabel || query}
              setQuery={(value: string) => {
                setSelectedTestLabel(value);
                setQuery(value);
              }}
              minChars={0}
              onReachEnd={loadMoreTests}
              hasMore={testsHasMore}
              isLoadingMore={testsLoadingMore}
              optionClassName="w-full text-start rounded-2xl! border border-card-border bg-white px-3 py-2 mb-2 last:mb-0 hover:bg-white transition-colors"
              renderOption={(option) => {
                const test = option.meta as IdexxTest | undefined;
                if (!test) return option.label;
                return (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-body-4 text-text-primary pr-2">{test.display}</div>
                      <div className="text-label-xsmall px-2 py-1 rounded bg-blue-50 text-blue-700 whitespace-nowrap">
                        {formatTestPrice(test)}
                      </div>
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
              {selectedTests.length === 0 ? (
                <div className="text-body-4 text-text-secondary">No tests selected yet.</div>
              ) : (
                selectedTests.map((test) => (
                  <button
                    key={test.code}
                    type="button"
                    onClick={() => removeTest(test.code)}
                    className="rounded-xl! border border-card-border bg-white px-3 py-2 text-left min-w-[220px] max-w-[280px] transition-colors hover:bg-white"
                    title="Remove test from selection"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-body-4 text-text-primary truncate">{test.display}</div>
                      <div className="text-label-xsmall px-2 py-1 rounded bg-blue-50 text-blue-700 whitespace-nowrap">
                        {formatTestPrice(test)}
                      </div>
                    </div>
                    <div className="mt-0.5 text-caption-1 text-text-secondary truncate">
                      {test.code} • Turnaround time: {getTestTurnaround(test)}
                    </div>
                  </button>
                ))
              )}
            </div>

            <LabelDropdown
              placeholder="Modality"
              options={modalityOptions}
              defaultOption={modality}
              onSelect={(option) => setModality(option.value as 'REFERENCE_LAB' | 'INHOUSE')}
            />
            <div className="text-caption-1 text-text-secondary">
              IDEXX test reference data does not explicitly flag tests as in-house vs
              device-specific in this contract. Ordering modality and IVLS selection determine
              in-house/device workflow.
            </div>

            {modality === 'INHOUSE' ? (
              <LabelDropdown
                placeholder="Select IVLS device"
                options={devices.map((device) => ({
                  label: `${device.displayName || 'IVLS'} (${device.deviceSerialNumber})`,
                  value: device.deviceSerialNumber,
                }))}
                defaultOption={selectedIvls}
                onSelect={(option) => setSelectedIvls(option.value)}
                error={!selectedIvls ? 'IVLS device is required for in-house orders.' : undefined}
              />
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <LabelDropdown
                placeholder="Veterinarian"
                options={practitionerOptions}
                defaultOption={veterinarian}
                onSelect={(option) => setVeterinarian(option.value)}
              />
              <LabelDropdown
                placeholder="Technician"
                options={practitionerOptions}
                defaultOption={technician}
                onSelect={(option) => setTechnician(option.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormInput
                intype="date"
                inname="lab-specimen-date"
                inlabel="Specimen collection date"
                value={specimenCollectionDate}
                onChange={(e) => setSpecimenCollectionDate(e.target.value)}
              />
              <FormInput
                intype="text"
                inname="lab-notes"
                inlabel="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <Primary
              href="#"
              text={creatingOrder ? 'Creating order...' : 'Create IDEXX order'}
              onClick={handleCreateOrder}
              isDisabled={
                creatingOrder ||
                loading ||
                selectedTests.length === 0 ||
                !companionId ||
                (modality === 'INHOUSE' && !companionInCensus) ||
                (modality === 'INHOUSE' && !inHouseCensusConfirmed) ||
                (modality === 'INHOUSE' && !selectedIvls)
              }
            />
            {modality === 'INHOUSE' && !companionInCensus ? (
              <div className="text-caption-1 text-text-error">
                Add this companion to IDEXX census before creating an in-house order.
              </div>
            ) : null}
            {modality === 'INHOUSE' && companionInCensus && !inHouseCensusConfirmed ? (
              <div className="text-caption-1 text-text-error">
                Census sync is pending for the selected IVLS device. Refresh census after IVLS
                confirms the patient.
              </div>
            ) : null}
          </div>
        </Accordion>

        <Accordion title="In-house census" defaultOpen showEditIcon={false} isEditing>
          <div className="flex flex-col gap-3 py-2">
            <div className="text-body-4 text-text-secondary">
              Required for in-house ordering when sending tests to IVLS devices.
            </div>
            <div
              className={`rounded-2xl border p-3 ${companionInCensus ? 'border-green-200 bg-green-50' : 'border-card-border'}`}
            >
              <div className="text-body-4 text-text-primary">
                Companion census status: {companionInCensus ? 'Added' : 'Not added'}
              </div>
              {companionInCensus ? (
                <>
                  <div className="text-caption-1 text-text-secondary mt-1">
                    Companion is present in IDEXX census.
                  </div>
                  <div className="text-caption-1 text-text-secondary mt-1">
                    IVLS confirmation:{' '}
                    {inHouseCensusConfirmed
                      ? 'Confirmed for selected/current device'
                      : 'Pending device confirmation'}
                  </div>
                </>
              ) : (
                <div className="mt-3">
                  <Primary
                    href="#"
                    text={updatingCensus ? 'Adding to census...' : 'Add to census'}
                    onClick={handleAddToCensus}
                    isDisabled={updatingCensus || !companionId || !selectedIvls}
                  />
                </div>
              )}
            </div>
            <Secondary href="#" text="Refresh census" onClick={() => void refreshCensus()} />
          </div>
        </Accordion>

        <Accordion title="Order status and requisition" defaultOpen showEditIcon={false} isEditing>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex items-center justify-end">
              <Secondary
                href="#"
                text={ordersLoading ? 'Refreshing orders...' : 'Refresh appointment orders'}
                onClick={() => void refreshAppointmentOrders()}
                isDisabled={ordersLoading}
              />
            </div>
            {!latestOrder ? (
              <div className="text-body-4 text-text-secondary">
                {ordersLoading
                  ? 'Loading appointment lab orders...'
                  : 'No lab orders found for this appointment yet.'}
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-card-border p-3 bg-white flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-1">
                      <div className="text-body-3 text-text-primary">
                        Order {latestOrder.idexxOrderId}
                      </div>
                      <div className="text-caption-1 text-text-secondary">
                        Updated:{' '}
                        {latestOrder.updatedAt
                          ? new Date(latestOrder.updatedAt).toLocaleString()
                          : '-'}
                      </div>
                    </div>
                    <span
                      className={`text-label-xsmall px-2 py-1 rounded w-fit ${getOrderStatusBadgeClass(latestOrder)}`}
                    >
                      {getOrderDisplayStatus(latestOrder)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <Primary
                      href="#"
                      text={
                        needsInitialOrderPlacement
                          ? 'Resume order placement'
                          : canOpenFollowUpInCurrentOrder
                            ? 'Follow up'
                            : 'Open IDEXX'
                      }
                      onClick={() =>
                        openOrderIframe(canOpenFollowUpInCurrentOrder ? 'followup' : 'order')
                      }
                      isDisabled={!resolveOrderUiUrl(latestOrder)}
                    />
                    <Secondary
                      href="#"
                      text="Acknowledgment PDF"
                      onClick={() => openOrderAcknowledgement(latestOrder)}
                      isDisabled={!resolveOrderPdfUrl(latestOrder)}
                    />
                  </div>
                </div>
                {appointmentOrders.length > 1 ? (
                  <div className="rounded-2xl border border-card-border p-3 flex flex-col gap-2">
                    <div className="text-body-4 text-text-primary">
                      Past orders in this appointment
                    </div>
                    {appointmentOrders
                      .filter((order) => order._id !== latestOrder._id)
                      .map((order) => {
                        return (
                          <div
                            key={order._id}
                            className="rounded-xl border border-card-border p-3 flex flex-col gap-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-body-4 text-text-primary">
                                  Order {order.idexxOrderId}
                                </div>
                                <div className="text-caption-1 text-text-secondary">
                                  Updated:{' '}
                                  {order.updatedAt
                                    ? new Date(order.updatedAt).toLocaleString()
                                    : '-'}
                                </div>
                              </div>
                              <span
                                className={`text-label-xsmall px-2 py-1 rounded w-fit ${getOrderStatusBadgeClass(order)}`}
                              >
                                {getOrderDisplayStatus(order)}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 justify-end">
                              <Primary
                                href="#"
                                text="Open IDEXX"
                                onClick={() => {
                                  setActiveOrderForActions(order);
                                  openOrderIframe('order', order.status, order);
                                }}
                                isDisabled={!resolveOrderUiUrl(order)}
                              />
                              <Secondary
                                href="#"
                                text="Acknowledgment PDF"
                                onClick={() => openOrderAcknowledgement(order)}
                                isDisabled={!resolveOrderPdfUrl(order)}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </Accordion>

        <Accordion title="Results" defaultOpen showEditIcon={false} isEditing>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-caption-1 text-text-secondary">
                Results are filtered for this companion and all orders mapped to this appointment.
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <Primary
                  href="#"
                  text={refreshingResults ? 'Refreshing...' : 'Refresh'}
                  onClick={() => void refreshResults()}
                  isDisabled={refreshingResults}
                />
                <Secondary href="/appointments/idexx-workspace" text="IDEXX workspace" />
              </div>
            </div>

            {results.length === 0 ? (
              <div className="text-body-4 text-text-secondary">No results available yet.</div>
            ) : (
              results.map((result, index) => (
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
                      text={pdfPreviewLoadingId === result.resultId ? '...' : 'PDF'}
                      onClick={() => void openResultPdfPreview(result.resultId)}
                      isDisabled={pdfPreviewLoadingId === result.resultId}
                    />
                  </div>

                  {(result.rawPayload?.categories ?? []).map((category) => (
                    <div
                      key={`${result.resultId}-${category.name}`}
                      className="rounded-xl border border-card-border p-2"
                    >
                      <div className="text-body-4 text-text-primary mb-2">{category.name}</div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[620px]">
                          <thead>
                            <tr className="border-b border-card-border">
                              <th className="text-left text-caption-1 text-text-tertiary py-1 pr-2">
                                Test
                              </th>
                              <th className="text-left text-caption-1 text-text-tertiary py-1 pr-2">
                                Value
                              </th>
                              <th className="text-left text-caption-1 text-text-tertiary py-1 pr-2">
                                Reference
                              </th>
                              <th className="text-left text-caption-1 text-text-tertiary py-1">
                                Meter
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {category.tests.map((test, idx) => {
                              const meter = getMeterMeta(test);
                              return (
                                <tr
                                  key={`${category.name}-${test.name}-${idx}`}
                                  className="border-b border-card-border last:border-0"
                                >
                                  <td className="text-caption-1 text-text-primary py-2 pr-2">
                                    {test.name}
                                  </td>
                                  <td
                                    className={`text-caption-1 py-2 pr-2 ${test.outOfRange ? 'text-red-600' : 'text-text-primary'}`}
                                  >
                                    <LabResultValue test={test} />
                                  </td>
                                  <td className="text-caption-1 text-text-secondary py-2 pr-2">
                                    {test.referenceRange ?? '-'}
                                  </td>
                                  <td className="py-2">
                                    {meter.canRender ? (
                                      <div className="relative h-2 w-48 bg-card-hover rounded-full">
                                        <div
                                          className={`absolute top-1/2 -translate-y-1/2 w-1.5 h-4 rounded ${meter.markerClass}`}
                                          style={{ left: `calc(${meter.percent}% - 3px)` }}
                                        />
                                      </div>
                                    ) : (
                                      <span className="text-caption-1 text-text-secondary">
                                        N/A
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </Accordion>
      </div>
    </>
  );
};

export default LabTests;
