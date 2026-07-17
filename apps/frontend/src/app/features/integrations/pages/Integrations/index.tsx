'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';

const INTEGRATIONS_PAGE_SKELETON = <PageSkeleton variant="list" />;
import Modal from '@/app/ui/overlays/Modal';
import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import FormInputPass from '@/app/ui/inputs/FormInputPass/FormInputPass';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { useOrgStore } from '@/app/stores/orgStore';
import { usePrimaryOrg } from '@/app/hooks/useOrgSelectors';
import {
  loadIntegrationsForPrimaryOrg,
  useIntegrationByProviderForPrimaryOrg,
  useIntegrationsForPrimaryOrg,
} from '@/app/hooks/useIntegrations';
import { useIntegrationStore } from '@/app/stores/integrationStore';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';
import { formatDateTimeLocal } from '@/app/lib/date';
import { logger } from '@/app/lib/logger';
import {
  disableIntegration,
  enableIntegration,
  getApiErrorMessage,
  getCredentialMeta,
  listIdexxIvlsDevices,
  listIdexxOrders,
  storeIntegrationCredentials,
  validateIntegrationCredentials,
} from '@/app/features/integrations/services/idexxService';
import { CredentialMeta, IvlsDevice, LabOrder } from '@/app/features/integrations/services/types';
import { getMerckGateway } from '@/app/features/integrations/services/merckService';
import { useResolvedMerckIntegrationForPrimaryOrg } from '@/app/hooks/useMerckIntegration';
import Close from '@/app/ui/primitives/Icons/Close';
import {
  IoAlertCircleOutline,
  IoCheckmarkCircle,
  IoExtensionPuzzleOutline,
  IoEyeOutline,
  IoInformationCircleOutline,
  IoRefreshOutline,
  IoTrashOutline,
} from 'react-icons/io5';
import clsx from 'clsx';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';

type StatusTokens = { bg: string; text: string; border: string };

const statusTokens: Record<string, StatusTokens> = {
  enabled: {
    bg: 'var(--color-pill-success-bg)',
    text: 'var(--color-pill-success-text)',
    border: 'var(--color-pill-success-border)',
  },
  disabled: {
    bg: 'var(--color-pill-warning-bg)',
    text: 'var(--color-pill-warning-text)',
    border: 'var(--color-pill-warning-border)',
  },
  error: {
    bg: 'var(--color-pill-warning-bg)',
    text: 'var(--color-pill-warning-text)',
    border: 'var(--color-pill-warning-border)',
  },
  pending: {
    bg: 'var(--color-pill-info-bg)',
    text: 'var(--color-pill-info-text)',
    border: 'var(--color-pill-info-border)',
  },
};

const credentialsStatusTokens: Record<string, StatusTokens> = {
  valid: {
    bg: 'var(--color-pill-success-bg)',
    text: 'var(--color-pill-success-text)',
    border: 'var(--color-pill-success-border)',
  },
  invalid: {
    bg: 'var(--color-pill-warning-bg)',
    text: 'var(--color-pill-warning-text)',
    border: 'var(--color-pill-warning-border)',
  },
  missing: {
    bg: 'var(--color-pill-neutral-bg)',
    text: 'var(--color-pill-neutral-text)',
    border: 'var(--color-pill-neutral-border)',
  },
};
const IDEXX_REGIONAL_AVAILABILITY_DISCLAIMER =
  'IDEXX integration availability is currently limited to the USA, Canada, and the UK.';

const integrationFilters = [
  { key: 'all', label: 'All' },
  { key: 'connected', label: 'Connected' },
  { key: 'available', label: 'Available' },
] as const;

type ValidateState = 'idle' | 'valid' | 'invalid';

const CREDENTIALS_STATUS_MAP: Record<string, ValidateState> = {
  valid: 'valid',
  invalid: 'invalid',
};

const resolveValidateState = (credentialsStatus?: string | null): ValidateState =>
  CREDENTIALS_STATUS_MAP[String(credentialsStatus ?? '').toLowerCase()] ?? 'idle';

const getConnectionHint = (idexxEnabled: boolean, hasStoredCredentials: boolean): string => {
  if (idexxEnabled)
    return 'IDEXX is enabled. Use the Credentials section to rotate username/password and validate the connection.';
  return hasStoredCredentials
    ? 'Stored credentials detected. Validate and enable when ready.'
    : 'Store credentials first to enable IDEXX.';
};

const getCredentialsActionLabel = (saving: boolean, hasStoredCredentials: boolean): string => {
  if (saving) return hasStoredCredentials ? 'Updating...' : 'Saving...';
  return hasStoredCredentials ? 'Update credentials' : 'Store credentials';
};

const getEnableDisableLabel = (saving: boolean, idexxEnabled: boolean): string => {
  if (saving) return 'Updating...';
  if (idexxEnabled) return 'Disable IDEXX';
  return 'Enable IDEXX';
};

const getIdexxCardButtonLabel = (saving: boolean, idexxEnabled: boolean): string => {
  if (saving) return idexxEnabled ? 'Disabling...' : 'Enabling...';
  return idexxEnabled ? 'Disable' : 'Enable';
};

const getIntegrationEmptyState = (
  integrationStatus: string,
  activeFilter: (typeof integrationFilters)[number]['key'],
  idexxEnabled: boolean,
  merckEnabled: boolean
) => {
  const isReady = integrationStatus !== 'loading';
  return {
    showNoConnected: isReady && activeFilter === 'connected' && !idexxEnabled && !merckEnabled,
    showNoAvailable: isReady && activeFilter === 'available' && idexxEnabled && merckEnabled,
  };
};

const formatOptionalDate = (value: string | null | undefined, fallback: string): string => {
  if (!value) return fallback;
  return formatDateTimeLocal(value);
};

const getValidateStateMeta = (
  validateState: ValidateState
): { text: string; className: string } | null => {
  if (validateState === 'idle') return null;
  if (validateState === 'valid') {
    return { text: 'Credentials validated successfully.', className: 'text-green-700' };
  }
  return { text: 'Credentials are invalid or not available.', className: 'text-text-error' };
};

// Display-only mask for the IDEXX password. The real secret is never fetched
// or rendered — the backend credential-meta endpoint omits it entirely.
const MASKED_PASSWORD = '••••••••••';

