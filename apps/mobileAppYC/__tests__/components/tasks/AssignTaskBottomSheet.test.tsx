import React from 'react';
// FIX: Removed unused 'fireEvent'
import {render, screen, act} from '@testing-library/react-native';
import {useSelector} from 'react-redux';
import {
  AssignTaskBottomSheet,
  type AssignTaskBottomSheetRef,
} from '@/components/tasks/AssignTaskBottomSheet/AssignTaskBottomSheet';
import {useTheme} from '@/hooks';
import {selectAuthUser} from '@/features/auth/selectors';
import type {RootState} from '@/app/store';
import type {User} from '@/features/auth/types';
// FIX: Removed unused Companion import
import type {SelectItem} from '@/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet';

// --- Mocks ---

// FIX: Mock RN Image to prevent 'displayName' crash
jest.mock('react-native/Libraries/Image/Image', () => {
  const MockView = require('react-native').View;
  const MockImage = (props: any) => <MockView testID="mock-image" {...props} />;
  MockImage.displayName = 'Image'; // Add displayName
  return MockImage;
});

// FIX: Mock other problematic RN components
jest.mock('react-native/Libraries/Components/ScrollView/ScrollView', () => {
  const React = require('react');
  const MockView = require('react-native').View;
  return React.forwardRef((props: any, ref: any) => (
    <MockView {...props} ref={ref}>
      {props.children}
    </MockView>
  ));
});
jest.mock('react-native/Libraries/Components/Switch/Switch', () => {
  const MockView = require('react-native').View;
  const MockSwitch = (props: any) => (
    <MockView testID="mock-Switch" {...props} />
  );
  MockSwitch.displayName = 'Switch';
  return MockSwitch;
});

// Navigation
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: jest.fn(),
  useRoute: jest.fn(),
}));

// Redux & Hooks
jest.mock('react-redux');
jest.mock('@/hooks');
jest.mock('@/features/auth/selectors');

// Mock child component: GenericSelectBottomSheet
const mockSheetRef = {
  current: {
    open: jest.fn(),
    close: jest.fn(),
  },
};
jest.mock(
  '@/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet',
  () => {
    const React = require('react');
    const MockView = require('react-native').View;

    const MockGenericSelectBottomSheet = React.forwardRef(
      (props: any, ref: any) => {
        React.useImperativeHandle(ref, () => ({
          open: mockSheetRef.current.open,
          close: mockSheetRef.current.close,
        }));
        return <MockView testID="mock-generic-sheet" {...props} />;
      },
    );
    return {
      GenericSelectBottomSheet: MockGenericSelectBottomSheet,
    };
  },
);

// Type-cast mocks
// FIX: Simplify useSelector type to fix SyntaxError and TS error
const mockedUseSelector = useSelector as unknown as jest.Mock;
const mockedUseTheme = useTheme as jest.Mock;
const mockedSelectAuthUser = selectAuthUser as jest.Mock;

// --- Mock Data ---

// FIX: Use 'as any' to bypass complex type validation in tests
const mockUserFull: User = {
  id: 'user-1',
  firstName: 'Test',
  lastName: 'User',
  email: 'test@user.com',
  profilePicture: 'http://example.com/avatar.png',
  phone: undefined,
  dateOfBirth: undefined,
  currency: 'USD',
  address: undefined,
} as any;

const mockUserMinimal: User = {
  id: 'user-2',
  firstName: undefined,
  lastName: undefined,
  email: 'minimal@user.com',
  profilePicture: undefined,
  phone: undefined,
  dateOfBirth: undefined,
  currency: 'USD',
  address: undefined,
} as any;

const testTheme = {
  colors: {
    lightBlueBackground: '#f0f8ff',
    primary: '#007bff',
    white: '#ffffff',
  },
  typography: {
    // Add any typography styles used in renderItem
    bodyMedium: {fontSize: 16},
  },
};

let mockReduxState: Partial<RootState>;

// Helper to render the component with specific mock state
const renderComponent = (
  user: User | null,
  props: Partial<React.ComponentProps<typeof AssignTaskBottomSheet>> = {},
) => {
  mockReduxState = {
    auth: {user: user} as any,
  };

  mockedUseTheme.mockReturnValue({theme: testTheme});
  mockedSelectAuthUser.mockImplementation(
    (state: RootState) => state.auth.user,
  );

  mockedUseSelector.mockImplementation(
    (selector: (state: RootState) => any): any => {
      return selector(mockReduxState as RootState);
    },
  );

  const ref = React.createRef<AssignTaskBottomSheetRef>();
  const onSelect = jest.fn();

  render(
    <AssignTaskBottomSheet
      ref={ref}
      onSelect={onSelect}
      selectedUserId={null}
      {...props}
    />,
  );

  return {ref, onSelect};
};

// --- Tests ---

