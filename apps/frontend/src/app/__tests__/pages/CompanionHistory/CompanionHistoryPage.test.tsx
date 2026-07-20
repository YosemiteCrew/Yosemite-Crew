import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import CompanionHistoryPage from '@/app/features/companionHistory/pages/CompanionHistoryPage';

type RecordOverrides = {
  companion?: Record<string, unknown>;
  parent?: Record<string, unknown>;
};

const buildRecord = ({ companion = {}, parent = {} }: RecordOverrides = {}) => ({
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
    ...companion,
  },
  parent: {
    id: 'p-1',
    firstName: 'Sam',
    lastName: 'Owner',
    email: 'sam@example.com',
    phoneNumber: '+15555555555',
    address: {},
    createdFrom: 'pms',
    ...parent,
  },
});

const withCompanionId = (key: string) => {
  if (key === 'companionId') return 'c-1';
  if (key === 'source') return 'appointments';
  return null;
};

const canMock = jest.fn();
const useAppointmentsForPrimaryOrgMock = jest.fn();

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
let mockIsPhone = false;

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

jest.mock('@/app/ui/layout/PhoneShell/useIsPhone', () => ({
  useIsPhone: () => mockIsPhone,
  PHONE_MEDIA_QUERY: '(max-width: 767px)',
}));

jest.mock('@/app/features/companionHistory/pages/phone/PhoneCompanionRecord', () => ({
  __esModule: true,
  default: ({ title, canEdit, onAddAppointment, onEdit, onAddCompanionAlert }: any) => (
    <div data-testid="phone-record" data-can-edit={String(canEdit)}>
      {title}
      <button type="button" onClick={onAddAppointment}>
        book
      </button>
      {onEdit ? (
        <button type="button" onClick={onEdit}>
          edit
        </button>
      ) : null}
      <button type="button" onClick={onAddCompanionAlert}>
        add-alert
      </button>
    </div>
  ),
}));

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AddAppointmentCentralModal',
  () => ({
    __esModule: true,
    default: ({ showModal, initialCompanionId, setActiveFilter, setActiveStatus }: any) => {
      // Exercise the page's ref-backed filter/status setters with both a plain
      // value and an updater function (they only write refs — no re-render).
      setActiveFilter('all');
      setActiveFilter((prev: string) => prev);
      setActiveStatus('all');
      setActiveStatus((prev: string) => prev);
      return showModal ? <div data-testid="add-appointment-modal">{initialCompanionId}</div> : null;
    },
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

jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: (permission: string) => canMock(permission) }),
}));

jest.mock('@/app/hooks/useAppointments', () => ({
  useLoadAppointmentsForPrimaryOrg: jest.fn(),
  useAppointmentsForPrimaryOrg: () => useAppointmentsForPrimaryOrgMock(),
}));

jest.mock('@/app/features/companions/components/AddCompanionCentralModal', () => ({
  __esModule: true,
  default: ({ showModal, viewCompanion }: any) =>
    showModal ? <div data-testid="edit-companion-modal">{viewCompanion?.companion?.id}</div> : null,
}));

jest.mock('@/app/features/companions/components/CompanionInfo', () => ({
  __esModule: true,
  default: ({ showModal, activeCompanion }: any) =>
    showModal ? (
      <div data-testid="legacy-companion-modal">{activeCompanion?.companion?.id}</div>
    ) : null,
}));

jest.mock('@/app/lib/featureFlags', () => ({
  isCompanionRevampEnabled: jest.fn(() => false),
}));

jest.mock('@/app/ui/layout/PageSkeleton', () => ({
  __esModule: true,
  default: () => <div className="animate-pulse" data-testid="page-skeleton" />,
}));

