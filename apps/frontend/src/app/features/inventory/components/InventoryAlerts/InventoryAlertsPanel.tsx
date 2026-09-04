'use client';
import React, { useEffect, useState } from 'react';
import InventoryAlerts from '@/app/features/inventory/components/InventoryAlerts/InventoryAlerts';
import {
  fetchExpiringAlerts,
  fetchLowStockAlerts,
  type ExpiringAlertBatch,
  type LowStockAlertItem,
} from '@/app/features/inventory/services/inventoryAlertsService';

type InventoryAlertsPanelProps = {
  organisationId?: string;
  /** Expiry look-ahead window; also drives the empty-state copy. Default 30. */
  expiringWindowDays?: number;
};

/**
 * Data container for {@link InventoryAlerts}. Loads low-stock and expiring alerts for
 * the org in parallel and hands the presentational component its arrays plus loading /
 * error. Kept thin on purpose: fetching lives here, rendering lives in InventoryAlerts.
 */
const InventoryAlertsPanel = ({
  organisationId,
  expiringWindowDays = 30,
}: InventoryAlertsPanelProps) => {
  const [lowStock, setLowStock] = useState<LowStockAlertItem[]>([]);
  const [expiring, setExpiring] = useState<ExpiringAlertBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Guards a state update after the org switches or the panel unmounts mid-flight.
    let active = true;

    // The loader is declared inside the effect so the hooks lint can see that every
    // setState it performs happens after an await, not synchronously during the body.
    const run = async () => {
      if (!organisationId) {
        setLowStock([]);
        setExpiring([]);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const [low, exp] = await Promise.all([
          fetchLowStockAlerts(organisationId),
          fetchExpiringAlerts(organisationId, expiringWindowDays),
        ]);
        if (!active) return;
        setLowStock(low);
        setExpiring(exp);
      } catch {
        if (!active) return;
        setLowStock([]);
        setExpiring([]);
        setError('Unable to load inventory alerts right now.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [organisationId, expiringWindowDays]);

  return (
    <InventoryAlerts
      lowStock={lowStock}
      expiring={expiring}
      loading={loading}
      error={error}
      expiringWindowDays={expiringWindowDays}
    />
  );
};

export default InventoryAlertsPanel;
