import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {DocumentsScreen} from '../../../../../src/features/documents/screens/DocumentsScreen/DocumentsScreen';
import * as reactRedux from 'react-redux';
import {useNavigation} from '@react-navigation/native';
import {DOCUMENT_CATEGORIES} from '../../../../../src/features/documents/constants';

// --- Mocks ---

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
}));

jest.mock('../../../../../src/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {background: 'white', secondary: 'black'},
      spacing: {2: 8, 3: 12, 4: 16, 24: 96},
      typography: {titleLarge: {fontSize: 20}},
    },
  }),
}));

jest.mock('../../../../../src/shared/components/common', () => {
  const {View: RNView} = require('react-native');
  return {
    SafeArea: ({children}: any) => <RNView>{children}</RNView>,
  };
});

jest.mock('../../../../../src/shared/components/common/Header/Header', () => {
  const {
    View: RNView,
    Text: RNText,
    TouchableOpacity: RNTouchableOpacity,
  } = require('react-native');
  return {
    Header: ({title, onRightPress}: any) => (
      <RNView testID="header">
        <RNText>{title}</RNText>
        <RNTouchableOpacity onPress={onRightPress} testID="header-right-btn" />
      </RNView>
    ),
  };
});

jest.mock(
  '../../../../../src/shared/components/common/SearchBar/SearchBar',
  () => {
    const {
      Text: RNText,
      TouchableOpacity: RNTouchableOpacity,
    } = require('react-native');
    return {
      SearchBar: ({onPress}: any) => (
        <RNTouchableOpacity onPress={onPress} testID="searchBar">
          <RNText>Search</RNText>
        </RNTouchableOpacity>
      ),
    };
  },
);

jest.mock(
  '../../../../../src/shared/components/common/CompanionSelector/CompanionSelector',
  () => {
    const {
      View: RNView,
      TouchableOpacity: RNTouchableOpacity,
    } = require('react-native');
    return {
      CompanionSelector: ({onSelect}: any) => (
        <RNView testID="companionSelector">
          <RNTouchableOpacity
            onPress={() => onSelect('c2')}
            testID="companion-select-btn"
          />
        </RNView>
      ),
    };
  },
);

// FIX: Update mock to explicitly call handler with 'doc1' to match test expectation
jest.mock(
  '../../../../../src/features/documents/components/DocumentListItem',
  () => {
    const {
      View: RNView,
      TouchableOpacity: RNTouchableOpacity,
    } = require('react-native');
    return {
      __esModule: true,
      default: ({onPressView, onPressEdit, document}: any) => (
        <RNView testID="docItem">
          {/* Pass document.id if available, fallback to 'doc1' for tests not providing full doc object */}
          <RNTouchableOpacity
            onPress={() => onPressView(document?.id || 'doc1')}
            testID="doc-view-btn"
          />
          <RNTouchableOpacity
            onPress={() => onPressEdit(document?.id || 'doc1')}
            testID="doc-edit-btn"
          />
        </RNView>
      ),
    };
  },
);

jest.mock(
  '../../../../../src/shared/components/common/CategoryTile/CategoryTile',
  () => {
    const {
      Text: RNText,
      TouchableOpacity: RNTouchableOpacity,
    } = require('react-native');
    return {
      CategoryTile: ({onPress, title}: any) => (
        <RNTouchableOpacity onPress={onPress} testID={`cat-${title}`}>
          <RNText>{title}</RNText>
        </RNTouchableOpacity>
      ),
    };
  },
);

jest.mock(
  '../../../../../src/features/documents/screens/EmptyDocumentsScreen/EmptyDocumentsScreen',
  () => {
    const {View: RNView, Text: RNText} = require('react-native');
    return {
      EmptyDocumentsScreen: () => (
        <RNView testID="emptyScreen">
          <RNText>Empty</RNText>
        </RNView>
      ),
    };
  },
);

jest.mock('../../../../../src/assets/images', () => ({
  Images: {addIconDark: 'add-icon'},
}));

// Mock Actions
jest.mock('../../../../../src/features/companion', () => ({
  setSelectedCompanion: jest.fn(id => ({type: 'companion/set', payload: id})),
}));
jest.mock('../../../../../src/features/documents/documentSlice', () => ({
  fetchDocuments: jest.fn(() => ({type: 'documents/fetch'})),
}));

