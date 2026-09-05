import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProfileCard from '@/app/features/organization/pages/Organization/Sections/ProfileCard';

let mockPrimaryOrg: any;
let mockProfile: any;
let mockAttributes: any;
const updateOrgMock = jest.fn();
const upsertUserProfileMock = jest.fn();

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => {
    const MockDynamic = ({ onClose }: any) => (
      <button type="button" onClick={onClose}>
        close-overlay
      </button>
    );
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

// Datepicker mock exposes both a value update and a functional-updater update so
// the dateString field's setCurrentDate wrapper is fully exercised.
jest.mock('@/app/ui/inputs/Datepicker', () => ({
  __esModule: true,
  default: ({ placeholder, setCurrentDate, error }: any) => (
    <div>
      <button type="button" onClick={() => setCurrentDate(new Date('2021-03-04T00:00:00Z'))}>
        {`date-value-${placeholder}`}
      </button>
      <button type="button" onClick={() => setCurrentDate((prev: Date) => prev)}>
        {`date-fn-${placeholder}`}
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, onSelect }: any) => (
    <button type="button" onClick={() => onSelect({ value: 'picked' })}>
      {`dropdown-${placeholder}`}
    </button>
  ),
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange, error }: any) => (
    <div>
      <input aria-label={inlabel} value={value ?? ''} onChange={onChange} />
      {error ? <span>{error}</span> : null}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/MultiSelectDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, onChange, error }: any) => (
    <div>
      <button type="button" onClick={() => onChange(['ms-a', 'ms-b'])}>
        {`multi-${placeholder}`}
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  ),
}));

jest.mock('@/app/ui/widgets/UploadImage/LogoUpdator', () => ({
  __esModule: true,
  default: ({ title, onSave }: any) => (
    <div>
      <button type="button" onClick={() => onSave('s3-key')}>
        {`save-${title}`}
      </button>
      <button type="button" onClick={() => onSave('')}>
        {`empty-${title}`}
      </button>
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/GoogleSearchDropDown/GoogleSearchDropDown', () => ({
  __esModule: true,
  default: ({ inlabel, onChange, onAddressSelect }: any) => (
    <div>
      <input aria-label={inlabel} onChange={onChange} />
      <button
        type="button"
        onClick={() =>
          onAddressSelect({
            addressLine: 'Line 1',
            city: 'City',
            state: 'State',
            postalCode: '00000',
            country: 'US',
          })
        }
      >
        {`addr-country-${inlabel}`}
      </button>
      <button
        type="button"
        onClick={() =>
          onAddressSelect({
            addressLine: 'Line 2',
            city: 'City2',
            state: 'State2',
            postalCode: '11111',
          })
        }
      >
        {`addr-nocountry-${inlabel}`}
      </button>
    </div>
  ),
}));

jest.mock('@/app/hooks/useOrgSelectors', () => ({
  usePrimaryOrg: () => mockPrimaryOrg,
}));

jest.mock('@/app/hooks/useProfiles', () => ({
  usePrimaryOrgProfile: () => mockProfile,
}));

jest.mock('@/app/features/organization/services/orgService', () => ({
  updateOrg: (...args: any[]) => updateOrgMock(...args),
}));

jest.mock('@/app/features/organization/services/profileService', () => ({
  upsertUserProfile: (...args: any[]) => upsertUserProfileMock(...args),
}));

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: (selector: any) => selector({ attributes: mockAttributes }),
}));

jest.mock('@/app/lib/urls', () => ({
  getSafeImageUrl: (url: any) => url || 'fallback-image',
}));

// Compute from input (not a constant) so date formatting varies with the value.
jest.mock('@/app/features/appointments/components/Calendar/weekHelpers', () => ({
  getFormattedDate: (d: Date) => `DATE[${d.getFullYear()}]`,
}));

jest.mock('@/app/constants/mediaSources', () => ({
  MEDIA_SOURCES: { organization: { fromS3Key: (key: string) => `s3://${key}` } },
}));

jest.mock('@/app/features/companions/components/AddCompanion/type', () => ({
  CountriesOptions: [{ label: 'United States', value: 'US' }],
}));

