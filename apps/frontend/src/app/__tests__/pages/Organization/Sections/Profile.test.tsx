import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Profile from '@/app/features/organization/pages/Organization/Sections/Profile';
import { updateOrg } from '@/app/features/organization/services/orgService';
import { usePermissions } from '@/app/hooks/usePermissions';

const mockNotify = jest.fn();

jest.mock('@/app/features/organization/services/orgService', () => ({
  updateOrg: jest.fn(),
}));

jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: jest.fn(),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({
    notify: mockNotify,
  }),
}));

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const SAVE_VALUES_BY_TITLE: Record<string, Record<string, string>> = {
  Organization: { name: 'New Clinic Name', country: 'CA' },
  Address: { addressLine: '123 Main St', city: 'Metropolis' },
  'Check-in settings': {
    appointmentCheckInBufferMinutes: '12',
    appointmentCheckInRadiusMeters: '350',
  },
};

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
        <button type="button" onClick={() => onSave(SAVE_VALUES_BY_TITLE[title] ?? {})}>
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
    (usePermissions as jest.Mock).mockReturnValue({ can: () => true });
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

  it('falls back to defaults when check-in values are invalid or negative', async () => {
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

    SAVE_VALUES_BY_TITLE['Check-in settings'] = {
      appointmentCheckInBufferMinutes: 'not-a-number',
      appointmentCheckInRadiusMeters: '-50',
    };
    fireEvent.click(screen.getByRole('button', { name: 'Save Check-in settings' }));

    await waitFor(() => {
      expect(updateOrg).toHaveBeenCalledWith(
        expect.objectContaining({
          appointmentCheckInBufferMinutes: 5,
          appointmentCheckInRadiusMeters: 200,
        })
      );
    });
  });

  it('saves organization details and merges the country into the address', async () => {
    render(
      <Profile
        primaryOrg={{
          _id: 'org-1',
          name: 'Clinic',
          type: 'HOSPITAL',
          phoneNo: '123',
          taxId: 'tax-1',
          address: { country: 'US', city: 'Old City' },
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save Organization' }));

    await waitFor(() => {
      expect(updateOrg).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Clinic Name',
          address: expect.objectContaining({ country: 'CA', city: 'Old City' }),
        })
      );
    });
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Organization updated' })
    );
  });

  it('notifies an error and logs when saving organization details fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('save failed');
    (updateOrg as jest.Mock).mockRejectedValue(error);

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

    fireEvent.click(screen.getByRole('button', { name: 'Save Organization' }));

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to update organization' })
      );
    });
    expect(consoleSpy).toHaveBeenCalledWith('Error updating organization:', error);
    consoleSpy.mockRestore();
  });

  it('saves address details, merging into the existing address', async () => {
    render(
      <Profile
        primaryOrg={{
          _id: 'org-1',
          name: 'Clinic',
          type: 'HOSPITAL',
          phoneNo: '123',
          taxId: 'tax-1',
          address: { country: 'US', city: 'Old City' },
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save Address' }));

    await waitFor(() => {
      expect(updateOrg).toHaveBeenCalledWith(
        expect.objectContaining({
          address: expect.objectContaining({
            country: 'US',
            city: 'Metropolis',
            addressLine: '123 Main St',
          }),
        })
      );
    });
  });

  it('notifies an error and logs when saving address details fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('address save failed');
    (updateOrg as jest.Mock).mockRejectedValue(error);

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

    fireEvent.click(screen.getByRole('button', { name: 'Save Address' }));

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to update organization' })
      );
    });
    expect(consoleSpy).toHaveBeenCalledWith('Error updating organization:', error);
    consoleSpy.mockRestore();
  });

  it('notifies an error and logs when saving check-in settings fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('check-in save failed');
    (updateOrg as jest.Mock).mockRejectedValue(error);
    SAVE_VALUES_BY_TITLE['Check-in settings'] = {
      appointmentCheckInBufferMinutes: '15',
      appointmentCheckInRadiusMeters: '400',
    };

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
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to update organization' })
      );
    });
    expect(consoleSpy).toHaveBeenCalledWith('Error updating organization:', error);
    consoleSpy.mockRestore();
  });

  it('does not allow saving when the user lacks org-edit permission', () => {
    (usePermissions as jest.Mock).mockReturnValue({ can: () => false });

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

    expect(screen.queryByRole('button', { name: 'Save Organization' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save Address' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Save Check-in settings' })
    ).not.toBeInTheDocument();
  });
});
