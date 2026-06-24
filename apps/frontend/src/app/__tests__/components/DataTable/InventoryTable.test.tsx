import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import InventoryTable from '@/app/ui/tables/InventoryTable';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, src }: any) => React.createElement('img', { alt, src }),
}));

jest.mock('react-icons/io5', () => ({
  IoEye: () => <span data-testid="icon-eye" />,
}));

jest.mock('@/app/lib/urls', () => ({
  getSafeOrgImageUrl: jest.fn((src: string) =>
    typeof src === 'string' && src.startsWith('inventory/') ? `https://cdn.example.com/${src}` : ''
  ),
}));

jest.mock('@/app/ui/cards/InventoryCard', () => ({
  __esModule: true,
  default: ({ item, handleViewInventory }: any) => (
    <div data-testid="mobile-card">
      <span>{item.basicInfo.name}</span>
      <button type="button" onClick={() => handleViewInventory(item)}>
        View Mobile
      </button>
    </div>
  ),
}));

jest.mock('@/app/ui/tables/GenericTable/GenericTable', () => ({
  __esModule: true,
  default: ({ data, columns }: any) => (
    <table data-testid="generic-table">
      <tbody>
        {data.map((row: any) => (
          <tr key={row.id} data-testid="table-row">
            {columns.map((col: any) => (
              <td key={col.key}>{col.render ? col.render(row) : row[col.key]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));

jest.mock('@/app/features/inventory/pages/Inventory/utils', () => ({
  displayStatusLabel: () => 'Healthy',
  formatCurrencyValue: (value: string | number) => `$ ${value}`,
  formatDisplayDate: () => '01 Jan 2025',
  formatPercentValue: () => '50%',
  getAvailableStock: () => 2,
  getMarginPercent: () => 50,
  getStatusBadgeStyle: () => ({ backgroundColor: '#000', color: '#fff' }),
}));

describe('InventoryTable', () => {
  const item = {
    id: 'item-1',
    basicInfo: {
      name: 'Vaccine',
      category: 'Medicine',
      status: 'ACTIVE',
    },
    stock: {
      current: 2,
      stockLocation: 'Shelf A',
    },
    pricing: {
      purchaseCost: 5,
      selling: 10,
    },
    batch: {
      expiryDate: '2025-01-01',
    },
  } as any;

  it('renders table data and mobile cards', () => {
    render(
      <InventoryTable
        filteredList={[item]}
        setActiveInventory={jest.fn()}
        setViewInventory={jest.fn()}
      />
    );

    const table = screen.getByTestId('generic-table');
    const tableScope = within(table);
    expect(tableScope.getByText('Vaccine')).toBeInTheDocument();
    expect(tableScope.getByText('Medicine')).toBeInTheDocument();
    expect(tableScope.getByText('2 units')).toBeInTheDocument();
    expect(tableScope.getByText('$ 5')).toBeInTheDocument();
    expect(tableScope.getByText('$ 10')).toBeInTheDocument();
    expect(tableScope.getByText('50%')).toBeInTheDocument();
    expect(tableScope.getByText('01 Jan 2025')).toBeInTheDocument();
    expect(tableScope.getByText('Shelf A')).toBeInTheDocument();
    expect(tableScope.getByText('Healthy')).toBeInTheDocument();

    const cards = screen.getAllByTestId('mobile-card');
    expect(cards).toHaveLength(1);
  });

  it('handles view action', () => {
    const setActiveInventory = jest.fn();
    const setViewInventory = jest.fn();

    render(
      <InventoryTable
        filteredList={[item]}
        setActiveInventory={setActiveInventory}
        setViewInventory={setViewInventory}
      />
    );

    fireEvent.click(screen.getByTestId('icon-eye').closest('button')!);
    expect(setActiveInventory).toHaveBeenCalledWith(item);
    expect(setViewInventory).toHaveBeenCalledWith(true);
  });

  it('prefers onView over the legacy setters when provided', () => {
    const setActiveInventory = jest.fn();
    const setViewInventory = jest.fn();
    const onView = jest.fn();

    render(
      <InventoryTable
        filteredList={[item]}
        setActiveInventory={setActiveInventory}
        setViewInventory={setViewInventory}
        onView={onView}
      />
    );

    fireEvent.click(screen.getByTestId('icon-eye').closest('button')!);
    expect(onView).toHaveBeenCalledWith(item);
    expect(setViewInventory).not.toHaveBeenCalled();
  });

  it('renders the restock action and fires onRestock', () => {
    const onRestock = jest.fn();

    render(
      <InventoryTable
        filteredList={[item]}
        setActiveInventory={jest.fn()}
        setViewInventory={jest.fn()}
        onRestock={onRestock}
      />
    );

    const restockBtn = screen.getByRole('button', { name: 'Restock Vaccine' });
    fireEvent.click(restockBtn);
    expect(onRestock).toHaveBeenCalledWith(item);
  });

  it('exposes accessible labels for the action icons (tooltip triggers)', () => {
    render(
      <InventoryTable
        filteredList={[item]}
        setActiveInventory={jest.fn()}
        setViewInventory={jest.fn()}
        onRestock={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'View Vaccine' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restock Vaccine' })).toBeInTheDocument();
  });

  it('renders an inventory image when the item stores an s3 key', () => {
    const itemWithImage = {
      ...item,
      basicInfo: {
        ...item.basicInfo,
        imageUrl: 'inventory/org-1/vaccine.jpg',
      },
    };

    render(
      <InventoryTable
        filteredList={[itemWithImage]}
        setActiveInventory={jest.fn()}
        setViewInventory={jest.fn()}
      />
    );

    expect(screen.getByAltText('')).toHaveAttribute(
      'src',
      'https://cdn.example.com/inventory/org-1/vaccine.jpg'
    );
  });
});
