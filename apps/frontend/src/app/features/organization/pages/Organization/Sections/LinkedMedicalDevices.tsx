import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import AccordionButton from '@/app/ui/primitives/Accordion/AccordionButton';
import { Secondary } from '@/app/ui/primitives/Buttons';
import { useOrgStore } from '@/app/stores/orgStore';
import { useIntegrationStore } from '@/app/stores/integrationStore';
import {
  loadIntegrationsForPrimaryOrg,
  useIntegrationByProviderForPrimaryOrg,
} from '@/app/hooks/useIntegrations';
import { listIdexxIvlsDevices } from '@/app/features/integrations/services/idexxService';
import { IvlsDevice } from '@/app/features/integrations/services/types';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';
import { formatDateTimeLocal } from '@/app/lib/date';
import { IoRefreshOutline } from 'react-icons/io5';

const LinkedMedicalDevices = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const integration = useIntegrationByProviderForPrimaryOrg('IDEXX');
  const integrationsLastFetchedAt = useIntegrationStore((s) => s.lastFetchedAt);
  const [devices, setDevices] = useState<IvlsDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const statusKey = (integration?.status ?? 'disabled').toLowerCase();
  const statusLabel = `${statusKey.charAt(0).toUpperCase()}${statusKey.slice(1)}`;
  const getIntegrationStatusClass = (key: string) => {
    if (key === 'enabled') return 'bg-green-50 text-green-800';
    if (key === 'error') return 'bg-red-50 text-red-700';
    if (key === 'pending') return 'bg-blue-50 text-blue-700';
    return 'bg-amber-50 text-amber-700';
  };
  const statusClasses = getIntegrationStatusClass(statusKey);
  const getDeviceStatusLabel = (value?: string) => {
    const key = String(value || 'unknown').toLowerCase();
    return `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
  };

  useEffect(() => {
    const run = async () => {
      if (!primaryOrgId) return;
      try {
        setError(null);
        if ((integration?.status ?? '').toLowerCase() === 'enabled') {
          const ivls = await listIdexxIvlsDevices(primaryOrgId);
          setDevices(ivls.ivlsDeviceList ?? []);
        } else {
          setDevices([]);
        }
      } catch {
        setError('Unable to refresh linked IVLS devices.');
        setDevices([]);
      }
    };
    void run();
  }, [primaryOrgId, integration?.status]);

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
    } catch {
      setError('Unable to refresh integration/device status.');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <AccordionButton title="Linked medical devices" showButton={false}>
      <div className="rounded-2xl border border-card-border p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <Image
              src={MEDIA_SOURCES.futureAssets.idexxLogoUrl}
              alt="IDEXX"
              width={40}
              height={40}
              className="rounded-lg border border-card-border p-1.5 bg-white"
            />
            <div>
              <div className="text-body-2 text-text-primary">IDEXX</div>
              <div className="text-body-4 text-text-secondary">
                {devices.length} linked IVLS device(s)
              </div>
            </div>
          </div>
          <div className={`text-label-xsmall px-2 py-1 rounded ${statusClasses}`}>
            {statusLabel}
          </div>
        </div>

        <div className="text-caption-1 text-text-secondary">
          Manage IDEXX credentials, enablement, and device links from Integrations settings.
        </div>
        <div className="flex items-center justify-between rounded-xl border border-card-border px-3 py-2 ">
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
            aria-label="Refresh linked medical devices"
            title="Refresh linked medical devices"
            disabled={refreshing}
          >
            <IoRefreshOutline className={refreshing ? 'animate-spin' : ''} size={16} />
          </button>
        </div>

        {error ? <div className="text-caption-1 text-text-error">{error}</div> : null}

        {devices.length === 0 ? (
          <div className="rounded-xl border border-card-border p-3 text-body-4 text-text-secondary ">
            No linked IVLS devices found.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {devices.map((device) => (
              <div
                key={device.deviceSerialNumber}
                className="rounded-xl border border-card-border p-3 "
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
                    {getDeviceStatusLabel(device.vcpActivatedStatus)}
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
            ))}
          </div>
        )}

        <div className="flex justify-end">
          <Secondary href="/integrations" text="Open integrations" />
        </div>
      </div>
    </AccordionButton>
  );
};

export default LinkedMedicalDevices;
