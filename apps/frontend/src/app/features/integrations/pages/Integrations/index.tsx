'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
import Close from '@/app/ui/primitives/Icons/Close';
import { IoRefreshOutline } from 'react-icons/io5';

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

const integrationFilters = [
  { key: 'all', label: 'All', bg: '#247AED', text: '#EAF3FF' },
  { key: 'installed', label: 'Installed', bg: '#F1D4B0', text: '#302f2e' },
  { key: 'available', label: 'Available', bg: '#D9A488', text: '#F7F7F7' },
] as const;

const StatusPill = ({ status }: { status?: string }) => {
  const key = (status ?? 'disabled').toLowerCase();
  const normalizedLabel = `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
  return (
    <span
      className={`text-label-xsmall px-2 py-1 rounded ${statusClasses[key] ?? 'bg-card-hover text-text-secondary'}`}
    >
      {normalizedLabel}
    </span>
  );
};

const IntegrationsPage = () => {
  const primaryOrg = usePrimaryOrg();
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const integrations = useIntegrationsForPrimaryOrg();
  const idexxIntegration = useIntegrationByProviderForPrimaryOrg('IDEXX');
  const integrationStatus = useIntegrationStore((s) => s.status);
  const integrationError = useIntegrationStore((s) => s.error);
  const integrationsLastFetchedAt = useIntegrationStore((s) => s.lastFetchedAt);
  const [devices, setDevices] = useState<IvlsDevice[]>([]);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [validateState, setValidateState] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [activeFilter, setActiveFilter] = useState<'all' | 'installed' | 'available'>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (integrationError) {
      setError(integrationError);
    }
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
    const key = String(idexxIntegration?.credentialsStatus ?? '').toLowerCase();
    if (key === 'valid') {
      setValidateState('valid');
      return;
    }
    if (key === 'invalid') {
      setValidateState('invalid');
      return;
    }
    setValidateState('idle');
  }, [idexxIntegration?.credentialsStatus]);

  const handleManualRefresh = async () => {
    if (!primaryOrgId || refreshing) return;
    setRefreshing(true);
    setError(null);
    try {
      await loadIntegrationsForPrimaryOrg({ force: true, silent: true });
      const nextIdexx =
        useIntegrationStore.getState().getIntegrationByProvider(primaryOrgId, 'IDEXX') ?? null;
      if ((nextIdexx?.status ?? '').toLowerCase() === 'enabled') {
        const ivls = await listIdexxIvlsDevices(primaryOrgId);
        setDevices(ivls.ivlsDeviceList ?? []);
      } else {
        setDevices([]);
      }
    } catch (e) {
      setError(getApiErrorMessage(e, 'Unable to refresh integration status.'));
    } finally {
      setRefreshing(false);
    }
  };

  const handleStoreCredentials = async () => {
    if (!primaryOrgId || !username.trim() || !password.trim()) return;
    setSaving(true);
    setError(null);
    setValidateState('idle');
    try {
      await storeIntegrationCredentials(
        primaryOrgId,
        {
          credentials: {
            username: username.trim(),
            password,
          },
        },
        'IDEXX'
      );
      await loadIntegrationsForPrimaryOrg({ force: true, silent: true });
    } catch (e) {
      setError(
        getApiErrorMessage(e, 'Unable to store IDEXX credentials. Please verify and retry.')
      );
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async () => {
    if (!primaryOrgId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await validateIntegrationCredentials(primaryOrgId, 'IDEXX');
      setValidateState(res.ok ? 'valid' : 'invalid');
    } catch (e) {
      setValidateState('invalid');
      setError(getApiErrorMessage(e, 'Credential validation failed.'));
    } finally {
      setSaving(false);
    }
  };

  const handleEnableDisable = async () => {
    if (!primaryOrgId) return;
    if (!idexxIntegration) {
      setShowSettings(true);
      setError('Store IDEXX credentials in settings before enabling.');
      return;
    }
    const isDisconnecting = (idexxIntegration.status ?? '').toLowerCase() === 'enabled';
    if (isDisconnecting) {
      const shouldDisconnect = globalThis.confirm(
        'Disconnect IDEXX for this organization? Lab ordering and result syncing will be unavailable until re-enabled.'
      );
      if (!shouldDisconnect) return;
    }
    setSaving(true);
    setError(null);
    try {
      if (!isDisconnecting) {
        try {
          const validation = await validateIntegrationCredentials(primaryOrgId, 'IDEXX');
          if (!validation.ok) {
            throw new Error('IDEXX credentials are invalid.');
          }
          setValidateState('valid');
        } catch (validationError) {
          setValidateState('invalid');
          setShowSettings(true);
          setError(
            getApiErrorMessage(
              validationError,
              'IDEXX credentials are missing or invalid. Open settings, fill credentials, validate, and then enable.'
            )
          );
          return;
        }
      }
      const next = isDisconnecting
        ? await disableIntegration(primaryOrgId, 'IDEXX')
        : await enableIntegration(primaryOrgId, 'IDEXX');
      if (next.status === 'enabled') {
        const ivls = await listIdexxIvlsDevices(primaryOrgId);
        setDevices(ivls.ivlsDeviceList ?? []);
      } else {
        setDevices([]);
      }
      await loadIntegrationsForPrimaryOrg({ force: true, silent: true });
    } catch (e) {
      setError(getApiErrorMessage(e, 'Unable to update IDEXX integration status.'));
    } finally {
      setSaving(false);
    }
  };

  const linkedCount = useMemo(
    () =>
      integrations.filter((integration) => integration.status?.toLowerCase() === 'enabled').length,
    [integrations]
  );

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
    (activeFilter === 'installed' && idexxEnabled) ||
    (activeFilter === 'available' && !idexxEnabled);
  const credentialsActionLabel = saving
    ? hasStoredCredentials
      ? 'Updating...'
      : 'Saving...'
    : hasStoredCredentials
      ? 'Update credentials'
      : 'Store credentials';

  return (
    <div className="flex flex-col gap-6 px-3! py-3! sm:px-12! lg:px-[60px]! sm:py-12!">
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <div className="text-text-primary text-heading-1">Integrations</div>
          <p className="text-body-3 text-text-secondary max-w-3xl">
            Connect and manage external tools for {primaryOrg?.name ?? 'your organization'},
            including IDEXX ordering and diagnostic results.
          </p>
        </div>
        <div className="text-body-4 text-text-secondary rounded-2xl border border-card-border px-4 py-2">
          Active integrations: <span className="text-text-primary">{linkedCount}</span>
        </div>
      </div>

      {error ? <div className="text-body-4 text-text-error">{error}</div> : null}

      <div className="flex items-center gap-2 flex-wrap">
        {integrationFilters.map((tab) => {
          const isActive = activeFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveFilter(tab.key as 'all' | 'installed' | 'available')}
              className="min-w-20 text-body-4 px-3 py-[6px] rounded-2xl! border border-card-border! transition-all duration-300 hover:bg-card-hover hover:border-card-hover! text-text-tertiary"
              style={isActive ? { backgroundColor: tab.bg, color: tab.text } : undefined}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {showIdexxCard ? (
        <div className="rounded-2xl border border-card-border p-4 max-w-[430px] flex items-start gap-4 min-h-[245px]">
          <div className="shrink-0">
            <Image
              src={MEDIA_SOURCES.futureAssets.idexxLogoUrl}
              alt="IDEXX"
              width={72}
              height={72}
              className="rounded-xl border border-card-border bg-white p-2"
            />
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="text-heading-3 text-text-primary pt-1">IDEXX</div>
              <StatusPill status={idexxIntegration?.status} />
            </div>
            <div className="text-body-4 text-text-secondary line-clamp-4">
              IDEXX diagnostics integration for lab ordering, in-house device workflows, and
              clinical result visibility in Yosemite.
            </div>
            <div className="flex items-center justify-end gap-2">
              <Secondary href="#" text="Settings" onClick={() => setShowSettings(true)} />
              {idexxStatus === 'enabled' ? (
                <Primary href="/appointments/idexx-workspace" text="View" />
              ) : (
                <Primary
                  href="#"
                  text={saving ? 'Enabling...' : 'Enable'}
                  onClick={handleEnableDisable}
                  isDisabled={saving}
                />
              )}
            </div>
          </div>
        </div>
      ) : null}

      {integrationStatus !== 'loading' && !idexxIntegration ? (
        <div className="text-body-4 text-text-secondary">
          IDEXX is not configured yet. Open settings to store credentials and enable it.
        </div>
      ) : null}

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
              Last refreshed:{' '}
              <span className="text-text-primary">
                {integrationsLastFetchedAt
                  ? formatDateTimeLocal(integrationsLastFetchedAt)
                  : 'Not refreshed yet'}
              </span>
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
              <IoRefreshOutline className={refreshing ? 'animate-spin' : ''} size={16} />
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
                {validateState !== 'idle' ? (
                  <div
                    className={`text-body-4 ${validateState === 'valid' ? 'text-green-700' : 'text-text-error'}`}
                  >
                    {validateState === 'valid'
                      ? 'Credentials validated successfully.'
                      : 'Credentials are invalid or not available.'}
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-2 text-caption-1">
                  <div className="text-text-secondary">Credentials status</div>
                  <div className="text-right">
                    <span
                      className={`text-label-xsmall px-2 py-1 rounded ${
                        credentialsStatusClasses[credentialsStatusKey] ??
                        'bg-card-hover text-text-secondary'
                      }`}
                    >
                      {credentialsStatusLabel}
                    </span>
                  </div>
                  <div className="text-text-secondary">Last validated</div>
                  <div className="text-text-primary text-right">
                    {idexxIntegration?.lastValidatedAt
                      ? formatDateTimeLocal(idexxIntegration.lastValidatedAt)
                      : 'Not validated yet'}
                  </div>
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
                  {idexxEnabled ? (
                    <Primary
                      href="#"
                      text={saving ? 'Updating...' : 'Disable IDEXX'}
                      onClick={handleEnableDisable}
                      isDisabled={saving || !idexxIntegration}
                    />
                  ) : (
                    <Primary
                      href="#"
                      text={saving ? 'Updating...' : 'Enable IDEXX'}
                      onClick={handleEnableDisable}
                      isDisabled={saving || !idexxIntegration || !hasStoredCredentials}
                    />
                  )}
                  <Secondary href="/appointments" text="Open appointments" />
                </div>
                {idexxEnabled ? (
                  <div className="text-caption-1 text-text-secondary">
                    IDEXX is enabled. Use the Credentials section to rotate username/password and
                    validate the connection.
                  </div>
                ) : (
                  <div className="text-caption-1 text-text-secondary">
                    {hasStoredCredentials
                      ? 'Stored credentials detected. Validate and enable when ready.'
                      : 'Store credentials first to enable IDEXX.'}
                  </div>
                )}
              </div>
            </Accordion>

            <Accordion title="Sync health" defaultOpen showEditIcon={false} isEditing>
              <div className="flex flex-col gap-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-caption-1 text-text-secondary">Last sync</div>
                  <div className="text-caption-1 text-text-primary">
                    {idexxIntegration?.lastSyncAt
                      ? formatDateTimeLocal(idexxIntegration.lastSyncAt)
                      : 'Pending'}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-caption-1 text-text-secondary">Enabled at</div>
                  <div className="text-caption-1 text-text-primary">
                    {idexxIntegration?.enabledAt
                      ? formatDateTimeLocal(idexxIntegration.enabledAt)
                      : 'Not enabled'}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-caption-1 text-text-secondary">Last validated</div>
                  <div className="text-caption-1 text-text-primary">
                    {idexxIntegration?.lastValidatedAt
                      ? formatDateTimeLocal(idexxIntegration.lastValidatedAt)
                      : 'Not validated yet'}
                  </div>
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
                {devices.length === 0 ? (
                  <div className="text-body-4 text-text-secondary">
                    No linked IVLS devices found for this organization.
                  </div>
                ) : (
                  devices.map((device) => (
                    <div
                      key={device.deviceSerialNumber}
                      className="rounded-2xl border border-card-border p-3 bg-card-bg"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-body-4 text-text-primary">
                            {device.displayName || 'IVLS device'}
                          </div>
                          <div className="text-caption-1 text-text-secondary mt-0.5">
                            {device.deviceSerialNumber}
                          </div>
                        </div>
                        <span
                          className={`text-label-xsmall px-2 py-1 rounded ${
                            String(device.vcpActivatedStatus || '').toLowerCase() === 'active'
                              ? 'bg-green-50 text-green-800'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {(() => {
                            const key = String(
                              device.vcpActivatedStatus || 'unknown'
                            ).toLowerCase();
                            return `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
                          })()}
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
                  ))
                )}
              </div>
            </Accordion>
          </div>
        </div>
      </Modal>
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
