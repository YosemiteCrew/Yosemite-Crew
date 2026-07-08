import React from 'react';
import {render, screen, act} from '../../setup/testUtils';
import {useSelector} from 'react-redux';
// FIX 1: Update component import path
import {
  AssignTaskBottomSheet,
  type AssignTaskBottomSheetRef,
} from '@/features/tasks/components/AssignTaskBottomSheet/AssignTaskBottomSheet';
import {selectAuthUser} from '@/features/auth/selectors';
import {selectAcceptedCoParents} from '@/features/coParent/selectors';
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
  const ReactModule = require('react');
  const MockView = require('react-native').View;
  return ReactModule.forwardRef((props: any, ref: any) => (
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
// Redux Provider is handled by renderWithProviders from testUtils
// FIX 4: Update hook mock path
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: require('../../setup/mockTheme').mockTheme,
    isDark: false,
  }),
  useAppDispatch: () => jest.fn(),
  useAppSelector: jest.fn(),
}));
jest.mock('@/features/auth/selectors');

jest.mock('@/features/coParent/selectors', () => ({
  selectAcceptedCoParents: jest.fn(),
}));

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn(),
}));

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
    const ReactModule = require('react');
    const MockView = require('react-native').View;

    const MockGenericSelectBottomSheet = ReactModule.forwardRef(
      (props: any, ref: any) => {
        ReactModule.useImperativeHandle(ref, () => ({
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
const mockedSelectAuthUser = selectAuthUser as jest.Mock;
const mockedSelectAcceptedCoParents = selectAcceptedCoParents as jest.Mock;

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

let mockReduxState: Partial<RootState>;

// Helper to render the component with specific mock state
const renderComponent = (
  user: User | null,
  props: Partial<React.ComponentProps<typeof AssignTaskBottomSheet>> = {},
) => {
  mockReduxState = {
    auth: {user: user} as any,
    companion: {
      selectedCompanionId: null,
      companions: [],
    } as any,
  };

  // useTheme is already mocked in @/hooks mock
  mockedSelectAuthUser.mockImplementation(
    (state: RootState) => state.auth.user,
  );

  mockedSelectAcceptedCoParents.mockReturnValue([]);

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

  describe('assignableCoParents filtering', () => {
    const renderWithCoParents = (
      coParents: any[],
      selectedCompanionId: string | null,
    ) => {
      mockReduxState = {
        auth: {user: mockUserFull} as any,
        companion: {
          selectedCompanionId,
          companions: [],
        } as any,
      };

      mockedSelectAuthUser.mockImplementation(
        (state: RootState) => state.auth.user,
      );
      mockedSelectAcceptedCoParents.mockReturnValue(coParents);
      mockedUseSelector.mockImplementation(
        (selector: (state: RootState) => any): any =>
          selector(mockReduxState as RootState),
      );

      const onSelect = jest.fn();
      render(
        <AssignTaskBottomSheet onSelect={onSelect} selectedUserId={null} />,
      );
      return screen.getByTestId('mock-generic-sheet');
    };

    it('excludes all co-parents when no companion is selected', () => {
      const sheet = renderWithCoParents(
        [
          {
            companionId: 'c1',
            role: 'member',
            status: 'accepted',
            parentId: 'cp-1',
            firstName: 'Amy',
          },
        ],
        null,
      );
      // Only the current user is present; no co-parent items.
      expect(sheet.props.items).toHaveLength(1);
    });

    it('excludes co-parents belonging to a different companion', () => {
      const sheet = renderWithCoParents(
        [
          {
            companionId: 'other-companion',
            role: 'member',
            status: 'accepted',
            parentId: 'cp-1',
            firstName: 'Amy',
          },
        ],
        'c1',
      );
      expect(sheet.props.items).toHaveLength(1);
    });

    it('excludes a co-parent with the "primary" role', () => {
      const sheet = renderWithCoParents(
        [
          {
            companionId: 'c1',
            role: 'Primary',
            status: 'accepted',
            parentId: 'cp-1',
            firstName: 'Amy',
          },
        ],
        'c1',
      );
      expect(sheet.props.items).toHaveLength(1);
    });

    it('excludes a co-parent whose tasks permission is explicitly false', () => {
      const sheet = renderWithCoParents(
        [
          {
            companionId: 'c1',
            role: 'member',
            status: 'accepted',
            permissions: {tasks: false},
            parentId: 'cp-1',
            firstName: 'Amy',
          },
        ],
        'c1',
      );
      expect(sheet.props.items).toHaveLength(1);
    });

    it('excludes a co-parent who is not accepted', () => {
      const sheet = renderWithCoParents(
        [
          {
            companionId: 'c1',
            role: 'member',
            status: 'pending',
            parentId: 'cp-1',
            firstName: 'Amy',
          },
        ],
        'c1',
      );
      expect(sheet.props.items).toHaveLength(1);
    });

    it('includes a co-parent that satisfies every filter condition (permissions defaulting to allowed)', () => {
      const sheet = renderWithCoParents(
        [
          {
            companionId: 'c1',
            role: 'member',
            status: 'Accepted',
            parentId: 'cp-1',
            firstName: 'Amy',
            lastName: 'Lee',
          },
        ],
        'c1',
      );
      expect(sheet.props.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({id: 'cp-1', label: 'Amy Lee'}),
        ]),
      );
    });

    it('treats a missing role and status as falling back to an empty string', () => {
      const sheet = renderWithCoParents(
        [
          {
            companionId: 'c1',
            role: undefined,
            status: undefined,
            parentId: 'cp-1',
            firstName: 'Amy',
          },
        ],
        'c1',
      );
      // role falls back to '' (!== 'primary'), but status falls back to ''
      // (!== 'accepted'), so this co-parent is still excluded overall.
      expect(sheet.props.items).toHaveLength(1);
    });

    it('falls back to email, then "Co-parent", when firstName/lastName are missing', () => {
      const withEmail = renderWithCoParents(
        [
          {
            companionId: 'c1',
            role: 'member',
            status: 'accepted',
            parentId: 'cp-1',
            email: 'amy@example.com',
          },
        ],
        'c1',
      );
      expect(withEmail.props.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({id: 'cp-1', label: 'amy@example.com'}),
        ]),
      );

      const withoutEmail = renderWithCoParents(
        [
          {
            companionId: 'c1',
            role: 'member',
            status: 'accepted',
            parentId: 'cp-2',
          },
        ],
        'c1',
      );
      expect(withoutEmail.props.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({id: 'cp-2', label: 'Co-parent'}),
        ]),
      );
    });

    it('deduplicates a co-parent whose resolved id already appeared (e.g. matches the current user)', () => {
      const sheet = renderWithCoParents(
        [
          {
            companionId: 'c1',
            role: 'member',
            status: 'accepted',
            parentId: 'user-1', // Same id as the current user (mockUserFull).
            firstName: 'Duplicate',
          },
        ],
        'c1',
      );
      // The duplicate co-parent entry should be filtered out, leaving only
      // the original current-user entry.
      expect(sheet.props.items).toHaveLength(1);
      expect(sheet.props.items[0].id).toBe('user-1');
    });
  });

  describe('renderUserItem', () => {
    let renderItem: (
      item: SelectItem,
      isSelected: boolean,
    ) => React.ReactElement;

    beforeEach(() => {
      // useTheme is already mocked in @/hooks mock
      renderComponent(mockUserFull);
      const sheet = screen.getByTestId('mock-generic-sheet');
      renderItem = sheet.props.renderItem;
    });

    it('renders avatar image when avatar URL is present', () => {
      const {Image} = require('react-native');
      const item: SelectItem = {
        id: 'user-1',
        label: 'Test',
        avatar: 'http://example.com/avatar.png',
      };
      const {UNSAFE_getByType, queryByText} = render(renderItem(item, false));
      expect(UNSAFE_getByType(Image).props.source).toEqual({
        uri: 'http://example.com/avatar.png',
      });
      expect(queryByText('T')).toBeNull();
    });

    it('renders initials when avatar URL is missing', () => {
      const item: SelectItem = {id: 'user-1', label: 'Test', avatar: undefined};
      // useTheme is already mocked in @/hooks mock
      const {getByText, queryByTestId} = render(renderItem(item, false));
      expect(getByText('T')).toBeTruthy(); // First char of 'Test'
      expect(queryByTestId('mock-image')).toBeNull();
    });

    it('renders a checkmark when item is selected', () => {
      const item: SelectItem = {id: 'user-1', label: 'Test', avatar: undefined};
      const {getByText} = render(renderItem(item, true));
      expect(getByText('✓')).toBeTruthy();
    });

    it('does not render a checkmark when item is not selected', () => {
      const item: SelectItem = {id: 'user-1', label: 'Test', avatar: undefined};
      const {queryByText} = render(renderItem(item, false));
      expect(queryByText('✓')).toBeNull();
    });
  });

  describe('users deduplication', () => {
    it('excludes co-parent entries that resolve to no id', () => {
      const sheet = (() => {
        mockReduxState = {
          auth: {user: mockUserFull} as any,
          companion: {selectedCompanionId: 'c1', companions: []} as any,
        };
        mockedSelectAuthUser.mockImplementation(
          (state: RootState) => state.auth.user,
        );
        mockedSelectAcceptedCoParents.mockReturnValue([
          {
            companionId: 'c1',
            role: 'member',
            status: 'accepted',
            // No parentId, id, or userId -> resolves to a falsy id
            firstName: 'NoId',
          },
        ]);
        mockedUseSelector.mockImplementation(
          (selector: (state: RootState) => any): any =>
            selector(mockReduxState as RootState),
        );
        render(
          <AssignTaskBottomSheet onSelect={jest.fn()} selectedUserId={null} />,
        );
        return screen.getByTestId('mock-generic-sheet');
      })();

      // Only the current user (with a valid id) should remain.
      expect(sheet.props.items).toEqual([
        {id: 'user-1', label: 'Test', avatar: 'http://example.com/avatar.png'},
      ]);
    });
  });
});
