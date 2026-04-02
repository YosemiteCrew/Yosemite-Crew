import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Profile from '@/app/features/organization/pages/Organization/Sections/Profile';
import { updateOrg } from '@/app/features/organization/services/orgService';

const mockNotify = jest.fn();

jest.mock('@/app/features/organization/services/orgService', () => ({
  updateOrg: jest.fn(),
}));

jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({
    can: () => true,
  }),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({
    notify: mockNotify,
  }),
}));

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/app/features/organization/pages/Organization/Sections/ProfileCard', () => ({
  __esModule: true,
  default: ({
    title,
    onSave,
  }: {
    title: string;
    onSave?: (values: Record<string, string>) => Promise<void>;
  }) => (
    <div>
      <span>{title}</span>
      {onSave ? (
        <button
          type="button"
          onClick={() =>
            onSave({
              appointmentCheckInBufferMinutes: '12',
              appointmentCheckInRadiusMeters: '350',
            })
          }
        >
          Save {title}
        </button>
      ) : null}
    </div>
  ),
}));

describe('Organization Profile Section', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (updateOrg as jest.Mock).mockResolvedValue({});
  });

  it('renders check-in settings card', () => {
    render(
      <Profile
        primaryOrg={{
          _id: 'org-1',
          name: 'Clinic',
          type: 'HOSPITAL',
          phoneNo: '123',
          taxId: 'tax-1',
          address: { country: 'US' },
        }}
      />
    );

    expect(screen.getByText('Check-in settings')).toBeInTheDocument();
  });

  it('saves check-in settings as integers', async () => {
    render(
      <Profile
        primaryOrg={{
          _id: 'org-1',
          name: 'Clinic',
          type: 'HOSPITAL',
          phoneNo: '123',
          taxId: 'tax-1',
          address: { country: 'US' },
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save Check-in settings' }));

    await waitFor(() => {
      expect(updateOrg).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: 'org-1',
          appointmentCheckInBufferMinutes: 12,
          appointmentCheckInRadiusMeters: 350,
        })
      );
    });
  });
});
