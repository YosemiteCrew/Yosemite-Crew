'use client';

import { useEffect, useState } from 'react';
import {
  getApiErrorMessage,
  listIdexxIvlsDevices,
  listIdexxOrders,
} from '@/app/features/integrations/services/idexxService';
import { IvlsDevice, LabOrder } from '@/app/features/integrations/services/types';

type UseIdexxLabDataArgs = {
  primaryOrgId: string | null | undefined;
  /** Supervisor, Assistant and Receptionist see the catalog without `labs:view:any`. */
  canViewLabs: boolean;
  /** Raw stored status, compared verbatim — not the lowercased display value. */
  idexxStatus: string | null | undefined;
};

/**
 * The IDEXX devices and recent orders behind the settings modal. Split out of
 * `useIntegrationsPage` so the page hook stays readable, and because this load
 * re-runs on an org switch: each run is fenced by a cancel flag so a slow reply
 * from the previous organisation can never write over the current one's data.
 *
 * A failed device read is returned as `deviceError` rather than pushed into the
 * caller's banner state from inside the effect.
 */
export const useIdexxLabData = ({
  primaryOrgId,
  canViewLabs,
  idexxStatus,
}: UseIdexxLabDataArgs) => {
  const [devices, setDevices] = useState<IvlsDevice[]>([]);
  const [recentOrders, setRecentOrders] = useState<LabOrder[]>([]);
  const [deviceError, setDeviceError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
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
      if (idexxStatus !== 'enabled') {
        setDevices([]);
        setRecentOrders([]);
        return;
      }
      try {
        const ivls = await listIdexxIvlsDevices(primaryOrgId);
        if (cancelled) return;
        setDevices(ivls.ivlsDeviceList ?? []);
      } catch (e) {
        if (cancelled) return;
        setDevices([]);
        setDeviceError(getApiErrorMessage(e, 'Unable to load linked IDEXX devices.'));
      }
      // Recent orders feed the settings modal's activity section. They are secondary to the
      // devices load, so a failure here is swallowed rather than surfaced as an error.
      try {
        // Only three rows are rendered; ask for three. Without a limit the
        // search returns every lab order the organisation has, which is a lot
        // of patient and result data to move for a footer list.
        const orders = await listIdexxOrders({ organisationId: primaryOrgId, limit: 3 });
        if (!cancelled) setRecentOrders(orders);
      } catch {
        if (!cancelled) setRecentOrders([]);
      }
    };
    run().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [primaryOrgId, idexxStatus, canViewLabs]);

  return { devices, recentOrders, setDevices, deviceError };
};
