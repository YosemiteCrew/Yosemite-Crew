import React, { useEffect, useState } from 'react';
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
import { formatDateTimeLocal } from '@/app/lib/date';
import { IoRefreshOutline, IoFlaskOutline, IoWaterOutline, IoBeakerOutline } from 'react-icons/io5';
import type { IconType } from 'react-icons';

const isDeviceOnline = (device: IvlsDevice): boolean =>
  String(device.vcpActivatedStatus ?? '').toLowerCase() === 'active';

const pickDeviceIcon = (displayName?: string | null): IconType => {
  const name = String(displayName ?? '').toLowerCase();
  if (name.includes('cyte')) return IoWaterOutline;
  if (name.includes('ua')) return IoBeakerOutline;
  return IoFlaskOutline;
};

const getIdleDays = (device: IvlsDevice): number | null => {
  if (!device.lastPolledCloudTime) return null;
  const polled = new Date(device.lastPolledCloudTime).getTime();
  if (Number.isNaN(polled)) return null;
  const days = Math.floor((Date.now() - polled) / 86_400_000);
  return days > 0 ? days : null;
};

const buildHealthText = (total: number, onlineCount: number): string => {
  if (total === 0) return 'no devices linked';
  if (onlineCount === total) return 'all healthy';
  return `${total - onlineCount} need attention`;
};

const LinkedMedicalDevices = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const integration = useIntegrationByProviderForPrimaryOrg('IDEXX');
  const integrationsLastFetchedAt = useIntegrationStore((s) => s.lastFetchedAt);
  const [devices, setDevices] = useState<IvlsDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
    if (!primaryOrgId) return;
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

  const total = devices.length;
  const onlineCount = devices.filter(isDeviceOnline).length;
  const lastPoll = integrationsLastFetchedAt
    ? formatDateTimeLocal(integrationsLastFetchedAt)
    : 'not yet';

  return (
    <AccordionButton title="Linked medical devices" showButton={false}>
      <div className="rounded-[18px] border border-[var(--hairline)] bg-[var(--screen)] overflow-hidden shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)]">
        <div className="flex items-center justify-between gap-3 px-5! py-3! border-b border-[var(--hairline)]">
          <div className="text-[11.5px] text-[var(--ink-faint)]">
            Last cloud poll {lastPoll} · {buildHealthText(total, onlineCount)}
          </div>
          <button
            type="button"
            onClick={() => {
              handleManualRefresh().catch(() => undefined);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] px-3 py-1.5 text-[11.5px] font-semibold text-[var(--ink-body)] hover:bg-[var(--inset)] disabled:opacity-50"
            aria-label="Refresh linked medical devices"
            title="Refresh linked medical devices"
            disabled={refreshing}
          >
            <IoRefreshOutline className={refreshing ? 'animate-spin' : ''} size={13} />
            Refresh
          </button>
        </div>

        {error ? (
          <div className="px-5! py-2! text-[11.5px] text-[var(--danger-text)]" role="alert">
            {error}
          </div>
        ) : null}

        {total === 0 ? (
          <div className="px-5! py-4! text-[13px] text-[var(--ink-faint)]">
            No linked IVLS devices found.
          </div>
        ) : (
          devices.map((device) => {
            const online = isDeviceOnline(device);
            const idleDays = getIdleDays(device);
            const idleDayLabel = idleDays === 1 ? 'day' : 'days';
            const idleSuffix = idleDays ? ` · ${idleDays} ${idleDayLabel}` : '';
            const DeviceIcon = pickDeviceIcon(device.displayName);
            return (
              <div
                key={device.deviceSerialNumber}
                className="flex items-center gap-3 px-5! py-3! border-b border-[var(--hairline)]"
              >
                <span className="shrink-0 flex items-center justify-center size-9 rounded-[11px] bg-[var(--blue-soft)] text-[var(--blue-text)]">
                  <DeviceIcon size={16} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-bold text-[var(--ink)] truncate">
                    {device.displayName || 'IVLS device'}
                  </span>
                  <span className="block text-[11px] text-[var(--ink-faint)] tabular-nums">
                    IVLS {device.deviceSerialNumber}
                  </span>
                </span>
                {online ? (
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--success)]">
                    <span className="size-[7px] rounded-full bg-[var(--success)] animate-pulse" />
                    {'ONLINE'}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--warn-text)]">
                    <span className="size-[7px] rounded-full bg-[var(--warn-text)]" />
                    {'IDLE'}
                    {idleSuffix}
                  </span>
                )}
              </div>
            );
          })
        )}

        <div className="flex items-center justify-between gap-3 px-5! py-3!">
          <span className="text-[11.5px] text-[var(--ink-faint)]">
            Devices sync via the IDEXX integration
          </span>
          <Secondary href="/integrations" text="Open integrations" />
        </div>
      </div>
    </AccordionButton>
  );
};

export default LinkedMedicalDevices;
