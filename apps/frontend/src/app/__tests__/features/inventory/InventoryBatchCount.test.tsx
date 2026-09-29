import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InventoryBatchCount from '@/app/features/inventory/components/InventoryBatchCount';
import type { BatchValues } from '@/app/features/inventory/pages/Inventory/types';
import {
  reconcileInventoryCount,
  recordInventoryBatchCount,
} from '@/app/features/inventory/services/inventoryCountService';

jest.mock('@/app/features/inventory/services/inventoryCountService', () => ({
  recordInventoryBatchCount: jest.fn(),
  reconcileInventoryCount: jest.fn(),
}));

const batch: BatchValues = {
  _id: 'batch-1',
  batch: 'LOT-1',
  serial: 'SERIAL-1',
  barcode: '123456',
  quantity: '8',
  allocated: '2',
  manufactureDate: '',
  expiryDate: '',
};
const discrepancy = {
  id: 'count-1',
  inventoryBatchId: 'batch-1',
  systemCount: 8,
  physicalCount: 7,
  discrepancy: -1,
  reconciled: false,
};
const commonProps = {
  organisationId: 'org-1',
  itemId: 'item-1',
  itemName: 'Pain relief',
  batches: [batch],
  onRefresh: jest.fn(),
};

describe('InventoryBatchCount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not render a count action when no identified batches are available', () => {
    const { container } = render(
      <InventoryBatchCount
        {...commonProps}
        batches={[
          {
            batch: 'No id',
            manufactureDate: '',
            expiryDate: '',
          },
        ]}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('allows manual batch selection and records the physical quantity without sending a system count', async () => {
    const user = userEvent.setup();
    (recordInventoryBatchCount as jest.Mock).mockResolvedValue({ ...discrepancy, discrepancy: 0 });
    render(<InventoryBatchCount {...commonProps} />);

    await user.click(screen.getByRole('button', { name: 'Start count' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Batch' }), 'batch-1');
    expect(screen.getByText('System quantity: 8 · 2 allocated')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Enter the physical count'), '7');
    await user.type(screen.getByLabelText('Count notes (optional)'), 'Shelf recount');
    await user.click(screen.getByRole('button', { name: 'Record count' }));

    await waitFor(() =>
      expect(recordInventoryBatchCount).toHaveBeenCalledWith('org-1', {
        inventoryItemId: 'item-1',
        inventoryBatchId: 'batch-1',
        countedAt: expect.any(String),
        physicalCount: 7,
        notes: 'Shelf recount',
      })
    );
    expect(await screen.findByText('Count recorded. Stock already matches.')).toBeInTheDocument();
    expect(commonProps.onRefresh).toHaveBeenCalledTimes(1);
  });

  it('matches a scanned barcode and asks for a reason before leaving a discrepancy unchanged', async () => {
    const user = userEvent.setup();
    (recordInventoryBatchCount as jest.Mock).mockResolvedValue(discrepancy);
    (reconcileInventoryCount as jest.Mock).mockResolvedValue({ ...discrepancy, reconciled: true });
    render(<InventoryBatchCount {...commonProps} />);

    await user.click(screen.getByRole('button', { name: 'Start count' }));
    await user.type(screen.getByPlaceholderText('Scan or enter a batch'), '123456');
    await user.type(screen.getByPlaceholderText('Enter the physical count'), '7');
    await user.click(screen.getByRole('button', { name: 'Record count' }));
    expect(await screen.findByText('Difference: -1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Leave stock unchanged' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Add a reason before leaving stock unchanged.'
    );

    await user.type(
      screen.getByLabelText('Reason if stock stays unchanged'),
      'Waiting for second count'
    );
    await user.click(screen.getByRole('button', { name: 'Leave stock unchanged' }));
    await waitFor(() =>
      expect(reconcileInventoryCount).toHaveBeenCalledWith('org-1', 'count-1', {
        resolution: 'NO_CHANGE',
        resolutionNotes: 'Waiting for second count',
      })
    );
    expect(await screen.findByText('Count recorded without changing stock.')).toBeInTheDocument();
  });

  it('adjusts stock after a discrepancy and starts another count from the success state', async () => {
    const user = userEvent.setup();
    (recordInventoryBatchCount as jest.Mock).mockResolvedValue(discrepancy);
    (reconcileInventoryCount as jest.Mock).mockResolvedValue({ ...discrepancy, reconciled: true });
    render(<InventoryBatchCount {...commonProps} />);

    await user.click(screen.getByRole('button', { name: 'Start count' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Batch' }), 'batch-1');
    await user.type(screen.getByPlaceholderText('Enter the physical count'), '7');
    await user.click(screen.getByRole('button', { name: 'Record count' }));
    await user.click(await screen.findByRole('button', { name: 'Adjust stock to count' }));
    await waitFor(() =>
      expect(reconcileInventoryCount).toHaveBeenCalledWith('org-1', 'count-1', {
        resolution: 'STOCK_ADJUSTED',
      })
    );
    await user.click(await screen.findByRole('button', { name: 'Count another batch' }));
    expect(screen.getByRole('combobox', { name: 'Batch' })).toHaveValue('');
  });

  it('shows a record error and can cancel the open form', async () => {
    const user = userEvent.setup();
    (recordInventoryBatchCount as jest.Mock).mockRejectedValue(new Error('Network unavailable'));
    render(<InventoryBatchCount {...commonProps} />);

    await user.click(screen.getByRole('button', { name: 'Start count' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Batch' }), 'batch-1');
    await user.type(screen.getByPlaceholderText('Enter the physical count'), '7');
    await user.click(screen.getByRole('button', { name: 'Record count' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('combobox', { name: 'Batch' })).not.toBeInTheDocument();
  });

  it('shows a reconciliation error and keeps the discrepancy available to retry', async () => {
    const user = userEvent.setup();
    (recordInventoryBatchCount as jest.Mock).mockResolvedValue(discrepancy);
    (reconcileInventoryCount as jest.Mock).mockRejectedValue('reconcile failed');
    render(<InventoryBatchCount {...commonProps} />);

    await user.click(screen.getByRole('button', { name: 'Start count' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Batch' }), 'batch-1');
    await user.type(screen.getByPlaceholderText('Enter the physical count'), '7');
    await user.click(screen.getByRole('button', { name: 'Record count' }));
    await user.click(await screen.findByRole('button', { name: 'Adjust stock to count' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The count could not be saved. Try again.'
    );
    expect(screen.getByText('Difference: -1')).toBeInTheDocument();
  });

  it('keeps the count action disabled without permission', () => {
    render(<InventoryBatchCount {...commonProps} disabled />);
    expect(screen.getByRole('button', { name: 'Start count' })).toBeDisabled();
  });

  it('selects a batch by its visible batch number from scanner input', () => {
    render(<InventoryBatchCount {...commonProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start count' }));
    fireEvent.change(screen.getByPlaceholderText('Scan or enter a batch'), {
      target: { value: 'LOT-1' },
    });
    expect(screen.getByRole('combobox', { name: 'Batch' })).toHaveValue('batch-1');
  });

  it('clears the selected batch when a scan does not match', () => {
    render(<InventoryBatchCount {...commonProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start count' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Batch' }), {
      target: { value: 'batch-1' },
    });
    fireEvent.change(screen.getByPlaceholderText('Scan or enter a batch'), {
      target: { value: 'UNKNOWN-BATCH' },
    });

    expect(screen.getByRole('combobox', { name: 'Batch' })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Record count' })).toBeDisabled();
  });

  it('records a zero-discrepancy count without a refresh callback', async () => {
    const user = userEvent.setup();
    (recordInventoryBatchCount as jest.Mock).mockResolvedValue({ ...discrepancy, discrepancy: 0 });
    render(
      <InventoryBatchCount
        {...commonProps}
        onRefresh={undefined}
        batches={[
          {
            _id: 'batch-1',
            batch: '',
            serial: 'SERIAL-1',
            barcode: '',
            quantity: undefined,
            allocated: '',
            manufactureDate: '',
            expiryDate: '',
          },
        ]}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Start count' }));
    expect(screen.getByRole('option', { name: 'SERIAL-1' })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Batch' }), 'batch-1');
    expect(screen.getByText('System quantity: Not available')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Scan or enter a batch'), 'SERIAL-1');
    await user.type(screen.getByPlaceholderText('Enter the physical count'), '8');
    await user.click(screen.getByRole('button', { name: 'Record count' }));
    await waitFor(() =>
      expect(recordInventoryBatchCount).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({
          physicalCount: 8,
        })
      )
    );
  });

  it('does not render a numeric zero when the count response is empty', async () => {
    const user = userEvent.setup();
    (recordInventoryBatchCount as jest.Mock).mockResolvedValue(0);
    render(<InventoryBatchCount {...commonProps} />);

    await user.click(screen.getByRole('button', { name: 'Start count' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Batch' }), 'batch-1');
    await user.type(screen.getByPlaceholderText('Enter the physical count'), '7');
    await user.click(screen.getByRole('button', { name: 'Record count' }));

    await waitFor(() => expect(recordInventoryBatchCount).toHaveBeenCalled());
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('shows a signed positive discrepancy when the physical count is higher', async () => {
    const user = userEvent.setup();
    (recordInventoryBatchCount as jest.Mock).mockResolvedValue({
      ...discrepancy,
      physicalCount: 10,
      discrepancy: 2,
    });
    render(<InventoryBatchCount {...commonProps} />);

    await user.click(screen.getByRole('button', { name: 'Start count' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Batch' }), 'batch-1');
    await user.type(screen.getByPlaceholderText('Enter the physical count'), '10');
    await user.click(screen.getByRole('button', { name: 'Record count' }));
    expect(await screen.findByText('Difference: +2')).toBeInTheDocument();
  });
});
