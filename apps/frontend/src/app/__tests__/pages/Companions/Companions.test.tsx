import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: () => Promise<unknown>) => {
    const source = loader.toString();
    // The CompanionInfo dynamic maps the module's named export — actually invoke the
    // loader so the `.then` mapper (import().then(m => ({ default: m.CompanionInfo })))
    // is exercised, then render the resolved component. Kept as its own component so
    // the hooks stay unconditional.
    if (source.includes('m.CompanionInfo')) {
      const CompanionInfoLoadable = (props: Record<string, unknown>) => {
        const [Comp, setComp] = React.useState<React.FC<Record<string, unknown>> | null>(null);
        React.useEffect(() => {
          let active = true;
          Promise.resolve(loader()).then((mod) => {
            if (active) {
              setComp(() => (mod as { default: React.FC<Record<string, unknown>> }).default);
            }
          });
          return () => {
            active = false;
          };
        }, []);
        return Comp ? <Comp {...props} /> : null;
      };
      CompanionInfoLoadable.displayName = 'MockDynamicComponent';
      return CompanionInfoLoadable;
    }
    const LoadableComponent = (props: Record<string, unknown>) => {
      // Central modals (revamp branch) render nothing; matched before the AddCompanion
      // substring so they don't pick up the plain AddCompanion mock.
      if (source.includes('AddCompanionCentralModal')) return null;
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
const searchParamsGetMock = jest.fn();
const isCompanionRevampEnabledMock = jest.fn();

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: (key: string) => searchParamsGetMock(key) }),
}));

jest.mock('@/app/lib/featureFlags', () => ({
  isCompanionRevampEnabled: () => isCompanionRevampEnabledMock(),
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

jest.mock('@/app/hooks/useAppointments', () => ({
  useAppointmentsForPrimaryOrg: () => [],
}));

jest.mock('@/app/features/companions/pages/Companions/InClinicTodayBand', () => ({
  __esModule: true,
  default: () => <div data-testid="in-clinic-band" />,
}));

jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => usePermissionsMock(),
}));

jest.mock('@/app/hooks/useCompanionTerminologyText', () => ({
  useCompanionTerminologyText: () => (text: string) => text,
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
    searchParamsGetMock.mockReturnValue(null);
    isCompanionRevampEnabledMock.mockReturnValue(false);
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
    expect(screen.getByTestId('in-clinic-band')).toBeInTheDocument();
    expect(companionsTableSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        filteredList: [
          expect.objectContaining({
            companion: expect.objectContaining({ id: 'c1' }),
          }),
        ],
        viewMode: 'list',
      })
    );

    // Two triggers share the label (desktop CTA + phone FAB) — click the first.
    fireEvent.click(screen.getAllByRole('button', { name: /Add companion/i })[0]);
    expect(screen.getByTestId('add-companion')).toBeInTheDocument();
  });

  it('shows the live patient / active counts in the title', () => {
    render(<ProtectedCompanions />);
    expect(screen.getByText('2 patients, 1 active')).toBeInTheDocument();
  });

  it('renders species tabs with live counts and filters by species', () => {
    // Empty query so species filtering is observable in the passed list.
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));
    render(<ProtectedCompanions />);

    expect(screen.getByRole('tab', { name: /All/ })).toHaveTextContent('2');
    expect(screen.getByRole('tab', { name: /Dogs/ })).toHaveTextContent('1');

    fireEvent.click(screen.getByRole('tab', { name: /Cats/ }));
    expect(companionsTableSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        filteredList: [
          expect.objectContaining({ companion: expect.objectContaining({ id: 'c2' }) }),
        ],
      })
    );
  });

  it('switches the table into grid view via the view toggle', () => {
    render(<ProtectedCompanions />);
    fireEvent.click(screen.getByRole('button', { name: 'Grid view' }));
    expect(companionsTableSpy.mock.calls.some(([props]) => props.viewMode === 'grid')).toBe(true);
  });

  it('toggles the last-visit sort control', () => {
    render(<ProtectedCompanions />);
    const sortPill = screen.getByRole('button', { name: /Last visit/ });
    expect(sortPill).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(sortPill);
    expect(sortPill).toHaveAttribute('aria-pressed', 'true');
  });

  it('opens the companion view from a companionId deep link', async () => {
    searchParamsGetMock.mockReturnValue('c1');
    render(<ProtectedCompanions />);
    // Revamp off → the CompanionInfo dynamic component is mounted and resolves.
    expect(await screen.findByTestId('companion-info')).toBeInTheDocument();
  });

  it('ignores a deep link that does not match any companion', () => {
    searchParamsGetMock.mockReturnValue('does-not-exist');
    render(<ProtectedCompanions />);
    expect(screen.queryByTestId('companion-info')).not.toBeInTheDocument();
  });

  it('renders the central modals when the companion revamp flag is enabled', () => {
    isCompanionRevampEnabledMock.mockReturnValue(true);
    render(<ProtectedCompanions />);
    // The revamp branch mounts the central add/appointment modals (mocked to null);
    // the table still renders alongside them.
    expect(screen.getByTestId('companions-table')).toBeInTheDocument();
  });

  it('reselects the first companion when the active one leaves the list', () => {
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));
    const { rerender } = render(<ProtectedCompanions />);

    // Swap in an entirely different set — the previously active companion (c1) is gone,
    // so the effect falls through to selecting the new first companion.
    useCompanionsMock.mockReturnValue([
      {
        companion: { id: 'c3', name: 'Milo', status: 'active', type: 'dog' },
        parent: { firstName: 'Kai' },
      },
      {
        companion: { id: 'c4', name: 'Nala', status: 'active', type: 'cat' },
        parent: { firstName: 'Ivy' },
      },
    ]);
    rerender(<ProtectedCompanions />);

    expect(companionsTableSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        filteredList: expect.arrayContaining([
          expect.objectContaining({ companion: expect.objectContaining({ id: 'c3' }) }),
        ]),
      })
    );
  });
});
