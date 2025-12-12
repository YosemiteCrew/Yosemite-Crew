import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
// FIX 1: Corrected path depth (5 levels up instead of 6) to reach 'src' from the nested test folder
import {CategoryDetailScreen} from '../../../../../src/features/documents/screens/CategoryDetailScreen/CategoryDetailScreen';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
// FIX 3: Removed unused 'setSelectedCompanion' import
import {fetchDocuments} from '../../../../../src/features/documents/documentSlice';

// --- Mocks ---

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockCategoryId = 'medical-records';

// Mock Navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
  useRoute: () => ({
    params: {categoryId: mockCategoryId},
  }),
}));

// Mock Styles Helper
jest.mock('@/shared/utils/screenStyles', () => ({
  createScreenContainerStyles: () => ({container: {}, contentContainer: {}}),
  createErrorContainerStyles: () => ({errorContainer: {}, errorText: {}}),
  createEmptyStateStyles: () => ({emptyContainer: {}, emptyText: {}}),
  createSearchAndSelectorStyles: () => ({searchBar: {}, companionSelector: {}}),
}));

// Mock Hooks
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {primary: 'blue', text: 'black'},
      spacing: {4: 16},
    },
  }),
}));

// Mock Helpers
jest.mock('@/shared/utils/helpers', () => ({
  formatLabel: (id: string) => id,
}));

// Mock Constants
jest.mock('@/features/documents/constants', () => ({
  DOCUMENT_CATEGORIES: [
    {
      id: 'medical-records',
      label: 'Medical Records',
      icon: 'medical-icon',
      subcategories: [
        {id: 'vaccination', label: 'Vaccinations'},
        {id: 'prescription', label: 'Prescriptions'},
      ],
    },
  ],
  SUBCATEGORY_ICONS: {
    vaccination: 'vaccine-icon',
  },
}));

// Mock Child Components (Returning Views to satisfy TypeScript JSX checks)
jest.mock('@/shared/components/common/Header/Header', () => ({
  Header: ({title, onBack}: any) => {
    const {TouchableOpacity, Text, View} = require('react-native');
    return (
      <View testID="mock-header">
        <Text>{title}</Text>
        <TouchableOpacity onPress={onBack} testID="header-back-btn" />
      </View>
    );
  },
}));

jest.mock('@/shared/components/common/SearchBar/SearchBar', () => ({
  SearchBar: ({onPress}: any) => {
    const {TouchableOpacity, Text} = require('react-native');
    return (
      <TouchableOpacity onPress={onPress} testID="mock-searchbar">
        <Text>Search</Text>
      </TouchableOpacity>
    );
  },
}));

jest.mock(
  '@/shared/components/common/CompanionSelector/CompanionSelector',
  () => ({
    CompanionSelector: ({onSelect}: any) => {
      const {TouchableOpacity, Text} = require('react-native');
      return (
        <TouchableOpacity
          onPress={() => onSelect('comp-2')}
          testID="mock-companion-selector">
          <Text>Select Companion</Text>
        </TouchableOpacity>
      );
    },
  }),
);

jest.mock(
  '@/shared/components/common/SubcategoryAccordion/SubcategoryAccordion',
  () => ({
    SubcategoryAccordion: ({title, children}: any) => {
      const {View, Text} = require('react-native');
      return (
        <View testID={`accordion-${title}`}>
          <Text>{title}</Text>
          {children}
        </View>
      );
    },
  }),
);

jest.mock('@/features/documents/components/DocumentListItem', () => {
  const {TouchableOpacity, Text} = require('react-native');
  return ({document, onPressView, onPressEdit}: any) => (
    <TouchableOpacity
      testID={`doc-item-${document.id}`}
      onPress={() => onPressView(document.id)}
      onLongPress={() => onPressEdit(document.id)}>
      <Text>{document.name}</Text>
    </TouchableOpacity>
  );
});

// Mock Thunks
jest.mock('@/features/documents/documentSlice', () => ({
  fetchDocuments: jest.fn(() => ({type: 'documents/fetch'})),
}));

// --- Test Setup ---

const createTestStore = (preloadedState: any) => {
  return configureStore({
    // FIX 2: Cast the reducer map to 'any' to bypass strict Redux RootState type mismatch issues in tests
    reducer: {
      companion: (state = preloadedState.companion || {}, action: any) => {
        if (action.type === 'companion/setSelectedCompanion') {
          return {...state, selectedCompanionId: action.payload};
        }
        return state;
      },
      documents: (state = preloadedState.documents || {}) => state,
    } as any,
    preloadedState,
  });
};

