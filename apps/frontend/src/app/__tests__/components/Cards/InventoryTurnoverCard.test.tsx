import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import InventoryTurnoverCard from '@/app/ui/cards/InventoryTurnoverCard';

describe('<InventoryTurnoverCard />', () => {
  const item = {
    name: 'Gloves',
    category: 'Consumable',
    beginningInventory: 50,
    endingInventory: 10,
    avgInventory: 30,
    totalPurchased: 200,
    turnsPerYear: 8,
    daysOnShelf: 45,
    status: 'Healthy',
  };

  test('renders turnover fields and status style', () => {
    render(<InventoryTurnoverCard item={item} />);

    expect(screen.getByText('Gloves')).toBeInTheDocument();
    expect(screen.getByText('Consumable')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();

    const status = screen.getByText('Healthy');
    expect(status).toBeInTheDocument();
    expect(status.style.backgroundColor).toBeTruthy();
  });

  test('reads the alternate averageInventory / totalPurchases field names', () => {
    const altItem = {
      ...item,
      avgInventory: undefined,
      totalPurchased: undefined,
      averageInventory: 42,
      totalPurchases: 314,
    };

    render(<InventoryTurnoverCard item={altItem} />);

    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('314')).toBeInTheDocument();
  });

  test('falls back to 0 when neither inventory field name is present', () => {
    const sparseItem = {
      name: 'Syringes',
      category: 'Consumable',
      beginningInventory: 5,
      endingInventory: 7,
      turnsPerYear: 1,
      daysOnShelf: 2,
      status: 'Healthy',
    };

    render(<InventoryTurnoverCard item={sparseItem} />);

    // Avg inventory and Total purchases both render the 0 fallback.
    expect(screen.getAllByText('0')).toHaveLength(2);
  });
});
