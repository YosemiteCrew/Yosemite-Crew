import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
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
  useTheme: () => ({
    theme: {
      colors: {
        primary: 'blue',
        primaryTint: 'lightblue',
        secondary: 'black',
        cardBackground: 'white',
        lightBlueBackground: '#E6F7FF',
        primarySurface: '#EEF',
        primaryTintStrong: 'blue',
      },
      spacing: {
        '1': 4,
        '2.5': 10,
      },
      borderRadius: {
        full: 999,
      },
      typography: {
        titleMedium: {fontSize: 16, fontWeight: 'bold'},
        titleSmall: {fontSize: 14},
        labelXsBold: {fontSize: 12, fontWeight: 'bold'},
      },
    },
  }),
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
});
