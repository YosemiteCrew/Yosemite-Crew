import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import user from '@testing-library/user-event';
import '@testing-library/jest-dom';
import CounterSaleDialog from '@/app/features/finance/pages/Finance/Sections/CounterSaleDialog';
import { fetchInventoryItems } from '@/app/features/inventory/services/inventoryService';
import {
  createCounterSale,
  finalizeFinanceInvoice,
} from '@/app/features/billing/services/invoiceService';

jest.mock('@/app/features/inventory/services/inventoryService', () => ({
  fetchInventoryItems: jest.fn(),
}));

jest.mock('@/app/features/billing/services/invoiceService', () => ({
  createCounterSale: jest.fn(),
  finalizeFinanceInvoice: jest.fn(),
}));

jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ showModal, children }: { showModal: boolean; children: React.ReactNode }) =>
    showModal ? <div role="dialog">{children}</div> : null,
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick, isDisabled, ariaLabel }: any) => (
    <button type="button" onClick={onClick} disabled={isDisabled} aria-label={ariaLabel}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick, isDisabled, ariaLabel }: any) => (
    <button type="button" onClick={onClick} disabled={isDisabled} aria-label={ariaLabel}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/inputs/Dropdown/Dropdown', () => ({
  __esModule: true,
  default: ({ placeholder, value, onChange, options, disabled }: any) => (
    <label>
      {placeholder}
      <select
        aria-label={placeholder}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Choose an item</option>
        {options.map((option: { value: string; label: string }) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  ),
}));

const stock = [
  {
    _id: 'bandage',
    organisationId: 'org-1',
    name: 'Bandage',
    sellingPrice: 10,
    currency: 'USD',
    status: 'ACTIVE',
    onHand: 5,
    allocated: 1,
  },
  {
    _id: 'prescription',
    organisationId: 'org-1',
    name: 'Prescription medicine',
    sellingPrice: 20,
    status: 'ACTIVE',
    onHand: 4,
    allocated: 0,
    prescriptionRequired: true,
  },
  {
    _id: 'unpriced',
    organisationId: 'org-1',
    name: 'Unpriced item',
    status: 'ACTIVE',
    onHand: 4,
    allocated: 0,
  },
];

const invoice = {
  id: 'invoice-1',
  organisationId: 'org-1',
  appointmentId: undefined,
  totalAmount: 20,
} as any;

