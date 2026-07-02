import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import CompanionHistoryPage from '@/app/features/companionHistory/pages/CompanionHistoryPage';

expect.extend(toHaveNoViolations);

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: () => Promise<unknown>) => {
    const source = loader.toString();
    const LoadableComponent = (props: Record<string, unknown>) => {
      if (source.includes('CompanionHistoryTimeline')) {
        const MockTimeline = (
          jest.requireMock(
            '@/app/features/companionHistory/components/CompanionHistoryTimeline'
          ) as {
            default: React.FC<Record<string, unknown>>;
          }
        ).default;
        return <MockTimeline {...props} />;
      }

      return null;
    };

    LoadableComponent.displayName = 'MockDynamicComponent';
    return LoadableComponent;
  },
}));

const pushMock = jest.fn();
const startRouteLoaderMock = jest.fn();
const searchGetMock = jest.fn();
const useCompanionsParentsForPrimaryOrgMock = jest.fn();
const useCompanionStoreMock = jest.fn();
const replaceCompanionTextMock = jest.fn((text: string) => text);
const mockUpdateCompanion = jest.fn();
const mockUpdateParent = jest.fn();
const mockNotify = jest.fn();

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: any) => <span>{alt}</span>,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => ({ get: searchGetMock }),
}));

jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="protected">{children}</div>,
}));

jest.mock('@/app/ui/layout/guards/OrgGuard', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="org-guard">{children}</div>,
}));

jest.mock('@/app/ui/primitives/Icons/Back', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Back
    </button>
  ),
}));

jest.mock('@/app/features/companionHistory/components/CompanionHistoryTimeline', () => ({
  __esModule: true,
  default: ({ companionId, showDocumentUpload }: any) => (
    <div data-testid="timeline">{`${companionId}-${String(showDocumentUpload)}`}</div>
  ),
}));

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AddAppointmentCentralModal',
  () => ({
    __esModule: true,
    default: ({ showModal, initialCompanionId }: any) =>
      showModal ? <div data-testid="add-appointment-modal">{initialCompanionId}</div> : null,
  })
);

jest.mock('@/app/hooks/useCompanion', () => ({
  useLoadCompanionsForPrimaryOrg: jest.fn(),
  useCompanionsParentsForPrimaryOrg: () => useCompanionsParentsForPrimaryOrgMock(),
}));

jest.mock('@/app/hooks/useCompanionTerminologyText', () => ({
  useCompanionTerminologyText: () => replaceCompanionTextMock,
}));

jest.mock('@/app/lib/urls', () => ({
  getSafeImageUrl: jest.fn(() => '/safe-photo.jpg'),
}));

jest.mock('@/app/lib/routeLoader', () => ({
  startRouteLoader: () => startRouteLoaderMock(),
}));

jest.mock('@/app/features/companions/services/companionService', () => ({
  updateCompanion: (...args: unknown[]) => mockUpdateCompanion(...args),
  updateParent: (...args: unknown[]) => mockUpdateParent(...args),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: mockNotify }),
}));

jest.mock('@/app/stores/companionStore', () => ({
  useCompanionStore: (selector: (s: { status: string }) => unknown) =>
    useCompanionStoreMock(selector),
}));

jest.mock('@/app/ui/layout/PageSkeleton', () => ({
  __esModule: true,
  default: () => <div className="animate-pulse" data-testid="page-skeleton" />,
}));