describe('CategoryDetailScreen', () => {
  const mockDocuments = [
    {
      id: 'doc1',
      name: 'Vaccine A',
      category: 'medical-records',
      subcategory: 'vaccination',
      companionId: 'comp-1',
    },
    {
      id: 'doc2',
      name: 'Script B',
      category: 'medical-records',
      subcategory: 'prescription',
      companionId: 'comp-1',
    },
    {
      id: 'doc3',
      name: 'Random File',
      category: 'medical-records',
      subcategory: null,
      companionId: 'comp-1',
    },
    {
      id: 'doc4',
      name: 'Other Pet Doc',
      category: 'medical-records',
      subcategory: 'vaccination',
      companionId: 'comp-2',
    },
  ];

  const initialState = {
    companion: {
      companions: [
        {id: 'comp-1', name: 'Buddy'},
        {id: 'comp-2', name: 'Max'},
      ],
      selectedCompanionId: 'comp-1',
    },
    documents: {
      documents: mockDocuments,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const navigation = require('@react-navigation/native');
    jest.spyOn(navigation, 'useRoute').mockReturnValue({
      params: {categoryId: mockCategoryId},
    });
  });

  const renderWithRedux = (state = initialState) => {
    const store = createTestStore(state);
    return {
      ...render(
        <Provider store={store}>
          <CategoryDetailScreen />
        </Provider>,
      ),
      store,
    };
  };

  // --- 1. Rendering ---

  describe('Rendering', () => {
    it('renders the header with correct category label', () => {
      const {getByText} = renderWithRedux();
      expect(getByText('Medical Records')).toBeTruthy();
    });

    it('renders subcategory accordions', () => {
      const {getByTestId} = renderWithRedux();
      expect(getByTestId('accordion-Vaccinations')).toBeTruthy();
      expect(getByTestId('accordion-Prescriptions')).toBeTruthy();
    });

    it('renders documents within the correct subcategory for selected companion', () => {
      const {getByText, queryByText} = renderWithRedux();
      expect(getByText('Vaccine A')).toBeTruthy();
      expect(getByText('Script B')).toBeTruthy();
      expect(queryByText('Other Pet Doc')).toBeNull();
    });

    it('renders dynamically created subcategories (Other) for null subcategory docs', () => {
      const {getByText} = renderWithRedux();
      expect(getByText('Random File')).toBeTruthy();
    });

    it('renders error view if category ID is invalid', () => {
      jest
        .spyOn(require('@react-navigation/native'), 'useRoute')
        .mockReturnValue({
          params: {categoryId: 'invalid-id'},
        });

      const {getByText} = renderWithRedux();
      expect(getByText('Category not found')).toBeTruthy();
    });
  });

  describe('Redux State & Logic', () => {
    it('auto-selects first companion if none is selected', () => {
      const stateNoSelection: any = {
        ...initialState,
        companion: {
          companions: [{id: 'comp-1', name: 'Buddy'}],
          selectedCompanionId: null,
        },
      };

      const {store} = renderWithRedux(stateNoSelection);
      expect(store.getState().companion.selectedCompanionId).toBe('comp-1');
    });

    it('fetches documents when selectedCompanionId changes', () => {
      renderWithRedux();
      expect(fetchDocuments).toHaveBeenCalledWith({companionId: 'comp-1'});
    });

    it('updates selected companion when user selects a new one', () => {
      const {getByTestId, store} = renderWithRedux();
      fireEvent.press(getByTestId('mock-companion-selector'));
      expect(store.getState().companion.selectedCompanionId).toBe('comp-2');
    });
  });

  // --- 3. Interaction ---

  describe('Interaction', () => {
    it('navigates to DocumentSearch when search bar is pressed', () => {
      const {getByTestId} = renderWithRedux();
      fireEvent.press(getByTestId('mock-searchbar'));
      expect(mockNavigate).toHaveBeenCalledWith('DocumentSearch');
    });

    it('navigates to DocumentPreview when a document is pressed', () => {
      const {getByTestId} = renderWithRedux();
      fireEvent.press(getByTestId('doc-item-doc1'));
      expect(mockNavigate).toHaveBeenCalledWith('DocumentPreview', {
        documentId: 'doc1',
      });
    });

    it('navigates to EditDocument when a document is long pressed', () => {
      const {getByTestId} = renderWithRedux();
      fireEvent(getByTestId('doc-item-doc1'), 'longPress');
      expect(mockNavigate).toHaveBeenCalledWith('EditDocument', {
        documentId: 'doc1',
      });
    });
  });

  // --- 4. Navigation (Header) ---

  describe('Navigation', () => {
    it('navigates back when header back button is pressed', () => {
      const {getByTestId} = renderWithRedux();
      fireEvent.press(getByTestId('header-back-btn'));
      expect(mockGoBack).toHaveBeenCalled();
    });
  });
});
