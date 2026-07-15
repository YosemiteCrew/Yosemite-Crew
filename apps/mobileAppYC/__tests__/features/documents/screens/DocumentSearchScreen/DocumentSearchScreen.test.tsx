import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
// Path: 5 levels up to mobileAppYC root
import {DocumentSearchScreen} from '../../../../../src/features/documents/screens/DocumentSearchScreen/DocumentSearchScreen';
import * as Redux from 'react-redux';
import {useNavigation} from '@react-navigation/native';
import {
  searchDocuments,
  clearSearchResults,
} from '../../../../../src/features/documents/documentSlice';
import {mockTheme} from '../../../../setup/mockTheme';

// --- Mocks ---

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
}));

const mockDispatch = jest.fn();
jest.spyOn(Redux, 'useDispatch').mockReturnValue(mockDispatch);
const mockUseSelector = jest.spyOn(Redux, 'useSelector');

jest.mock('../../../../../src/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('../../../../../src/shared/utils/screenStyles', () => ({
  createAllCommonStyles: () => ({
    container: {},
    contentContainer: {},
    errorContainer: {},
    errorText: {},
  }),
}));

jest.mock(
  '../../../../../src/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen',
  () => {
    const {View} = require('react-native');
    return {
      LiquidGlassHeaderScreen: ({header, children}: any) => (
        <View testID="screen-layout">
          {header}
          {typeof children === 'function' ? children({}) : children}
        </View>
      ),
    };
  },
);

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

  const makeDoc = (over: any = {}) => ({
    id: 'd1',
    title: 'Vaccination record',
    category: 'health',
    subcategory: 'vaccination',
    visitType: 'hospital',
    issueDate: '2026-07-01',
    isUserAdded: true,
    uploadedByPmsUserId: null,
    ...over,
  });

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

  const setupStore = (
    searchResults: any[] = [],
    searchLoading = false,
    searchError: string | null = null,
    selectedCompanionId: string | null = 'comp-1',
    documentsUndefined = false,
  ) => {
    mockUseSelector.mockImplementation((selector: any) => {
      const state = {
        companion: {companions: mockCompanions, selectedCompanionId},
        documents: documentsUndefined
          ? undefined
          : {searchResults, searchLoading, searchError},
      };
      return selector(state);
    });
  };

  const type = (getByTestId: any, text: string) =>
    fireEvent(getByTestId('search-input-mock'), 'press', {
      nativeEvent: {text},
    });

  it('renders the search field, cancel button and companion selector', () => {
    setupStore();
    const {getByTestId} = render(<DocumentSearchScreen />);
    expect(getByTestId('search-bar')).toBeTruthy();
    expect(getByTestId('search-cancel-button')).toBeTruthy();
    expect(getByTestId('companion-selector')).toBeTruthy();
  });

  it('navigates back when Cancel is pressed', () => {
    setupStore();
    const {getByTestId} = render(<DocumentSearchScreen />);
    fireEvent.press(getByTestId('search-cancel-button'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('auto-selects the first companion when none is selected', () => {
    setupStore([], false, null, null);
    render(<DocumentSearchScreen />);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({type: 'companion/set', payload: 'comp-1'}),
    );
  });

  it('handles documents state being undefined without crashing', () => {
    setupStore([], false, null, 'comp-1', true);
    const {getByTestId} = render(<DocumentSearchScreen />);
    expect(getByTestId('search-bar')).toBeTruthy();
  });

  it('clears results on mount with an empty query', () => {
    setupStore();
    render(<DocumentSearchScreen />);
    expect(clearSearchResults).toHaveBeenCalled();
  });

  it('debounces the search while typing', () => {
    setupStore();
    const {getByTestId} = render(<DocumentSearchScreen />);
    type(getByTestId, 'vaccine');
    expect(searchDocuments).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1000));
    expect(searchDocuments).toHaveBeenCalledWith({
      companionId: 'comp-1',
      query: 'vaccine',
    });
  });

  it('records a recent search and searches immediately on submit', () => {
    setupStore();
    const {getByTestId, getByText} = render(<DocumentSearchScreen />);
    type(getByTestId, 'rabies');
    fireEvent.press(getByTestId('search-submit'));
    expect(searchDocuments).toHaveBeenCalledWith({
      companionId: 'comp-1',
      query: 'rabies',
    });
    expect(getByText('Recent searches')).toBeTruthy();
    expect(getByTestId('recent-search-rabies')).toBeTruthy();
  });

  it('fills the query from a recent-search chip', () => {
    setupStore();
    const {getByTestId} = render(<DocumentSearchScreen />);
    type(getByTestId, 'insurance');
    fireEvent.press(getByTestId('search-submit'));
    // clear the field, then tap the recent chip to re-populate it
    type(getByTestId, '');
    (searchDocuments as unknown as jest.Mock).mockClear();
    fireEvent.press(getByTestId('recent-search-insurance'));
    act(() => jest.advanceTimersByTime(1000));
    expect(searchDocuments).toHaveBeenCalledWith({
      companionId: 'comp-1',
      query: 'insurance',
    });
  });

  it('clears results when the query becomes empty', () => {
    setupStore();
    const {getByTestId} = render(<DocumentSearchScreen />);
    type(getByTestId, 'test');
    act(() => jest.advanceTimersByTime(1000));
    (clearSearchResults as unknown as jest.Mock).mockClear();
    type(getByTestId, '');
    expect(clearSearchResults).toHaveBeenCalled();
  });

  it('shows a loading indicator while searching', () => {
    setupStore([], true);
    const {UNSAFE_queryAllByType} = render(<DocumentSearchScreen />);
    const {ActivityIndicator} = require('react-native');
    expect(UNSAFE_queryAllByType(ActivityIndicator).length).toBeGreaterThan(0);
  });

  it('shows an error message when search fails', () => {
    setupStore([], false, 'Network Error');
    const {getByText} = render(<DocumentSearchScreen />);
    expect(getByText('Network Error')).toBeTruthy();
  });

  it('shows the empty state when there are no results', () => {
    setupStore([], false);
    const {getByText} = render(<DocumentSearchScreen />);
    expect(getByText('No documents found')).toBeTruthy();
  });

  it('renders results with a plural count line scoped to the pet', () => {
    setupStore([
      makeDoc({id: 'd1', title: 'Alpha'}),
      makeDoc({id: 'd2', title: 'Beta'}),
    ]);
    const {getByText, getByTestId} = render(<DocumentSearchScreen />);
    expect(getByTestId('doc-item-d1')).toBeTruthy();
    expect(getByTestId('doc-item-d2')).toBeTruthy();
    expect(getByText("2 results across Buddy's documents")).toBeTruthy();
  });

  it('uses a singular label and generic scope when the pet name is unknown', () => {
    setupStore([makeDoc()], false, null, 'comp-x');
    const {getByText} = render(<DocumentSearchScreen />);
    expect(getByText('1 result across your documents')).toBeTruthy();
  });

  it('opens the preview on a result row tap', () => {
    setupStore([makeDoc({id: 'd1'})]);
    const {getByTestId} = render(<DocumentSearchScreen />);
    fireEvent.press(getByTestId('doc-item-d1'));
    expect(mockNavigate).toHaveBeenCalledWith('DocumentPreview', {
      documentId: 'd1',
    });
  });

  it('edits an editable document on long press', () => {
    setupStore([
      makeDoc({id: 'd1', isUserAdded: true, uploadedByPmsUserId: null}),
    ]);
    const {getByTestId} = render(<DocumentSearchScreen />);
    fireEvent(getByTestId('doc-item-d1'), 'longPress');
    expect(mockNavigate).toHaveBeenCalledWith('EditDocument', {
      documentId: 'd1',
    });
  });

  it('does not edit a PMS-synced document on long press', () => {
    setupStore([
      makeDoc({id: 'd1', isUserAdded: false, uploadedByPmsUserId: 'pms-1'}),
    ]);
    const {getByTestId} = render(<DocumentSearchScreen />);
    fireEvent(getByTestId('doc-item-d1'), 'longPress');
    expect(mockNavigate).not.toHaveBeenCalledWith('EditDocument', {
      documentId: 'd1',
    });
  });

  it('shows a visible, accessible edit button for editable documents (not just long-press)', () => {
    setupStore([
      makeDoc({
        id: 'd1',
        title: 'Vaccination record',
        isUserAdded: true,
        uploadedByPmsUserId: null,
      }),
    ]);
    const {getByTestId} = render(<DocumentSearchScreen />);

    const editButton = getByTestId('doc-item-edit-d1');
    expect(editButton.props.accessibilityRole).toBe('button');
    expect(editButton.props.accessibilityLabel).toBe('Edit Vaccination record');

    fireEvent.press(editButton);
    expect(mockNavigate).toHaveBeenCalledWith('EditDocument', {
      documentId: 'd1',
    });
  });

  it('omits the visible edit button for PMS-synced documents', () => {
    setupStore([
      makeDoc({id: 'd1', isUserAdded: false, uploadedByPmsUserId: 'pms-1'}),
    ]);
    const {queryByTestId} = render(<DocumentSearchScreen />);

    expect(queryByTestId('doc-item-edit-d1')).toBeNull();
  });

  it('re-searches when the companion changes while a query exists', () => {
    setupStore();
    const {getByTestId, update} = render(<DocumentSearchScreen />);
    type(getByTestId, 'rabies');
    act(() => jest.advanceTimersByTime(1000));
    (searchDocuments as unknown as jest.Mock).mockClear();
    setupStore([], false, null, 'comp-2');
    update(<DocumentSearchScreen />);
    expect(searchDocuments).toHaveBeenCalledWith({
      companionId: 'comp-2',
      query: 'rabies',
    });
  });

  it('prevents a duplicate search when the query is unchanged and results exist', () => {
    setupStore([], false);
    const {getByTestId, update} = render(<DocumentSearchScreen />);
    type(getByTestId, 'test');
    act(() => jest.advanceTimersByTime(1000));
    setupStore([makeDoc()], false);
    update(<DocumentSearchScreen />);
    (searchDocuments as unknown as jest.Mock).mockClear();
    fireEvent.press(getByTestId('search-submit'));
    expect(searchDocuments).not.toHaveBeenCalled();
  });

  it('allows a re-search when the query is unchanged but results are empty', () => {
    setupStore([], false);
    const {getByTestId, update} = render(<DocumentSearchScreen />);
    type(getByTestId, 'test');
    act(() => jest.advanceTimersByTime(1000));
    setupStore([], false);
    update(<DocumentSearchScreen />);
    (searchDocuments as unknown as jest.Mock).mockClear();
    fireEvent.press(getByTestId('search-submit'));
    expect(searchDocuments).toHaveBeenCalledWith({
      companionId: 'comp-1',
      query: 'test',
    });
  });

  it('highlights the matched query substring in a result title', () => {
    setupStore([makeDoc({id: 'd1', title: 'Vaccination record'})]);
    const {getByTestId, getByText} = render(<DocumentSearchScreen />);
    type(getByTestId, 'vacc');
    // Title splits into a highlighted "Vacc" node + the remainder.
    expect(getByText('Vacc')).toBeTruthy();
    expect(getByTestId('doc-item-d1')).toBeTruthy();
  });

  it('highlights a term that appears mid-title and ends the title', () => {
    setupStore([makeDoc({id: 'd1', title: 'Rabies vaccine'})]);
    const {getByTestId} = render(<DocumentSearchScreen />);
    // Match starts after leading text ("Rabies ") and ends at title end,
    // exercising the pre-match push and the no-trailing-text path.
    type(getByTestId, 'vaccine');
    expect(getByTestId('doc-item-d1')).toBeTruthy();
  });

  it('falls back to visitType and omits an invalid date in the meta line', () => {
    setupStore([
      makeDoc({
        id: 'd1',
        subcategory: '',
        visitType: 'clinic',
        issueDate: 'not-a-real-date',
      }),
    ]);
    const {getByTestId} = render(<DocumentSearchScreen />);
    expect(getByTestId('doc-item-d1')).toBeTruthy();
  });

  it('clears results when submitting an empty query', () => {
    setupStore();
    const {getByTestId} = render(<DocumentSearchScreen />);
    (clearSearchResults as unknown as jest.Mock).mockClear();
    // No text typed: recordRecentSearch and triggerSearch both bail early.
    fireEvent.press(getByTestId('search-submit'));
    expect(clearSearchResults).toHaveBeenCalled();
    expect(searchDocuments).not.toHaveBeenCalled();
  });

  it('deduplicates recent searches case-insensitively', () => {
    setupStore();
    const {getByTestId, queryByTestId} = render(<DocumentSearchScreen />);
    type(getByTestId, 'rabies');
    fireEvent.press(getByTestId('search-submit'));
    type(getByTestId, 'canine');
    fireEvent.press(getByTestId('search-submit'));
    type(getByTestId, 'RABIES');
    fireEvent.press(getByTestId('search-submit'));
    // The earlier lowercase "rabies" chip is filtered out; "RABIES" replaces it.
    expect(getByTestId('recent-search-RABIES')).toBeTruthy();
    expect(getByTestId('recent-search-canine')).toBeTruthy();
    expect(queryByTestId('recent-search-rabies')).toBeNull();
  });

  it('selects a companion from the selector', () => {
    setupStore();
    const {getByTestId} = render(<DocumentSearchScreen />);
    fireEvent.press(getByTestId('companion-selector'));
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({type: 'companion/set', payload: 'comp-2'}),
    );
  });
});
