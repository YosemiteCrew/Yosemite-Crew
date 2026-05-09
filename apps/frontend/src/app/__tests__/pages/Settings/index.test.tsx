import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Settings from '@/app/features/settings/pages/Settings';

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: () => Promise<unknown>) => {
    const source = loader.toString();
    const LoadableComponent = (props: Record<string, unknown>) => {
      if (source.includes('Sections/OrgSection')) {
        const MockOrgSection = (
          jest.requireMock('@/app/features/settings/pages/Settings/Sections/OrgSection') as {
            default: React.FC<Record<string, unknown>>;
          }
        ).default;
        return <MockOrgSection {...props} />;
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

jest.mock('@/app/features/settings/pages/Settings/Sections/OrgSection', () => ({
  __esModule: true,
  default: () => <div>Org Section</div>,
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
  it('renders settings sections inside protected route', () => {
    render(<Settings />);

    expect(screen.getByTestId('protected')).toBeInTheDocument();
    expect(screen.getByText('Org Section')).toBeInTheDocument();
    expect(screen.getByText('Companion Terminology')).toBeInTheDocument();
    expect(screen.getByText('Delete Profile')).toBeInTheDocument();
  });
});
