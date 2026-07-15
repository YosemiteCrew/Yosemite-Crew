import React from 'react';
import {Alert} from 'react-native';
import * as Redux from 'react-redux';
import {render, fireEvent, screen} from '@testing-library/react-native';
import {mockTheme} from '../../../../setup/mockTheme';
import {CoParentsScreen} from '@/features/coParent/screens/CoParentsScreen/CoParentsScreen';

// --- Mocks ---

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);

const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  canGoBack: mockCanGoBack,
} as any;

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: any) => cb(),
}));

const mockDispatch = jest.fn();
let mockState: any = {};

jest.spyOn(Redux, 'useDispatch').mockReturnValue(mockDispatch as any);
jest
  .spyOn(Redux, 'useSelector')
  .mockImplementation((callback: any) => callback(mockState));

const mockFetchCoParents = jest.fn();

jest.mock('../../../../../src/features/coParent/thunks', () => ({
  fetchCoParents: (...args: any[]) => mockFetchCoParents(...args),
}));

jest.mock('../../../../../src/features/coParent/selectors', () => ({
  selectCoParents: (state: any) => state.coParent?.coParents ?? [],
  selectCoParentLoading: (state: any) => state.coParent?.loading ?? false,
}));

const mockSetSelectedCompanion = jest.fn();

jest.mock('@/features/companion', () => ({
  selectCompanions: (state: any) => state.companion?.companions || [],
  selectSelectedCompanionId: (state: any) =>
    state.companion?.selectedCompanionId,
  setSelectedCompanion: (id: any) => mockSetSelectedCompanion(id),
}));

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('@/assets/images', () => ({
  Images: {
    coparentEmpty: {uri: 'coparent-empty'},
    addIconDark: {uri: 'add-icon'},
  },
}));

jest.mock('@/shared/components/common/Header/Header', () => {
  const {View, Text, TouchableOpacity} = require('react-native');
  return {
    Header: ({title, onBack, rightIcon, onRightPress}: any) => (
      <View testID="header">
        <Text>{title}</Text>
        <TouchableOpacity testID="header-back-btn" onPress={onBack}>
          <Text>Back</Text>
        </TouchableOpacity>
        {rightIcon && (
          <TouchableOpacity testID="header-add-btn" onPress={onRightPress}>
            <Text>Add</Text>
          </TouchableOpacity>
        )}
      </View>
    ),
  };
});

jest.mock('@/shared/components/common', () => {
  const {View} = require('react-native');
  return {
    GifLoader: () => <View testID="gif-loader" />,
  };
});

jest.mock(
  '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen',
  () => {
    const {View} = require('react-native');
    return {
      LiquidGlassHeaderScreen: ({header, children}: any) => (
        <View testID="liquid-glass-header-screen">
          {header}
          {typeof children === 'function' ? children({}) : children}
        </View>
      ),
    };
  },
);

