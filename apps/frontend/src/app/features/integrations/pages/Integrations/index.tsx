'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
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
import {
  disableIntegration,
  enableIntegration,
  getApiErrorMessage,
  listIdexxIvlsDevices,
  storeIntegrationCredentials,
  validateIntegrationCredentials,
} from '@/app/features/integrations/services/idexxService';
import { IvlsDevice } from '@/app/features/integrations/services/types';
import { getMerckGateway } from '@/app/features/integrations/services/merckService';
import { useResolvedMerckIntegrationForPrimaryOrg } from '@/app/hooks/useMerckIntegration';
import Close from '@/app/ui/primitives/Icons/Close';
import { IoInformationCircleOutline, IoRefreshOutline, IoTrashOutline } from 'react-icons/io5';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';

const statusClasses: Record<string, string> = {
  enabled: 'bg-green-50 text-green-800',
  disabled: 'bg-amber-50 text-amber-700',
  error: 'bg-red-50 text-red-700',
  pending: 'bg-blue-50 text-blue-700',
};

const credentialsStatusClasses: Record<string, string> = {
  valid: 'bg-green-50 text-green-800',
  invalid: 'bg-red-50 text-red-700',
  missing: 'bg-amber-50 text-amber-700',
};
const IDEXX_REGIONAL_AVAILABILITY_DISCLAIMER =
  'IDEXX integration availability is currently limited to the USA, Canada, and the UK.';

