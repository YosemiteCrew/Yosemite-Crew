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

describe('Settings page', () => {
  it('renders the header with the subtitle and auto-save indicator', () => {
    render(<Settings />);

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(
      screen.getByText('Your preferences, and the clinic settings you administer')
    ).toBeInTheDocument();
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
