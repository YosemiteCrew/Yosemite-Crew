/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProfileCard from '@/app/features/organization/pages/Organization/Sections/ProfileCard';
import { updateOrg } from '@/app/features/organization/services/orgService';
import { upsertUserProfile } from '@/app/features/organization/services/profileService';

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => {
    const MockDynamic = () => <div data-testid="mock-dynamic-overlay" />;
    MockDynamic.displayName = 'MockDynamic';
    return MockDynamic;
  },
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/inputs/Datepicker', () => ({
  __esModule: true,
  default: ({ placeholder, setCurrentDate, currentDate }: any) => (
    <button type="button" onClick={() => setCurrentDate(new Date('2023-05-06'))}>
      {placeholder}:{currentDate ? new Date(currentDate).toISOString() : 'none'}
    </button>
  ),
}));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, onSelect, options, error }: any) => (
    <div>
      <button type="button" onClick={() => onSelect(options?.[0] ?? { value: 'x' })}>
        {placeholder}
      </button>
      {error ? <div>{error}</div> : null}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ inlabel, inname, value, onChange, error }: any) => (
    <div>
      <input aria-label={inname || inlabel} value={value ?? ''} onChange={onChange} />
      {error ? <div>{error}</div> : null}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/MultiSelectDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, onChange, options }: any) => (
    <button type="button" onClick={() => onChange(options?.map((o: any) => o.value) ?? [])}>
      {placeholder}
    </button>
  ),
}));

jest.mock('@/app/ui/inputs/GoogleSearchDropDown/GoogleSearchDropDown', () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange, onAddressSelect }: any) => (
    <div>
      <input aria-label={inlabel} value={value ?? ''} onChange={onChange} />
      <button
        type="button"
        onClick={() =>
          onAddressSelect({
            addressLine: '123 Main St',
            city: 'Springfield',
            state: 'IL',
            postalCode: '62704',
            country: 'USA',
          })
        }
      >
        pick-address
      </button>
    </div>
  ),
}));

jest.mock('@/app/ui/widgets/UploadImage/LogoUpdator', () => ({
  __esModule: true,
  default: ({ title, onSave, disabled }: any) => (
    <button type="button" disabled={disabled} onClick={() => onSave('new-key.png')}>
      {title}
    </button>
  ),
}));

const usePrimaryOrgMock = jest.fn();
jest.mock('@/app/hooks/useOrgSelectors', () => ({
  usePrimaryOrg: () => usePrimaryOrgMock(),
}));

jest.mock('@/app/hooks/useProfiles', () => ({
  usePrimaryOrgProfile: () => ({ _id: 'profile-1', personalDetails: { profilePictureUrl: '' } }),
}));

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: (selector: any) =>
    selector({ attributes: { given_name: 'Pat', family_name: 'Kim' } }),
}));

jest.mock('@/app/lib/urls', () => ({
  isHttpsImageUrl: () => false,
  getSafeImageUrl: () => '/placeholder.png',
}));

jest.mock('@/app/features/organization/services/orgService', () => ({
  updateOrg: jest.fn(),
}));

jest.mock('@/app/features/organization/services/profileService', () => ({
  upsertUserProfile: jest.fn(),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img alt={props.alt} {...props} />,
}));

