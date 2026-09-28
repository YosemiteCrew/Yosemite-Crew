import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import NurseHandoverRoute, { metadata } from '@/app/(routes)/(app)/appointments/handover/page';

jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/app/ui/layout/guards/OrgGuard', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/app/features/appointments/pages/NurseHandover/NurseHandover', () => ({
  __esModule: true,
  default: () => <h1>Shift handover</h1>,
}));

describe('nurse handover route', () => {
  it('sets the page title and renders the guarded handover screen', () => {
    render(<NurseHandoverRoute />);

    expect(metadata.title).toBe('Shift handover — Yosemite Crew');
    expect(screen.getByRole('heading', { name: 'Shift handover' })).toBeInTheDocument();
  });
});
