'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';
import '@/app/features/integrations/pages/Integrations/integrations.css';

const INTEGRATIONS_PAGE_SKELETON = <PageSkeleton variant="list" />;
import Modal from '@/app/ui/overlays/Modal';
import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import FormInputPass from '@/app/ui/inputs/FormInputPass/FormInputPass';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { useOrgStore } from '@/app/stores/orgStore';
import { usePrimaryOrg } from '@/app/hooks/useOrgSelectors';
import { useHasPermission } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';
import {
  loadIntegrationsForPrimaryOrg,
  useIntegrationByProviderForPrimaryOrg,
  useIntegrationsForPrimaryOrg,
} from '@/app/hooks/useIntegrations';
import { useIntegrationStore } from '@/app/stores/integrationStore';
import { formatDateTimeLocal } from '@/app/lib/date';
import {
  disableIntegration,
  enableIntegration,
  getApiErrorMessage,
  listIdexxIvlsDevices,
  listIdexxOrders,
  storeIntegrationCredentials,
  validateIntegrationCredentials,
} from '@/app/features/integrations/services/idexxService';
import { IvlsDevice, LabOrder } from '@/app/features/integrations/services/types';
import { getMerckGateway } from '@/app/features/integrations/services/merckService';
import { useResolvedMerckIntegrationForPrimaryOrg } from '@/app/hooks/useMerckIntegration';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import {
  IoBookOutline,
  IoExtensionPuzzleOutline,
  IoInformationCircleOutline,
  IoRefreshOutline,
  IoSettingsOutline,
  IoTrashOutline,
} from 'react-icons/io5';
import clsx from 'clsx';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import SharedStatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import { useConfirm } from '@/app/ui/overlays/Modal/ConfirmModal';

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
  'coming-soon': {
    bg: 'var(--color-pill-neutral-bg)',
    text: 'var(--color-pill-neutral-text)',
    border: 'var(--color-pill-neutral-border)',
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
  { key: 'coming-soon', label: 'Coming soon' },
] as const;

type IntegrationFilterKey = (typeof integrationFilters)[number]['key'];

// Total number of integration cards the page ships, surfaced beside the title.
const TOTAL_INTEGRATIONS = 6;

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

// Coming-soon integrations cannot be connected or enabled, so they belong only in the
// unfiltered list and in the dedicated "Coming soon" tab - never under Connected or Available.
const shouldShowComingSoonCards = (activeFilter: IntegrationFilterKey): boolean =>
  activeFilter === 'all' || activeFilter === 'coming-soon';

const hasVisibleIntegrationCards = (
  activeFilter: IntegrationFilterKey,
  showIdexxCard: boolean,
  showMerckCard: boolean
): boolean => showIdexxCard || showMerckCard || shouldShowComingSoonCards(activeFilter);