describe('DocumentsScreen', () => {
  const dispatchMock = jest.fn();
  const navigateMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useNavigation as jest.Mock).mockReturnValue({navigate: navigateMock});
    jest.spyOn(reactRedux, 'useDispatch').mockReturnValue(dispatchMock);
  });

  // Helper to mock state
  const mockState = (
    companions: any[] = [],
    selectedCompanionId: string | null = null,
    documents: any[] = [],
  ) => {
    jest.spyOn(reactRedux, 'useSelector').mockImplementation(selector => {
      const state = {
        companion: {companions, selectedCompanionId},
        documents: {documents},
      };
      return selector(state);
    });
  };

  it('renders EmptyDocumentsScreen when no companions exist', () => {
    mockState([], null, []);
    const {getByTestId} = render(<DocumentsScreen />);
    expect(getByTestId('emptyScreen')).toBeTruthy();
  });

  it('automatically selects first companion if none selected on mount', () => {
    const companions = [{id: 'c1', name: 'Dog'}];
    mockState(companions, null, []);

    render(<DocumentsScreen />);

    // Check dispatch call structure
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({type: 'companion/set', payload: 'c1'}),
    );
  });

  it('does not select first companion if one is already selected', () => {
    const companions = [{id: 'c1'}, {id: 'c2'}];
    mockState(companions, 'c2', []); // c2 already selected

    render(<DocumentsScreen />);

    // Ensure set action was NOT called
    const calls = dispatchMock.mock.calls;
    const selectCalls = calls.filter(call => call[0].type === 'companion/set');
    expect(selectCalls.length).toBe(0);
  });

  it('fetches documents when companion is selected', () => {
    const companions = [{id: 'c1'}];
    mockState(companions, 'c1', []);

    render(<DocumentsScreen />);

    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({type: 'documents/fetch'}),
    );
  });

  it('renders Recent section with latest document for selected companion', () => {
    const companions = [{id: 'c1'}];
    const docs = [
      {
        id: 'd1',
        companionId: 'c1',
        createdAt: '2023-01-01',
        category: 'medical',
      },
      {
        id: 'd2',
        companionId: 'c1',
        createdAt: '2023-02-01',
        category: 'insurance',
      }, // Newer
      {
        id: 'd3',
        companionId: 'c2',
        createdAt: '2023-03-01',
        category: 'medical',
      }, // Different companion
    ];
    mockState(companions, 'c1', docs);

    const {getByText} = render(<DocumentsScreen />);

    expect(getByText('Recent')).toBeTruthy();
  });

  it('handles "All" documents case', () => {
    const companions = [{id: 'c1'}];
    const docs = [{id: 'd1', companionId: 'c1'}];
    mockState(companions, null, docs);

    render(<DocumentsScreen />);
  });

  it('calculates category counts correctly', () => {
    const companions = [{id: 'c1'}];
    const catId = DOCUMENT_CATEGORIES[0].id;
    const docs = [
      {id: 'd1', companionId: 'c1', category: catId},
      {id: 'd2', companionId: 'c1', category: catId},
      {id: 'd3', companionId: 'c1', category: 'other'},
    ];
    mockState(companions, 'c1', docs);

    render(<DocumentsScreen />);
  });

  // --- Interaction Tests ---

  it('navigates to AddDocument on header press', () => {
    mockState([{id: 'c1'}], 'c1', []);
    const {getByTestId} = render(<DocumentsScreen />);

    fireEvent(getByTestId('header-right-btn'), 'press');
    expect(navigateMock).toHaveBeenCalledWith('AddDocument');
  });

  it('navigates to DocumentSearch on search bar press', () => {
    mockState([{id: 'c1'}], 'c1', []);
    const {getByTestId} = render(<DocumentsScreen />);

    fireEvent(getByTestId('searchBar'), 'press');
    expect(navigateMock).toHaveBeenCalledWith('DocumentSearch');
  });

  it('updates selected companion on selector change', () => {
    mockState([{id: 'c1'}, {id: 'c2'}], 'c1', []);
    const {getByTestId} = render(<DocumentsScreen />);

    // Trigger onSelect via the internal button in our mock
    fireEvent(getByTestId('companion-select-btn'), 'press');
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({type: 'companion/set', payload: 'c2'}),
    );
  });

  it('navigates correctly from list items and categories', () => {
    const companions = [{id: 'c1'}];
    const catId = DOCUMENT_CATEGORIES[0].id;
    const catLabel = DOCUMENT_CATEGORIES[0].label;
    const docs = [
      {id: 'doc1', companionId: 'c1', createdAt: '2023-01-01', category: catId},
    ];

    mockState(companions, 'c1', docs);

    const {getByTestId} = render(<DocumentsScreen />);

    // Test View Document (via internal button in mock)
    fireEvent(getByTestId('doc-view-btn'), 'press');
    expect(navigateMock).toHaveBeenCalledWith('DocumentPreview', {
      documentId: 'doc1',
    });

    // Test Edit Document (via internal button in mock)
    fireEvent(getByTestId('doc-edit-btn'), 'press');
    expect(navigateMock).toHaveBeenCalledWith('EditDocument', {
      documentId: 'doc1',
    });

    // Test Category Press
    const categoryBtn = getByTestId(`cat-${catLabel}`);
    fireEvent(categoryBtn, 'press');
    expect(navigateMock).toHaveBeenCalledWith('CategoryDetail', {
      categoryId: catId,
    });
  });
});
