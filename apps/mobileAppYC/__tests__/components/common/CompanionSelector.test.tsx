import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {render, fireEvent, act} from '@testing-library/react-native';
import {CompanionSelector} from '../../../src/shared/components/common/CompanionSelector/CompanionSelector';
import {Platform, ToastAndroid, Alert, Image} from 'react-native';
import * as Redux from 'react-redux';

// --- Mocks ---

// Mock Redux
jest.mock('react-redux', () => ({
  useSelector: jest.fn(),
}));

// Mock Images asset
jest.mock('@/assets/images', () => ({
  Images: {
    blueAddIcon: {uri: 'blue-add-icon-png'},
  },
}));

// Mock useTheme hook
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// Mock normalizeImageUri
jest.mock('@/shared/utils/imageUri', () => ({
  normalizeImageUri: (uri: string | null) => uri || null,
}));

// Mock Toast/Alert
jest.spyOn(Alert, 'alert');
jest.spyOn(ToastAndroid, 'show');

describe('CompanionSelector Component', () => {
  const mockOnSelect = jest.fn();
  const mockOnAddCompanion = jest.fn();

  const mockCompanions = [
    {
      id: '1',
      name: 'Buddy',
      profileImage: 'http://img.com/1.jpg',
      taskCount: 2,
    },
    {id: '2', name: 'Max', profileImage: null}, // No image -> Fallback initial
    {id: '3', name: 'Bella'}, // No taskCount -> Undefined badge text
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Default Redux state: safe defaults for all 4 selector calls
    // 1. accessMap
    // 2. defaultAccess
    // 3. globalRole
    // 4. globalPermissions
    (Redux.useSelector as unknown as jest.Mock).mockReturnValue(null);
  });

  // ===========================================================================
  // 1. Rendering Logic (Avatars, Fallbacks, Badges)
  // ===========================================================================

  it('renders companions correctly', () => {
    const {getByText} = render(
      <CompanionSelector
        companions={mockCompanions}
        selectedCompanionId="1"
        onSelect={mockOnSelect}
      />,
    );

    expect(getByText('Buddy')).toBeTruthy();
    expect(getByText('Max')).toBeTruthy();

    // Check Badge Text Logic
    expect(getByText('2 Tasks')).toBeTruthy(); // Buddy has tasks
  });

  it('renders fallback initial when profile image is missing or null', () => {
    const {getByText} = render(
      <CompanionSelector
        companions={[mockCompanions[1]]} // Max (no image)
        selectedCompanionId={null}
        onSelect={mockOnSelect}
      />,
    );
    // Max -> 'M'
    expect(getByText('M')).toBeTruthy();
  });

  it('renders fallback initial when image load fails', () => {
    const {getByText, UNSAFE_getByType} = render(
      <CompanionSelector
        companions={[mockCompanions[0]]} // Buddy (has image initially)
        selectedCompanionId="1"
        onSelect={mockOnSelect}
      />,
    );

    const image = UNSAFE_getByType(Image);
    // Trigger onError
    fireEvent(image, 'error');

    // Should re-render with fallback initial 'B' for Buddy
    expect(getByText('B')).toBeTruthy();
  });

  it('renders custom badge text if getBadgeText prop is provided', () => {
    const {getByText} = render(
      <CompanionSelector
        companions={mockCompanions}
        selectedCompanionId="1"
        onSelect={mockOnSelect}
        getBadgeText={c => `Custom ${c.name}`}
      />,
    );

    expect(getByText('Custom Buddy')).toBeTruthy();
  });

  it('renders "Add companion" button when showAddButton is true', () => {
    const {getByText} = render(
      <CompanionSelector
        companions={[]}
        selectedCompanionId={null}
        onSelect={mockOnSelect}
        onAddCompanion={mockOnAddCompanion}
        showAddButton={true}
      />,
    );

    const addButton = getByText('Add companion');
    fireEvent.press(addButton);
    expect(mockOnAddCompanion).toHaveBeenCalled();
  });

  it('does NOT render "Add companion" button when showAddButton is false', () => {
    const {queryByText} = render(
      <CompanionSelector
        companions={[]}
        selectedCompanionId={null}
        onSelect={mockOnSelect}
        showAddButton={false}
      />,
    );

    expect(queryByText('Add companion')).toBeNull();
  });

  // ===========================================================================
  // 2. Sorting Logic (Priority & Original Order)
  // ===========================================================================

  it('correctly uses resolveRolePriority for sorting', () => {
    // Define IDs explicitly to match test expectation
    // 1: Viewer (Priority 2)
    // 2: Primary (Priority 0)
    // 3: CoParent (Priority 1)
    const accessMapMock = {
      '1': {role: 'VIEWER'},
      '2': {role: 'PRIMARY_OWNER'},
      '3': {role: 'COPARENT'},
    };

    // Explicitly mock the 4 selector calls in order
    (Redux.useSelector as unknown as jest.Mock)
      .mockReturnValueOnce(accessMapMock) // 1. accessMap
      .mockReturnValueOnce(null) // 2. defaultAccess
      .mockReturnValueOnce(null) // 3. globalRole
      .mockReturnValueOnce(null); // 4. globalPermissions

    const {getAllByText} = render(
      <CompanionSelector
        companions={mockCompanions} // Input Order: 1, 2, 3
        selectedCompanionId={null}
        onSelect={mockOnSelect}
      />,
    );

    const names = getAllByText(/Buddy|Max|Bella/);
    // Expected Sort Order:
    // 1. Max (ID 2, Primary) -> Priority 0
    // 2. Bella (ID 3, CoParent) -> Priority 1
    // 3. Buddy (ID 1, Viewer) -> Priority 2

    expect(names[0].props.children).toBe('Max');
    expect(names[1].props.children).toBe('Bella');
    expect(names[2].props.children).toBe('Buddy');
  });

  it('sorts companions that are missing every id using the missing-id fallbacks', () => {
    // Two companions with no id/_id/companionId at all. With 2+ items the sort
    // comparator actually runs; both resolve to priority 2 (equal), so the
    // comparator falls into the "__missingA__"/"__missingB__" id fallbacks and
    // resolveRolePriority's empty-string companionId fallback.
    (Redux.useSelector as unknown as jest.Mock).mockReturnValue(null);

    const noIdCompanions = [{name: 'NoIdOne'}, {name: 'NoIdTwo'}];

    const {getByText} = render(
      // @ts-ignore
      <CompanionSelector companions={noIdCompanions} onSelect={mockOnSelect} />,
    );

    expect(getByText('NoIdOne')).toBeTruthy();
    expect(getByText('NoIdTwo')).toBeTruthy();
  });

  // ===========================================================================
  // 3. Interaction & Permissions Logic
  // ===========================================================================

  it('selects companion if no permission is required', () => {
    (Redux.useSelector as unknown as jest.Mock).mockReturnValue(null); // Reset mocks

    const {getByText} = render(
      <CompanionSelector
        companions={mockCompanions}
        selectedCompanionId={null}
        onSelect={mockOnSelect}
      />,
    );

    fireEvent.press(getByText('Buddy'));
    expect(mockOnSelect).toHaveBeenCalledWith('1');
  });

  it('selects companion if permission is required and user HAS permission', () => {
    const accessMapMock = {
      '1': {
        role: 'VIEWER',
        permissions: {canViewVet: true},
      },
    };

    (Redux.useSelector as unknown as jest.Mock)
      .mockReturnValueOnce(accessMapMock) // accessMap
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null);

    const {getByText} = render(
      <CompanionSelector
        companions={[mockCompanions[0]]}
        selectedCompanionId={null}
        onSelect={mockOnSelect}
        requiredPermission="canViewVet"
      />,
    );

    fireEvent.press(getByText('Buddy'));
    expect(mockOnSelect).toHaveBeenCalledWith('1');
  });

  it('shows toast/alert if permission is REQUIRED but user LACKS permission', () => {
    Platform.OS = 'android'; // Test Android Toast path
    const accessMapMock = {
      '1': {
        role: 'VIEWER',
        permissions: {canViewVet: false},
      },
    };

    (Redux.useSelector as unknown as jest.Mock)
      .mockReturnValueOnce(accessMapMock)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null);

    const {getByText} = render(
      <CompanionSelector
        companions={[mockCompanions[0]]}
        selectedCompanionId={null}
        onSelect={mockOnSelect}
        requiredPermission="canViewVet"
        permissionLabel="Vet Records"
      />,
    );

    fireEvent.press(getByText('Buddy'));

    expect(mockOnSelect).not.toHaveBeenCalled();
    expect(ToastAndroid.show).toHaveBeenCalledWith(
      expect.stringContaining('access to Vet Records'),
      expect.anything(),
    );
  });

  it('shows iOS Alert if permission denied on iOS', () => {
    Platform.OS = 'ios';
    const accessMapMock = {
      '1': {role: 'VIEWER', permissions: {canEdit: false}},
    };

    (Redux.useSelector as unknown as jest.Mock)
      .mockReturnValueOnce(accessMapMock)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null);

    const {getByText} = render(
      <CompanionSelector
        companions={[mockCompanions[0]]}
        selectedCompanionId={null}
        onSelect={mockOnSelect}
        requiredPermission="canEdit"
      />,
    );

    fireEvent.press(getByText('Buddy'));
    expect(Alert.alert).toHaveBeenCalled();
  });

  it('allows access if user is PRIMARY regardless of permissions object', () => {
    const accessMapMock = {
      '1': {role: 'PRIMARY_OWNER', permissions: {canEdit: false}}, // explicitly false, but role is primary
    };

    (Redux.useSelector as unknown as jest.Mock)
      .mockReturnValueOnce(accessMapMock)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null);

    const {getByText} = render(
      <CompanionSelector
        companions={[mockCompanions[0]]}
        selectedCompanionId={null}
        onSelect={mockOnSelect}
        requiredPermission="canEdit"
      />,
    );

    fireEvent.press(getByText('Buddy'));
    expect(mockOnSelect).toHaveBeenCalledWith('1');
  });

  it('denies selection and uses empty role/permission fallbacks when no access data exists', () => {
    // Default mock returns null for every selector, so accessMap/defaultAccess/
    // globalRole/globalPermissions are all null. In the onPress permission block
    // this falls through every `??` to an empty role and undefined permissions,
    // landing on the ternary's `: false` arm and blocking selection.
    Platform.OS = 'android';
    (Redux.useSelector as unknown as jest.Mock).mockReturnValue(null);

    const {getByText} = render(
      <CompanionSelector
        companions={[mockCompanions[0]]}
        selectedCompanionId={null}
        onSelect={mockOnSelect}
        requiredPermission="canViewVet"
      />,
    );

    fireEvent.press(getByText('Buddy'));

    expect(mockOnSelect).not.toHaveBeenCalled();
    expect(ToastAndroid.show).toHaveBeenCalledWith(
      expect.stringContaining('canViewVet'),
      expect.anything(),
    );
  });

  it('grants selection using globally fetched permissions when the companion has none of its own', () => {
    // Access exists (non-null) but carries no permissions object, so the lookup
    // skips `access?.permissions` and resolves via globalPermissions (the middle
    // arm of the `?? ... ?? ...` chain).
    (Redux.useSelector as unknown as jest.Mock).mockImplementation(selector =>
      selector({
        coParent: {
          accessByCompanionId: {'1': {role: 'VIEWER'}},
          defaultAccess: null,
          lastFetchedRole: null,
          lastFetchedPermissions: {canViewVet: true},
        },
      }),
    );

    const {getByText} = render(
      <CompanionSelector
        companions={[mockCompanions[0]]}
        selectedCompanionId={null}
        onSelect={mockOnSelect}
        requiredPermission="canViewVet"
      />,
    );

    fireEvent.press(getByText('Buddy'));
    expect(mockOnSelect).toHaveBeenCalledWith('1');
  });

  it('falls back to defaultAccess for both the access and its permissions lookup', () => {
    // accessMap has no entry for this companion, so access resolves from
    // defaultAccess. That defaultAccess carries no permissions and none are
    // globally fetched, so the chain reaches `defaultAccess?.permissions`
    // (non-null defaultAccess) which yields undefined -> denied.
    Platform.OS = 'android';
    (Redux.useSelector as unknown as jest.Mock).mockImplementation(selector =>
      selector({
        coParent: {
          accessByCompanionId: {},
          defaultAccess: {role: 'VIEWER'},
          lastFetchedRole: null,
          lastFetchedPermissions: null,
        },
      }),
    );

    const {getByText} = render(
      <CompanionSelector
        companions={[mockCompanions[0]]}
        selectedCompanionId={null}
        onSelect={mockOnSelect}
        requiredPermission="canViewVet"
      />,
    );

    fireEvent.press(getByText('Buddy'));

    expect(mockOnSelect).not.toHaveBeenCalled();
    expect(ToastAndroid.show).toHaveBeenCalled();
  });

  it('shows the generic permission message when the permission label is an empty string', () => {
    // permissionLabel="" is not nullish, so `permissionLabel ?? requiredPermission`
    // resolves to the empty string. showPermissionToast then takes its falsy-label
    // branch and emits the generic "this companion" copy.
    Platform.OS = 'ios';
    (Redux.useSelector as unknown as jest.Mock).mockReturnValue(null);

    const {getByText} = render(
      <CompanionSelector
        companions={[mockCompanions[0]]}
        selectedCompanionId={null}
        onSelect={mockOnSelect}
        requiredPermission="canViewVet"
        permissionLabel=""
      />,
    );

    fireEvent.press(getByText('Buddy'));

    expect(mockOnSelect).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Permission needed',
      expect.stringContaining('this companion'),
    );
  });

  // ===========================================================================
  // 4. Edge Cases & Branches
  // ===========================================================================

  it('handles companion with missing ID gracefully', () => {
    // If a companion has no ID
    const badCompanion = {name: 'Ghost', taskCount: 0};

    // Mock defaults to prevent crash on sort
    (Redux.useSelector as unknown as jest.Mock).mockReturnValue(null);

    const {getByText} = render(
      // @ts-ignore
      <CompanionSelector companions={[badCompanion]} onSelect={mockOnSelect} />,
    );

    fireEvent.press(getByText('Ghost'));
    // onSelect logic checks for id existence, so it shouldn't be called
    expect(mockOnSelect).not.toHaveBeenCalled();
  });

  it('handles _id and companionId fallback properties for ID', () => {
    (Redux.useSelector as unknown as jest.Mock).mockReturnValue(null);

    // Test the ID resolution logic in sort and render
    const altCompanions = [
      {_id: 'a1', name: 'Alpha'},
      {companionId: 'b2', name: 'Beta'},
    ];

    const {getByText} = render(
      // @ts-ignore
      <CompanionSelector companions={altCompanions} onSelect={mockOnSelect} />,
    );

    fireEvent.press(getByText('Alpha'));
    expect(mockOnSelect).toHaveBeenCalledWith('a1');

    fireEvent.press(getByText('Beta'));
    expect(mockOnSelect).toHaveBeenCalledWith('b2');
  });

  it('falls back to empty defaults when the coParent slice is missing from state', () => {
    // Exercise the real selector bodies (state.coParent?.x ?? fallback) by
    // actually invoking the passed selector against a state with no coParent
    // slice, rather than short-circuiting useSelector with a fixed mock value.
    (Redux.useSelector as unknown as jest.Mock).mockImplementation(selector =>
      selector({coParent: undefined}),
    );

    const {getByText} = render(
      <CompanionSelector
        companions={mockCompanions}
        selectedCompanionId={null}
        onSelect={mockOnSelect}
      />,
    );

    fireEvent.press(getByText('Buddy'));
    expect(mockOnSelect).toHaveBeenCalledWith('1');
  });

  it('reads the coParent slice fields when present in state', () => {
    (Redux.useSelector as unknown as jest.Mock).mockImplementation(selector =>
      selector({
        coParent: {
          accessByCompanionId: {'1': {role: 'PRIMARY'}},
          defaultAccess: null,
          lastFetchedRole: 'PRIMARY',
          lastFetchedPermissions: null,
        },
      }),
    );

    const {getByText} = render(
      <CompanionSelector
        companions={mockCompanions}
        selectedCompanionId={null}
        onSelect={mockOnSelect}
      />,
    );

    fireEvent.press(getByText('Buddy'));
    expect(mockOnSelect).toHaveBeenCalledWith('1');
  });

  it('exposes the selected state to screen readers via accessibilityState', () => {
    const {getByLabelText} = render(
      <CompanionSelector
        companions={mockCompanions}
        selectedCompanionId="1"
        onSelect={mockOnSelect}
      />,
    );

    const selected = getByLabelText('Buddy, 2 Tasks');
    expect(selected.props.accessibilityRole).toBe('radio');
    expect(selected.props.accessibilityState).toEqual({selected: true});

    const unselected = getByLabelText('Bella');
    expect(unselected.props.accessibilityState).toEqual({selected: false});
  });

  it('does not toggle a companion image out of the failed state twice', () => {
    const {getByText, UNSAFE_getByType} = render(
      <CompanionSelector
        companions={[mockCompanions[0]]}
        selectedCompanionId="1"
        onSelect={mockOnSelect}
      />,
    );

    const image = UNSAFE_getByType(Image);
    const onError = image.props.onError;
    act(() => {
      onError();
    });
    // Firing a second error for the same companion should hit the dedup
    // branch (prev[id] already true) rather than creating a new state object.
    act(() => {
      onError();
    });

    expect(getByText('B')).toBeTruthy();
  });
});
