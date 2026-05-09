import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: () => Promise<unknown>) => {
    const source = loader.toString();
    const LoadableComponent = (props: Record<string, unknown>) => {
      if (source.includes('components/AddCompanion')) {
        const Mock = jest.requireMock(
          '@/app/features/companions/components/AddCompanion'
        ) as React.FC<Record<string, unknown>>;
        return <Mock {...props} />;
      }
      return null;
    };
    LoadableComponent.displayName = 'MockDynamicComponent';
    return LoadableComponent;
  },
}));

import ProtectedCompanions from '@/app/features/companions/pages/Companions/Companions';

const useCompanionsMock = jest.fn();
const usePermissionsMock = jest.fn();
const useSearchStoreMock = jest.fn();
const companionsTableSpy = jest.fn();

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: () => null }),
}));

jest.mock('@/app/ui/layout/PageSkeleton', () => ({
  __esModule: true,
  default: () => <div className="animate-pulse" />,
}));

jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/layout/guards/OrgGuard', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/hooks/useCompanion', () => ({
  useCompanionsParentsForPrimaryOrg: () => useCompanionsMock(),
}));

jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => usePermissionsMock(),
}));

jest.mock('@/app/stores/searchStore', () => ({
  useSearchStore: (selector: any) => useSearchStoreMock(selector),
}));

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/filters/Filters', () => (props: any) => (
  <div data-testid="filters">
    {props.showAddButton && (
      <button type="button" onClick={props.onAddButtonClick}>
        {props.addButtonText}
      </button>
    )}
  </div>
));

jest.mock('@/app/ui/tables/CompanionsTable', () => (props: any) => {
  companionsTableSpy(props);
  return <div data-testid="companions-table" />;
});

jest.mock(
  '@/app/features/companions/components/AddCompanion',
  () => (props: any) => (props.showModal ? <div data-testid="add-companion" /> : null)
);

jest.mock('@/app/features/companions/components', () => ({
  __esModule: true,
  CompanionInfo: () => <div data-testid="companion-info" />,
}));

jest.mock('@/app/features/companions/pages/Companions/BookAppointment', () => () => (
  <div data-testid="book-appointment" />
));

jest.mock('@/app/features/companions/pages/Companions/AddTask', () => () => (
  <div data-testid="add-task" />
));

jest.mock('@/app/features/companions/pages/Companions/ChangeStatus', () => () => (
  <div data-testid="change-companion-status" />
));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

describe('Companions page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCompanionsMock.mockReturnValue([
      {
        companion: { id: 'c1', name: 'Buddy', status: 'active', type: 'dog' },
        parent: { firstName: 'Sam' },
      },
      {
        companion: { id: 'c2', name: 'Rex', status: 'inactive', type: 'cat' },
        parent: { firstName: 'Alex' },
      },
    ]);
    usePermissionsMock.mockReturnValue({
      can: jest.fn(() => true),
    });
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: 'buddy' }));
  });

  it('has no axe violations', async () => {
    const { container } = render(<ProtectedCompanions />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders h1 page heading', () => {
    render(<ProtectedCompanions />);
    expect(screen.getByRole('heading', { level: 1, name: /Companions/ })).toBeInTheDocument();
  });

  it('renders filtered companions and opens add modal', () => {
    render(<ProtectedCompanions />);

    expect(screen.getByTestId('companions-table')).toBeInTheDocument();
    expect(companionsTableSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        filteredList: [
          expect.objectContaining({
            companion: expect.objectContaining({ id: 'c1' }),
          }),
        ],
      })
    );

    fireEvent.click(screen.getByText('Add'));
    expect(screen.getByTestId('add-companion')).toBeInTheDocument();
  });
});