describe('CounterSaleDialog', () => {
  const setOpen = jest.fn();
  const onCreated = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (fetchInventoryItems as jest.Mock).mockResolvedValue(stock);
    (createCounterSale as jest.Mock).mockResolvedValue(invoice);
    (finalizeFinanceInvoice as jest.Mock).mockResolvedValue({ ...invoice, pdfUrl: 'receipt.pdf' });
  });

  it('creates a sale from eligible stock and opens its invoice', async () => {
    render(
      <CounterSaleDialog
        open
        setOpen={setOpen}
        organisationId="org-1"
        currency="USD"
        onCreated={onCreated}
      />
    );

    const itemPicker = await screen.findByRole('combobox', { name: 'Item' });
    await screen.findByRole('option', { name: /Bandage/ });
    expect(screen.queryByRole('option', { name: /Prescription medicine/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Unpriced item/ })).not.toBeInTheDocument();
    await user.selectOptions(itemPicker, 'bandage');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Qty' }), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create counter sale' }));

    await waitFor(() =>
      expect(createCounterSale).toHaveBeenCalledWith({
        organisationId: 'org-1',
        items: [{ inventoryItemId: 'bandage', quantity: 2 }],
      })
    );
    expect(finalizeFinanceInvoice).toHaveBeenCalledWith(invoice.id);
    expect(onCreated).toHaveBeenCalledWith({ ...invoice, pdfUrl: 'receipt.pdf' });
    expect(setOpen).toHaveBeenCalledWith(false);
    const receiptStatus = await screen.findByRole('status');
    expect(receiptStatus).toHaveTextContent('Receipt ready');
    expect(receiptStatus.tagName).toBe('OUTPUT');
  });

  it('does not create a second sale when receipt generation can be retried', async () => {
    (finalizeFinanceInvoice as jest.Mock)
      .mockRejectedValueOnce(new Error('Tax service unavailable'))
      .mockResolvedValueOnce({ ...invoice, pdfUrl: 'receipt.pdf' });
    render(
      <CounterSaleDialog
        open
        setOpen={setOpen}
        organisationId="org-1"
        currency="USD"
        onCreated={onCreated}
      />
    );
    const itemPicker = await screen.findByRole('combobox', { name: 'Item' });
    await screen.findByRole('option', { name: /Bandage/ });
    await user.selectOptions(itemPicker, 'bandage');
    await user.click(screen.getByRole('button', { name: 'Create counter sale' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('sale was saved');
    expect(createCounterSale).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Retry receipt generation' }));

    await waitFor(() => expect(finalizeFinanceInvoice).toHaveBeenCalledTimes(2));
    expect(createCounterSale).toHaveBeenCalledTimes(1);
    expect(onCreated).toHaveBeenCalledWith({ ...invoice, pdfUrl: 'receipt.pdf' });
  });

  it('opens the saved invoice when receipt generation fails', async () => {
    (finalizeFinanceInvoice as jest.Mock).mockRejectedValueOnce(
      new Error('Receipt service unavailable')
    );
    render(
      <CounterSaleDialog
        open
        setOpen={setOpen}
        organisationId="org-1"
        currency="USD"
        onCreated={onCreated}
      />
    );
    const itemPicker = await screen.findByRole('combobox', { name: 'Item' });
    await screen.findByRole('option', { name: /Bandage/ });
    await user.selectOptions(itemPicker, 'bandage');
    await user.click(screen.getByRole('button', { name: 'Create counter sale' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('sale was saved');
    expect(createCounterSale).toHaveBeenCalledTimes(1);
    expect(onCreated).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Open saved counter-sale invoice' }));
    expect(onCreated).toHaveBeenCalledWith(invoice);
    expect(setOpen).toHaveBeenCalledWith(false);
    expect(createCounterSale).toHaveBeenCalledTimes(1);
  });

  it('keeps the dialog open and explains a failed save', async () => {
    (createCounterSale as jest.Mock).mockRejectedValue({
      response: { data: { message: 'Insufficient stock' } },
    });
    render(
      <CounterSaleDialog
        open
        setOpen={setOpen}
        organisationId="org-1"
        currency="USD"
        onCreated={onCreated}
      />
    );
    const itemPicker = await screen.findByRole('combobox', { name: 'Item' });
    await screen.findByRole('option', { name: /Bandage/ });
    await user.selectOptions(itemPicker, 'bandage');
    fireEvent.click(screen.getByRole('button', { name: 'Create counter sale' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Insufficient stock');
    expect(onCreated).not.toHaveBeenCalled();
    expect(setOpen).not.toHaveBeenCalled();
  });

  it('reports inventory load failures and disables submission', async () => {
    (fetchInventoryItems as jest.Mock)
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce(stock);
    render(
      <CounterSaleDialog
        open
        setOpen={setOpen}
        organisationId="org-1"
        currency="USD"
        onCreated={onCreated}
      />
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Inventory could not be loaded');
    expect(screen.getByRole('button', { name: 'Create counter sale' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Retry loading inventory' }));
    expect(await screen.findByRole('option', { name: /Bandage/ })).toBeInTheDocument();
  });

  it('uses a readable fallback when the sale request has no message', async () => {
    (createCounterSale as jest.Mock).mockRejectedValue(null);
    render(
      <CounterSaleDialog
        open
        setOpen={setOpen}
        organisationId="org-1"
        currency="USD"
        onCreated={onCreated}
      />
    );
    const itemPicker = await screen.findByRole('combobox', { name: 'Item' });
    await screen.findByRole('option', { name: /Bandage/ });
    await user.selectOptions(itemPicker, 'bandage');
    await user.click(screen.getByRole('button', { name: 'Create counter sale' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The sale could not be saved. Try again.'
    );
  });

  it('shows a network error returned without an API message', async () => {
    (createCounterSale as jest.Mock).mockRejectedValue(new Error('Network unavailable'));
    render(
      <CounterSaleDialog
        open
        setOpen={setOpen}
        organisationId="org-1"
        currency="USD"
        onCreated={onCreated}
      />
    );
    const itemPicker = await screen.findByRole('combobox', { name: 'Item' });
    await screen.findByRole('option', { name: /Bandage/ });
    await user.selectOptions(itemPicker, 'bandage');
    await user.click(screen.getByRole('button', { name: 'Create counter sale' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable');
  });

  it('supports adding and removing a cart line and cancelling before saving', async () => {
    render(
      <CounterSaleDialog
        open
        setOpen={setOpen}
        organisationId="org-1"
        currency="USD"
        onCreated={onCreated}
      />
    );
    await screen.findByRole('combobox', { name: 'Item' });
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    expect(screen.getByRole('combobox', { name: 'Item 2' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove item 2' }));
    await user.click(screen.getByRole('button', { name: 'Cancel counter sale' }));

    expect(screen.queryByRole('combobox', { name: 'Item 2' })).not.toBeInTheDocument();
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  it('offers the saved invoice if receipt generation fails', async () => {
    (finalizeFinanceInvoice as jest.Mock).mockRejectedValue(new Error('Tax service unavailable'));
    render(
      <CounterSaleDialog
        open
        setOpen={setOpen}
        organisationId="org-1"
        currency="USD"
        onCreated={onCreated}
      />
    );
    const itemPicker = await screen.findByRole('combobox', { name: 'Item' });
    await screen.findByRole('option', { name: /Bandage/ });
    await user.selectOptions(itemPicker, 'bandage');
    await user.click(screen.getByRole('button', { name: 'Create counter sale' }));
    await user.click(
      await screen.findByRole('button', { name: 'Open saved counter-sale invoice' })
    );

    expect(createCounterSale).toHaveBeenCalledTimes(1);
    expect(onCreated).toHaveBeenCalledWith(invoice);
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  it('blocks a quantity above the unreserved stock and totals the cart', async () => {
    render(
      <CounterSaleDialog
        open
        setOpen={setOpen}
        organisationId="org-1"
        currency="USD"
        onCreated={onCreated}
      />
    );
    const itemPicker = await screen.findByRole('combobox', { name: 'Item' });
    await screen.findByRole('option', { name: /Bandage/ });
    await user.selectOptions(itemPicker, 'bandage');
    const quantity = screen.getByRole('spinbutton', { name: 'Qty' });
    const createSale = screen.getByRole('button', { name: 'Create counter sale' });

    // 5 on hand with 1 reserved leaves 4 that can be sold.
    fireEvent.change(quantity, { target: { value: '5' } });
    expect(createSale).toBeDisabled();

    fireEvent.change(quantity, { target: { value: '4' } });
    expect(createSale).toBeEnabled();
    expect(screen.getByText('$40.00')).toBeInTheDocument();
  });

  it('shows when active stock is unavailable', async () => {
    (fetchInventoryItems as jest.Mock).mockResolvedValueOnce([
      { ...stock[0], onHand: 1, allocated: 1 },
    ]);
    render(
      <CounterSaleDialog
        open
        setOpen={setOpen}
        organisationId="org-1"
        currency="USD"
        onCreated={onCreated}
      />
    );

    expect(await screen.findByText(/No active, priced items/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create counter sale' })).toBeDisabled();
  });

  it('does not request inventory or render while closed', () => {
    const { queryByRole } = render(
      <CounterSaleDialog
        open={false}
        setOpen={setOpen}
        organisationId="org-1"
        currency="USD"
        onCreated={onCreated}
      />
    );
    expect(fetchInventoryItems).not.toHaveBeenCalled();
    expect(queryByRole('dialog')).not.toBeInTheDocument();
  });
});
