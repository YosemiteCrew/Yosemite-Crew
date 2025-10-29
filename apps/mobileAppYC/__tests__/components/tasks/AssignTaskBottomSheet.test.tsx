import React from 'react';
import {render, screen, act} from '@testing-library/react-native';
import {useSelector} from 'react-redux';
// FIX 1: Update component import path
import {
  AssignTaskBottomSheet,
  type AssignTaskBottomSheetRef,
} from '@/features/tasks/components/AssignTaskBottomSheet/AssignTaskBottomSheet';
// FIX 2: Update hook import path
import {useTheme} from '@/shared/hooks';
import {selectAuthUser} from '@/features/auth/selectors';
import type {RootState} from '@/app/store';
import type {User} from '@/features/auth/types';
// FIX 3: Update shared component type import path
import type {SelectItem} from '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet';

// --- Mocks ---

jest.mock('react-native/Libraries/Image/Image', () => {
  const MockView = require('react-native').View;
  const MockImage = (props: any) => <MockView testID="mock-image" {...props} />;
  MockImage.displayName = 'Image';
  return MockImage;
});

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
// FIX 4: Update hook mock path
jest.mock('@/shared/hooks');
jest.mock('@/features/auth/selectors');

// Mock child component: GenericSelectBottomSheet
const mockSheetRef = {
  current: {
    open: jest.fn(),
    close: jest.fn(),
  },
};
// FIX 5: Update mocked component path
jest.mock(
  '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet',
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
    // Add displayName
    MockGenericSelectBottomSheet.displayName = 'GenericSelectBottomSheet';
    return {
      GenericSelectBottomSheet: MockGenericSelectBottomSheet,
    };
  },
);

// Type-cast mocks
const mockedUseSelector = useSelector as unknown as jest.Mock;
const mockedUseTheme = useTheme as jest.Mock;
const mockedSelectAuthUser = selectAuthUser as jest.Mock;

// --- Mock Data ---

const mockUserFull: User = {
  id: 'user-1',
  firstName: 'Test',
  lastName: 'User',
  email: 'test@user.com',
  profilePicture: 'http://example.com/avatar.png',
} as any;

const mockUserMinimal: User = {
  id: 'user-2',
  firstName: undefined,
  lastName: undefined,
  email: 'minimal@user.com',
  profilePicture: undefined,
} as any;

const testTheme = {
  colors: {
    lightBlueBackground: '#f0f8ff',
    primary: '#007bff',
    white: '#ffffff',
  },
  typography: {
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

  it('does not call onSelect when onSave is triggered with null', () => {
    const {onSelect} = renderComponent(mockUserFull);
    const sheet = screen.getByTestId('mock-generic-sheet');

    act(() => {
      sheet.props.onSave(null); // Call with null
    });

    expect(onSelect).not.toHaveBeenCalled();
  });

  describe('renderUserItem', () => {
    let renderItem: (
      item: SelectItem,
      isSelected: boolean,
    ) => React.ReactElement;

    beforeEach(() => {
      mockedUseTheme.mockReturnValue({theme: testTheme});
      renderComponent(mockUserFull);
      const sheet = screen.getByTestId('mock-generic-sheet');
      renderItem = sheet.props.renderItem;
    });

    it('renders avatar image when avatar URL is present', () => {
      mockedUseTheme.mockReturnValue({theme: testTheme});
    });

    it('renders initials when avatar URL is missing', () => {
      const item: SelectItem = {id: 'user-1', label: 'Test', avatar: undefined};
      mockedUseTheme.mockReturnValue({theme: testTheme});
      const {getByText, queryByTestId} = render(renderItem(item, false));
      expect(getByText('T')).toBeTruthy(); // First char of 'Test'
      expect(queryByTestId('mock-image')).toBeNull();
    });

    it('renders a checkmark when item is selected', () => {
      mockedUseTheme.mockReturnValue({theme: testTheme});
    });

    it('does not render a checkmark when item is not selected', () => {
      mockedUseTheme.mockReturnValue({theme: testTheme});
    });
  });
});
