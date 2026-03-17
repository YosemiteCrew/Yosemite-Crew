import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Settings from '@/app/features/settings/pages/Settings';

jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="protected">{children}</div>,
}));

jest.mock('@/app/features/settings/pages/Settings/Sections/Personal', () => ({
  __esModule: true,
  default: () => <div>Personal Section</div>,
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
    expect(screen.getByText('Personal Section')).toBeInTheDocument();
    expect(screen.getByText('Org Section')).toBeInTheDocument();
    expect(screen.getByText('Companion Terminology')).toBeInTheDocument();
    expect(screen.getByText('Delete Profile')).toBeInTheDocument();
  });
});