describe('Organization ProfileCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePrimaryOrgMock.mockReturnValue({ _id: 'org-1', imageURL: '', name: 'Acme' });
  });

  it('renders field values in view mode', () => {
    render(
      <ProfileCard
        title="Test Card"
        editable={false}
        fields={[
          { label: 'Name', key: 'name', type: 'text' },
          {
            label: 'Role',
            key: 'role',
            type: 'select',
            options: [{ label: 'Admin', value: 'admin' }],
          },
        ]}
        org={{ name: 'Acme', role: 'admin' }}
      />
    );

    expect(screen.getByText('Test Card')).toBeInTheDocument();
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('renders multiSelect, date, and default (raw) field values including the "-" fallback', () => {
    render(
      <ProfileCard
        title="Card"
        editable={false}
        fields={[
          {
            label: 'Tags',
            key: 'tags',
            type: 'multiSelect',
            options: [{ label: 'VIP', value: 'vip' }],
          },
          { label: 'Empty Tags', key: 'emptyTags', type: 'multiSelect' },
          { label: 'DOB', key: 'dob', type: 'date' },
          { label: 'Bad Date', key: 'badDate', type: 'date' },
          { label: 'Note', key: 'note' },
        ]}
        org={{ tags: ['vip'], emptyTags: [], dob: '2020-01-05', badDate: 'not-a-date', note: '' }}
      />
    );

    expect(screen.getByText('VIP')).toBeInTheDocument();
    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(2);
  });

  it('shows the edit icon when editable with onSave, and enters edit mode on click', () => {
    const onSave = jest.fn();
    render(
      <ProfileCard
        title="Card"
        editable
        onSave={onSave}
        fields={[{ label: 'Name', key: 'name', type: 'text', editable: true }]}
        org={{ name: 'Acme' }}
      />
    );

    const editIcon = document.querySelector('svg');
    expect(editIcon).toBeInTheDocument();
    fireEvent.click(editIcon!);

    expect(screen.getByRole('textbox', { name: 'name' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('does not show the edit icon when editable but no onSave is provided', () => {
    render(
      <ProfileCard
        title="Card"
        editable
        fields={[{ label: 'Name', key: 'name', type: 'text' }]}
        org={{ name: 'Acme' }}
      />
    );
    expect(document.querySelector('svg')).not.toBeInTheDocument();
  });

  it('blocks save when a required field is empty and shows the error', async () => {
    const onSave = jest.fn();
    render(
      <ProfileCard
        title="Card"
        editable
        onSave={onSave}
        fields={[{ label: 'Name', key: 'name', type: 'text', editable: true, required: true }]}
        org={{ name: '' }}
      />
    );

    fireEvent.click(document.querySelector('svg')!);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves successfully, clearing edit mode', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(
      <ProfileCard
        title="Card"
        editable
        onSave={onSave}
        fields={[{ label: 'Name', key: 'name', type: 'text', editable: true }]}
        org={{ name: 'Acme' }}
      />
    );

    fireEvent.click(document.querySelector('svg')!);
    fireEvent.change(screen.getByRole('textbox', { name: 'name' }), {
      target: { value: 'New Name' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Name' }))
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    );
  });

  it('logs an error and stays in edit mode when onSave rejects', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const onSave = jest.fn().mockRejectedValue(new Error('boom'));
    render(
      <ProfileCard
        title="Card"
        editable
        onSave={onSave}
        fields={[{ label: 'Name', key: 'name', type: 'text', editable: true }]}
        org={{ name: 'Acme' }}
      />
    );

    fireEvent.click(document.querySelector('svg')!);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    consoleErrorSpy.mockRestore();
  });

  it('cancels edit mode and resets form values', () => {
    const onSave = jest.fn();
    render(
      <ProfileCard
        title="Card"
        editable
        onSave={onSave}
        fields={[{ label: 'Name', key: 'name', type: 'text', editable: true }]}
        org={{ name: 'Acme' }}
      />
    );

    fireEvent.click(document.querySelector('svg')!);
    fireEvent.change(screen.getByRole('textbox', { name: 'name' }), {
      target: { value: 'Changed' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('textbox', { name: 'name' })).not.toBeInTheDocument();
    expect(screen.getByText('Acme')).toBeInTheDocument();
  });

  it('handles dropdown/select, multiSelect, date, googleAddress edits and the separator field', () => {
    const onSave = jest.fn();
    render(
      <ProfileCard
        title="Card"
        editable
        onSave={onSave}
        fields={[
          {
            label: 'Role',
            key: 'role',
            type: 'select',
            editable: true,
            options: [{ label: 'Admin', value: 'admin' }],
          },
          {
            label: 'Country',
            key: 'country',
            type: 'country',
            editable: true,
          },
          { label: 'Sep', key: 'sep', type: 'separator', editable: true },
          {
            label: 'Tags',
            key: 'tags',
            type: 'multiSelect',
            editable: true,
            options: [{ label: 'VIP', value: 'vip' }],
          },
          { label: 'DOB', key: 'dob', type: 'date', editable: true },
          { label: 'DOB2', key: 'dob2', type: 'dateString', editable: true },
          { label: 'Address', key: 'address', type: 'googleAddress', editable: true },
        ]}
        org={{ role: '', country: '', tags: [], dob: null, dob2: null, address: '' }}
      />
    );

    fireEvent.click(document.querySelector('svg')!);

    fireEvent.click(screen.getByRole('button', { name: 'Role' }));
    fireEvent.click(screen.getByRole('button', { name: 'Country' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tags' }));
    fireEvent.click(screen.getByText(/^DOB:/));
    fireEvent.click(screen.getByText(/^DOB2:/));
    fireEvent.click(screen.getByRole('button', { name: 'pick-address' }));

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('shows verify-business CTA and opens the CalBookingOverlay when the org is unverified', () => {
    render(
      <ProfileCard title="Card" showProfile fields={[]} org={{ name: 'Acme', isVerified: false }} />
    );

    expect(screen.getByText('Pending')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Verify business profile' }));
    expect(screen.getByTestId('mock-dynamic-overlay')).toBeInTheDocument();
  });

  it('shows Verified status and hides the CTA when the org is verified', () => {
    render(
      <ProfileCard title="Card" showProfile fields={[]} org={{ name: 'Acme', isVerified: true }} />
    );

    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Verify business profile' })
    ).not.toBeInTheDocument();
  });

  it('updates the org logo via LogoUpdator (updateOrgLogo success path)', async () => {
    (updateOrg as jest.Mock).mockResolvedValueOnce(undefined);
    render(
      <ProfileCard title="Card" showProfile fields={[]} org={{ name: 'Acme', isVerified: true }} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Update logo' }));

    await waitFor(() => expect(updateOrg).toHaveBeenCalled());
  });

  it('logs an error when updateOrgLogo fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (updateOrg as jest.Mock).mockRejectedValueOnce(new Error('fail'));
    render(
      <ProfileCard title="Card" showProfile fields={[]} org={{ name: 'Acme', isVerified: true }} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Update logo' }));

    await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());
    consoleErrorSpy.mockRestore();
  });

  it('disables logo updates when there is no primary org id', () => {
    usePrimaryOrgMock.mockReturnValue(null);
    render(
      <ProfileCard title="Card" showProfile fields={[]} org={{ name: 'Acme', isVerified: true }} />
    );

    expect(screen.getByRole('button', { name: 'Update logo' })).toBeDisabled();
  });

  it('updates the profile picture via LogoUpdator (updateProfilePicture success path)', async () => {
    (upsertUserProfile as jest.Mock).mockResolvedValueOnce(undefined);
    render(<ProfileCard title="Card" showProfileUser fields={[]} org={{ name: 'Acme' }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Update Profile Picture' }));

    await waitFor(() => expect(upsertUserProfile).toHaveBeenCalled());
    expect(screen.getByText('Pat Kim')).toBeInTheDocument();
  });
});