describe('CompanionHistoryPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsPhone = false;
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
    canMock.mockReturnValue(true);
    useAppointmentsForPrimaryOrgMock.mockReturnValue([]);
  });

  it('shows missing companion notice and uses fallback back path', () => {
    render(<CompanionHistoryPage />);

    expect(screen.getByText('Companion overview')).toBeInTheDocument();
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
    expect(screen.queryByText('Companion overview')).not.toBeInTheDocument();
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
    expect(screen.getByText("Buddy's overview")).toBeInTheDocument();
    expect(screen.getByText('Labrador / Canine')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(startRouteLoaderMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith('/appointments');
  });

  it('renders the bespoke phone record below the phone breakpoint', () => {
    mockIsPhone = true;
    searchGetMock.mockImplementation(withCompanionId);
    useCompanionsParentsForPrimaryOrgMock.mockReturnValue([buildRecord()]);

    render(<CompanionHistoryPage />);

    const phoneRecord = screen.getByTestId('phone-record');
    expect(phoneRecord).toHaveTextContent("Buddy's overview");
    expect(phoneRecord).toHaveAttribute('data-can-edit', 'true');
    // The desktop overview (its h1 heading and profile regions) is not rendered.
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Companion profile' })).not.toBeInTheDocument();

    // Shared modals still mount, so the phone Book-appointment CTA reaches them.
    fireEvent.click(screen.getByRole('button', { name: 'book' }));
    expect(screen.getByTestId('add-appointment-modal')).toHaveTextContent('c-1');

    // The phone edit affordance opens the shared companion editor.
    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    expect(screen.getByTestId('legacy-companion-modal')).toHaveTextContent('c-1');

    // The phone add-alert affordance opens the shared alert modal.
    fireEvent.click(screen.getByRole('button', { name: 'add-alert' }));
    expect(screen.getByLabelText(/needs muzzle/i)).toBeInTheDocument();
  });

  it('falls back to the desktop layout on phone when no companion id is present', () => {
    mockIsPhone = true;

    render(<CompanionHistoryPage />);

    // Without a companion id the phone record is gated off and the desktop
    // missing-companion notice is shown instead.
    expect(screen.queryByTestId('phone-record')).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'Companion id is missing. Please open overview from Appointments or Companions.'
      )
    ).toBeInTheDocument();
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
    await screen.findByRole('heading', { level: 1, name: 'Companion overview' });
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

  it('keeps a non-companions companions path and preserves remaining query params', () => {
    // Sub-path of /companions: removeCompanionDeepLinkParam returns it unchanged.
    searchGetMock.mockImplementation((key: string) => {
      if (key === 'companionId') return 'c-1';
      if (key === 'source') return 'companions';
      if (key === 'backTo') return '/companions/c-1/records';
      return null;
    });
    const { rerender } = render(<CompanionHistoryPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(pushMock).toHaveBeenCalledWith('/companions/c-1/records');

    // /companions with an extra param: only companionId is stripped, the rest stays.
    pushMock.mockClear();
    searchGetMock.mockImplementation((key: string) => {
      if (key === 'companionId') return 'c-1';
      if (key === 'source') return 'companions';
      if (key === 'backTo') return '/companions?companionId=c-1&view=grid';
      return null;
    });
    rerender(<CompanionHistoryPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(pushMock).toHaveBeenCalledWith('/companions?view=grid');
  });

  it('renders patient and client alert pills from persisted alerts', () => {
    searchGetMock.mockImplementation(withCompanionId);
    useCompanionsParentsForPrimaryOrgMock.mockReturnValue([
      buildRecord({
        companion: { alerts: [{ title: 'Diabetic', severity: 'high' }] },
        parent: { alerts: [{ title: 'Call first', severity: 'low' }] },
      }),
    ]);

    render(<CompanionHistoryPage />);

    expect(screen.getByText('Diabetic')).toBeInTheDocument();
    expect(screen.getByText('Call first')).toBeInTheDocument();
    // Each rendered alert pill carries its own remove control.
    expect(screen.getByRole('button', { name: 'Remove alert Diabetic' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove alert Call first' })).toBeInTheDocument();
  });

  it('saves a companion alert through the companion update service', async () => {
    searchGetMock.mockImplementation(withCompanionId);
    const record = buildRecord();
    useCompanionsParentsForPrimaryOrgMock.mockReturnValue([record]);

    render(<CompanionHistoryPage />);

    fireEvent.click(screen.getByRole('button', { name: /add companion alert/i }));
    fireEvent.change(screen.getByLabelText(/needs muzzle/i), { target: { value: 'Diabetic' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add alert' }));

    await waitFor(() => expect(mockUpdateCompanion).toHaveBeenCalledTimes(1));
    expect(mockUpdateCompanion).toHaveBeenCalledWith({
      ...record.companion,
      alerts: [{ title: 'Diabetic', severity: 'low' }],
    });
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Alert added' })
    );
    expect(mockUpdateParent).not.toHaveBeenCalled();
  });

  it('notifies an error when saving an alert fails', async () => {
    searchGetMock.mockImplementation(withCompanionId);
    useCompanionsParentsForPrimaryOrgMock.mockReturnValue([buildRecord()]);
    mockUpdateCompanion.mockRejectedValueOnce(new Error('network'));

    render(<CompanionHistoryPage />);

    fireEvent.click(screen.getByRole('button', { name: /add companion alert/i }));
    fireEvent.change(screen.getByLabelText(/needs muzzle/i), { target: { value: 'Diabetic' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add alert' }));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Failed to add alert' })
      )
    );
  });

  it('removes a companion alert and notifies success, then surfaces a failure', async () => {
    searchGetMock.mockImplementation(withCompanionId);
    useCompanionsParentsForPrimaryOrgMock.mockReturnValue([
      buildRecord({ companion: { alerts: [{ title: 'Diabetic', severity: 'high' }] } }),
    ]);

    render(<CompanionHistoryPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove alert Diabetic' }));
    await waitFor(() => expect(mockUpdateCompanion).toHaveBeenCalledTimes(1));
    expect(mockUpdateCompanion).toHaveBeenCalledWith(expect.objectContaining({ alerts: [] }));
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Alert removed' })
    );

    // Second removal attempt fails.
    mockUpdateCompanion.mockRejectedValueOnce(new Error('boom'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove alert Diabetic' }));
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Failed to remove alert' })
      )
    );
  });

  it('removes a client alert and notifies success, then surfaces a failure', async () => {
    searchGetMock.mockImplementation(withCompanionId);
    useCompanionsParentsForPrimaryOrgMock.mockReturnValue([
      buildRecord({ parent: { alerts: [{ title: 'Call first', severity: 'low' }] } }),
    ]);

    render(<CompanionHistoryPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove alert Call first' }));
    await waitFor(() => expect(mockUpdateParent).toHaveBeenCalledTimes(1));
    expect(mockUpdateParent).toHaveBeenCalledWith(expect.objectContaining({ alerts: [] }));
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Alert removed' })
    );

    mockUpdateParent.mockRejectedValueOnce(new Error('boom'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove alert Call first' }));
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Failed to remove alert' })
      )
    );
  });

  it('falls back for missing parent fields and species image type', () => {
    searchGetMock.mockImplementation(withCompanionId);
    useCompanionsParentsForPrimaryOrgMock.mockReturnValue([
      buildRecord({
        // Unknown species → image type falls back to the default.
        companion: { type: 'fish' },
        parent: { id: '', firstName: '', lastName: '', email: '', phoneNumber: '' },
      }),
    ]);

    render(<CompanionHistoryPage />);

    const parentSection = screen.getByRole('region', { name: 'Parent profile' });
    const readDetail = (label: string) =>
      within(parentSection).getByText(`${label}:`).parentElement?.querySelector('span:last-child')
        ?.textContent ?? '';

    // Empty parent id → Client ID falls back to the companion id.
    expect(readDetail('Client ID')).toBe('c-1');
    expect(readDetail('Client')).toBe('-');
    expect(readDetail('Email')).toBe('-');
    expect(readDetail('Phone')).toBe('-');
  });

  it('formats the parent age / DOB across value variants', () => {
    searchGetMock.mockImplementation(withCompanionId);

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    oneYearAgo.setDate(oneYearAgo.getDate() - 1);

    const future = new Date();
    future.setFullYear(future.getFullYear() + 2);

    const readParentAgeDob = () => {
      const parentSection = screen.getByRole('region', { name: 'Parent profile' });
      return (
        within(parentSection)
          .getByText('Age / DOB:')
          .parentElement?.querySelector('span:last-child')?.textContent ?? ''
      );
    };

    // Plural years.
    useCompanionsParentsForPrimaryOrgMock.mockReturnValue([
      buildRecord({
        companion: { type: undefined },
        parent: { birthDate: new Date('2000-01-02') },
      }),
    ]);
    let view = render(<CompanionHistoryPage />);
    expect(readParentAgeDob()).toMatch(/years \//);
    view.unmount();

    // Singular year.
    useCompanionsParentsForPrimaryOrgMock.mockReturnValue([
      buildRecord({ parent: { birthDate: oneYearAgo } }),
    ]);
    view = render(<CompanionHistoryPage />);
    expect(readParentAgeDob()).toMatch(/1 year \//);
    view.unmount();

    // Future date → negative age → date only, no age label.
    useCompanionsParentsForPrimaryOrgMock.mockReturnValue([
      buildRecord({ parent: { birthDate: future } }),
    ]);
    view = render(<CompanionHistoryPage />);
    expect(readParentAgeDob()).not.toMatch(/year/);
    view.unmount();

    // Unparseable date → non-finite age → fallback dash.
    useCompanionsParentsForPrimaryOrgMock.mockReturnValue([
      buildRecord({ parent: { birthDate: 'not-a-date' } }),
    ]);
    view = render(<CompanionHistoryPage />);
    expect(readParentAgeDob()).toBe('-');
    view.unmount();
  });

  it('opens the add-appointment modal with the active companion id', () => {
    searchGetMock.mockImplementation(withCompanionId);
    useCompanionsParentsForPrimaryOrgMock.mockReturnValue([buildRecord()]);

    render(<CompanionHistoryPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Add appointment' }));
    expect(screen.getByTestId('add-appointment-modal')).toHaveTextContent('c-1');
  });

  describe('editing patient details', () => {
    it('opens the companion editor from the profile panel', () => {
      searchGetMock.mockImplementation(withCompanionId);
      useCompanionsParentsForPrimaryOrgMock.mockReturnValue([buildRecord()]);

      render(<CompanionHistoryPage />);

      expect(screen.queryByTestId('legacy-companion-modal')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Edit patient details' }));
      expect(screen.getByTestId('legacy-companion-modal')).toHaveTextContent('c-1');
    });

    it('hides the edit control without the companion-edit permission', () => {
      canMock.mockReturnValue(false);
      searchGetMock.mockImplementation(withCompanionId);
      useCompanionsParentsForPrimaryOrgMock.mockReturnValue([buildRecord()]);

      render(<CompanionHistoryPage />);

      expect(
        screen.queryByRole('button', { name: 'Edit patient details' })
      ).not.toBeInTheDocument();
    });
  });

  describe('last visit', () => {
    it('shows the most recent appointment that has already started', () => {
      searchGetMock.mockImplementation(withCompanionId);
      useCompanionsParentsForPrimaryOrgMock.mockReturnValue([buildRecord()]);
      useAppointmentsForPrimaryOrgMock.mockReturnValue([
        {
          companion: { id: 'c-1' },
          startTime: '2020-03-02T10:00:00Z',
          appointmentDate: '2020-03-02T10:00:00Z',
        },
        {
          companion: { id: 'c-1' },
          startTime: '2020-05-09T10:00:00Z',
          appointmentDate: '2020-05-09T10:00:00Z',
        },
        // A different companion's later visit must not leak into this panel.
        {
          companion: { id: 'c-2' },
          startTime: '2021-01-01T10:00:00Z',
          appointmentDate: '2021-01-01T10:00:00Z',
        },
      ]);

      render(<CompanionHistoryPage />);

      expect(screen.getByText('Last visit:')).toBeInTheDocument();
      expect(screen.getByText('May 9, 2020')).toBeInTheDocument();
    });

    it('shows a dash rather than a claim when no past appointment is on record', () => {
      searchGetMock.mockImplementation(withCompanionId);
      useCompanionsParentsForPrimaryOrgMock.mockReturnValue([buildRecord()]);
      useAppointmentsForPrimaryOrgMock.mockReturnValue([]);

      render(<CompanionHistoryPage />);

      const row = screen.getByText('Last visit:').parentElement as HTMLElement;
      expect(within(row).getByText('-')).toBeInTheDocument();
    });
  });

  describe('insurance row', () => {
    const readValue = (label: string) =>
      screen.getByText(label).parentElement?.querySelector('span:last-child');

    it('reads "<company> · active" for a live policy', () => {
      searchGetMock.mockImplementation(withCompanionId);
      useCompanionsParentsForPrimaryOrgMock.mockReturnValue([
        buildRecord({
          companion: {
            isInsured: true,
            insurance: { isInsured: true, companyName: 'PetSecure' },
          },
        }),
      ]);

      render(<CompanionHistoryPage />);

      expect(readValue('Insurance:')).toHaveTextContent('PetSecure · active');
    });

    it('drops the active suffix when the policy is no longer live', () => {
      searchGetMock.mockImplementation(withCompanionId);
      useCompanionsParentsForPrimaryOrgMock.mockReturnValue([
        buildRecord({
          companion: { isInsured: true, insurance: { isInsured: false, companyName: 'PetSecure' } },
        }),
      ]);

      render(<CompanionHistoryPage />);

      expect(readValue('Insurance:')).toHaveTextContent('PetSecure');
      expect(readValue('Insurance:')).not.toHaveTextContent('active');
    });

    it('states cover without a named insurer, and dashes when uninsured', () => {
      searchGetMock.mockImplementation(withCompanionId);
      useCompanionsParentsForPrimaryOrgMock.mockReturnValue([
        buildRecord({ companion: { isInsured: true } }),
      ]);

      const view = render(<CompanionHistoryPage />);
      expect(readValue('Insurance:')).toHaveTextContent('Active');
      view.unmount();

      useCompanionsParentsForPrimaryOrgMock.mockReturnValue([buildRecord()]);
      render(<CompanionHistoryPage />);
      expect(readValue('Insurance:')).toHaveTextContent('-');
    });

    it('paints a recorded allergy in the danger ink', () => {
      searchGetMock.mockImplementation(withCompanionId);
      useCompanionsParentsForPrimaryOrgMock.mockReturnValue([
        buildRecord({ companion: { allergy: 'Penicillin' } }),
      ]);

      render(<CompanionHistoryPage />);

      expect(readValue('Allergies:')).toHaveStyle({ color: 'var(--danger-text)' });
      expect(readValue('Insurance:')).toHaveStyle({ color: 'var(--ink)' });
    });
  });

  describe('co-parent row', () => {
    it('surfaces a live co-parent link with the shared-care suffix', () => {
      searchGetMock.mockImplementation(withCompanionId);
      useCompanionsParentsForPrimaryOrgMock.mockReturnValue([
        buildRecord({
          companion: {
            parentLinks: [
              { role: 'PRIMARY', status: 'ACTIVE', parent: { firstName: 'Sam' } },
              {
                role: 'CO_PARENT',
                status: 'ACTIVE',
                parent: { firstName: 'Jonas', lastName: 'Hartmann' },
              },
            ],
          },
        }),
      ]);

      render(<CompanionHistoryPage />);

      const value = screen.getByText('Co-parent:').parentElement?.querySelector('span:last-child');
      expect(value).toHaveTextContent('Jonas Hartmann · shared care');
    });

    it.each([
      ['there are no links at all', undefined],
      ['the only co-parent link was revoked', [{ role: 'CO_PARENT', status: 'REVOKED' }]],
      ['the co-parent link carries no name', [{ role: 'CO_PARENT', status: 'ACTIVE' }]],
    ])('hides the row when %s', (_case, parentLinks) => {
      searchGetMock.mockImplementation(withCompanionId);
      useCompanionsParentsForPrimaryOrgMock.mockReturnValue([
        buildRecord({ companion: { parentLinks } }),
      ]);

      render(<CompanionHistoryPage />);

      expect(screen.queryByText('Co-parent:')).not.toBeInTheDocument();
    });
  });
});
