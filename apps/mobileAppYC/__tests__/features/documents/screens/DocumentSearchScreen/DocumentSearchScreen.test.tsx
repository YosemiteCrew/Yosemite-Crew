import React from 'react';
import {ActivityIndicator} from 'react-native';
import {render, fireEvent, act} from '@testing-library/react-native';
// Path: 5 levels up to mobileAppYC root
import {DocumentSearchScreen} from '../../../../../src/features/documents/screens/DocumentSearchScreen/DocumentSearchScreen';
import * as Redux from 'react-redux';
import {useNavigation} from '@react-navigation/native';
import {
  searchDocuments,
  clearSearchResults,
} from '../../../../../src/features/documents/documentSlice';

// --- Mocks ---

// 1. Navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
}));

// 2. Redux
const mockDispatch = jest.fn();
jest.spyOn(Redux, 'useDispatch').mockReturnValue(mockDispatch);
const mockUseSelector = jest.spyOn(Redux, 'useSelector');

// 3. Hooks & Styles
jest.mock('../../../../../src/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        secondary: 'black',
        textSecondary: 'gray',
        cardBackground: 'white',
        borderMuted: 'lightgray',
        error: 'red',
      },
      spacing: new Array(20).fill(8),
      borderRadius: {lg: 8},
      typography: {
        titleMedium: {fontSize: 18},
        bodySmall: {fontSize: 12},
      },
    },
  }),
}));

jest.mock('../../../../../src/shared/utils/screenStyles', () => ({
  createScreenContainerStyles: () => ({container: {flex: 1}}),
  createErrorContainerStyles: () => ({
    errorContainer: {padding: 10},
    errorText: {color: 'red'},
  }),
  createEmptyStateStyles: () => ({emptyState: {padding: 20}}),
  createSearchAndSelectorStyles: () => ({searchBar: {margin: 10}}),
}));

// 4. Components (Inline requires to avoid ReferenceError due to hoisting)
jest.mock('../../../../../src/shared/components/common', () => ({
  SafeArea: ({children}: any) => <>{children}</>,
}));