describe('CompanionHistoryPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    searchGetMock.mockImplementation((key: string) => {
      if (key === 'companionId') return null;
      if (key === 'source') return null;
      if (key === 'backTo') return null;
      return null;
    });
    useCompanionsParentsForPrimaryOrgMock.mockReturnValue([]);
    useCompanionStoreMock.mockImplementation((selector: (s: { status: string }) => unknown) =>
      selector({ status: 'loaded' })
    );
    mockUpdateCompanion.mockResolvedValue(undefined);
    mockUpdateParent.mockResolvedValue(undefined);
  });

  it('shows missing companion notice and uses fallback back path', () => {
    render(<CompanionHistoryPage />);

    expect(screen.getByText('Companion Overview')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Companion id is missing. Please open overview from Appointments or Companions.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByTestId('timeline')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(startRouteLoaderMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith('/companions');
  });

  it('shows skeleton when companions are still loading', () => {
    useCompanionStoreMock.mockImplementation((selector: (s: { status: string }) => unknown) =>
      selector({ status: 'loading' })
    );

    render(<CompanionHistoryPage />);

    // Loading state renders PageSkeleton — heading must not appear yet
    expect(screen.queryByText('Companion Overview')).not.toBeInTheDocument();
    // Skeleton container is present
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders timeline and companion summary when companion id is present', () => {
    searchGetMock.mockImplementation((key: string) => {
      if (key === 'companionId') return 'c-1';
      if (key === 'source') return 'appointments';
      if (key === 'backTo') return null;
      return null;
    });
    useCompanionsParentsForPrimaryOrgMock.mockReturnValue([
      {
        companion: {
          id: 'c-1',
          name: 'Buddy',
          photoUrl: '/buddy.jpg',
          breed: 'Labrador',
          type: 'dog',
          gender: 'male',
          isneutered: true,
          isInsured: false,
          dateOfBirth: new Date('2021-01-01'),
          parentId: 'p-1',
          organisationId: 'org-1',
        },
        parent: {
          id: 'p-1',
          firstName: 'Sam',
          lastName: 'Owner',
          email: 'sam@example.com',
          phoneNumber: '+15555555555',
          address: {},
          createdFrom: 'pms',
        },
      },
    ]);

    render(<CompanionHistoryPage />);

    expect(screen.getByTestId('timeline')).toHaveTextContent('c-1-true');
    expect(screen.getByText("Buddy's Overview")).toBeInTheDocument();
    expect(screen.getByText('Labrador / Canine')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(startRouteLoaderMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith('/appointments');
  });

  it('shows patient and client alert tooltips on hover', async () => {
    searchGetMock.mockImplementation((key: string) => {
      if (key === 'companionId') return 'c-1';
      if (key === 'source') return 'appointments';
      if (key === 'backTo') return null;
      return null;
    });
    useCompanionsParentsForPrimaryOrgMock.mockReturnValue([
      {
        companion: {
          id: 'c-1',
          name: 'Buddy',
          photoUrl: '/buddy.jpg',
          breed: 'Labrador',
          type: 'dog',
          gender: 'male',
          isneutered: true,
          isInsured: false,
          dateOfBirth: new Date('2021-01-01'),
          parentId: 'p-1',
          organisationId: 'org-1',
        },
        parent: {
          id: 'p-1',
          firstName: 'Sam',
          lastName: 'Owner',
          email: 'sam@example.com',
          phoneNumber: '+15555555555',
          address: {},
          createdFrom: 'pms',
        },
      },
    ]);

    render(<CompanionHistoryPage />);

    const patientTrigger = screen
      .getByRole('button', { name: /add companion alert/i })
      .closest('.glass-tooltip');
    expect(patientTrigger).not.toBeNull();
    fireEvent.mouseEnter(patientTrigger as Element);
    expect(await screen.findByText('Add alerts for patient')).toBeInTheDocument();

    const clientTrigger = screen
      .getByRole('button', { name: /add client alert/i })
      .closest('.glass-tooltip');
    expect(clientTrigger).not.toBeNull();
    fireEvent.mouseEnter(clientTrigger as Element);
    expect(await screen.findByText('Add alert for client')).toBeInTheDocument();
  });

  it('saves client alerts through the parent update service', async () => {
    searchGetMock.mockImplementation((key: string) => {
      if (key === 'companionId') return 'c-1';
      if (key === 'source') return 'appointments';
      if (key === 'backTo') return null;
      return null;
    });
    const parent = {
      id: 'p-1',
      firstName: 'Sam',
      lastName: 'Owner',
      email: 'sam@example.com',
      phoneNumber: '+15555555555',
      address: {},
      createdFrom: 'pms',
    };
    useCompanionsParentsForPrimaryOrgMock.mockReturnValue([
      {
        companion: {
          id: 'c-1',
          name: 'Buddy',
          photoUrl: '/buddy.jpg',
          breed: 'Labrador',
          type: 'dog',
          gender: 'male',
          isneutered: true,
          isInsured: false,
          dateOfBirth: new Date('2021-01-01'),
          parentId: 'p-1',
          organisationId: 'org-1',
        },
        parent,
      },
    ]);

    render(<CompanionHistoryPage />);

    fireEvent.click(screen.getByRole('button', { name: /add client alert/i }));
    fireEvent.change(screen.getByLabelText(/call before visit/i), {
      target: { value: 'Call before visit' },
    });
    const submitButton = screen.getAllByRole('button', { name: 'Add client alert' }).at(-1);
    expect(submitButton).toBeDefined();
    fireEvent.click(submitButton!);

    await waitFor(() => expect(mockUpdateParent).toHaveBeenCalledTimes(1));
    expect(mockUpdateParent).toHaveBeenCalledWith({
      ...parent,
      alerts: [{ title: 'Call before visit', severity: 'low' }],
    });
    expect(mockUpdateCompanion).not.toHaveBeenCalled();
  });

  it('has no axe violations on initial render', async () => {
    const { container } = render(<CompanionHistoryPage />);
    await screen.findByRole('heading', { level: 1, name: 'Companion Overview' });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('prefers safe backTo path and falls back for unsafe value', () => {
    searchGetMock.mockImplementation((key: string) => {
      if (key === 'companionId') return 'c-1';
      if (key === 'source') return 'appointments';
      if (key === 'backTo') return '/appointments/details';
      return null;
    });

    const { rerender } = render(<CompanionHistoryPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(startRouteLoaderMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith('/appointments/details');

    pushMock.mockClear();
    startRouteLoaderMock.mockClear();
    searchGetMock.mockImplementation((key: string) => {
      if (key === 'companionId') return 'c-1';
      if (key === 'source') return 'appointments';
      if (key === 'backTo') return 'https://evil.example';
      return null;
    });

    rerender(<CompanionHistoryPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(startRouteLoaderMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith('/appointments');
  });

  it('removes companion deep-link query when returning to companions', () => {
    searchGetMock.mockImplementation((key: string) => {
      if (key === 'companionId') return 'c-1';
      if (key === 'source') return 'companions';
      if (key === 'backTo') return '/companions?companionId=c-1';
      return null;
    });

    render(<CompanionHistoryPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(startRouteLoaderMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith('/companions');
  });
});
