import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Settings from '@/app/features/settings/pages/Settings';

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: () => Promise<unknown>, options?: { loading?: () => unknown }) => {
    // Exercise the loader and loading callbacks so the dynamic wiring in the
    // page is covered; rendering still goes through the mocks below.
    loader().catch(() => undefined);
    options?.loading?.();
    const source = loader.toString();
    const LoadableComponent = (props: Record<string, unknown>) => {
      if (source.includes('Sections/Personal')) {
        const MockPersonal = (
          jest.requireMock('@/app/features/settings/pages/Settings/Sections/Personal') as {
            default: React.FC<Record<string, unknown>>;
          }
        ).default;
        return <MockPersonal {...props} />;
      }

      if (source.includes('Sections/AppearancePreference')) {
        return <div>Appearance Preference</div>;
      }

      if (source.includes('Sections/ProfileEditModal')) {
        const MockProfileEditModal = (
          jest.requireMock('@/app/features/settings/pages/Settings/Sections/ProfileEditModal') as {
            default: React.FC<Record<string, unknown>>;
          }
        ).default;
        return <MockProfileEditModal {...props} />;
      }

      if (source.includes('Sections/HoursEditModal')) {
        const MockHoursEditModal = (
          jest.requireMock('@/app/features/settings/pages/Settings/Sections/HoursEditModal') as {
            default: React.FC<Record<string, unknown>>;
          }
        ).default;
        return <MockHoursEditModal {...props} />;
      }

      if (source.includes('Sections/TimezonePreference')) {
        return <div>Timezone Preference</div>;
      }

      if (source.includes('Sections/DefaultOpenScreenPreference')) {
        return <div>Default Open Screen Preference</div>;
      }

      if (source.includes('Sections/CompanionTerminologyPreference')) {
        const MockCompanionTerminologyPreference = (
          jest.requireMock(
            '@/app/features/settings/pages/Settings/Sections/CompanionTerminologyPreference'
          ) as {
            default: React.FC<Record<string, unknown>>;
          }
        ).default;
        return <MockCompanionTerminologyPreference {...props} />;
      }

      if (source.includes('Sections/DeleteProfile')) {
        const MockDeleteProfile = (
          jest.requireMock('@/app/features/settings/pages/Settings/Sections/DeleteProfile') as {
            default: React.FC<Record<string, unknown>>;
          }
        ).default;
        return <MockDeleteProfile {...props} />;
      }

      // The clinic-wide controls previously fell through to `null`, which let the
      // whole point of the scope split regress without failing anything. They are
      // identifiable now so the composition tests below can assert placement.
      if (source.includes('Sections/AppointmentLockWindowPreference')) {
        return (
          <div>
            Appointment Lock Window Preference
            <span data-testid="lock-window-readonly">{String(props.readOnly)}</span>
          </div>
        );
      }

      if (source.includes('Sections/CrossClinicMessagingPreference')) {
        return (
          <div>
            Cross Clinic Messaging Preference
            <span data-testid="cross-clinic-readonly">{String(props.readOnly)}</span>
          </div>
        );
      }

      if (source.includes('Sections/YourOrganizations')) {
        return <div>Your Organizations</div>;
      }

      if (source.includes('Sections/FederationSection')) {
        return <div>Federation Section</div>;
      }

      return null;
    };

    LoadableComponent.displayName = 'MockDynamicComponent';
    return LoadableComponent;
  },
}));

jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="protected">{children}</div>,
}));

jest.mock('@/app/features/settings/pages/Settings/Sections/Personal', () => ({
  __esModule: true,
  default: ({ onEditProfile, onEditHours }: any) => (
    <div>
      <span>Personal Card</span>
      <button type="button" onClick={onEditProfile}>
        open-profile
      </button>
      <button type="button" onClick={onEditHours}>
        open-hours
      </button>
    </div>
  ),
}));

jest.mock('@/app/features/settings/pages/Settings/Sections/ProfileEditModal', () => ({
  __esModule: true,
  default: ({ showModal }: any) => <div>{`Profile Modal ${showModal ? 'open' : 'closed'}`}</div>,
}));

jest.mock('@/app/features/settings/pages/Settings/Sections/HoursEditModal', () => ({
  __esModule: true,
  default: ({ showModal }: any) => <div>{`Hours Modal ${showModal ? 'open' : 'closed'}`}</div>,
}));

jest.mock('@/app/features/settings/pages/Settings/Sections/DeleteProfile', () => ({
  __esModule: true,
  default: () => <div>Delete Profile</div>,
}));

jest.mock('@/app/features/settings/pages/Settings/Sections/CompanionTerminologyPreference', () => ({
  __esModule: true,
  default: () => <div>Companion Terminology</div>,
}));

// Records the permission argument. Discarding it made every permission test
// pass even when the page checked the WRONG permission - reverting to
// integrations:edit:any, the exact bug these tests exist to catch, left the
// suite green.
const mockHasPermission = jest.fn((_perm?: unknown) => true);
jest.mock('@/app/hooks/usePermissions', () => ({
  __esModule: true,
  useHasPermission: (perm: unknown) => mockHasPermission(perm),
}));