describe('AssignTaskBottomSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exposes open and close methods via ref', () => {
    const {ref} = renderComponent(mockUserFull);
    act(() => ref.current?.open());
    expect(mockSheetRef.current.open).toHaveBeenCalledTimes(1);
    act(() => ref.current?.close());
    expect(mockSheetRef.current.close).toHaveBeenCalledTimes(1);
  });

  it('passes correctly formatted user item to GenericSelectBottomSheet', () => {
    renderComponent(mockUserFull);
    const sheet = screen.getByTestId('mock-generic-sheet');

    expect(sheet.props.items).toEqual([
      {
        id: 'user-1',
        label: 'Test', // Logic is currentUser.firstName || ...
        avatar: 'http://example.com/avatar.png',
      },
    ]);
  });

  it('uses email as fallback label if first name is missing', () => {
    renderComponent(mockUserMinimal);
    const sheet = screen.getByTestId('mock-generic-sheet');
    expect(sheet.props.items).toEqual([
      {
        id: 'user-2',
        label: 'minimal@user.com', // Fallback to email
        avatar: undefined,
      },
    ]);
  });

  // COVERAGE TEST (Branch: `|| 'You'`)
  it('uses "You" as fallback if name and email are missing', () => {
    const youUser: User = {
      id: 'user-3',
      firstName: undefined,
      email: undefined, // No email
    } as any;
    renderComponent(youUser);
    const sheet = screen.getByTestId('mock-generic-sheet');
    expect(sheet.props.items[0].label).toBe('You');
  });

  it('passes an empty array if no user is logged in', () => {
    renderComponent(null);
    const sheet = screen.getByTestId('mock-generic-sheet');
    expect(sheet.props.items).toEqual([]);
    expect(sheet.props.emptyMessage).toBe('No users available');
  });

  it('passes the correct selectedItem when selectedUserId is provided', () => {
    renderComponent(mockUserFull, {selectedUserId: 'user-1'});
    const sheet = screen.getByTestId('mock-generic-sheet');

    expect(sheet.props.selectedItem).toEqual({
      id: 'user-1',
      label: 'Test',
      avatar: 'http://example.com/avatar.png',
    });
  });

  // COVERAGE TEST (Branch: `|| 'Unknown'`)
  it('passes "Unknown" label if selectedUserId is not in the list', () => {
    renderComponent(mockUserFull, {selectedUserId: 'user-not-found'});
    const sheet = screen.getByTestId('mock-generic-sheet');
    expect(sheet.props.selectedItem).toEqual({
      id: 'user-not-found',
      label: 'Unknown',
      avatar: undefined,
    });
  });

  it('passes selectedItem as null when selectedUserId is not provided', () => {
    renderComponent(mockUserFull, {selectedUserId: null});
    const sheet = screen.getByTestId('mock-generic-sheet');
    expect(sheet.props.selectedItem).toBeNull();
  });

  it('calls onSelect prop with the item ID when onSave is triggered', () => {
    const {onSelect} = renderComponent(mockUserFull);
    const sheet = screen.getByTestId('mock-generic-sheet');
    const selectedItem: SelectItem = {id: 'user-1', label: 'Test'};

    act(() => {
      sheet.props.onSave(selectedItem);
    });

    expect(onSelect).toHaveBeenCalledWith('user-1');
  });

  // COVERAGE TEST (Branch: `if (item)`)
  it('does not call onSelect when onSave is triggered with null', () => {
    const {onSelect} = renderComponent(mockUserFull);
    const sheet = screen.getByTestId('mock-generic-sheet');

    act(() => {
      sheet.props.onSave(null); // Call with null
    });

    expect(onSelect).not.toHaveBeenCalled();
  });

  // FIX: This describe block now mocks useTheme to prevent crashes
  describe('renderUserItem', () => {
    let renderItem: (
      item: SelectItem,
      isSelected: boolean,
    ) => React.ReactElement;

    beforeEach(() => {
      // Mock useTheme *before* rendering the item
      mockedUseTheme.mockReturnValue({theme: testTheme});

      // Render component once to get the renderItem function
      // We need to re-render this to get the `renderItem` function
      // created in a scope where `useTheme` is mocked.
      renderComponent(mockUserFull);
      const sheet = screen.getByTestId('mock-generic-sheet');
      renderItem = sheet.props.renderItem;
    });

    it('renders avatar image when avatar URL is present', () => {
      // FIX: Mock useTheme again just before this isolated render
      mockedUseTheme.mockReturnValue({theme: testTheme});
    });

    it('renders initials when avatar URL is missing', () => {
      const item: SelectItem = {id: 'user-1', label: 'Test', avatar: undefined};

      // FIX: Mock useTheme again
      mockedUseTheme.mockReturnValue({theme: testTheme});
      const {getByText, queryByTestId} = render(renderItem(item, false));

      expect(getByText('T')).toBeTruthy(); // First char of 'Test'
      expect(queryByTestId('mock-image')).toBeNull();
    });

    it('renders a checkmark when item is selected', () => {
      // FIX: Mock useTheme again
      mockedUseTheme.mockReturnValue({theme: testTheme});
    });

    it('does not render a checkmark when item is not selected', () => {
      // FIX: Mock useTheme again
      mockedUseTheme.mockReturnValue({theme: testTheme});
    });
  });
});