jest.mock(
  '../../../../../src/features/coParent/components/CoParentCard/CoParentCard',
  () => {
    const {View, Text, TouchableOpacity} = require('react-native');
    return {
      CoParentCard: ({
        coParent,
        onPressView,
        onPressEdit,
        hideSwipeActions,
        showEditAction,
        divider,
      }: any) => (
        <View testID={`coparent-card-${coParent.id}`}>
          <Text>{coParent.firstName}</Text>
          <Text testID={`hide-swipe-${coParent.id}`}>
            {String(hideSwipeActions)}
          </Text>
          <Text testID={`show-edit-${coParent.id}`}>
            {String(showEditAction)}
          </Text>
          <Text testID={`divider-${coParent.id}`}>{String(divider)}</Text>
          {onPressView && (
            <TouchableOpacity
              testID={`view-${coParent.id}`}
              onPress={onPressView}>
              <Text>View</Text>
            </TouchableOpacity>
          )}
          {onPressEdit && (
            <TouchableOpacity
              testID={`edit-${coParent.id}`}
              onPress={onPressEdit}>
              <Text>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
      ),
    };
  },
);

describe('CoParentsScreen', () => {
  const mockCompanion = {
    id: 'comp-1',
    name: 'Buddy',
    profileImage: 'https://img/buddy.jpg',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert');
    mockCanGoBack.mockReturnValue(true);

    mockState = {
      coParent: {
        coParents: [],
        loading: false,
        accessByCompanionId: {'comp-1': {role: 'PRIMARY'}},
        defaultAccess: null,
      },
      companion: {
        companions: [mockCompanion],
        selectedCompanionId: 'comp-1',
      },
    };
  });

  it('shows the loader while co-parents are loading', () => {
    mockState.coParent.loading = true;

    render(<CoParentsScreen navigation={mockNavigation} route={{} as any} />);

    expect(screen.getByTestId('gif-loader')).toBeTruthy();
  });

  it('shows the empty state when there are no co-parents', () => {
    render(<CoParentsScreen navigation={mockNavigation} route={{} as any} />);

    expect(screen.getByText(/Looks like your friends/i)).toBeTruthy();
  });

  it('renders a CoParentCard per co-parent when data is loaded', () => {
    mockState.coParent.coParents = [
      {id: 'cp-1', parentId: 'p-1', firstName: 'Jane', role: 'CO_PARENT'},
      {id: 'cp-2', parentId: 'p-2', firstName: 'Primary', role: 'PRIMARY'},
    ];

    render(<CoParentsScreen navigation={mockNavigation} route={{} as any} />);

    expect(screen.getByTestId('coparent-card-cp-1')).toBeTruthy();
    expect(screen.getByTestId('coparent-card-cp-2')).toBeTruthy();
  });

  it('hides swipe actions and press handlers for a primary entry', () => {
    mockState.coParent.coParents = [
      {id: 'cp-2', parentId: 'p-2', firstName: 'Primary', role: 'PRIMARY'},
    ];

    render(<CoParentsScreen navigation={mockNavigation} route={{} as any} />);

    expect(screen.getByTestId('hide-swipe-cp-2').props.children).toBe('true');
    expect(screen.getByTestId('show-edit-cp-2').props.children).toBe('false');
    expect(screen.queryByTestId('view-cp-2')).toBeNull();
    expect(screen.queryByTestId('edit-cp-2')).toBeNull();
  });

  it('marks the last item without a divider', () => {
    mockState.coParent.coParents = [
      {id: 'cp-1', parentId: 'p-1', firstName: 'Jane', role: 'CO_PARENT'},
      {id: 'cp-2', parentId: 'p-2', firstName: 'Mo', role: 'CO_PARENT'},
    ];

    render(<CoParentsScreen navigation={mockNavigation} route={{} as any} />);

    expect(screen.getByTestId('divider-cp-1').props.children).toBe('true');
    expect(screen.getByTestId('divider-cp-2').props.children).toBe('false');
  });

  it('navigates to EditCoParent when view is pressed for a non-primary entry', () => {
    mockState.coParent.coParents = [
      {id: 'cp-1', parentId: 'p-1', firstName: 'Jane', role: 'CO_PARENT'},
    ];

    render(<CoParentsScreen navigation={mockNavigation} route={{} as any} />);

    fireEvent.press(screen.getByTestId('view-cp-1'));

    expect(mockNavigate).toHaveBeenCalledWith('EditCoParent', {
      coParentId: 'p-1',
    });
  });

  it('navigates to EditCoParent when edit is pressed for a non-primary entry', () => {
    mockState.coParent.coParents = [
      {id: 'cp-1', parentId: 'p-1', firstName: 'Jane', role: 'CO_PARENT'},
    ];

    render(<CoParentsScreen navigation={mockNavigation} route={{} as any} />);

    fireEvent.press(screen.getByTestId('edit-cp-1'));

    expect(mockNavigate).toHaveBeenCalledWith('EditCoParent', {
      coParentId: 'p-1',
    });
  });

  it('falls back to id when a co-parent has no parentId', () => {
    mockState.coParent.coParents = [
      {id: 'cp-1', parentId: undefined, firstName: 'Jane', role: 'CO_PARENT'},
    ];

    render(<CoParentsScreen navigation={mockNavigation} route={{} as any} />);

    fireEvent.press(screen.getByTestId('view-cp-1'));

    expect(mockNavigate).toHaveBeenCalledWith('EditCoParent', {
      coParentId: 'cp-1',
    });
  });

  it('shows the add button in the header when the user can add a co-parent', () => {
    render(<CoParentsScreen navigation={mockNavigation} route={{} as any} />);
    expect(screen.getByTestId('header-add-btn')).toBeTruthy();
  });

  it('hides the add button in the header when the user is not primary', () => {
    mockState.coParent.accessByCompanionId = {'comp-1': {role: 'CO_PARENT'}};

    render(<CoParentsScreen navigation={mockNavigation} route={{} as any} />);
    expect(screen.queryByTestId('header-add-btn')).toBeNull();
  });

  it('falls back to defaultAccess role when no companion-specific access exists', () => {
    mockState.coParent.accessByCompanionId = {};
    mockState.coParent.defaultAccess = {role: 'PRIMARY'};

    render(<CoParentsScreen navigation={mockNavigation} route={{} as any} />);
    expect(screen.getByTestId('header-add-btn')).toBeTruthy();
  });

  it('navigates to AddCoParent when the add button is pressed with a companion selected', () => {
    render(<CoParentsScreen navigation={mockNavigation} route={{} as any} />);

    fireEvent.press(screen.getByTestId('header-add-btn'));

    expect(mockNavigate).toHaveBeenCalledWith('AddCoParent');
  });

  it('alerts instead of navigating when the add button is pressed without a companion', () => {
    mockState.companion.companions = [];
    mockState.companion.selectedCompanionId = undefined;
    mockState.coParent.defaultAccess = {role: 'PRIMARY'};

    render(<CoParentsScreen navigation={mockNavigation} route={{} as any} />);

    fireEvent.press(screen.getByTestId('header-add-btn'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Select companion',
      'Please select a companion before adding a co-parent.',
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navigates back when the header back button is pressed and canGoBack is true', () => {
    render(<CoParentsScreen navigation={mockNavigation} route={{} as any} />);
    fireEvent.press(screen.getByTestId('header-back-btn'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('does not navigate back when canGoBack is false', () => {
    mockCanGoBack.mockReturnValue(false);
    render(<CoParentsScreen navigation={mockNavigation} route={{} as any} />);
    fireEvent.press(screen.getByTestId('header-back-btn'));
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('dispatches setSelectedCompanion when no companion is selected yet', () => {
    mockState.companion.selectedCompanionId = undefined;

    render(<CoParentsScreen navigation={mockNavigation} route={{} as any} />);

    expect(mockSetSelectedCompanion).toHaveBeenCalledWith('comp-1');
  });

  it('does not dispatch setSelectedCompanion when a companion is already selected', () => {
    render(<CoParentsScreen navigation={mockNavigation} route={{} as any} />);
    expect(mockSetSelectedCompanion).not.toHaveBeenCalled();
  });

  it('fetches co-parents for the selected companion on focus', () => {
    render(<CoParentsScreen navigation={mockNavigation} route={{} as any} />);

    expect(mockFetchCoParents).toHaveBeenCalledWith({
      companionId: 'comp-1',
      companionName: 'Buddy',
      companionImage: 'https://img/buddy.jpg',
    });
  });

  it('does not fetch co-parents when no companion is selected', () => {
    mockState.companion.companions = [];
    mockState.companion.selectedCompanionId = undefined;

    render(<CoParentsScreen navigation={mockNavigation} route={{} as any} />);

    expect(mockFetchCoParents).not.toHaveBeenCalled();
  });

  it('sends undefined companionImage when fetching for a companion without a profileImage', () => {
    mockState.companion.companions = [{id: 'comp-2', name: 'Rex'}];
    mockState.companion.selectedCompanionId = 'comp-2';

    render(<CoParentsScreen navigation={mockNavigation} route={{} as any} />);

    expect(mockFetchCoParents).toHaveBeenCalledWith(
      expect.objectContaining({companionImage: undefined}),
    );
  });

  it('treats a co-parent with no role as non-primary', () => {
    mockState.coParent.coParents = [
      {id: 'cp-1', parentId: 'p-1', firstName: 'Jane', role: undefined},
    ];

    render(<CoParentsScreen navigation={mockNavigation} route={{} as any} />);

    expect(screen.getByTestId('view-cp-1')).toBeTruthy();
    expect(screen.getByTestId('hide-swipe-cp-1').props.children).toBe('false');
  });

  it('does not crash and defaults access when coParent state is entirely missing', () => {
    mockState.coParent = undefined;

    expect(() =>
      render(<CoParentsScreen navigation={mockNavigation} route={{} as any} />),
    ).not.toThrow();
    expect(screen.queryByTestId('header-add-btn')).toBeNull();
  });

  it('shows the add button in the header when the list is populated and the user can add', () => {
    mockState.coParent.coParents = [
      {id: 'cp-1', parentId: 'p-1', firstName: 'Jane', role: 'CO_PARENT'},
    ];

    render(<CoParentsScreen navigation={mockNavigation} route={{} as any} />);

    expect(screen.getByTestId('header-add-btn')).toBeTruthy();
  });

  it('hides the add button in the header when the list is populated and the user cannot add', () => {
    mockState.coParent.coParents = [
      {id: 'cp-1', parentId: 'p-1', firstName: 'Jane', role: 'CO_PARENT'},
    ];
    mockState.coParent.accessByCompanionId = {'comp-1': {role: 'CO_PARENT'}};

    render(<CoParentsScreen navigation={mockNavigation} route={{} as any} />);

    expect(screen.queryByTestId('header-add-btn')).toBeNull();
  });
});
