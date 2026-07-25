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

const ORG = {
  _id: 'org-1',
  name: 'Clinic',
  type: 'HOSPITAL' as const,
  phoneNo: '123',
  taxId: 'tax-1',
  address: { country: 'US' },
};

const renderProfile = (overrides: Record<string, unknown> = {}) =>
  render(<Profile primaryOrg={{ ...ORG, ...overrides } as any} />);

/** The band renders first; enter the edit surface where the profile cards live. */
const enterEditMode = () => {
  fireEvent.click(screen.getByRole('button', { name: /Edit profile/ }));
};

describe('Organization Profile Section', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (updateOrg as jest.Mock).mockResolvedValue({});
    (usePermissions as jest.Mock).mockReturnValue({ can: () => true });
    SAVE_VALUES_BY_TITLE.Organization = { name: 'New Clinic Name', country: 'CA' };
    SAVE_VALUES_BY_TITLE.Address = { addressLine: '123 Main St', city: 'Metropolis' };
    SAVE_VALUES_BY_TITLE['Check-in settings'] = {
      appointmentCheckInBufferMinutes: '12',
      appointmentCheckInRadiusMeters: '350',
    };
  });

  it('renders the identity band with the org name and type pill', () => {
    renderProfile();

    expect(screen.getByText('Clinic')).toBeInTheDocument();
    expect(screen.getByText('HOSPITAL')).toBeInTheDocument();
  });

  it('hides the Edit profile control when the user cannot edit the org', () => {
    (usePermissions as jest.Mock).mockReturnValue({ can: () => false });
    renderProfile();

    expect(screen.queryByRole('button', { name: /Edit profile/ })).not.toBeInTheDocument();
  });

  it('reveals the editable cards after clicking Edit profile', () => {
    renderProfile();
    enterEditMode();

    expect(screen.getByText('Organization')).toBeInTheDocument();
    expect(screen.getByText('Address')).toBeInTheDocument();
    expect(screen.getByText('Check-in settings')).toBeInTheDocument();
  });

  it('returns to the band when Done is clicked', () => {
    renderProfile();
    enterEditMode();
    fireEvent.click(screen.getByRole('button', { name: /Done/ }));

    expect(screen.getByRole('button', { name: /Edit profile/ })).toBeInTheDocument();
  });

  it('saves check-in settings as integers', async () => {
    renderProfile();
    enterEditMode();

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
    renderProfile();
    enterEditMode();

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
    renderProfile({ address: { country: 'US', city: 'Old City' } });
    enterEditMode();

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

    renderProfile();
    enterEditMode();

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

  it('saves organization details without a country, leaving the address untouched', async () => {
    renderProfile({ address: { country: 'US', city: 'Old City' } });
    enterEditMode();

    SAVE_VALUES_BY_TITLE.Organization = { name: 'No Country Clinic' };
    fireEvent.click(screen.getByRole('button', { name: 'Save Organization' }));

    await waitFor(() => {
      expect(updateOrg).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'No Country Clinic',
          address: expect.objectContaining({ country: 'US', city: 'Old City' }),
        })
      );
    });
  });

  it('saves address details, merging into the existing address', async () => {
    renderProfile({ address: { country: 'US', city: 'Old City' } });
    enterEditMode();

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
});