/**
 * Returns the labelled scope band (`<section aria-labelledby>`) that contains
 * the given control, so a test can assert WHERE a control sits rather than just
 * that it rendered somewhere on the page.
 */
const bandContaining = (text: string): HTMLElement | null =>
  screen.getByText(text).closest('section[aria-labelledby^="settings-band-"]');

describe('Settings page', () => {
  beforeEach(() => {
    mockHasPermission.mockReturnValue(true);
  });

  it('puts every per-user control in the Personal band', () => {
    render(<Settings />);

    for (const control of [
      'Personal Card',
      'Timezone Preference',
      'Default Open Screen Preference',
      'Companion Terminology',
      'Your Organizations',
      'Delete Profile',
      // Device-scoped, but still the signed-in person's own surface.
      'Appearance Preference',
    ]) {
      expect(bandContaining(control)).toHaveAttribute('aria-labelledby', 'settings-band-Personal');
    }
  });

  it('puts every clinic-wide control in the Organisation band', () => {
    render(<Settings />);

    for (const control of [
      'Appointment Lock Window Preference',
      'Cross Clinic Messaging Preference',
      'Federation Section',
    ]) {
      expect(bandContaining(control)).toHaveAttribute(
        'aria-labelledby',
        'settings-band-Organisation'
      );
    }
  });

  it('keeps the device theme out of the account-scoped group', () => {
    render(<Settings />);

    // Appearance does not follow the account to another device, so it must not
    // sit under the group that promises "your account".
    const appearanceGroup = screen.getByText('Appearance Preference').closest('section');
    expect(appearanceGroup).toHaveTextContent('This device');
    expect(appearanceGroup).not.toHaveTextContent('Only you');
  });

  // Scoped to the GROUP, not the band. The organisation band mixes two gates -
  // scheduling goes through updateOrg (teams:edit:any), federation through
  // integrations:edit:any - so a Supervisor holds one and not the other. A
  // band-level verdict would be wrong for exactly that role.
  it('marks the scheduling group read-only when the member cannot edit it', () => {
    mockHasPermission.mockReturnValue(false);
    render(<Settings />);

    const group = screen.getByText('Appointment Lock Window Preference').closest('section');
    expect(group).toHaveTextContent(/Managed by a clinic administrator/);
  });

  it('does not mark the scheduling group read-only for a member who can edit it', () => {
    mockHasPermission.mockReturnValue(true);
    render(<Settings />);

    const group = screen.getByText('Appointment Lock Window Preference').closest('section');
    expect(group).not.toHaveTextContent(/Managed by a clinic administrator/);
  });

  it('gates the scheduling group on teams:edit:any, not the integrations permission', () => {
    render(<Settings />);

    // The scheduling controls write through updateOrg, whose PUT route requires
    // teams:edit:any. Asserting the argument is what makes the other permission
    // tests meaningful.
    expect(mockHasPermission).toHaveBeenCalledWith('teams:edit:any');
    expect(mockHasPermission).not.toHaveBeenCalledWith('integrations:edit:any');
  });

  it('disables the clinic controls when the member cannot edit them', () => {
    mockHasPermission.mockReturnValue(false);
    render(<Settings />);

    // Advertising read-only without enforcing it invites a click the backend rejects.
    expect(screen.getByTestId('lock-window-readonly')).toHaveTextContent('true');
    expect(screen.getByTestId('cross-clinic-readonly')).toHaveTextContent('true');
  });

  it('keeps the organisation band description permission-neutral', () => {
    mockHasPermission.mockReturnValue(false);
    render(<Settings />);

    // The band must not claim a single verdict for controls behind two gates.
    expect(
      screen.getByText('Shared clinic settings. Changes here apply to every colleague.')
    ).toBeInTheDocument();
  });

  it('renders the header with the subtitle and auto-save indicator', () => {
    render(<Settings />);

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByText('Your preferences and clinic settings')).toBeInTheDocument();
    expect(screen.getByText('Changes save automatically')).toBeInTheDocument();
  });

  it('renders the compact panel and keeps the editor modals closed', () => {
    render(<Settings />);

    expect(screen.getByTestId('protected')).toBeInTheDocument();
    expect(screen.getByText('Personal Card')).toBeInTheDocument();
    expect(screen.getByText('Companion Terminology')).toBeInTheDocument();
    expect(screen.getByText('Appearance Preference')).toBeInTheDocument();
    expect(screen.getByText('Delete Profile')).toBeInTheDocument();
    // The detailed editors are modals, closed until their affordance is used.
    expect(screen.getByText('Profile Modal closed')).toBeInTheDocument();
    expect(screen.getByText('Hours Modal closed')).toBeInTheDocument();
  });

  it('opens the profile and hours modals from the Personal card affordances', () => {
    render(<Settings />);

    fireEvent.click(screen.getByRole('button', { name: 'open-profile' }));
    expect(screen.getByText('Profile Modal open')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'open-hours' }));
    expect(screen.getByText('Hours Modal open')).toBeInTheDocument();
  });
});