const integrationFilters = [
  { key: 'all', label: 'All', bg: '#247AED', text: '#EAF3FF' },
  { key: 'connected', label: 'Connected', bg: '#F1D4B0', text: '#302f2e' },
  { key: 'available', label: 'Available', bg: '#D9A488', text: '#F7F7F7' },
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

const DeviceCard = ({ device }: { device: IvlsDevice }) => {
  const statusKey = String(device.vcpActivatedStatus || 'unknown').toLowerCase();
  const statusLabel = `${statusKey.charAt(0).toUpperCase()}${statusKey.slice(1)}`;
  const statusClass =
    statusKey === 'active' ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-700';
  return (
    <div key={device.deviceSerialNumber} className="rounded-2xl border border-card-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-body-4 text-text-primary">{device.displayName || 'IVLS device'}</div>
          <div className="text-caption-1 text-text-secondary mt-0.5">
            {device.deviceSerialNumber}
          </div>
        </div>
        <span className={`text-label-xsmall px-2 py-1 rounded-2xl! ${statusClass}`}>
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

const StatusPill = ({ status }: { status?: string }) => {
  const key = (status ?? 'disabled').toLowerCase();
  const normalizedLabel = `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
  return (
    <span
      className={`text-label-xsmall px-2 py-1 rounded-2xl! ${statusClasses[key] ?? 'bg-card-hover text-text-secondary'}`}
    >
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
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [merckSaving, setMerckSaving] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [validateState, setValidateState] = useState<ValidateState>('idle');
  const [activeFilter, setActiveFilter] = useState<'all' | 'connected' | 'available'>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (integrationError) setError(integrationError);
  }, [integrationError]);

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
    const enabledProviders = new Set(
      integrations
        .filter((integration) => integration.status?.toLowerCase() === 'enabled')
        .map((integration) => integration.provider)
    );
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
            <div className="text-heading-3 text-text-primary">Integration settings</div>
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
            className="h-8 w-8 rounded-full! border border-card-border flex items-center justify-center text-text-primary hover:bg-card-hover"
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
                    className={`text-label-xsmall px-2 py-1 rounded-2xl! ${
                      credentialsStatusClasses[credentialsStatusKey] ??
                      'bg-card-hover text-text-secondary'
                    }`}
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
  <div className="flex items-center gap-2 flex-wrap">
    {integrationFilters.map((tab) => {
      const isActive = activeFilter === tab.key;
      return (
        <button
          key={tab.key}
          type="button"
          onClick={() => setActiveFilter(tab.key)}
          className="min-w-20 text-body-4 px-3 py-[6px] rounded-2xl! border border-card-border! transition-all duration-300 hover:bg-card-hover hover:border-card-hover! text-text-tertiary"
          style={isActive ? { backgroundColor: tab.bg, color: tab.text } : undefined}
        >
          {tab.label}
        </button>
      );
    })}
  </div>
);

const IdexxIntegrationCard = ({
  s,
  buttonLabel,
}: {
  s: IntegrationsPageState;
  buttonLabel: string;
}) => {
  if (!s.showIdexxCard) return null;

  return (
    <div className="rounded-2xl border border-card-border p-4 w-full md:flex-1 md:min-w-[320px] xl:max-w-[430px] flex items-stretch gap-4 min-h-[245px]">
      <div className="shrink-0 w-[72px] flex flex-col items-center justify-between">
        <div className="h-[72px] w-[72px] rounded-xl border border-card-border bg-white p-2 flex items-center justify-center">
          <Image
            src={MEDIA_SOURCES.futureAssets.idexxLogoUrl}
            alt="IDEXX"
            width={56}
            height={56}
            className="object-contain max-h-[56px] max-w-[56px] h-auto w-auto"
          />
        </div>
        {s.idexxEnabled ? (
          <button
            type="button"
            onClick={s.handleEnableDisable}
            aria-label="Disable IDEXX quick action"
            title="Disable IDEXX quick action"
            className="h-10 w-10 rounded-2xl! border border-red-200 flex items-center justify-center hover:bg-red-50 transition-colors cursor-pointer"
          >
            <IoTrashOutline className="text-red-600" size={16} />
          </button>
        ) : (
          <div className="h-10 w-10" />
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div className="flex flex-col gap-3 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="text-heading-3 text-text-primary pt-1">IDEXX</div>
            <StatusPill status={s.idexxIntegration?.status} />
          </div>
          <div className="text-body-4 text-text-secondary line-clamp-4">
            Yosemite Crew integrates with IDEXX Reference Laboratories and their point-of-care
            diagnostics for a seamless workflow.
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 w-full items-center">
          <Secondary
            href="#"
            text="Settings"
            onClick={() => s.setShowSettings(true)}
            className="w-full px-4"
          />
          {s.idexxEnabled ? (
            <Primary href="/appointments/idexx-workspace" text="View" className="w-full px-4" />
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
    <div className="rounded-2xl border border-card-border p-4 w-full md:flex-1 md:min-w-[320px] xl:max-w-[430px] flex items-stretch gap-4 min-h-[245px]">
      <div className="shrink-0 w-[72px] flex flex-col items-center justify-between">
        <div className="h-[72px] w-[72px] rounded-xl border border-card-border bg-white p-2 flex items-center justify-center">
          <Image
            src={MEDIA_SOURCES.futureAssets.msdLogoUrl}
            alt="MSD Veterinary Manual"
            width={60}
            height={60}
            className="object-contain max-h-[60px] max-w-[60px] h-auto w-auto"
          />
        </div>
        {s.merckEnabled ? (
          <button
            type="button"
            onClick={s.handleMerckEnableDisable}
            aria-label="Disable MSD Veterinary Manual"
            title="Disable MSD Veterinary Manual"
            className="h-10 w-10 rounded-2xl! border border-red-200 flex items-center justify-center hover:bg-red-50 transition-colors cursor-pointer"
          >
            <IoTrashOutline className="text-red-600" size={16} />
          </button>
        ) : (
          <div className="h-10 w-10" />
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div className="flex flex-col gap-3 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="text-heading-3 text-text-primary pt-1">MSD Veterinary Manual</div>
            <StatusPill status={s.merckIntegration?.status} />
          </div>
          <div className="text-body-4 text-text-secondary line-clamp-4">
            Veterinary manuals search and reader experience with professional and consumer content
            modes.
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex w-full items-center justify-end">
            {s.merckEnabled ? (
              <Primary
                href="/integrations/merck-manuals"
                text="View"
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
    <div className="rounded-2xl border border-card-border p-4 w-full md:flex-1 md:min-w-[320px] xl:max-w-[430px] flex items-stretch gap-4 min-h-[245px]">
      <div className="shrink-0 w-[72px] flex flex-col items-center justify-between">
        <div className="h-[72px] w-[72px] rounded-xl border border-card-border bg-white p-2 flex items-center justify-center overflow-hidden">
          <Image
            src={MEDIA_SOURCES.futureAssets.radAnalyzerLogoUrl}
            alt="RadAnalyzer"
            width={56}
            height={56}
            className="object-contain max-h-[56px] max-w-[56px] h-auto w-auto"
          />
        </div>
        <div className="h-10 w-10" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div className="flex flex-col gap-3 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="text-heading-3 text-text-primary pt-1">RadAnalyzer</div>
            <span className="text-label-xsmall px-2 py-1 rounded-2xl! bg-amber-50 text-amber-700">
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
    <div className="rounded-2xl border border-card-border p-4 w-full md:flex-1 md:min-w-[320px] xl:max-w-[430px] flex items-stretch gap-4 min-h-[245px]">
      <div className="shrink-0 w-[72px] flex flex-col items-center justify-between">
        <div className="h-[72px] w-[72px] rounded-xl border border-card-border bg-white p-2 flex items-center justify-center overflow-hidden">
          <Image
            src={MEDIA_SOURCES.futureAssets.vetnioLogoUrl}
            alt="Vetnio"
            width={56}
            height={56}
            className="object-contain max-h-[56px] max-w-[56px] h-auto w-auto"
          />
        </div>
        <div className="h-10 w-10" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div className="flex flex-col gap-3 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="text-heading-3 text-text-primary pt-1">Vetnio</div>
            <span className="text-label-xsmall px-2 py-1 rounded-2xl! bg-amber-50 text-amber-700">
              Coming soon
            </span>
          </div>
          <div className="text-body-4 text-text-secondary line-clamp-4">
            AI-powered documentation for veterinary practices — instantly generate clinical notes,
            discharge summaries, and client communications from consultations.
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
    <div className="flex flex-wrap gap-4 items-stretch">
      <IdexxIntegrationCard s={s} buttonLabel={idexxCardButtonLabel} />
      <MerckIntegrationCard s={s} buttonLabel={merckCardButtonLabel} />
      <RadIntegrationCard activeFilter={s.activeFilter} />
      <VetnioIntegrationCard activeFilter={s.activeFilter} />
    </div>
  );
};

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

  return (
    <div className="flex flex-col gap-4 pl-3! pr-3! pt-3! pb-3! md:pl-5! md:pr-5! md:pt-5! md:pb-5! lg:pl-5! lg:pr-5! lg:pt-5! lg:pb-5!">
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <div className="text-text-primary text-heading-1 flex items-center gap-2">
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
                className="relative top-[3px] inline-flex h-5 w-5 shrink-0 items-center justify-center leading-none text-text-secondary hover:text-text-primary transition-colors"
              >
                <IoInformationCircleOutline size={20} />
              </button>
            </GlassTooltip>
          </div>
        </div>
        <div className="text-body-4 text-text-secondary rounded-2xl border border-card-border px-4 py-2">
          Active integrations: <span className="text-text-primary">{s.linkedCount}</span>
        </div>
      </div>

      {s.error ? <div className="text-body-4 text-text-error">{s.error}</div> : null}

      <IntegrationFilterTabs activeFilter={s.activeFilter} setActiveFilter={s.setActiveFilter} />

      <IntegrationCards
        s={s}
        idexxCardButtonLabel={idexxCardButtonLabel}
        merckCardButtonLabel={merckCardButtonLabel}
      />

      {showNoConnected ? (
        <div className="text-body-4 text-text-secondary">No connected integrations yet.</div>
      ) : null}

      {showNoAvailable ? (
        <div className="text-body-4 text-text-secondary">No available integrations right now.</div>
      ) : null}

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
  <ProtectedRoute>
    <OrgGuard>
      <IntegrationsPage />
    </OrgGuard>
  </ProtectedRoute>
);

export default ProtectedIntegrations;