const formatModalityLabel = (modality?: string | null): string => {
  const raw = String(modality ?? '').trim();
  if (!raw) return '';
  const normalized = raw.toLowerCase().replaceAll(/[_-]+/g, ' ');
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const ORDER_STATUS_COMPLETED: StatusTokens = {
  bg: 'var(--status-completed-bg)',
  text: 'var(--status-completed-text)',
  border: 'var(--status-completed-border)',
};
const ORDER_STATUS_RUNNING: StatusTokens = {
  bg: 'var(--status-in-progress-bg)',
  text: 'var(--status-in-progress-text)',
  border: 'var(--status-in-progress-border)',
};
const ORDER_STATUS_CANCELLED: StatusTokens = {
  bg: 'var(--status-cancelled-bg)',
  text: 'var(--status-cancelled-text)',
  border: 'var(--status-cancelled-border)',
};
const ORDER_STATUS_NEUTRAL: StatusTokens = {
  bg: 'var(--status-requested-bg)',
  text: 'var(--status-requested-text)',
  border: 'var(--status-requested-border)',
};

const resolveOrderStatusBadge = (
  status?: string | null
): { label: string; tokens: StatusTokens } => {
  const key = String(status ?? '')
    .trim()
    .toLowerCase();
  const label = key ? key.replaceAll(/[_-]+/g, ' ').toUpperCase() : 'PENDING';
  if (/result|complete|final|done/.test(key)) return { label, tokens: ORDER_STATUS_COMPLETED };
  if (/run|process|progress/.test(key)) return { label, tokens: ORDER_STATUS_RUNNING };
  if (/error|fail|cancel|reject/.test(key)) return { label, tokens: ORDER_STATUS_CANCELLED };
  return { label, tokens: ORDER_STATUS_NEUTRAL };
};

type RecentOrderRow = {
  key: string;
  patient: string;
  description: string;
  statusLabel: string;
  tokens: StatusTokens;
};

// Build honest recent-order rows from real IDEXX order records. Patient falls
// back to the order reference when the payload carries no denormalized name;
// description prefers the first ordered test, else the formatted modality.
const buildRecentOrderRows = (orders: LabOrder[]): RecentOrderRow[] =>
  orders.slice(0, 3).map((order, index) => {
    const orderRef = String(order.idexxOrderId ?? '').trim();
    const patient =
      String(order.patientName ?? '').trim() ||
      (orderRef ? `Order ${orderRef}` : '') ||
      'Lab order';
    const firstTest = String(order.tests?.[0] ?? '').trim();
    const description = firstTest || formatModalityLabel(order.modality) || 'Lab work';
    const { label, tokens } = resolveOrderStatusBadge(order.status);
    return {
      key: String(order._id ?? orderRef ?? '') || `order-${index}`,
      patient,
      description,
      statusLabel: label,
      tokens,
    };
  });

const deviceStatusTokens = (key: string): StatusTokens =>
  key === 'active'
    ? {
        bg: 'var(--color-pill-success-bg)',
        text: 'var(--color-pill-success-text)',
        border: 'var(--color-pill-success-border)',
      }
    : {
        bg: 'var(--color-pill-warning-bg)',
        text: 'var(--color-pill-warning-text)',
        border: 'var(--color-pill-warning-border)',
      };

const DeviceCard = ({ device }: { device: IvlsDevice }) => {
  const statusKey = String(device.vcpActivatedStatus || 'unknown').toLowerCase();
  const statusLabel = `${statusKey.charAt(0).toUpperCase()}${statusKey.slice(1)}`;
  const dt = deviceStatusTokens(statusKey);
  return (
    <div key={device.deviceSerialNumber} className="rounded-2xl border border-card-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-body-4 text-text-primary">{device.displayName || 'IVLS device'}</div>
          <div className="text-caption-1 text-text-secondary mt-0.5">
            {device.deviceSerialNumber}
          </div>
        </div>
        <span
          className="text-label-xsmall px-2 py-1 rounded-2xl! border!"
          style={{
            backgroundColor: dt.bg,
            color: dt.text,
            borderColor: dt.border,
            borderStyle: 'solid',
          }}
        >
          {statusLabel}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-caption-1">
        <div className="text-text-secondary">Last cloud poll</div>
        <div className="text-text-primary text-right">
          {device.lastPolledCloudTime
            ? formatDateTimeLocal(device.lastPolledCloudTime)
            : 'Not available'}
        </div>
      </div>
    </div>
  );
};

const StatusPill = ({ status, label }: { status?: string; label?: string }) => {
  const key = (status ?? 'disabled').toLowerCase();
  const normalizedLabel = label ?? `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
  const tokens = statusTokens[key];
  const isLive = key === 'enabled';
  return (
    <span
      className="shrink-0 max-w-full inline-flex items-center gap-1.5 whitespace-nowrap uppercase tracking-[0.06em] text-label-xsmall px-2.5 py-1 rounded-full! border!"
      style={
        tokens
          ? {
              backgroundColor: tokens.bg,
              color: tokens.text,
              borderColor: tokens.border,
              borderStyle: 'solid',
            }
          : {
              backgroundColor: 'var(--color-card-hover)',
              color: 'var(--color-text-secondary)',
              borderColor: 'var(--color-card-border)',
              borderStyle: 'solid',
            }
      }
    >
      {isLive ? (
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full"
          style={{ backgroundColor: 'var(--success)' }}
        />
      ) : null}
      {normalizedLabel}
    </span>
  );
};

const LinkedDevicesList = ({ devices }: { devices: IvlsDevice[] }) => {
  if (devices.length === 0) {
    return (
      <div className="text-body-4 text-text-secondary">
        No linked IVLS devices found for this organization.
      </div>
    );
  }

  return (
    <>
      {devices.map((device) => (
        <DeviceCard key={device.deviceSerialNumber} device={device} />
      ))}
    </>
  );
};

type IdexxActionsState = {
  primaryOrgId: string | null | undefined;
  refreshing: boolean;
  saving: boolean;
  username: string;
  password: string;
  idexxIntegration: { status?: string | null } | null | undefined;
  setDevices: (d: IvlsDevice[]) => void;
  setError: (e: string | null) => void;
  setRefreshing: (v: boolean) => void;
  setSaving: (v: boolean) => void;
  setValidateState: (v: ValidateState) => void;
  setShowSettings: (v: boolean) => void;
};

const useIdexxActions = (s: IdexxActionsState) => {
  const handleManualRefresh = useCallback(async () => {
    if (!s.primaryOrgId || s.refreshing) return;
    s.setRefreshing(true);
    s.setError(null);
    try {
      await loadIntegrationsForPrimaryOrg({ force: true, silent: true });
      const nextIdexx =
        useIntegrationStore.getState().getIntegrationByProvider(s.primaryOrgId, 'IDEXX') ?? null;
      if ((nextIdexx?.status ?? '').toLowerCase() === 'enabled') {
        const ivls = await listIdexxIvlsDevices(s.primaryOrgId);
        s.setDevices(ivls.ivlsDeviceList ?? []);
      } else {
        s.setDevices([]);
      }
    } catch (e) {
      s.setError(getApiErrorMessage(e, 'Unable to refresh integration status.'));
    } finally {
      s.setRefreshing(false);
    }
  }, [s]);

  const handleStoreCredentials = useCallback(async () => {
    if (!s.primaryOrgId || !s.username.trim() || !s.password.trim()) return;
    s.setSaving(true);
    s.setError(null);
    s.setValidateState('idle');
    try {
      await storeIntegrationCredentials(
        s.primaryOrgId,
        { credentials: { username: s.username.trim(), password: s.password } },
        'IDEXX'
      );
      await loadIntegrationsForPrimaryOrg({ force: true, silent: true });
    } catch (e) {
      s.setError(
        getApiErrorMessage(e, 'Unable to store IDEXX credentials. Please verify and retry.')
      );
    } finally {
      s.setSaving(false);
    }
  }, [s]);

  const handleValidate = useCallback(async () => {
    if (!s.primaryOrgId) return;
    s.setSaving(true);
    s.setError(null);
    try {
      const res = await validateIntegrationCredentials(s.primaryOrgId, 'IDEXX');
      s.setValidateState(res.ok ? 'valid' : 'invalid');
      // Validation updates credentialsStatus/lastValidatedAt on the backend; refresh the store so
      // the Enable button (gated on stored/validated credentials) unlocks without a manual reload.
      await loadIntegrationsForPrimaryOrg({ force: true, silent: true });
    } catch (e) {
      s.setValidateState('invalid');
      s.setError(getApiErrorMessage(e, 'Credential validation failed.'));
    } finally {
      s.setSaving(false);
    }
  }, [s]);

  const validateBeforeEnable = useCallback(async (): Promise<boolean> => {
    try {
      const validation = await validateIntegrationCredentials(s.primaryOrgId!, 'IDEXX');
      if (!validation.ok) throw new Error('IDEXX credentials are invalid.');
      s.setValidateState('valid');
      return true;
    } catch (validationError) {
      s.setValidateState('invalid');
      s.setShowSettings(true);
      s.setError(
        getApiErrorMessage(
          validationError,
          'IDEXX credentials are missing or invalid. Open settings, fill credentials, validate, and then enable.'
        )
      );
      return false;
    }
  }, [s]);

  const handleEnableDisable = useCallback(async () => {
    if (!s.primaryOrgId) return;
    if (!s.idexxIntegration) {
      s.setShowSettings(true);
      s.setError('Store IDEXX credentials in settings before enabling.');
      return;
    }
    const isDisconnecting = (s.idexxIntegration.status ?? '').toLowerCase() === 'enabled';
    if (isDisconnecting) {
      const ok = globalThis.confirm(
        'Disconnect IDEXX for this organization? Lab ordering and result syncing will be unavailable until re-enabled.'
      );
      if (!ok) return;
    }
    s.setSaving(true);
    s.setError(null);
    try {
      if (!isDisconnecting) {
        const valid = await validateBeforeEnable();
        if (!valid) return;
      }
      const next = isDisconnecting
        ? await disableIntegration(s.primaryOrgId, 'IDEXX')
        : await enableIntegration(s.primaryOrgId, 'IDEXX');
      if (next.status === 'enabled') {
        const ivls = await listIdexxIvlsDevices(s.primaryOrgId);
        s.setDevices(ivls.ivlsDeviceList ?? []);
      } else {
        s.setDevices([]);
      }
      await loadIntegrationsForPrimaryOrg({ force: true, silent: true });
    } catch (e) {
      s.setError(getApiErrorMessage(e, 'Unable to update IDEXX integration status.'));
    } finally {
      s.setSaving(false);
    }
  }, [s, validateBeforeEnable]);

  return { handleManualRefresh, handleStoreCredentials, handleValidate, handleEnableDisable };
};

const useIntegrationsPage = () => {
  const primaryOrg = usePrimaryOrg();
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const integrations = useIntegrationsForPrimaryOrg();
  const {
    integration: merckIntegration,
    isEnabled: merckEnabled,
    refresh: refreshMerckIntegration,
  } = useResolvedMerckIntegrationForPrimaryOrg();
  const idexxIntegration = useIntegrationByProviderForPrimaryOrg('IDEXX');
  const integrationStatus = useIntegrationStore((s) => s.status);
  const integrationError = useIntegrationStore((s) => s.error);
  const integrationsLastFetchedAt = useIntegrationStore((s) => s.lastFetchedAt);
  const [devices, setDevices] = useState<IvlsDevice[]>([]);
  const [credentialMeta, setCredentialMeta] = useState<CredentialMeta | null>(null);
  const [recentOrders, setRecentOrders] = useState<LabOrder[]>([]);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [merckSaving, setMerckSaving] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [validateState, setValidateState] = useState<ValidateState>('idle');
  const [activeFilter, setActiveFilter] = useState<'all' | 'connected' | 'available'>('all');
  const [error, setError] = useState<string | null>(null);

  // Render-phase adjustment: surface a new store-level integration error in
  // the local error banner without clobbering later local errors.
  const [syncedIntegrationError, setSyncedIntegrationError] = useState<string | null>(null);
  if (integrationError !== syncedIntegrationError) {
    setSyncedIntegrationError(integrationError);
    if (integrationError) setError(integrationError);
  }

  useEffect(() => {
    const run = async () => {
      if (!primaryOrgId) return;
      if (idexxIntegration?.status === 'enabled') {
        try {
          const ivls = await listIdexxIvlsDevices(primaryOrgId);
          setDevices(ivls.ivlsDeviceList ?? []);
        } catch (e) {
          setDevices([]);
          setError(getApiErrorMessage(e, 'Unable to load linked IDEXX devices.'));
        }
      } else {
        setDevices([]);
      }
    };
    run().catch(() => undefined);
  }, [primaryOrgId, idexxIntegration?.status]);

  useEffect(() => {
    setValidateState(resolveValidateState(idexxIntegration?.credentialsStatus));
  }, [idexxIntegration?.credentialsStatus]);

  // Populate the inline credentials panel when IDEXX is connected: non-secret
  // credential metadata (username/practiceId, never the password) plus the most
  // recent lab orders. Cleared when disconnected so nothing stale is shown.
  const idexxConnected = (idexxIntegration?.status ?? '').toLowerCase() === 'enabled';
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!primaryOrgId || !idexxConnected) {
        setCredentialMeta(null);
        setRecentOrders([]);
        return;
      }
      const [metaResult, ordersResult] = await Promise.allSettled([
        getCredentialMeta(primaryOrgId, 'IDEXX'),
        listIdexxOrders({ organisationId: primaryOrgId, limit: 3 }),
      ]);
      if (cancelled) return;
      setCredentialMeta(metaResult.status === 'fulfilled' ? metaResult.value : null);
      setRecentOrders(ordersResult.status === 'fulfilled' ? ordersResult.value : []);
    };
    run().catch((error) => {
      /* v8 ignore next -- defensive: run() resolves its own API failures via allSettled, so this only fires on an unexpected programmer error */
      logger.error('Failed to load IDEXX credential panel', error);
    });
    return () => {
      cancelled = true;
    };
  }, [primaryOrgId, idexxConnected]);

  const { handleManualRefresh, handleStoreCredentials, handleValidate, handleEnableDisable } =
    useIdexxActions({
      primaryOrgId,
      refreshing,
      saving,
      username,
      password,
      idexxIntegration,
      setDevices,
      setError,
      setRefreshing,
      setSaving,
      setValidateState,
      setShowSettings,
    });

  const linkedCount = useMemo(() => {
    const enabledProviders = integrations.reduce<Set<string>>((providers, integration) => {
      if (integration.status?.toLowerCase() === 'enabled') providers.add(integration.provider);
      return providers;
    }, new Set());
    if (merckEnabled) enabledProviders.add('MERCK_MANUALS');
    return enabledProviders.size;
  }, [integrations, merckEnabled]);

  const idexxStatus = (idexxIntegration?.status ?? 'disabled').toLowerCase();
  const idexxEnabled = idexxStatus === 'enabled';
  const credentialsStatusKey = String(
    idexxIntegration?.credentialsStatus ?? 'missing'
  ).toLowerCase();
  const hasStoredCredentials =
    (credentialsStatusKey && credentialsStatusKey !== 'missing') ||
    Boolean(idexxIntegration?.lastValidatedAt);
  const credentialsStatusLabel = `${credentialsStatusKey.charAt(0).toUpperCase()}${credentialsStatusKey.slice(1)}`;
  const showIdexxCard =
    activeFilter === 'all' ||
    (activeFilter === 'connected' && idexxEnabled) ||
    (activeFilter === 'available' && !idexxEnabled);
  const showMerckCard =
    activeFilter === 'all' ||
    (activeFilter === 'connected' && merckEnabled) ||
    (activeFilter === 'available' && !merckEnabled);
  const credentialsActionLabel = getCredentialsActionLabel(saving, hasStoredCredentials);

  const handleMerckEnableDisable = useCallback(async () => {
    if (!primaryOrgId || merckSaving) return;
    setMerckSaving(true);
    setError(null);
    try {
      const gateway = getMerckGateway();
      if (merckEnabled) {
        await gateway.disable(primaryOrgId);
      } else {
        await gateway.enable(primaryOrgId);
      }
      await loadIntegrationsForPrimaryOrg({ force: true, silent: true });
      refreshMerckIntegration();
    } catch (e) {
      setError(getApiErrorMessage(e, 'Unable to update MSD Veterinary Manual status.'));
    } finally {
      setMerckSaving(false);
    }
  }, [primaryOrgId, merckEnabled, merckSaving, refreshMerckIntegration]);

  return {
    primaryOrg,
    primaryOrgId,
    integrationStatus,
    integrationsLastFetchedAt,
    idexxIntegration,
    idexxStatus,
    idexxEnabled,
    devices,
    credentialMeta,
    recentOrders,
    saving,
    refreshing,
    showSettings,
    setShowSettings,
    username,
    setUsername,
    password,
    setPassword,
    validateState,
    activeFilter,
    setActiveFilter,
    error,
    linkedCount,
    merckIntegration,
    merckEnabled,
    merckSaving,
    credentialsStatusKey,
    credentialsStatusLabel,
    hasStoredCredentials,
    showIdexxCard,
    showMerckCard,
    credentialsActionLabel,
    handleManualRefresh,
    handleStoreCredentials,
    handleValidate,
    handleEnableDisable,
    handleMerckEnableDisable,
  };
};

const IdexxSettingsModal = ({
  showSettings,
  setShowSettings,
  idexxIntegration,
  idexxEnabled,
  hasStoredCredentials,
  credentialsStatusKey,
  credentialsStatusLabel,
  credentialsActionLabel,
  validateState,
  saving,
  refreshing,
  integrationsLastFetchedAt,
  devices,
  username,
  setUsername,
  password,
  setPassword,
  handleManualRefresh,
  handleStoreCredentials,
  handleValidate,
  handleEnableDisable,
}: {
  showSettings: boolean;
  setShowSettings: React.Dispatch<React.SetStateAction<boolean>>;
  idexxIntegration: ReturnType<typeof useIntegrationByProviderForPrimaryOrg>;
  idexxEnabled: boolean;
  hasStoredCredentials: boolean;
  credentialsStatusKey: string;
  credentialsStatusLabel: string;
  credentialsActionLabel: string;
  validateState: ValidateState;
  saving: boolean;
  refreshing: boolean;
  integrationsLastFetchedAt: string | null | undefined;
  devices: IvlsDevice[];
  username: string;
  setUsername: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  handleManualRefresh: () => Promise<void>;
  handleStoreCredentials: () => Promise<void>;
  handleValidate: () => Promise<void>;
  handleEnableDisable: () => Promise<void>;
}) => {
  const enableDisableLabel = getEnableDisableLabel(saving, idexxEnabled);
  const lastRefreshedText = formatOptionalDate(integrationsLastFetchedAt, 'Not refreshed yet');
  const refreshIconClass = refreshing ? 'animate-spin' : '';
  const validateMeta = getValidateStateMeta(validateState);
  const lastValidatedText = formatOptionalDate(
    idexxIntegration?.lastValidatedAt,
    'Not validated yet'
  );
  const lastSyncText = formatOptionalDate(idexxIntegration?.lastSyncAt, 'Pending');
  const enabledAtText = formatOptionalDate(idexxIntegration?.enabledAt, 'Not enabled');

  return (
    <Modal showModal={showSettings} setShowModal={setShowSettings}>
      <div className="flex flex-col h-full gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-heading-3 text-text-primary">Integration settings</h3>
            <div className="text-body-4 text-text-secondary">
              Configure IDEXX for this organization
            </div>
          </div>
          <Close onClick={() => setShowSettings(false)} />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-card-border px-3 py-2 bg-card-bg">
          <div className="text-caption-1 text-text-secondary">
            Last refreshed: <span className="text-text-primary">{lastRefreshedText}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              handleManualRefresh().catch(() => undefined);
            }}
            className="size-8 rounded-full! border border-card-border flex items-center justify-center text-text-primary hover:bg-card-hover"
            aria-label="Refresh integrations"
            title="Refresh integrations"
            disabled={refreshing}
          >
            <IoRefreshOutline className={refreshIconClass} size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-1">
          <Accordion title="Credentials" defaultOpen showEditIcon={false} isEditing>
            <div className="flex flex-col gap-3 py-2">
              <FormInput
                intype="text"
                inname="idexx-username"
                inlabel="IDEXX username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <FormInputPass
                intype="password"
                inname="idexx-password"
                inlabel="IDEXX password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Primary
                  href="#"
                  text={credentialsActionLabel}
                  onClick={handleStoreCredentials}
                  isDisabled={saving || !username.trim() || !password.trim()}
                />
                <Secondary
                  href="#"
                  text={saving ? 'Validating...' : 'Validate'}
                  onClick={handleValidate}
                  isDisabled={saving}
                />
              </div>
              {validateMeta ? (
                <div className={`text-body-4 ${validateMeta.className}`}>{validateMeta.text}</div>
              ) : null}
              <div className="grid grid-cols-2 gap-2 text-caption-1">
                <div className="text-text-secondary">Credentials status</div>
                <div className="text-right">
                  <span
                    className="text-label-xsmall px-2 py-1 rounded-2xl! border!"
                    style={(() => {
                      const t = credentialsStatusTokens[credentialsStatusKey];
                      return t
                        ? {
                            backgroundColor: t.bg,
                            color: t.text,
                            borderColor: t.border,
                            borderStyle: 'solid',
                          }
                        : {
                            backgroundColor: 'var(--color-card-hover)',
                            color: 'var(--color-text-secondary)',
                            borderColor: 'var(--color-card-border)',
                            borderStyle: 'solid',
                          };
                    })()}
                  >
                    {credentialsStatusLabel}
                  </span>
                </div>
                <div className="text-text-secondary">Last validated</div>
                <div className="text-text-primary text-right">{lastValidatedText}</div>
              </div>
            </div>
          </Accordion>

          <Accordion title="Connection" defaultOpen showEditIcon={false} isEditing>
            <div className="flex flex-col gap-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-body-4 text-text-primary">Current status</div>
                <StatusPill status={idexxIntegration?.status} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-caption-1 text-text-secondary">Connected since</div>
                <div className="text-caption-1 text-text-primary">
                  {formatDateTimeLocal(idexxIntegration?.enabledAt)}
                </div>
              </div>
              <div className="text-caption-1 text-text-secondary">
                Enabling IDEXX allows appointment lab ordering and results visibility.
              </div>
              <div className="flex flex-wrap gap-2">
                <Primary
                  href="#"
                  text={enableDisableLabel}
                  onClick={handleEnableDisable}
                  isDisabled={
                    saving || !idexxIntegration || (!idexxEnabled && !hasStoredCredentials)
                  }
                />
                <Secondary href="/appointments" text="Open appointments" />
              </div>
              <div className="text-caption-1 text-text-secondary">
                {getConnectionHint(idexxEnabled, hasStoredCredentials)}
              </div>
            </div>
          </Accordion>

          <Accordion title="Sync health" defaultOpen showEditIcon={false} isEditing>
            <div className="flex flex-col gap-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-caption-1 text-text-secondary">Last sync</div>
                <div className="text-caption-1 text-text-primary">{lastSyncText}</div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-caption-1 text-text-secondary">Enabled at</div>
                <div className="text-caption-1 text-text-primary">{enabledAtText}</div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-caption-1 text-text-secondary">Last validated</div>
                <div className="text-caption-1 text-text-primary">{lastValidatedText}</div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-caption-1 text-text-secondary">Linked IVLS devices</div>
                <div className="text-caption-1 text-text-primary">{devices.length}</div>
              </div>
              <Secondary href="/appointments/idexx-workspace" text="IDEXX Hub" />
            </div>
          </Accordion>

          <Accordion title="Linked medical devices" defaultOpen showEditIcon={false} isEditing>
            <div className="flex flex-col gap-2 py-2">
              <LinkedDevicesList devices={devices} />
            </div>
          </Accordion>

          <div className="text-caption-2 text-text-extra pt-1 pb-1">
            {IDEXX_REGIONAL_AVAILABILITY_DISCLAIMER}
          </div>
        </div>
      </div>
    </Modal>
  );
};

type IntegrationsPageState = ReturnType<typeof useIntegrationsPage>;

const IntegrationFilterTabs = ({
  activeFilter,
  setActiveFilter,
}: {
  activeFilter: IntegrationsPageState['activeFilter'];
  setActiveFilter: IntegrationsPageState['setActiveFilter'];
}) => (
  <fieldset className="flex items-center gap-2 flex-wrap">
    <legend className="sr-only">Filter integrations</legend>
    {integrationFilters.map((tab) => {
      const isActive = activeFilter === tab.key;
      return (
        <button
          key={tab.key}
          type="button"
          onClick={() => setActiveFilter(tab.key)}
          aria-pressed={isActive}
          className={clsx(
            'rounded-full! border px-[13px] py-1.5 text-[12px] transition-colors',
            isActive
              ? 'bg-[var(--inset)] border-[var(--divider)] text-[var(--ink)] font-bold'
              : 'border-[var(--hairline)] text-[var(--ink-muted)] font-semibold hover:border-[var(--divider)]'
          )}
        >
          {tab.label}
        </button>
      );
    })}
  </fieldset>
);

const INTEGRATION_CARD_CLASS =
  'rounded-[18px] border border-[var(--hairline)] bg-[var(--screen)] p-5 w-full flex items-stretch gap-4 min-h-[245px] shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)]';
const INTEGRATION_CARD_HEADER_CLASS = 'grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2';
const INTEGRATION_CARD_TITLE_CLASS = 'min-w-0 truncate text-heading-3 text-text-primary pt-1';
const COMING_SOON_PILL_CLASS =
  'shrink-0 max-w-full whitespace-nowrap text-label-xsmall px-2 py-1 rounded-2xl! border!';

const IdexxIntegrationCard = ({
  s,
  buttonLabel,
}: {
  s: IntegrationsPageState;
  buttonLabel: string;
}) => {
  if (!s.showIdexxCard) return null;

  return (
    <div className={INTEGRATION_CARD_CLASS}>
      <div className="shrink-0 w-[72px] flex flex-col items-center justify-between">
        <div className="size-[72px] rounded-[15px] border border-[var(--hairline)] bg-neutral-0 p-2 flex items-center justify-center">
          <Image
            src={MEDIA_SOURCES.futureAssets.idexxLogoUrl}
            alt="IDEXX"
            width={56}
            height={56}
            className="object-contain max-h-[56px] max-w-[56px] size-auto"
          />
        </div>
        {s.idexxEnabled ? (
          <button
            type="button"
            onClick={s.handleEnableDisable}
            aria-label="Disable IDEXX quick action"
            title="Disable IDEXX quick action"
            className="size-10 rounded-2xl! border border-red-200 flex items-center justify-center hover:bg-red-50 transition-colors cursor-pointer"
          >
            <IoTrashOutline className="text-red-600" size={16} />
          </button>
        ) : (
          <div className="size-10" />
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div className="flex flex-col gap-3 pb-3">
          <div className={INTEGRATION_CARD_HEADER_CLASS}>
            <div className={INTEGRATION_CARD_TITLE_CLASS}>IDEXX VetConnect PLUS</div>
            <StatusPill
              status={s.idexxIntegration?.status}
              label={s.idexxEnabled ? 'Connected' : undefined}
            />
          </div>
          <div className="text-body-4 text-text-secondary line-clamp-4">
            Order in-house and reference lab work from the appointment workspace; results file to
            the patient automatically.
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 w-full items-center">
          <Secondary
            href="#"
            text="Manage credentials"
            onClick={() => s.setShowSettings(true)}
            className="w-full px-4"
          />
          {s.idexxEnabled ? (
            <Secondary
              href="/appointments/idexx-workspace"
              text="Open workspace"
              className="w-full px-4"
            />
          ) : (
            <Primary
              href="#"
              text={buttonLabel}
              onClick={s.handleEnableDisable}
              isDisabled={s.saving}
              className="w-full px-4"
            />
          )}
        </div>
      </div>
    </div>
  );
};

const MerckIntegrationCard = ({
  s,
  buttonLabel,
}: {
  s: IntegrationsPageState;
  buttonLabel: string;
}) => {
  if (!s.showMerckCard) return null;

  return (
    <div className={INTEGRATION_CARD_CLASS}>
      <div className="shrink-0 w-[72px] flex flex-col items-center justify-between">
        <div className="size-[72px] rounded-[15px] border border-[var(--hairline)] bg-neutral-0 p-2 flex items-center justify-center">
          <Image
            src={MEDIA_SOURCES.futureAssets.msdLogoUrl}
            alt="MSD Veterinary Manual"
            width={60}
            height={60}
            className="object-contain max-h-[60px] max-w-[60px] size-auto"
          />
        </div>
        {s.merckEnabled ? (
          <button
            type="button"
            onClick={s.handleMerckEnableDisable}
            aria-label="Disable MSD Veterinary Manual"
            title="Disable MSD Veterinary Manual"
            className="size-10 rounded-2xl! border border-red-200 flex items-center justify-center hover:bg-red-50 transition-colors cursor-pointer"
          >
            <IoTrashOutline className="text-red-600" size={16} />
          </button>
        ) : (
          <div className="size-10" />
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div className="flex flex-col gap-3 pb-3">
          <div className={INTEGRATION_CARD_HEADER_CLASS}>
            <div className={INTEGRATION_CARD_TITLE_CLASS}>MSD Veterinary Manual</div>
            <StatusPill status={s.merckIntegration?.status} />
          </div>
          <div className="text-body-4 text-text-secondary line-clamp-4">
            Search the veterinary manual from the workspace side rail without leaving the visit.
            Free for every clinic.
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex w-full items-center justify-end">
            {s.merckEnabled ? (
              <Primary
                href="/integrations/merck-manuals"
                text="Open manuals"
                className="w-full max-w-[160px] px-4"
              />
            ) : (
              <Primary
                href="#"
                text={buttonLabel}
                onClick={s.handleMerckEnableDisable}
                isDisabled={s.merckSaving}
                className="w-full max-w-[160px] px-4"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const RadIntegrationCard = ({
  activeFilter,
}: {
  activeFilter: IntegrationsPageState['activeFilter'];
}) => {
  if (activeFilter === 'connected') return null;

  return (
    <div className={INTEGRATION_CARD_CLASS}>
      <div className="shrink-0 w-[72px] flex flex-col items-center justify-between">
        <div className="size-[72px] rounded-[15px] border border-[var(--hairline)] bg-neutral-0 p-2 flex items-center justify-center overflow-hidden">
          <Image
            src={MEDIA_SOURCES.futureAssets.radAnalyzerLogoUrl}
            alt="RadAnalyzer"
            width={56}
            height={56}
            className="object-contain max-h-[56px] max-w-[56px] size-auto"
          />
        </div>
        <div className="size-10" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div className="flex flex-col gap-3 pb-3">
          <div className={INTEGRATION_CARD_HEADER_CLASS}>
            <div className={INTEGRATION_CARD_TITLE_CLASS}>RadAnalyzer</div>
            <span
              className={COMING_SOON_PILL_CLASS}
              style={{
                backgroundColor: 'var(--color-pill-neutral-bg)',
                color: 'var(--color-pill-neutral-text)',
                borderColor: 'var(--color-pill-neutral-border)',
                borderStyle: 'solid',
              }}
            >
              Coming soon
            </span>
          </div>
          <div className="text-body-4 text-text-secondary line-clamp-4">
            Imaging and analyzer connectivity for diagnostic workflows in Yosemite Crew.
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex w-full items-center justify-end">
            <Primary href="#" text="Coming soon" isDisabled className="w-full max-w-[160px] px-4" />
          </div>
        </div>
      </div>
    </div>
  );
};

const VetnioIntegrationCard = ({
  activeFilter,
}: {
  activeFilter: IntegrationsPageState['activeFilter'];
}) => {
  if (activeFilter === 'connected') return null;

  return (
    <div className={INTEGRATION_CARD_CLASS}>
      <div className="shrink-0 w-[72px] flex flex-col items-center justify-between">
        <div className="size-[72px] rounded-[15px] border border-[var(--hairline)] bg-neutral-0 p-2 flex items-center justify-center overflow-hidden">
          <Image
            src={MEDIA_SOURCES.futureAssets.vetnioLogoUrl}
            alt="Vetnio"
            width={56}
            height={56}
            className="object-contain max-h-[56px] max-w-[56px] size-auto"
          />
        </div>
        <div className="size-10" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div className="flex flex-col gap-3 pb-3">
          <div className={INTEGRATION_CARD_HEADER_CLASS}>
            <div className={INTEGRATION_CARD_TITLE_CLASS}>Vetnio</div>
            <span
              className={COMING_SOON_PILL_CLASS}
              style={{
                backgroundColor: 'var(--color-pill-neutral-bg)',
                color: 'var(--color-pill-neutral-text)',
                borderColor: 'var(--color-pill-neutral-border)',
                borderStyle: 'solid',
              }}
            >
              Coming soon
            </span>
          </div>
          <div className="text-body-4 text-text-secondary line-clamp-4">
            AI-powered documentation for veterinary practices &mdash; instantly generate clinical
            notes, discharge summaries, and client communications from consultations.
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex w-full items-center justify-end">
            <Primary href="#" text="Coming soon" isDisabled className="w-full max-w-[160px] px-4" />
          </div>
        </div>
      </div>
    </div>
  );
};

const QuickBooksIntegrationCard = ({
  activeFilter,
}: {
  activeFilter: IntegrationsPageState['activeFilter'];
}) => {
  if (activeFilter === 'connected') return null;

  return (
    <div className={INTEGRATION_CARD_CLASS}>
      <div className="shrink-0 w-[72px] flex flex-col items-center justify-between">
        <div className="size-[72px] rounded-[15px] border border-[var(--hairline)] bg-neutral-0 p-1 flex items-center justify-center overflow-hidden">
          <span className="font-satoshi text-[28px] font-bold leading-none tracking-[-0.56px] text-[#2ca01c]">
            qb
          </span>
        </div>
        <div className="size-10" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div className="flex flex-col gap-3 pb-3">
          <div className={INTEGRATION_CARD_HEADER_CLASS}>
            <div className={INTEGRATION_CARD_TITLE_CLASS}>QuickBooks</div>
            <span
              className={COMING_SOON_PILL_CLASS}
              style={{
                backgroundColor: 'var(--color-pill-neutral-bg)',
                color: 'var(--color-pill-neutral-text)',
                borderColor: 'var(--color-pill-neutral-border)',
                borderStyle: 'solid',
              }}
            >
              Coming soon
            </span>
          </div>
          <div className="text-body-4 text-text-secondary line-clamp-4">
            Accounting sync for invoices, payments, customers, and financial workflows through
            QuickBooks Online.
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex w-full items-center justify-end">
            <Primary href="#" text="Coming soon" isDisabled className="w-full max-w-[160px] px-4" />
          </div>
        </div>
      </div>
    </div>
  );
};

const LaikaIntegrationCard = ({
  activeFilter,
}: {
  activeFilter: IntegrationsPageState['activeFilter'];
}) => {
  if (activeFilter === 'connected') return null;

  return (
    <div className={INTEGRATION_CARD_CLASS}>
      <div className="shrink-0 w-[72px] flex flex-col items-center justify-between">
        <div className="size-[72px] rounded-[15px] border border-[var(--hairline)] bg-neutral-0 p-2 flex items-center justify-center overflow-hidden">
          <Image
            src={MEDIA_SOURCES.futureAssets.laikaLogoUrl}
            alt="Laika"
            width={56}
            height={16}
            className="object-contain max-h-14 max-w-14 size-auto"
            unoptimized
          />
        </div>
        <div className="size-10" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div className="flex flex-col gap-3 pb-3">
          <div className={INTEGRATION_CARD_HEADER_CLASS}>
            <div className={INTEGRATION_CARD_TITLE_CLASS}>Laika</div>
            <span
              className={COMING_SOON_PILL_CLASS}
              style={{
                backgroundColor: 'var(--color-pill-neutral-bg)',
                color: 'var(--color-pill-neutral-text)',
                borderColor: 'var(--color-pill-neutral-border)',
                borderStyle: 'solid',
              }}
            >
              Coming soon
            </span>
          </div>
          <div className="text-body-4 text-text-secondary line-clamp-4">
            AI-powered diagnostic support for veterinary clinicians &mdash; interpret lab results,
            reason through differentials, and get evidence-based guidance trained exclusively on
            veterinary medical data.
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex w-full items-center justify-end">
            <Primary href="#" text="Coming soon" isDisabled className="w-full max-w-[160px] px-4" />
          </div>
        </div>
      </div>
    </div>
  );
};

const IntegrationCards = ({
  s,
  idexxCardButtonLabel,
  merckCardButtonLabel,
}: {
  s: IntegrationsPageState;
  idexxCardButtonLabel: string;
  merckCardButtonLabel: string;
}) => {
  if (!s.showIdexxCard && !s.showMerckCard && s.activeFilter === 'connected') return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
      <IdexxIntegrationCard s={s} buttonLabel={idexxCardButtonLabel} />
      <MerckIntegrationCard s={s} buttonLabel={merckCardButtonLabel} />
      <RadIntegrationCard activeFilter={s.activeFilter} />
      <VetnioIntegrationCard activeFilter={s.activeFilter} />
      <QuickBooksIntegrationCard activeFilter={s.activeFilter} />
      <LaikaIntegrationCard activeFilter={s.activeFilter} />
    </div>
  );
};

const PANEL_FIELD_VALUE_CLASS =
  'flex items-center h-[42px] px-[13px] bg-[var(--field-bg)] border-[1.5px] border-[var(--hairline)] rounded-[12px] text-[13.5px] text-[var(--ink-body)]';
const PANEL_FIELD_LABEL_CLASS = 'text-[12.5px] font-semibold text-[var(--ink-soft)]';

const metaFieldValue = (value?: string | null): string =>
  String(value ?? '').trim() || 'Not available';

const CredentialsPanelHeaderStatus = ({ validateState }: { validateState: ValidateState }) => {
  if (validateState === 'valid') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-[var(--success)]">
        <IoCheckmarkCircle size={13} aria-hidden="true" />
        Credentials validated successfully
      </span>
    );
  }
  if (validateState === 'invalid') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-text-error">
        <IoAlertCircleOutline size={13} aria-hidden="true" />
        Credentials invalid
      </span>
    );
  }
  return (
    <span className="text-[11.5px] font-semibold text-[var(--ink-faint)]">Awaiting validation</span>
  );
};

const RecentOrdersList = ({ orders }: { orders: LabOrder[] }) => {
  const rows = buildRecentOrderRows(orders);
  if (rows.length === 0) {
    return <span className="text-[12.5px] text-[var(--ink-muted)]">No recent orders yet</span>;
  }
  return (
    <>
      {rows.map((row) => (
        <span key={row.key} className="flex items-center justify-between gap-2 text-[12.5px]">
          <span className="min-w-0 truncate font-semibold text-[var(--ink-body)]">
            {row.patient} &middot; {row.description}
          </span>
          <span
            className="shrink-0 inline-flex items-center rounded-full! border! px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.02em]"
            style={{
              backgroundColor: row.tokens.bg,
              color: row.tokens.text,
              borderColor: row.tokens.border,
              borderStyle: 'solid',
            }}
          >
            {row.statusLabel}
          </span>
        </span>
      ))}
    </>
  );
};

const IdexxCredentialsPanel = ({ s }: { s: IntegrationsPageState }) => (
  <aside
    aria-label="IDEXX credentials"
    className="flex flex-col overflow-hidden rounded-[18px] border border-[var(--hairline)] bg-[var(--screen)] shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)]"
  >
    <div className="flex items-center justify-between gap-2 border-b border-[var(--hairline)] px-5 pt-[18px] pb-[14px]">
      <span className="text-[15px] font-bold tracking-[-0.01em] text-[var(--ink)]">
        IDEXX credentials
      </span>
      <CredentialsPanelHeaderStatus validateState={s.validateState} />
    </div>

    <div className="flex flex-col gap-[14px] px-5 py-[18px]">
      <div className="flex flex-col gap-1.5">
        <span className={PANEL_FIELD_LABEL_CLASS}>VetConnect username</span>
        <span className={PANEL_FIELD_VALUE_CLASS}>
          {metaFieldValue(s.credentialMeta?.username)}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={PANEL_FIELD_LABEL_CLASS}>Password</span>
        <span className={clsx(PANEL_FIELD_VALUE_CLASS, 'justify-between')}>
          <span>{MASKED_PASSWORD}</span>
          <IoEyeOutline size={15} aria-hidden="true" className="text-[var(--ink-faint)]" />
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={PANEL_FIELD_LABEL_CLASS}>Practice ID</span>
        <span className={clsx(PANEL_FIELD_VALUE_CLASS, 'tabular-nums')}>
          {metaFieldValue(s.credentialMeta?.practiceId)}
        </span>
      </div>
      <button
        type="button"
        onClick={() => {
          s.handleValidate().catch(() => undefined);
        }}
        disabled={s.saving}
        className="flex h-10 items-center justify-center rounded-full! border border-[var(--divider)] text-[13px] font-semibold text-[var(--ink-body)] transition-colors hover:bg-[var(--inset)] disabled:opacity-60"
      >
        {s.saving ? 'Re-validating…' : 'Re-validate credentials'}
      </button>
    </div>

    <div className="mt-auto flex flex-col gap-[9px] border-t border-[var(--hairline)] px-5 py-[14px]">
      <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--ink-faint)]">
        Recent orders
      </span>
      <RecentOrdersList orders={s.recentOrders} />
    </div>
  </aside>
);

const IntegrationsPage = () => {
  const s = useIntegrationsPage();
  const { showNoConnected, showNoAvailable } = getIntegrationEmptyState(
    s.integrationStatus,
    s.activeFilter,
    s.idexxEnabled,
    s.merckEnabled
  );
  const idexxCardButtonLabel = getIdexxCardButtonLabel(s.saving, s.idexxEnabled);
  const merckCardButtonLabel = getIdexxCardButtonLabel(s.merckSaving, s.merckEnabled);
  // Only mount the right-hand credentials panel when the IDEXX card itself is
  // visible under the active filter, so filtering to "Available" (which hides a
  // connected IDEXX card) does not leave the panel orphaned in the grid.
  const showIdexxPanel = s.showIdexxCard && s.idexxEnabled;

  return (
    <div className="yc-page-content">
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <h1 className="text-text-primary text-page-title flex items-center gap-2">
            <span>Integrations</span>
            <GlassTooltip
              content={`Connect and manage external tools for ${
                s.primaryOrg?.name ?? 'your organization'
              }, including diagnostics, clinical knowledge, communication, and operational workflows.`}
              side="bottom"
            >
              <button
                type="button"
                aria-label="Integrations info"
                className="inline-flex size-5 shrink-0 items-center justify-center leading-none translate-y-px text-text-secondary hover:text-text-primary transition-colors"
              >
                <IoInformationCircleOutline size={20} />
              </button>
            </GlassTooltip>
          </h1>
          <p className="text-body-4 text-text-secondary">
            Connect labs, references and devices to the workspace
          </p>
        </div>
        <div className="ml-auto flex items-start justify-end gap-3 flex-wrap">
          <div className="text-body-4 text-text-secondary rounded-full border border-[var(--hairline)] px-4 py-2">
            Active integrations: <span className="text-text-primary">{s.linkedCount}</span>
          </div>
          <IntegrationFilterTabs
            activeFilter={s.activeFilter}
            setActiveFilter={s.setActiveFilter}
          />
        </div>
      </div>

      {s.error ? (
        <div role="alert" className="text-body-4 text-text-error">
          {s.error}
        </div>
      ) : null}

      <div
        className={clsx(
          'grid items-start gap-4',
          showIdexxPanel ? 'grid-cols-1 lg:grid-cols-[1.5fr_1fr]' : 'grid-cols-1'
        )}
      >
        <div className="flex min-w-0 flex-col gap-4">
          <IntegrationCards
            s={s}
            idexxCardButtonLabel={idexxCardButtonLabel}
            merckCardButtonLabel={merckCardButtonLabel}
          />

          <div className="flex items-center gap-2.5 rounded-[14px] bg-[var(--inset)] px-4 py-3 text-[12.5px] text-[var(--ink-muted)]">
            <IoExtensionPuzzleOutline
              size={15}
              aria-hidden="true"
              className="shrink-0 text-[var(--blue-text)]"
            />
            More integrations ship as plugins. Browse the developer portal&apos;s plugin catalog.
          </div>

          {showNoConnected ? (
            <output className="text-body-4 text-text-secondary">
              No connected integrations yet.
            </output>
          ) : null}

          {showNoAvailable ? (
            <output className="text-body-4 text-text-secondary">
              No available integrations right now.
            </output>
          ) : null}
        </div>

        {showIdexxPanel ? <IdexxCredentialsPanel s={s} /> : null}
      </div>

      <IdexxSettingsModal
        showSettings={s.showSettings}
        setShowSettings={s.setShowSettings}
        idexxIntegration={s.idexxIntegration}
        idexxEnabled={s.idexxEnabled}
        hasStoredCredentials={s.hasStoredCredentials}
        credentialsStatusKey={s.credentialsStatusKey}
        credentialsStatusLabel={s.credentialsStatusLabel}
        credentialsActionLabel={s.credentialsActionLabel}
        validateState={s.validateState}
        saving={s.saving}
        refreshing={s.refreshing}
        integrationsLastFetchedAt={s.integrationsLastFetchedAt}
        devices={s.devices}
        username={s.username}
        setUsername={s.setUsername}
        password={s.password}
        setPassword={s.setPassword}
        handleManualRefresh={s.handleManualRefresh}
        handleStoreCredentials={s.handleStoreCredentials}
        handleValidate={s.handleValidate}
        handleEnableDisable={s.handleEnableDisable}
      />
    </div>
  );
};

const ProtectedIntegrations = () => (
  <ProtectedRoute skeleton={INTEGRATIONS_PAGE_SKELETON}>
    <OrgGuard skeleton={INTEGRATIONS_PAGE_SKELETON}>
      <IntegrationsPage />
    </OrgGuard>
  </ProtectedRoute>
);

export default ProtectedIntegrations;