describe('Organization ProfileCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrimaryOrg = { _id: 'org-1' };
    mockProfile = { _id: 'profile-1', personalDetails: { profilePictureUrl: 'pic.png' } };
    mockAttributes = { given_name: 'Pat', family_name: 'Kim' };
    updateOrgMock.mockResolvedValue(undefined);
    upsertUserProfileMock.mockResolvedValue(undefined);
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

  it('formats select, multi-select, separator and empty values in view mode', () => {
    render(
      <ProfileCard
        title="View"
        editable={false}
        fields={[
          { label: 'Empty', key: 'empty', type: 'text' },
          { label: 'Absent', key: 'absent', type: 'text' },
          {
            label: 'Role',
            key: 'role',
            type: 'select',
            options: [{ label: 'Admin', value: 'admin' }],
          },
          {
            label: 'RoleRaw',
            key: 'roleRaw',
            type: 'select',
            options: [{ label: 'Admin', value: 'admin' }],
          },
          { label: 'RoleNoOpt', key: 'roleNoOpt', type: 'select' },
          { label: 'StrOpt', key: 'stropt', type: 'select', options: ['sx', 'sy'] as any },
          { label: 'RoleFalsy', key: 'roleFalsy', type: 'dropdown' },
          {
            label: 'Tags',
            key: 'tags',
            type: 'multiSelect',
            options: [
              { label: 'Red', value: 'red' },
              { label: 'Blue', value: 'blue' },
            ],
          },
          { label: 'TagsRaw', key: 'tagsRaw', type: 'multiSelect' },
          { label: 'TagStr', key: 'tagStr', type: 'multiSelect' },
          { label: 'TagEmpty', key: 'tagEmpty', type: 'multiSelect' },
          { label: 'TagEmptyStr', key: 'tagEmptyStr', type: 'multiSelect' },
          { label: 'TagUndef', key: 'tagUndef', type: 'multiSelect' },
          {
            label: 'TagMiss',
            key: 'tagMiss',
            type: 'multiSelect',
            options: [{ label: 'Red', value: 'red' }],
          },
          { label: 'NoType', key: 'notype' },
          { label: 'Sep', key: 'sepv', type: 'separator' },
        ]}
        org={{
          empty: '',
          role: 'admin',
          roleRaw: 'ghost',
          roleNoOpt: 'plain',
          stropt: 'sx',
          roleFalsy: '',
          notype: 'plainval',
          tags: ['red', 'blue'],
          tagsRaw: ['x'],
          tagStr: 'solo',
          tagEmpty: [],
          tagEmptyStr: '',
          tagMiss: ['zzz'],
        }}
      />
    );

    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('ghost')).toBeInTheDocument();
    expect(screen.getByText('plain')).toBeInTheDocument();
    expect(screen.getByText('sx')).toBeInTheDocument();
    expect(screen.getByText('Red, Blue')).toBeInTheDocument();
    expect(screen.getByText('x')).toBeInTheDocument();
    expect(screen.getByText('solo')).toBeInTheDocument();
    expect(screen.getByText('zzz')).toBeInTheDocument();
    expect(screen.getByText('plainval')).toBeInTheDocument();
    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(5);
  });

  it('renders formatted dates and dashes across every date value shape in view mode', () => {
    render(
      <ProfileCard
        title="Dates"
        editable={false}
        fields={[
          { label: 'IsoDate', key: 'iso', type: 'date' },
          { label: 'SecNum', key: 'sec', type: 'date' },
          { label: 'MsNum', key: 'ms', type: 'date' },
          { label: 'DateObj', key: 'obj', type: 'date' },
          { label: 'BadObj', key: 'badobj', type: 'date' },
          { label: 'FreeStr', key: 'free', type: 'date' },
          { label: 'BadStr', key: 'bad', type: 'date' },
          { label: 'SpaceStr', key: 'space', type: 'date' },
          { label: 'BoolVal', key: 'bool', type: 'date' },
          { label: 'InfNum', key: 'inf', type: 'date' },
          { label: 'EmptyDate', key: 'ed', type: 'date' },
        ]}
        org={{
          iso: '2020-01-01',
          sec: 1600000000,
          ms: 1600000000000,
          obj: new Date('2019-06-15T12:00:00'),
          badobj: new Date('invalid'),
          free: 'Jan 1, 2022',
          bad: 'notadate',
          space: '   ',
          bool: true,
          inf: Infinity,
          ed: '',
        }}
      />
    );

    expect(screen.getAllByText(/DATE\[/).length).toBeGreaterThanOrEqual(5);
    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(6);
  });

  it('formats a dateString value in view mode', () => {
    render(
      <ProfileCard
        title="DS"
        editable={false}
        fields={[{ label: 'DS', key: 'ds', type: 'dateString' }]}
        org={{ ds: '2023-07-08' }}
      />
    );

    expect(screen.getByText('DATE[2023]')).toBeInTheDocument();
  });

  it('renders every editable field type in edit mode and wires the change handlers', () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(
      <ProfileCard
        title="Editable"
        onSave={onSave}
        fields={[
          { label: 'Text', key: 'text', type: 'text', editable: true },
          { label: 'Number', key: 'number', type: 'number', editable: true },
          {
            label: 'Select',
            key: 'select',
            type: 'select',
            editable: true,
            options: [{ label: 'A', value: 'a' }],
          },
          { label: 'Dropdown', key: 'dropdown', type: 'dropdown', editable: true },
          {
            label: 'Multi',
            key: 'multi',
            type: 'multiSelect',
            editable: true,
            options: [{ label: 'A', value: 'a' }],
          },
          { label: 'MultiNoOpt', key: 'multiNoOpt', type: 'multiSelect', editable: true },
          { label: 'Country', key: 'country', type: 'country', editable: true },
          { label: 'Date', key: 'date', type: 'date', editable: true },
          { label: 'DateString', key: 'dateString', type: 'dateString', editable: true },
          { label: 'DateStringEmpty', key: 'dsEmpty', type: 'dateString', editable: true },
          { label: 'Address', key: 'address', type: 'googleAddress', editable: true },
          { label: 'Sep', key: 'sep', type: 'separator', editable: true },
          { label: 'ReadOnly', key: 'readonly', type: 'text', editable: false },
          { label: 'Unknown', key: 'unknown', type: 'weirdtype', editable: true },
        ]}
        org={{
          text: 'hello',
          number: '5',
          select: 'a',
          dropdown: 'd',
          multi: ['a'],
          multiNoOpt: ['a'],
          country: 'US',
          date: '2020-01-01',
          dateString: '2020-01-01',
          dsEmpty: '',
          address: 'addr',
          readonly: 'ro',
          unknown: 'u',
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit Editable' }));

    fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'world' } });
    fireEvent.change(screen.getByLabelText('Number'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'dropdown-Select' }));
    fireEvent.click(screen.getByRole('button', { name: 'multi-Multi' }));
    fireEvent.click(screen.getByRole('button', { name: 'date-value-Date' }));
    fireEvent.click(screen.getByRole('button', { name: 'date-value-DateString' }));
    fireEvent.click(screen.getByRole('button', { name: 'date-fn-DateString' }));
    fireEvent.click(screen.getByRole('button', { name: 'addr-country-Address' }));
    fireEvent.click(screen.getByRole('button', { name: 'addr-nocountry-Address' }));
    fireEvent.change(screen.getByLabelText('Address'), { target: { value: 'typed' } });

    // Read-only field renders as a value row even while editing.
    expect(screen.getByText('ro')).toBeInTheDocument();
    // Unknown type falls back to the text field component.
    expect(screen.getByLabelText('Unknown')).toBeInTheDocument();
  });

  it('is not editable without an onSave handler even when editable is true', () => {
    render(
      <ProfileCard
        title="NoSave"
        fields={[{ label: 'Name', key: 'name', type: 'text' }]}
        org={{ name: 'X' }}
      />
    );

    expect(screen.queryByRole('button', { name: 'Edit NoSave' })).not.toBeInTheDocument();
  });

  it('validates and saves when required editable fields are satisfied', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(
      <ProfileCard
        title="Save"
        onSave={onSave}
        fields={[
          { label: 'Name', key: 'name', type: 'text', required: true, editable: true },
          { label: 'Count', key: 'count', type: 'number', required: true, editable: true },
          { label: 'CountZero', key: 'zero', type: 'number', required: true, editable: true },
          { label: 'CountStrZero', key: 'strzero', type: 'number', required: true, editable: true },
          {
            label: 'Tags',
            key: 'tags',
            type: 'multiSelect',
            required: true,
            editable: true,
            options: [{ label: 'A', value: 'a' }],
          },
          { label: 'When', key: 'when', type: 'date', required: true, editable: true },
          { label: 'WhenStr', key: 'whenStr', type: 'dateString', required: true, editable: true },
          { label: 'Optional', key: 'opt', type: 'text', required: false, editable: true },
          { label: 'ReqReadOnly', key: 'rro', type: 'text', required: true, editable: false },
        ]}
        org={{
          name: 'Given',
          count: '3',
          zero: 0,
          strzero: '0',
          tags: ['a'],
          when: '2020-01-01',
          whenStr: '2020-01-01',
          opt: '',
          rro: '',
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // Save success flips back to view mode (edit affordance returns).
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Edit Save' })).toBeInTheDocument()
    );
    expect(onSave).toHaveBeenCalled();
  });

  it('blocks save and surfaces required errors for empty editable fields', () => {
    const onSave = jest.fn();
    render(
      <ProfileCard
        title="Invalid"
        onSave={onSave}
        fields={[
          { label: 'Name', key: 'name', type: 'text', required: true, editable: true },
          { label: 'Count', key: 'count', type: 'number', required: true, editable: true },
          { label: 'Tags', key: 'tags', type: 'multiSelect', required: true, editable: true },
          { label: 'When', key: 'when', type: 'date', required: true, editable: true },
          { label: 'WhenStr', key: 'whenStr', type: 'dateString', required: true, editable: true },
        ]}
        org={{ name: '', count: '', tags: [], when: '', whenStr: '' }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit Invalid' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Count is required')).toBeInTheDocument();
    expect(screen.getByText('Tags is required')).toBeInTheDocument();
    expect(screen.getByText('When is required')).toBeInTheDocument();
    expect(screen.getByText('WhenStr is required')).toBeInTheDocument();
  });

  it('logs and stays in edit mode when onSave rejects', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const onSave = jest.fn().mockRejectedValue(new Error('save failed'));
    render(
      <ProfileCard
        title="Fail"
        onSave={onSave}
        fields={[{ label: 'Name', key: 'name', type: 'text', editable: true }]}
        org={{ name: 'ok' }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit Fail' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith('Error in ProfileCard onSave:', expect.any(Error))
    );
    // Still editing — the Save button remains.
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    errorSpy.mockRestore();
  });

  it('resets the form and returns to view mode on cancel', () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(
      <ProfileCard
        title="Cancelable"
        onSave={onSave}
        fields={[{ label: 'Name', key: 'name', type: 'text', required: true, editable: true }]}
        org={{ name: '' }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit Cancelable' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Name is required')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Edit Cancelable' })).toBeInTheDocument();
    expect(screen.queryByText('Name is required')).not.toBeInTheDocument();
  });

  it('shows a verified badge and no verify CTA for a verified org', () => {
    render(
      <ProfileCard title="Org" showProfile fields={[]} org={{ name: 'Acme', isVerified: true }} />
    );

    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Verify business profile' })
    ).not.toBeInTheDocument();
  });

  it('shows a pending badge, opens/closes the booking overlay and updates the org logo', async () => {
    render(
      <ProfileCard title="Org" showProfile fields={[]} org={{ name: 'Acme', isVerified: false }} />
    );

    expect(screen.getByText('Pending')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Verify business profile' }));
    fireEvent.click(screen.getByRole('button', { name: 'close-overlay' }));

    fireEvent.click(screen.getByRole('button', { name: 'save-Update logo' }));
    await waitFor(() =>
      expect(updateOrgMock).toHaveBeenCalledWith(
        expect.objectContaining({ imageURL: 's3://s3-key' })
      )
    );
  });

  it('logs when the org logo update throws because the org is missing', () => {
    mockPrimaryOrg = null;
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ProfileCard title="Org" showProfile fields={[]} org={{ name: 'Acme', isVerified: true }} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'save-Update logo' }));

    expect(errorSpy).toHaveBeenCalledWith('Error updating organization:', expect.any(Error));
    expect(updateOrgMock).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('skips the org logo update when the s3 key is missing', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ProfileCard title="Org" showProfile fields={[]} org={{ name: 'Acme', isVerified: true }} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'empty-Update logo' }));

    expect(updateOrgMock).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('renders the user profile block and updates the profile picture', async () => {
    render(<ProfileCard title="User" showProfileUser fields={[]} org={{}} />);

    expect(screen.getByText('Pat Kim')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'save-Update Profile Picture' }));

    await waitFor(() => expect(upsertUserProfileMock).toHaveBeenCalled());
  });

  it('falls back to empty names when auth attributes are missing', () => {
    mockAttributes = null;
    render(<ProfileCard title="User" showProfileUser fields={[]} org={{}} />);

    expect(screen.getByRole('button', { name: 'save-Update Profile Picture' })).toBeInTheDocument();
  });

  it('logs and skips upsert when the profile is missing', () => {
    mockProfile = null;
    render(<ProfileCard title="User" showProfileUser fields={[]} org={{}} />);

    fireEvent.click(screen.getByRole('button', { name: 'save-Update Profile Picture' }));

    expect(upsertUserProfileMock).not.toHaveBeenCalled();
  });

  it('skips the profile picture upsert when the s3 key is missing', () => {
    render(<ProfileCard title="User" showProfileUser fields={[]} org={{}} />);

    fireEvent.click(screen.getByRole('button', { name: 'empty-Update Profile Picture' }));

    expect(upsertUserProfileMock).not.toHaveBeenCalled();
  });

  it('rebuilds form values when the org identity changes', () => {
    const { rerender } = render(
      <ProfileCard
        title="Reset"
        editable={false}
        fields={[{ label: 'Name', key: 'name', type: 'text' }]}
        org={{ name: 'First' }}
      />
    );
    expect(screen.getByText('First')).toBeInTheDocument();

    rerender(
      <ProfileCard
        title="Reset"
        editable={false}
        fields={[{ label: 'Name', key: 'name', type: 'text' }]}
        org={{ name: 'Second' }}
      />
    );
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('rebuilds form values when only the fields identity changes', () => {
    const org = { name: 'Same' };
    const { rerender } = render(
      <ProfileCard
        title="F"
        editable={false}
        fields={[{ label: 'Name', key: 'name', type: 'text' }]}
        org={org}
      />
    );

    rerender(
      <ProfileCard
        title="F"
        editable={false}
        fields={[{ label: 'Full Name', key: 'name', type: 'text' }]}
        org={org}
      />
    );

    expect(screen.getByText('Full Name')).toBeInTheDocument();
  });

  it('edits dropdown and country fields through their editors', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(
      <ProfileCard
        title="Prefs"
        fields={[
          {
            label: 'Plan',
            key: 'plan',
            type: 'dropdown',
            editable: true,
            options: [{ label: 'Picked', value: 'picked' }],
          },
          { label: 'Country', key: 'country', type: 'country', editable: true },
        ]}
        org={{ plan: 'basic', country: 'US' }}
        onSave={onSave}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit Prefs' }));
    fireEvent.click(screen.getByText('dropdown-Plan'));
    fireEvent.click(screen.getByText('dropdown-Country'));
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ plan: 'picked', country: 'picked' })
      )
    );
  });

  // Address autofill writes several fields at once. Their "required" errors were
  // raised against the blanks the autofill just filled, so they have to clear with
  // the same write - otherwise the row reads as invalid while holding a value.
  it('clears the required errors of every field an address autofill filled', () => {
    render(
      <ProfileCard
        title="Address"
        fields={[
          { label: 'Address', key: 'address', type: 'googleAddress', editable: true },
          { label: 'City', key: 'city', type: 'text', required: true, editable: true },
          { label: 'State', key: 'state', type: 'text', required: true, editable: true },
        ]}
        org={{ address: '', city: '', state: '' }}
        onSave={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit Address' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('City is required')).toBeInTheDocument();
    expect(screen.getByText('State is required')).toBeInTheDocument();

    fireEvent.click(screen.getByText('addr-country-Address'));

    expect(screen.queryByText('City is required')).not.toBeInTheDocument();
    expect(screen.queryByText('State is required')).not.toBeInTheDocument();
  });

  it('shows a scalar multiSelect value populated by address autofill', () => {
    render(
      <ProfileCard
        title="Address"
        fields={[
          { label: 'Address', key: 'address', type: 'googleAddress', editable: true },
          { label: 'Cities', key: 'city', type: 'multiSelect', editable: false },
        ]}
        org={{ address: '', city: '' }}
        onSave={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit Address' }));
    // The non-editable multiSelect row renders the scalar value set via onMultiChange.
    fireEvent.click(screen.getByText('addr-country-Address'));
    expect(screen.getByText('City')).toBeInTheDocument();
  });
});