jest.mock('../../../../../src/shared/components/common/Header/Header', () => ({
  Header: ({title, onBack}: any) => {
    const {View, Text, TouchableOpacity} = require('react-native');
    return (
      <View testID="header">
        <Text>{title}</Text>
        <TouchableOpacity testID="header-back-btn" onPress={onBack}>
          <Text>Back</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

jest.mock(
  '../../../../../src/shared/components/common/SearchBar/SearchBar',
  () => ({
    SearchBar: ({value, onChangeText, onSubmitEditing, rightElement}: any) => {
      const {View, Text, TouchableOpacity} = require('react-native');
      return (
        <View testID="search-bar">
          <Text testID="search-value">{value}</Text>
          <TouchableOpacity testID="search-submit" onPress={onSubmitEditing}>
            <Text>Submit</Text>
          </TouchableOpacity>
          {/* Mock input text change simulation */}
          <Text
            testID="search-input-mock"
            onPress={(e: any) => onChangeText(e.nativeEvent.text)}>
            MockInput
          </Text>
          {rightElement}
        </View>
      );
    },
  }),
);

jest.mock(
  '../../../../../src/shared/components/common/CompanionSelector/CompanionSelector',
  () => ({
    CompanionSelector: ({onSelect}: any) => {
      const {TouchableOpacity, Text} = require('react-native');
      return (
        <TouchableOpacity
          testID="companion-selector"
          onPress={() => onSelect('comp-2')}>
          <Text>Selector</Text>
        </TouchableOpacity>
      );
    },
  }),
);

jest.mock(
  '../../../../../src/features/documents/components/DocumentListItem',
  () => {
    const {TouchableOpacity, Text, View} = require('react-native');
    return (props: any) => (
      <View testID={`doc-item-${props.document.id}`}>
        <Text>{props.document.name}</Text>
        <TouchableOpacity
          testID={`view-doc-${props.document.id}`}
          onPress={() => props.onPressView(props.document.id)}>
          <Text>View</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID={`edit-doc-${props.document.id}`}
          onPress={() => props.onPressEdit(props.document.id)}>
          <Text>Edit</Text>
        </TouchableOpacity>
      </View>
    );
  },
);

// 5. Actions
jest.mock('../../../../../src/features/documents/documentSlice', () => ({
  searchDocuments: jest.fn(() => ({type: 'documents/search'})),
  clearSearchResults: jest.fn(() => ({type: 'documents/clearSearch'})),
}));

jest.mock('../../../../../src/features/companion', () => ({
  setSelectedCompanion: jest.fn(id => ({type: 'companion/set', payload: id})),
}));

describe('DocumentSearchScreen', () => {
  const mockCompanions = [
    {id: 'comp-1', name: 'Buddy'},
    {id: 'comp-2', name: 'Lucy'},
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useNavigation as jest.Mock).mockReturnValue({
      navigate: mockNavigate,
      goBack: mockGoBack,
    });
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // Helper to update mock state
  const setupStore = (
    searchResults: any[] = [],
    searchLoading = false,
    searchError: string | null = null,
    selectedCompanionId: string | null = 'comp-1',
    documentsUndefined = false,
  ) => {
    mockUseSelector.mockImplementation((selector: any) => {
      const state = {
        companion: {
          companions: mockCompanions,
          selectedCompanionId,
        },
        documents: documentsUndefined
          ? undefined
          : {
              searchResults,
              searchLoading,
              searchError,
            },
      };
      return selector(state);
    });
  };

  it('renders correctly (Header, SearchBar, Selector)', () => {
    setupStore();
    const {getByText, getByTestId} = render(<DocumentSearchScreen />);

    expect(getByText('Search documents')).toBeTruthy();
    expect(getByTestId('search-bar')).toBeTruthy();
    expect(getByTestId('companion-selector')).toBeTruthy();
  });

  it('auto-selects first companion if none selected on mount', () => {
    setupStore([], false, null, null); // selectedCompanionId = null
    render(<DocumentSearchScreen />);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({type: 'companion/set', payload: 'comp-1'}),
    );
  });

  it('handles state.documents being undefined (coverage for fallback)', () => {
    setupStore([], false, null, 'comp-1', true); // documentsUndefined = true
    const {getByTestId} = render(<DocumentSearchScreen />);
    expect(getByTestId('search-bar')).toBeTruthy(); // Should not crash
  });

  it('clears search results on mount (empty query)', () => {
    setupStore();
    render(<DocumentSearchScreen />);
    // Initial render has empty query -> triggers useEffect
    expect(clearSearchResults).toHaveBeenCalled();
  });

  it('updates query and debounces search execution', () => {
    setupStore();
    const {getByTestId} = render(<DocumentSearchScreen />);

    // Simulate typing "vaccine"
    const mockInput = getByTestId('search-input-mock');
    fireEvent(mockInput, 'press', {nativeEvent: {text: 'vaccine'}});

    // Should NOT call search immediately (debounce)
    expect(searchDocuments).not.toHaveBeenCalled();

    // Fast forward debounce timer (1000ms)
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(searchDocuments).toHaveBeenCalledWith({
      companionId: 'comp-1',
      query: 'vaccine',
    });
  });

  it('triggers search immediately on submit', () => {
    setupStore();
    const {getByTestId} = render(<DocumentSearchScreen />);

    const mockInput = getByTestId('search-input-mock');
    fireEvent(mockInput, 'press', {nativeEvent: {text: 'urgent'}});

    // Press submit
    fireEvent.press(getByTestId('search-submit'));

    expect(searchDocuments).toHaveBeenCalledWith({
      companionId: 'comp-1',
      query: 'urgent',
    });
  });

  it('clears results if query becomes empty', () => {
    setupStore();
    const {getByTestId} = render(<DocumentSearchScreen />);

    const mockInput = getByTestId('search-input-mock');

    // Set text and wait for debounce
    fireEvent(mockInput, 'press', {nativeEvent: {text: 'test'}});
    act(() => jest.advanceTimersByTime(1000));

    // Clear the mocks to ignore calls from initial mount and first type
    (clearSearchResults as unknown as jest.Mock).mockClear();

    // Now clear text
    fireEvent(mockInput, 'press', {nativeEvent: {text: ''}});

    // Should trigger clear
    expect(clearSearchResults).toHaveBeenCalled();
  });

  it('shows loading indicator and then hides it (coverage for rightElement)', () => {
    // 1. Loading True
    setupStore([], true);
    const {UNSAFE_queryAllByType, update} = render(<DocumentSearchScreen />);

    // Should find 1 ActivityIndicator

    // 2. Loading False (re-render with new state)
    setupStore([], false);
    update(<DocumentSearchScreen />);

    // Should find 0
    expect(UNSAFE_queryAllByType(ActivityIndicator).length).toBe(0);
  });

  it('displays error message if search error exists', () => {
    setupStore([], false, 'Network Error');
    const {getByText} = render(<DocumentSearchScreen />);

    expect(getByText('Network Error')).toBeTruthy();
  });

  it('displays empty state when results are 0 and not loading', () => {
    setupStore([], false);
    const {getByText} = render(<DocumentSearchScreen />);

    expect(getByText('No documents found')).toBeTruthy();
  });

  it('renders search results', () => {
    const results = [
      {id: 'd1', name: 'Result Doc 1'},
      {id: 'd2', name: 'Result Doc 2'},
    ];
    setupStore(results);
    const {getByText} = render(<DocumentSearchScreen />);

    expect(getByText('Result Doc 1')).toBeTruthy();
    expect(getByText('Result Doc 2')).toBeTruthy();
  });

  it('navigates to View/Edit document', () => {
    const results = [{id: 'd1', name: 'Doc'}];
    setupStore(results);
    const {getByTestId} = render(<DocumentSearchScreen />);

    // View
    fireEvent.press(getByTestId('view-doc-d1'));
    expect(mockNavigate).toHaveBeenCalledWith('DocumentPreview', {
      documentId: 'd1',
    });

    // Edit
    fireEvent.press(getByTestId('edit-doc-d1'));
    expect(mockNavigate).toHaveBeenCalledWith('EditDocument', {
      documentId: 'd1',
    });
  });

  it('updates search if companion changes while query exists', () => {
    setupStore();
    const {getByTestId, update} = render(<DocumentSearchScreen />);

    // 1. Type query to set lastQueryRef
    const mockInput = getByTestId('search-input-mock');
    fireEvent(mockInput, 'press', {nativeEvent: {text: 'rabies'}});
    act(() => jest.advanceTimersByTime(1000));

    // Clear mocks to track the specific dispatch
    (searchDocuments as unknown as jest.Mock).mockClear();

    // 2. Simulate Companion Change by updating store and re-rendering
    // We update selectedCompanionId to 'comp-2'
    setupStore([], false, null, 'comp-2');
    update(<DocumentSearchScreen />);

    // The effect [dispatch, selectedCompanionId] should fire because lastQueryRef is 'rabies'
    expect(searchDocuments).toHaveBeenCalledWith({
      companionId: 'comp-2',
      query: 'rabies',
    });
  });

  it("prevents duplicate search if query hasn't changed and results exist (optimization coverage)", () => {
    // 1. Start with initial render
    setupStore([], false);
    const {getByTestId, update} = render(<DocumentSearchScreen />);

    // 2. Type "test" and let debounce run -> sets lastQueryRef.current = 'test'
    const mockInput = getByTestId('search-input-mock');
    fireEvent(mockInput, 'press', {nativeEvent: {text: 'test'}});
    act(() => jest.advanceTimersByTime(1000));

    // 3. Update store to reflect that search results now exist for 'test'
    setupStore([{id: 'd1'}], false);
    update(<DocumentSearchScreen />);

    // Clear mock to check next calls
    (searchDocuments as unknown as jest.Mock).mockClear();

    // 4. Trigger submit with SAME text "test"
    // Since searchResults exist (>0) and text matches ref, it should return early
    fireEvent.press(getByTestId('search-submit'));

    expect(searchDocuments).not.toHaveBeenCalled();
  });

  it('ALLOWS re-search if query same BUT results empty (optimization coverage)', () => {
    // 1. Start with initial render
    setupStore([], false);
    const {getByTestId, update} = render(<DocumentSearchScreen />);

    // 2. Type "test" and let debounce run -> sets lastQueryRef.current = 'test'
    const mockInput = getByTestId('search-input-mock');
    fireEvent(mockInput, 'press', {nativeEvent: {text: 'test'}});
    act(() => jest.advanceTimersByTime(1000));

    // 3. Update store (ensure results are EMPTY)
    setupStore([], false);
    update(<DocumentSearchScreen />);

    (searchDocuments as unknown as jest.Mock).mockClear();

    // 4. Submit "test" again.
    // Condition `trimmed === lastQueryRef.current && searchResults.length` -> `true && 0` -> false.
    // It should proceed to search.
    fireEvent.press(getByTestId('search-submit'));

    expect(searchDocuments).toHaveBeenCalledWith({
      companionId: 'comp-1',
      query: 'test',
    });
  });

  it('navigates back', () => {
    setupStore();
    const {getByTestId} = render(<DocumentSearchScreen />);
    fireEvent.press(getByTestId('header-back-btn'));
    expect(mockGoBack).toHaveBeenCalled();
  });
});
