import { render, screen } from '@testing-library/react';
import Page from '@/app/(routes)/(app)/inventory/purchase-orders/page';

jest.mock('@/app/features/inventory/pages/PurchaseOrders', () => ({
  __esModule: true,
  default: () => <h1>Purchase orders content</h1>,
}));
jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/app/ui/layout/guards/OrgGuard', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));

it('renders the protected purchase orders route', () => {
  render(<Page />);
  expect(screen.getByRole('heading', { name: 'Purchase orders content' })).toBeVisible();
});
