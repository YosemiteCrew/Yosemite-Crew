import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import InventoryCard from '@/app/ui/cards/InventoryCard';

describe('<InventoryCard />', () => {
  const item = {
    basicInfo: {
      name: 'Heartworm Med',
      category: 'Medicine',
      subCategory: '',
      department: '',
      description: 'Desc',
      status: 'Low stock',
    },
    pricing: {
      purchaseCost: '12',
      selling: '15',
      maxDiscount: '',
      tax: '',
    },
    stock: {
      current: '3',
      allocated: '',
      available: '',
      reorderLevel: '5',
      reorderQuantity: '',
      stockLocation: 'Pharmacy',
      stockType: '',
      minStockAlert: '',
    },
    batch: {
      batch: '',
      manufactureDate: '',
      expiryDate: '2030-02-01',
      serial: '',
      tracking: '',
      litterId: '',
      nextRefillDate: '',
    },
    status: 'Low stock',
  };

  test('renders inventory fields and status', () => {
    render(<InventoryCard item={item} handleViewInventory={jest.fn()} />);

    expect(screen.getByText('Heartworm Med')).toBeInTheDocument();
    expect(screen.getByText('Medicine')).toBeInTheDocument();
    expect(screen.getByText('3 units')).toBeInTheDocument();
    expect(screen.getByText('$ 12')).toBeInTheDocument();
    expect(screen.getByText('$ 15')).toBeInTheDocument();
    expect(screen.getByText('Feb 1, 2030')).toBeInTheDocument();
    expect(screen.getByText('Pharmacy')).toBeInTheDocument();
    expect(screen.getByText('Low stock')).toBeInTheDocument();
  });

  test('invokes view handler on button click', () => {
    const onView = jest.fn();
    render(<InventoryCard item={item} handleViewInventory={onView} />);

    fireEvent.click(screen.getByText('View'));
    expect(onView).toHaveBeenCalledWith(item);
  });

  test('renders placeholders for blank stock, null location, missing prices and no expiry', () => {
    render(
      <InventoryCard
        item={{
          ...item,
          pricing: { ...item.pricing, purchaseCost: undefined, selling: undefined },
          stock: { ...item.stock, current: undefined, stockLocation: null },
          batch: { ...item.batch, expiryDate: '' },
        }}
        handleViewInventory={jest.fn()}
      />
    );

    // Blank stock and null location both fall back to the em-dash placeholder.
    expect(screen.getAllByText('—')).toHaveLength(3); // stock, expiry, location
    expect(screen.queryByText(/units/)).not.toBeInTheDocument();
    // Missing prices coerce to 0 via `value ?? 0`, they are not placeholders.
    expect(screen.getAllByText('$ 0')).toHaveLength(3); // unit cost, selling, total
  });

  test('renders a numeric stock value and treats an undefined location as missing', () => {
    render(
      <InventoryCard
        item={{
          ...item,
          stock: { ...item.stock, current: 5, stockLocation: undefined },
        }}
        handleViewInventory={jest.fn()}
      />
    );

    // A number short-circuits the `typeof val === 'string'` guard in displayValue.
    expect(screen.getByText('5 units')).toBeInTheDocument();
    // undefined location hits the first side of `val === undefined || val === null`.
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('$ 75')).toBeInTheDocument(); // 15 * 5
  });

  test('renders a placeholder when a price is not a finite number', () => {
    render(
      <InventoryCard
        item={{
          ...item,
          pricing: { ...item.pricing, purchaseCost: 'abc', selling: 'abc' },
        }}
        handleViewInventory={jest.fn()}
      />
    );

    // formatCurrency placeholder for unit cost + selling, and totalValue's NaN price.
    expect(screen.getAllByText('—')).toHaveLength(3);
  });

  test('renders a placeholder for total value when stock on hand is not a finite number', () => {
    render(
      <InventoryCard
        item={{
          ...item,
          stock: { ...item.stock, current: 'xyz' },
        }}
        handleViewInventory={jest.fn()}
      />
    );

    // Price is finite, so the second side of the totalValue guard decides.
    expect(screen.getByText('xyz units')).toBeInTheDocument();
    expect(screen.getByText('$ 12')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
