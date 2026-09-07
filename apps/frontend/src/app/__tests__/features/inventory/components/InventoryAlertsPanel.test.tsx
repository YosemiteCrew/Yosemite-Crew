import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import InventoryAlertsPanel from '@/app/features/inventory/components/InventoryAlerts/InventoryAlertsPanel';

const fetchLowStockAlerts = jest.fn();
const fetchExpiringAlerts = jest.fn();
jest.mock('@/app/features/inventory/services/inventoryAlertsService', () => ({
  __esModule: true,
  fetchLowStockAlerts: (...a: unknown[]) => fetchLowStockAlerts(...a),
  fetchExpiringAlerts: (...a: unknown[]) => fetchExpiringAlerts(...a),
}));

// Presentational double: surfaces the container's props for assertions.
jest.mock('@/app/features/inventory/components/InventoryAlerts/InventoryAlerts', () => ({
  __esModule: true,
  default: ({
    lowStock,
    expiring,
    loading,
    error,
    expiringWindowDays,
    onViewLowStock,
    onViewExpiring,
  }: any) => (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="error">{error ?? ''}</span>
      <span data-testid="window">{expiringWindowDays}</span>
      <span data-testid="low">{lowStock.length}</span>
      <span data-testid="exp">{expiring.length}</span>
      <button type="button" onClick={onViewLowStock}>
        view-low
      </button>
      <button type="button" onClick={onViewExpiring}>
        view-expiring
      </button>
    </div>
  ),
}));

describe('InventoryAlertsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchLowStockAlerts.mockResolvedValue([{ id: 'i-1' }]);
    fetchExpiringAlerts.mockResolvedValue([{ id: 'b-1' }, { id: 'b-2' }]);
  });

  it('loads both alert sets in parallel for the org', async () => {
    render(<InventoryAlertsPanel organisationId="org-1" />);
    await waitFor(() => expect(screen.getByTestId('low')).toHaveTextContent('1'));
    expect(fetchLowStockAlerts).toHaveBeenCalledWith('org-1');
    expect(fetchExpiringAlerts).toHaveBeenCalledWith('org-1', 30);
    expect(screen.getByTestId('exp')).toHaveTextContent('2');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('honours a custom expiring window', async () => {
    render(<InventoryAlertsPanel organisationId="org-1" expiringWindowDays={7} />);
    await waitFor(() => expect(fetchExpiringAlerts).toHaveBeenCalledWith('org-1', 7));
    expect(screen.getByTestId('window')).toHaveTextContent('7');
  });

  it('forwards catalog filter actions', async () => {
    const onViewLowStock = jest.fn();
    const onViewExpiring = jest.fn();
    render(
      <InventoryAlertsPanel
        organisationId="org-1"
        onViewLowStock={onViewLowStock}
        onViewExpiring={onViewExpiring}
      />
    );
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    screen.getByRole('button', { name: 'view-low' }).click();
    screen.getByRole('button', { name: 'view-expiring' }).click();
    expect(onViewLowStock).toHaveBeenCalledTimes(1);
    expect(onViewExpiring).toHaveBeenCalledTimes(1);
  });

  it('does not fetch without an org id', async () => {
    render(<InventoryAlertsPanel />);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(fetchLowStockAlerts).not.toHaveBeenCalled();
    expect(fetchExpiringAlerts).not.toHaveBeenCalled();
    expect(screen.getByTestId('low')).toHaveTextContent('0');
  });

  it('surfaces an error when a fetch rejects', async () => {
    fetchExpiringAlerts.mockRejectedValueOnce(new Error('down'));
    render(<InventoryAlertsPanel organisationId="org-1" />);
    await waitFor(() =>
      expect(screen.getByTestId('error')).toHaveTextContent('Unable to load inventory alerts')
    );
    expect(screen.getByTestId('low')).toHaveTextContent('0');
    expect(screen.getByTestId('exp')).toHaveTextContent('0');
  });
});
