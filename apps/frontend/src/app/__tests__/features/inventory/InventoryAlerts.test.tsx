import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import InventoryAlerts from '@/app/features/inventory/components/InventoryAlerts/InventoryAlerts';
import type {
  ExpiringAlertBatch,
  LowStockAlertItem,
} from '@/app/features/inventory/services/inventoryAlertsService';

/** Anchored to now so the relative-date pills are deterministic across time. */
const inDays = (days: number): string => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

const lowStock: LowStockAlertItem[] = [
  { id: 'i1', name: 'Meloxicam 15 mg/mL', onHand: 2, reorderLevel: 10, unitOfMeasure: 'mL' },
  { id: 'i2', name: 'Rabies vaccine', onHand: 0, reorderLevel: 25, unitOfMeasure: 'dose' },
];

const expiring: ExpiringAlertBatch[] = [
  {
    id: 'b1',
    itemId: 'i1',
    batchNumber: 'B-2026-04',
    expiryDate: inDays(3),
    quantity: 18,
    inventoryItem: { name: 'Meloxicam 15 mg/mL' },
  },
  { id: 'b2', itemId: 'i7', batchNumber: 'B-2026-07', expiryDate: inDays(21), quantity: 30 },
];

describe('InventoryAlerts', () => {
  it('renders low-stock rows with the on-hand / reorder figure and out-of-stock emphasis', () => {
    render(<InventoryAlerts lowStock={lowStock} expiring={[]} />);

    const lowStockGroup = screen.getByRole('region', { name: 'Low stock' });
    expect(within(lowStockGroup).getByText('Meloxicam 15 mg/mL')).toBeInTheDocument();
    expect(within(lowStockGroup).getByText('Rabies vaccine')).toBeInTheDocument();

    // The on-hand / reorder figure is split across nodes ("2 / 10 mL"), so match the row text.
    expect(within(lowStockGroup).getByText(/2 \/ 10/)).toBeInTheDocument();

    // onHand 0 => danger "Out of stock"; a positive-but-low item => "Low".
    expect(within(lowStockGroup).getByText('Out of stock')).toBeInTheDocument();
    expect(within(lowStockGroup).getByText('Low')).toBeInTheDocument();
  });

  it('renders expiring rows with quantity and a batch-number fallback when no item name', () => {
    render(<InventoryAlerts lowStock={[]} expiring={expiring} />);

    const expiringGroup = screen.getByRole('region', { name: 'Expiring soon' });
    // Item name is used as the row title when the relation is present.
    expect(within(expiringGroup).getByText('Meloxicam 15 mg/mL')).toBeInTheDocument();
    // The second batch has no inventoryItem, so the batch number becomes the title.
    expect(within(expiringGroup).getByText('B-2026-07')).toBeInTheDocument();
    // Quantities render.
    expect(within(expiringGroup).getByText('18')).toBeInTheDocument();
    expect(within(expiringGroup).getByText('30')).toBeInTheDocument();
  });

  it('shows a clean empty state for each group when there are no alerts', () => {
    render(<InventoryAlerts lowStock={[]} expiring={[]} expiringWindowDays={30} />);

    expect(screen.getByText('No low-stock items')).toBeInTheDocument();
    expect(screen.getByText('Nothing expiring in the next 30 days')).toBeInTheDocument();
    // Empty means empty — no rows leaked in from the other group's fixtures.
    expect(screen.queryByText('Out of stock')).not.toBeInTheDocument();
  });

  it('renders an error banner when the container reports a load failure', () => {
    render(
      <InventoryAlerts
        lowStock={[]}
        expiring={[]}
        error="Unable to load inventory alerts right now."
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Unable to load inventory alerts right now.'
    );
  });
});
