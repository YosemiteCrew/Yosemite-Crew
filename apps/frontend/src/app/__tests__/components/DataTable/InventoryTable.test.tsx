import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import InventoryTable from '../../../components/DataTable/InventoryTable';

jest.mock('react-icons/bs', () => ({
  BsFillBoxSeamFill: () => <span data-testid="box-icon" />,
}));

const mockGenericTableProps: any = {};
jest.mock('@/app/components/GenericTable/GenericTable', () => ({
  __esModule: true,
  default: (props: any) => {
    Object.assign(mockGenericTableProps, props);
    return <div data-testid="mock-generic-table" />;
  },
}));

const mockInventoryData: any[] = [
  {
    status: 'in-stock',
    itemName: 'Metformin',
    genericName: 'Metformin Hydrochloride',
    sku: 'SKU12345',
    strength: '500mg',
    category: 'Antidiabetic',
    manufacturer: 'Pharma Inc.',
    price: '₹150.00',
    manufacturerPrice: '₹120.00',
    stockReorderLevel: 50,
    quantity: 200,
    expiryDate: '2025-12-31',
  },
  {
    status: 'low-stock',
    itemName: 'Amoxicillin',
    genericName: 'Amoxicillin Trihydrate',
    sku: 'SKU67890',
    strength: '250mg',
    category: 'Antibiotic',
    manufacturer: 'Health Co.',
    price: '₹250.00',
    manufacturerPrice: '₹200.00',
    stockReorderLevel: 20,
    quantity: 15,
    expiryDate: '2026-06-30',
  },
];

describe('InventoryTable Component', () => {
  beforeEach(() => {
    for (const key in mockGenericTableProps) {
      delete mockGenericTableProps[key];
    }
  });

  test('should pass the correct data and columns to GenericTable', () => {
    render(<InventoryTable data={mockInventoryData} />);

    expect(screen.getByTestId('mock-generic-table')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sell All' })).toBeInTheDocument();

    expect(mockGenericTableProps.data).toEqual(mockInventoryData);
    expect(mockGenericTableProps.columns).toHaveLength(10);
    expect(mockGenericTableProps.bordered).toBe(false);
  });

  test('should render all column content correctly for 100% coverage', () => {
    render(<InventoryTable data={mockInventoryData} />);
    const { columns } = mockGenericTableProps;
    const inStockItem = mockInventoryData[0];
    const lowStockItem = mockInventoryData[1];

    const getColumnRender = (key: string) => columns.find((c: any) => c.key === key)?.render;

    const avatarRender = getColumnRender('avatar');
    const { container: inStockContainer } = render(<>{avatarRender(inStockItem)}</>);
    expect(inStockContainer.querySelector('.inv-status-dot')).toHaveClass('in-stock');

    const { container: lowStockContainer } = render(<>{avatarRender(lowStockItem)}</>);
    expect(lowStockContainer.querySelector('.inv-status-dot')).toHaveClass('low-stock');

    const nameRender = getColumnRender('name');
    expect(render(<>{nameRender(inStockItem)}</>).getByText('Metformin')).toBeInTheDocument();

    const genericNameRender = getColumnRender('genericName');
    expect(render(<>{genericNameRender(inStockItem)}</>).getByText('Metformin Hydrochloride')).toBeInTheDocument();

    const skuRender = getColumnRender('sku');
    expect(render(<>{skuRender(inStockItem)}</>).getByText('SKU12345')).toBeInTheDocument();

    const categoryRender = getColumnRender('category');
    expect(render(<>{categoryRender(inStockItem)}</>).getByText('Antidiabetic')).toBeInTheDocument();

    const manufacturerRender = getColumnRender('manufacturer');
    expect(render(<>{manufacturerRender(inStockItem)}</>).getByText('Pharma Inc.')).toBeInTheDocument();

    const priceRender = getColumnRender('price');
    expect(render(<>{priceRender(inStockItem)}</>).getByText('₹150.00')).toBeInTheDocument();

    const manufacturerPriceRender = getColumnRender('manufacturerPrice');
    expect(render(<>{manufacturerPriceRender(inStockItem)}</>).getByText('₹120.00')).toBeInTheDocument();

    const stockRender = getColumnRender('stock');
    const { container: stockContainer } = render(<>{stockRender(inStockItem)}</>);
    expect(within(stockContainer).getByText('50')).toBeInTheDocument();
    expect(within(stockContainer).getByText('200')).toBeInTheDocument(); 
    expect(within(stockContainer).getByTestId('box-icon')).toBeInTheDocument();

    const expiryRender = getColumnRender('expiry');
    expect(render(<>{expiryRender(inStockItem)}</>).getByText('2025-12-31')).toBeInTheDocument();
  });
});