const getIntegrationEmptyState = (
  integrationStatus: string,
  activeFilter: IntegrationFilterKey,
  showIdexxCard: boolean,
  showMerckCard: boolean
) => {
  const isReady = integrationStatus !== 'loading';
  // Derived from card visibility so an empty-state message can never render beside a visible card.
  const isEmpty = !hasVisibleIntegrationCards(activeFilter, showIdexxCard, showMerckCard);
  return {
    showNoConnected: isReady && activeFilter === 'connected' && isEmpty,
    showNoAvailable: isReady && activeFilter === 'available' && isEmpty,
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
        <StatusPill label={statusLabel} tokens={dt} showDot={statusKey === 'active'} />
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

// Resolves this page's status keys (enabled/disabled/valid/active/…) to the
// shared StatusPill, keeping the key semantics and the enabled-only live dot so
// no call site changes. Colours still come from the local token maps.
const NEUTRAL_FALLBACK_TOKENS: StatusTokens = {
  bg: 'var(--color-card-hover)',
  text: 'var(--color-text-secondary)',
  border: 'var(--color-card-border)',
};

const StatusPill = ({
  status,
  label,
  tokens: tokensOverride,
  showDot,
}: {
  status?: string;
  label?: string;
  // Pills whose colours come from a different map (device, credentials) pass
  // their tokens directly; everything else looks the key up in statusTokens.
  tokens?: StatusTokens;
  showDot?: boolean;
}) => {
  const key = (status ?? 'disabled').toLowerCase();
  const normalizedLabel = label ?? `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
  const tokens = tokensOverride ?? statusTokens[key] ?? NEUTRAL_FALLBACK_TOKENS;
  return (
    <SharedStatusPill
      label={normalizedLabel}
      tokens={tokens}
      showDot={showDot ?? key === 'enabled'}
    />
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

const ORDER_PILL_RESULTED = new Set(['result', 'complete', 'final', 'confirm']);
const ORDER_PILL_RUNNING = new Set(['run', 'pending', 'progress', 'process', 'partial']);

const getOrderPillTokens = (status?: string | null): StatusTokens => {
  const key = String(status ?? '').toLowerCase();
  if ([...ORDER_PILL_RESULTED].some((token) => key.includes(token))) {
    return {
      bg: 'var(--color-pill-success-bg)',
      text: 'var(--color-pill-success-text)',
      border: 'var(--color-pill-success-border)',
    };
  }
  if ([...ORDER_PILL_RUNNING].some((token) => key.includes(token))) {
    return {
      bg: 'var(--color-pill-progress-bg)',
      text: 'var(--color-pill-progress-text)',
      border: 'var(--color-pill-progress-border)',
    };
  }
  return {
    bg: 'var(--color-pill-neutral-bg)',
    text: 'var(--color-pill-neutral-text)',
    border: 'var(--color-pill-neutral-border)',
  };
};

const formatOrderStatusLabel = (status?: string | null): string => {
  const raw = String(status ?? '').trim();
  if (!raw) return 'Pending';
  return `${raw.charAt(0).toUpperCase()}${raw.slice(1).toLowerCase()}`;
};

const formatOrderLabel = (order: LabOrder): string => {
  const name = String(order.patientName ?? '').trim();
  const tests = (order.tests ?? []).filter(Boolean).join(', ');
  if (name && tests) return `${name} · ${tests}`;
  return name || tests || `Order ${order.idexxOrderId}`;
};

const RecentOrdersList = ({ orders }: { orders: LabOrder[] }) => {
  if (orders.length === 0) {
    return <div className="text-body-4 text-text-secondary">No recent orders.</div>;
  }

  return (
    <>
      {orders.slice(0, 3).map((order) => {
        const tokens = getOrderPillTokens(order.status);
        return (
          <div
            key={order._id || order.idexxOrderId}
            className="flex items-center justify-between gap-2 text-caption-1"
          >
            <span className="min-w-0 truncate font-semibold text-text-primary">
              {formatOrderLabel(order)}
            </span>
            <StatusPill label={formatOrderStatusLabel(order.status)} tokens={tokens} />
          </div>
        );
      })}
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
  const { confirm, confirmDialog } = useConfirm();
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
      const ok = await confirm({
        title: 'Disconnect IDEXX?',
        body: 'Lab ordering and result syncing stop for this organization until IDEXX is enabled again.',
        confirmLabel: 'Disconnect',
        tone: 'danger',
      });
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
  }, [s, validateBeforeEnable, confirm]);

  return {
    handleManualRefresh,
    handleStoreCredentials,
    handleValidate,
    handleEnableDisable,
    confirmDialog,
  };
};

const useIntegrationsPage = () => {
  const primaryOrg = usePrimaryOrg();
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  // Most roles can view the catalog but not change it: the backend requires
  // integrations:edit:any for the credentials, enable, disable and validate
  // routes, so those controls stay hidden rather than 403 on click.
  const canEditIntegrations = useHasPermission(PERMISSIONS.INTEGRATIONS_EDIT_ANY);
  // Supervisor, Assistant and Receptionist can view the catalog without holding
  // labs:view:any, and the device/order loaders hit lab routes that require it,
  // so those reads are skipped rather than failing the page on open.
  const canViewLabs = useHasPermission(PERMISSIONS.LABS_VIEW_ANY);
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
  const [recentOrders, setRecentOrders] = useState<LabOrder[]>([]);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [merckSaving, setMerckSaving] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [validateState, setValidateState] = useState<ValidateState>(() =>
    resolveValidateState(idexxIntegration?.credentialsStatus)
  );
  const [activeFilter, setActiveFilter] = useState<IntegrationFilterKey>('all');
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
      if (!canViewLabs) {
        // Losing lab access (org switch, or the permission revoked) must drop
        // anything fetched under the previous one, or the settings modal keeps
        // rendering stale devices and orders.
        setDevices([]);
        setRecentOrders([]);
        return;
      }
      if (idexxIntegration?.status === 'enabled') {
        try {
          const ivls = await listIdexxIvlsDevices(primaryOrgId);
          setDevices(ivls.ivlsDeviceList ?? []);
        } catch (e) {
          setDevices([]);
          setError(getApiErrorMessage(e, 'Unable to load linked IDEXX devices.'));
        }
        // Recent orders feed the settings modal's activity section. They are secondary to the
        // devices load, so a failure here is swallowed rather than surfaced as an error.
        try {
          const orders = await listIdexxOrders({ organisationId: primaryOrgId });
          setRecentOrders(orders);
        } catch {
          setRecentOrders([]);
        }
      } else {
        setDevices([]);
        setRecentOrders([]);
      }
    };
    run().catch(() => undefined);
  }, [primaryOrgId, idexxIntegration?.status, canViewLabs]);

  // Render-phase adjustment: follow the stored credentials status whenever it
  // changes without clobbering later local validate-state updates.
  const [syncedCredentialsStatus, setSyncedCredentialsStatus] = useState(
    idexxIntegration?.credentialsStatus
  );
  if (idexxIntegration?.credentialsStatus !== syncedCredentialsStatus) {
    setSyncedCredentialsStatus(idexxIntegration?.credentialsStatus);
    setValidateState(resolveValidateState(idexxIntegration?.credentialsStatus));
  }

  const {
    handleManualRefresh,
    handleStoreCredentials,
    handleValidate,
    handleEnableDisable,
    confirmDialog,
  } = useIdexxActions({
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
    confirmDialog,
    primaryOrg,
    primaryOrgId,
    canEditIntegrations,
    canViewLabs,
    integrationStatus,
    integrationsLastFetchedAt,
    idexxIntegration,
    idexxStatus,
    idexxEnabled,
    devices,
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

const INTEGRATION_SETTINGS_TITLE_ID = 'integration-settings-title';

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
  recentOrders,
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
  recentOrders: LabOrder[];
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
    <Modal
      showModal={showSettings}
      setShowModal={setShowSettings}
      aria-labelledby={INTEGRATION_SETTINGS_TITLE_ID}
    >
      <div className="flex flex-col h-full gap-4">
        <ModalHeader
          title="Integration settings"
          meta="Configure IDEXX for this organization"
          onClose={() => setShowSettings(false)}
          titleId={INTEGRATION_SETTINGS_TITLE_ID}
        />
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--hairline)] px-3 py-2 bg-[var(--field-bg)]">
          <div className="text-caption-1 text-text-secondary">
            Last refreshed: <span className="text-text-primary">{lastRefreshedText}</span>
          </div>
          <Secondary
            size="compact"
            text="Refresh"
            ariaLabel="Refresh integrations"
            icon={<IoRefreshOutline className={refreshIconClass} aria-hidden="true" />}
            onClick={() => {
              handleManualRefresh().catch(() => undefined);
            }}
            isDisabled={refreshing}
          />
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
                  <StatusPill
                    label={credentialsStatusLabel}
                    tokens={credentialsStatusTokens[credentialsStatusKey]}
                  />
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

          <Accordion title="Recent orders" defaultOpen showEditIcon={false} isEditing>
            <div className="flex flex-col gap-2 py-2">
              <RecentOrdersList orders={recentOrders} />
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
            'rounded-full! border px-[13px] py-1.5 text-[12px] whitespace-nowrap transition-colors',
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

// Compact integration card — design: 16px/18px padding, 18px radius, a 10px
// column gap and a 42px inline icon leading the title row.
const INTEGRATION_CARD_CLASS =
  'rounded-[18px] border px-[18px] py-4 w-full flex flex-col gap-2.5 shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)]';
const INTEGRATION_CARD_STYLE: React.CSSProperties = {
  background: 'var(--screen)',
  borderColor: 'var(--hairline)',
};
const INTEGRATION_CARD_HEADER_CLASS = 'flex items-center gap-3';
const INTEGRATION_CARD_TITLE_CLASS =
  'min-w-0 flex-1 truncate text-[14.5px] font-bold tracking-[-0.01em]';
const INTEGRATION_CARD_TITLE_STYLE: React.CSSProperties = { color: 'var(--ink)' };
const INTEGRATION_CARD_DESC_CLASS = 'text-[12.5px] leading-[1.55] line-clamp-4';
const INTEGRATION_CARD_DESC_STYLE: React.CSSProperties = { color: 'var(--ink-muted)' };
const INTEGRATION_CARD_ACTIONS_CLASS = 'mt-auto flex flex-wrap items-center gap-2 pt-0.5';
// 42x42 / radius 13 icon chip that leads each card header.
const INTEGRATION_ICON_CLASS =
  'flex size-[42px] shrink-0 items-center justify-center rounded-[13px] text-[12px] font-extrabold tracking-[0.02em]';
const INTEGRATION_ICON_STYLES = {
  idexx: { background: 'var(--spot)', color: 'var(--spot-ink)' },
  merck: { background: 'var(--blue-soft)', color: 'var(--blue-text)' },
  vetnio: { background: 'var(--avatar-green-bg)', color: 'var(--avatar-green-ink)' },
  quickBooks: { background: 'var(--avatar-amber-bg)', color: 'var(--avatar-amber-ink)' },
  radAnalyzer: { background: 'var(--avatar-violet-bg)', color: 'var(--avatar-violet-ink)' },
  laika: { background: 'var(--inset)', color: 'var(--ink-muted)' },
} satisfies Record<string, React.CSSProperties>;

// 32px circular icon buttons that close the card's action row.
const CARD_ICON_BUTTON_CLASS =
  'flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full! transition-colors';
const MANAGE_ICON_BUTTON_STYLE: React.CSSProperties = {
  border: '1.5px solid var(--blue)',
  color: 'var(--blue-text)',
  boxShadow: '0 0 0 3px var(--glow-b10)',
};
const DISCONNECT_ICON_BUTTON_STYLE: React.CSSProperties = {
  border: '1px solid var(--danger-border)',
  color: 'var(--danger-text)',
};

const IdexxIntegrationCard = ({
  s,
  buttonLabel,
}: {
  s: IntegrationsPageState;
  buttonLabel: string;
}) => {
  if (!s.showIdexxCard) return null;

  return (
    <div className={INTEGRATION_CARD_CLASS} style={INTEGRATION_CARD_STYLE}>
      <div className={INTEGRATION_CARD_HEADER_CLASS}>
        <span className={INTEGRATION_ICON_CLASS} style={INTEGRATION_ICON_STYLES.idexx}>
          IDX
        </span>
        <div className={INTEGRATION_CARD_TITLE_CLASS} style={INTEGRATION_CARD_TITLE_STYLE}>
          IDEXX VetConnect PLUS
        </div>
        <StatusPill
          status={s.idexxIntegration?.status}
          label={s.idexxEnabled ? 'Connected' : undefined}
        />
      </div>
      <div className={INTEGRATION_CARD_DESC_CLASS} style={INTEGRATION_CARD_DESC_STYLE}>
        Order in-house and reference lab work from the appointment workspace; results file to the
        patient automatically.
      </div>
      <div className={INTEGRATION_CARD_ACTIONS_CLASS}>
        {s.idexxEnabled && s.canViewLabs && (
          <Secondary
            href="/appointments/idexx-workspace"
            text="Open workspace"
            className="px-4 whitespace-nowrap"
          />
        )}
        {!s.idexxEnabled && s.canEditIntegrations && (
          <Primary
            href="#"
            text={buttonLabel}
            onClick={s.handleEnableDisable}
            isDisabled={s.saving}
            className="px-4 whitespace-nowrap"
          />
        )}
        {s.canEditIntegrations && (
          <button
            type="button"
            onClick={() => s.setShowSettings(true)}
            aria-label="Manage credentials"
            title="Manage"
            className={`${CARD_ICON_BUTTON_CLASS} ml-auto`}
            style={MANAGE_ICON_BUTTON_STYLE}
          >
            <IoSettingsOutline size={14} aria-hidden="true" />
          </button>
        )}
        {s.idexxEnabled && s.canEditIntegrations ? (
          <button
            type="button"
            onClick={s.handleEnableDisable}
            aria-label="Disable IDEXX quick action"
            title="Disable IDEXX quick action"
            className={CARD_ICON_BUTTON_CLASS}
            style={DISCONNECT_ICON_BUTTON_STYLE}
          >
            <IoTrashOutline size={14} aria-hidden="true" />
          </button>
        ) : null}
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
    <div className={INTEGRATION_CARD_CLASS} style={INTEGRATION_CARD_STYLE}>
      <div className={INTEGRATION_CARD_HEADER_CLASS}>
        <span className={INTEGRATION_ICON_CLASS} style={INTEGRATION_ICON_STYLES.merck}>
          <IoBookOutline size={19} aria-hidden="true" />
        </span>
        <div className={INTEGRATION_CARD_TITLE_CLASS} style={INTEGRATION_CARD_TITLE_STYLE}>
          MSD Veterinary Manual
        </div>
        <StatusPill status={s.merckIntegration?.status} />
      </div>
      <div className={INTEGRATION_CARD_DESC_CLASS} style={INTEGRATION_CARD_DESC_STYLE}>
        Search the veterinary manual from the workspace side rail without leaving the visit. Free
        for every clinic.
      </div>
      <div className={INTEGRATION_CARD_ACTIONS_CLASS}>
        {s.merckEnabled && (
          <Secondary
            href="/integrations/merck-manuals"
            text="Open manuals"
            className="px-4 whitespace-nowrap"
          />
        )}
        {!s.merckEnabled && s.canEditIntegrations && (
          <Primary
            href="#"
            text={buttonLabel}
            onClick={s.handleMerckEnableDisable}
            isDisabled={s.merckSaving}
            className="px-4 whitespace-nowrap"
          />
        )}
        {s.merckEnabled && s.canEditIntegrations ? (
          <button
            type="button"
            onClick={s.handleMerckEnableDisable}
            aria-label="Disable MSD Veterinary Manual"
            title="Disable MSD Veterinary Manual"
            className={`${CARD_ICON_BUTTON_CLASS} ml-auto`}
            style={DISCONNECT_ICON_BUTTON_STYLE}
          >
            <IoTrashOutline size={14} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
};

const RadIntegrationCard = ({
  activeFilter,
}: {
  activeFilter: IntegrationsPageState['activeFilter'];
}) => {
  if (!shouldShowComingSoonCards(activeFilter)) return null;

  return (
    <div className={INTEGRATION_CARD_CLASS} style={INTEGRATION_CARD_STYLE}>
      <div className={INTEGRATION_CARD_HEADER_CLASS}>
        <span className={INTEGRATION_ICON_CLASS} style={INTEGRATION_ICON_STYLES.radAnalyzer}>
          RA
        </span>
        <div className={INTEGRATION_CARD_TITLE_CLASS} style={INTEGRATION_CARD_TITLE_STYLE}>
          RadAnalyzer
        </div>
        <StatusPill status="coming-soon" label="Coming soon" />
      </div>
      <div className={INTEGRATION_CARD_DESC_CLASS} style={INTEGRATION_CARD_DESC_STYLE}>
        Imaging and analyzer connectivity for diagnostic workflows in Yosemite Crew.
      </div>
      <div className={INTEGRATION_CARD_ACTIONS_CLASS}>
        <span
          className="inline-flex min-h-10 items-center justify-center rounded-full! px-4 text-[13.5px] font-semibold whitespace-nowrap select-none"
          style={{
            background: 'transparent',
            color: 'var(--ink-body)',
            border: '1px solid var(--divider)',
          }}
        >
          Notify me
        </span>
      </div>
    </div>
  );
};

const VetnioIntegrationCard = ({
  activeFilter,
}: {
  activeFilter: IntegrationsPageState['activeFilter'];
}) => {
  if (!shouldShowComingSoonCards(activeFilter)) return null;

  return (
    <div className={INTEGRATION_CARD_CLASS} style={INTEGRATION_CARD_STYLE}>
      <div className={INTEGRATION_CARD_HEADER_CLASS}>
        <span className={INTEGRATION_ICON_CLASS} style={INTEGRATION_ICON_STYLES.vetnio}>
          VN
        </span>
        <div className={INTEGRATION_CARD_TITLE_CLASS} style={INTEGRATION_CARD_TITLE_STYLE}>
          Vetnio
        </div>
        <StatusPill status="coming-soon" label="Coming soon" />
      </div>
      <div className={INTEGRATION_CARD_DESC_CLASS} style={INTEGRATION_CARD_DESC_STYLE}>
        AI-powered documentation for veterinary practices &mdash; instantly generate clinical notes,
        discharge summaries, and client communications from consultations.
      </div>
      <div className={INTEGRATION_CARD_ACTIONS_CLASS}>
        <span
          className="inline-flex min-h-10 items-center justify-center rounded-full! px-4 text-[13.5px] font-semibold whitespace-nowrap select-none"
          style={{
            background: 'transparent',
            color: 'var(--ink-body)',
            border: '1px solid var(--divider)',
          }}
        >
          Notify me
        </span>
      </div>
    </div>
  );
};

const QuickBooksIntegrationCard = ({
  activeFilter,
}: {
  activeFilter: IntegrationsPageState['activeFilter'];
}) => {
  if (!shouldShowComingSoonCards(activeFilter)) return null;

  return (
    <div className={INTEGRATION_CARD_CLASS} style={INTEGRATION_CARD_STYLE}>
      <div className={INTEGRATION_CARD_HEADER_CLASS}>
        <span className={INTEGRATION_ICON_CLASS} style={INTEGRATION_ICON_STYLES.quickBooks}>
          QB
        </span>
        <div className={INTEGRATION_CARD_TITLE_CLASS} style={INTEGRATION_CARD_TITLE_STYLE}>
          QuickBooks
        </div>
        <StatusPill status="coming-soon" label="Coming soon" />
      </div>
      <div className={INTEGRATION_CARD_DESC_CLASS} style={INTEGRATION_CARD_DESC_STYLE}>
        Accounting sync for invoices, payments, customers, and financial workflows through
        QuickBooks Online.
      </div>
      <div className={INTEGRATION_CARD_ACTIONS_CLASS}>
        <span
          className="inline-flex min-h-10 items-center justify-center rounded-full! px-4 text-[13.5px] font-semibold whitespace-nowrap select-none"
          style={{
            background: 'transparent',
            color: 'var(--ink-body)',
            border: '1px solid var(--divider)',
          }}
        >
          Notify me
        </span>
      </div>
    </div>
  );
};

const LaikaIntegrationCard = ({
  activeFilter,
}: {
  activeFilter: IntegrationsPageState['activeFilter'];
}) => {
  if (!shouldShowComingSoonCards(activeFilter)) return null;

  return (
    <div className={INTEGRATION_CARD_CLASS} style={INTEGRATION_CARD_STYLE}>
      <div className={INTEGRATION_CARD_HEADER_CLASS}>
        <span className={INTEGRATION_ICON_CLASS} style={INTEGRATION_ICON_STYLES.laika}>
          LK
        </span>
        <div className={INTEGRATION_CARD_TITLE_CLASS} style={INTEGRATION_CARD_TITLE_STYLE}>
          Laika
        </div>
        <StatusPill status="coming-soon" label="Coming soon" />
      </div>
      <div className={INTEGRATION_CARD_DESC_CLASS} style={INTEGRATION_CARD_DESC_STYLE}>
        AI-powered diagnostic support for veterinary clinicians &mdash; interpret lab results,
        reason through differentials, and get evidence-based guidance trained exclusively on
        veterinary medical data.
      </div>
      <div className={INTEGRATION_CARD_ACTIONS_CLASS}>
        <span
          className="inline-flex min-h-10 items-center justify-center rounded-full! px-4 text-[13.5px] font-semibold whitespace-nowrap select-none"
          style={{
            background: 'transparent',
            color: 'var(--ink-body)',
            border: '1px solid var(--divider)',
          }}
        >
          Notify me
        </span>
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
  if (!hasVisibleIntegrationCards(s.activeFilter, s.showIdexxCard, s.showMerckCard)) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-stretch">
      <IdexxIntegrationCard s={s} buttonLabel={idexxCardButtonLabel} />
      <MerckIntegrationCard s={s} buttonLabel={merckCardButtonLabel} />
      <RadIntegrationCard activeFilter={s.activeFilter} />
      <VetnioIntegrationCard activeFilter={s.activeFilter} />
      <QuickBooksIntegrationCard activeFilter={s.activeFilter} />
      <LaikaIntegrationCard activeFilter={s.activeFilter} />
    </div>
  );
};

const IntegrationsPage = () => {
  const s = useIntegrationsPage();
  const { showNoConnected, showNoAvailable } = getIntegrationEmptyState(
    s.integrationStatus,
    s.activeFilter,
    s.showIdexxCard,
    s.showMerckCard
  );
  const idexxCardButtonLabel = getIdexxCardButtonLabel(s.saving, s.idexxEnabled);
  const merckCardButtonLabel = getIdexxCardButtonLabel(s.merckSaving, s.merckEnabled);

  return (
    <div className="yc-page-content">
      {s.confirmDialog}
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title flex items-center gap-2">
            <span>Integrations</span>
            <span className="text-page-title-count">({TOTAL_INTEGRATIONS})</span>
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
          <div className="yc-integrations-active-pill">
            <span aria-hidden="true" className="yc-integrations-active-dot" />
            {s.linkedCount} active
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

      <div className="flex flex-col gap-4">
        <IntegrationCards
          s={s}
          idexxCardButtonLabel={idexxCardButtonLabel}
          merckCardButtonLabel={merckCardButtonLabel}
        />

        <div className="yc-integrations-plugin-strip">
          <IoExtensionPuzzleOutline
            className="yc-integrations-plugin-strip-icon"
            size={15}
            aria-hidden="true"
          />
          <span className="flex-1">
            More integrations ship as plugins. Browse the developer portal&apos;s plugin catalog.
          </span>
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

      {/* Every control inside the panel hits an integrations:edit:any route, so
          it never mounts for a view-only role - closing the paths that open it
          from a failed validate or enable as well as from the gear. */}
      <IdexxSettingsModal
        showSettings={s.canEditIntegrations && s.showSettings}
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
        recentOrders={s.recentOrders}
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
