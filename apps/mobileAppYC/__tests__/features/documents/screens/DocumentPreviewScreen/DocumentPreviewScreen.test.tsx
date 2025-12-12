import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
// FIX: Corrected path depth (5 levels up instead of 6)
import {DocumentPreviewScreen} from '../../../../../src/features/documents/screens/DocumentPreviewScreen/DocumentPreviewScreen';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import {fetchDocumentView} from '../../../../../src/features/documents/documentSlice';

// --- Mocks ---

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockDocumentId = 'doc-123';

// 1. Navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
  useRoute: () => ({
    params: {documentId: mockDocumentId},
  }),
}));

// 2. Styles
jest.mock('@/shared/utils/screenStyles', () => ({
  createScreenContainerStyles: () => ({container: {}, contentContainer: {}}),
  createErrorContainerStyles: () => ({errorContainer: {}, errorText: {}}),
}));

// 3. Theme
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {cardBackground: 'white', textSecondary: 'grey'},
      spacing: {2: 8, 4: 16},
      borderRadius: {lg: 8},
      typography: {titleLarge: {}, bodyMedium: {}},
    },
  }),
}));

// 4. Assets
jest.mock('@/assets/images', () => ({
  Images: {
    blackEdit: {uri: 'edit-icon'},
  },
}));

// 5. Child Components
jest.mock('@/shared/components/common/Header/Header', () => ({
  Header: ({title, onBack, onRightPress}: any) => {
    const {
      TouchableOpacity: RNTouchableOpacity,
      Text: RNText,
      View: RNView,
    } = require('react-native');
    return (
      <RNView testID="mock-header">
        <RNText>{title}</RNText>
        <RNTouchableOpacity onPress={onBack} testID="header-back-btn" />
        {onRightPress && (
          <RNTouchableOpacity onPress={onRightPress} testID="header-right-btn">
            <RNText>Edit</RNText>
          </RNTouchableOpacity>
        )}
      </RNView>
    );
  },
}));

jest.mock('@/features/documents/components/DocumentAttachmentViewer', () => {
  const {View: RNView, Text: RNText} = require('react-native');
  const DocumentAttachmentViewer = () => (
    <RNView testID="mock-attachment-viewer">
      <RNText>Attachment Viewer</RNText>
    </RNView>
  );
  return {
    __esModule: true,
    default: DocumentAttachmentViewer,
  };
});

// 6. Thunks
jest.mock('@/features/documents/documentSlice', () => ({
  fetchDocumentView: jest.fn(() => ({type: 'documents/fetchView'})),
}));

// --- Test Store Helper ---
const createTestStore = (preloadedState: any) => {
  return configureStore({
    reducer: {
      // FIX: Argument order corrected to (state, action)
      companion: (state = {}, _action: any) => state,
      documents: (state = {}, _action: any) => state,
    } as any,
    preloadedState,
  });
};

describe('DocumentPreviewScreen', () => {
  const mockDoc = {
    id: mockDocumentId,
    title: 'Vaccination Report',
    businessName: 'Happy Vet Clinic',
    issueDate: '2023-01-15T00:00:00.000Z',
    companionId: 'comp-1',
    isUserAdded: true,
    uploadedByPmsUserId: null, // Editable
    files: [{id: 'f1', viewUrl: 'https://example.com/view.pdf'}],
  };

  const mockCompanion = {
    id: 'comp-1',
    name: 'Buddy',
  };

  const initialState = {
    companion: {
      companions: [mockCompanion],
    },
    documents: {
      documents: [mockDoc],
      viewLoading: {},
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderWithRedux = (state = initialState) => {
    const store = createTestStore(state);
    return {
      ...render(
        <Provider store={store}>
          <DocumentPreviewScreen />
        </Provider>,
      ),
      store,
    };
  };

  // --- 1. Rendering ---

  describe('Rendering', () => {
    it('renders the header with document title', () => {
      const {getByText, getByTestId} = renderWithRedux();
      expect(getByText('Vaccination Report')).toBeTruthy();
      expect(getByTestId('mock-header')).toBeTruthy();
    });

    it('renders info card with correct details', () => {
      const {getByText} = renderWithRedux();
      // Title logic: {title} for {companionName}
      expect(getByText('Vaccination Report for Buddy')).toBeTruthy();
      expect(getByText('Happy Vet Clinic')).toBeTruthy();
      // Date formatting: Jan 15, 2023
      expect(getByText('Jan 15, 2023')).toBeTruthy();
    });

    it('renders "Unknown" companion if companion is missing', () => {
      const stateNoCompanion = {
        ...initialState,
        companion: {companions: []},
      };
      const {getByText} = renderWithRedux(stateNoCompanion);
      expect(getByText('Vaccination Report for Unknown')).toBeTruthy();
    });

    it('renders dashes if businessName or date are missing', () => {
      const docMissingInfo: any = {
        ...mockDoc,
        businessName: null,
        issueDate: null,
      };

      const state = {
        ...initialState,
        documents: {documents: [docMissingInfo], viewLoading: {}},
      };

      const {getAllByText} = renderWithRedux(state);
      // Expect at least two dashes (one for business, one for date)
      expect(getAllByText('—').length).toBeGreaterThanOrEqual(2);
    });

    it('renders dashes if date is invalid', () => {
      const docInvalidDate = {...mockDoc, issueDate: 'invalid-date-string'};
      const state = {
        ...initialState,
        documents: {documents: [docInvalidDate], viewLoading: {}},
      };
      const {getByText} = renderWithRedux(state);
      expect(getByText('—')).toBeTruthy();
    });

    it('renders error view if document is not found', () => {
      const emptyState = {
        companion: {companions: []},
        documents: {documents: [], viewLoading: {}},
      };

      const {getByText} = renderWithRedux(emptyState);
      expect(getByText('Document not found')).toBeTruthy();
    });

    it('renders the attachment viewer', () => {
      const {getByTestId} = renderWithRedux();
      expect(getByTestId('mock-attachment-viewer')).toBeTruthy();
    });
  });

  // --- 2. Redux State & Logic (Edit Permission) ---

  describe('Redux State & Permissions', () => {
    it('shows Edit button if document is user added and NOT from PMS', () => {
      // MockDoc is already isUserAdded: true, uploadedByPmsUserId: null
      const {getByTestId} = renderWithRedux();
      expect(getByTestId('header-right-btn')).toBeTruthy();
    });

    it('hides Edit button if document is NOT user added', () => {
      const doc = {...mockDoc, isUserAdded: false};
      const state = {
        ...initialState,
        documents: {documents: [doc], viewLoading: {}},
      };

      const {queryByTestId} = renderWithRedux(state);
      expect(queryByTestId('header-right-btn')).toBeNull();
    });

    it('hides Edit button if document IS uploaded by PMS user', () => {
      const doc = {
        ...mockDoc,
        isUserAdded: true,
        uploadedByPmsUserId: 'user-pms',
      } as any;

      const state = {
        ...initialState,
        documents: {documents: [doc], viewLoading: {}},
      };

      const {queryByTestId} = renderWithRedux(state);
      expect(queryByTestId('header-right-btn')).toBeNull();
    });
  });

  // --- 3. Interaction ---

  describe('Interaction', () => {
    it('navigates back when header back button is pressed', () => {
      const {getByTestId} = renderWithRedux();
      fireEvent.press(getByTestId('header-back-btn'));
      expect(mockGoBack).toHaveBeenCalled();
    });

    it('navigates to EditDocument when edit button is pressed', () => {
      const {getByTestId} = renderWithRedux();
      fireEvent.press(getByTestId('header-right-btn'));
      expect(mockNavigate).toHaveBeenCalledWith('EditDocument', {
        documentId: mockDocumentId,
      });
    });

    it('navigates back when document is not found (Error State Back Button)', () => {
      const emptyState = {
        companion: {companions: []},
        documents: {documents: [], viewLoading: {}},
      };
      const {getByTestId} = renderWithRedux(emptyState);

      fireEvent.press(getByTestId('header-back-btn'));
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  // --- 4. Side Effects (UseEffect) ---

  describe('Side Effects', () => {
    it('dispatches fetchDocumentView if files have no valid URLs', () => {
      const docNoUrls = {
        ...mockDoc,
        files: [{id: 'f1', uri: 'local-file'}],
      } as any;

      const state = {
        ...initialState,
        documents: {documents: [docNoUrls], viewLoading: {}},
      };

      renderWithRedux(state);
      expect(fetchDocumentView).toHaveBeenCalledWith({
        documentId: mockDocumentId,
      });
    });

    it('dispatches fetchDocumentView if files exist but need fresh URLs (missing view OR download)', () => {
      // hasViewableAttachments will be true (has http), but needsFreshUrls check should trigger
      // logic: return !(hasView && hasDownload)
      const docMissingDownload = {
        ...mockDoc,
        files: [{id: 'f1', viewUrl: 'https://view.com', downloadUrl: null}],
      };
      const state = {
        ...initialState,
        documents: {documents: [docMissingDownload], viewLoading: {}},
      };

      renderWithRedux(state);
      expect(fetchDocumentView).toHaveBeenCalledWith({
        documentId: mockDocumentId,
      });
    });

    it('does NOT dispatch if viewLoading is already true', () => {
      const docNoUrls = {...mockDoc, files: []};
      const state = {
        ...initialState,
        documents: {
          documents: [docNoUrls],
          viewLoading: {[mockDocumentId]: true}, // Already loading
        },
      };

      renderWithRedux(state);
      expect(fetchDocumentView).not.toHaveBeenCalled();
    });

    it('does NOT dispatch if document has valid view AND download urls', () => {
      const docValid = {
        ...mockDoc,
        files: [
          {
            id: 'f1',
            viewUrl: 'https://view.com',
            downloadUrl: 'https://dl.com',
          },
        ],
      };
      const state = {
        ...initialState,
        documents: {documents: [docValid], viewLoading: {}},
      };

      renderWithRedux(state);
      expect(fetchDocumentView).not.toHaveBeenCalled();
    });

    it('does NOT dispatch if document is undefined (handled by early return)', () => {
      const state = {
        ...initialState,
        documents: {documents: [], viewLoading: {}},
      };
      renderWithRedux(state);
      expect(fetchDocumentView).not.toHaveBeenCalled();
    });

    it('handles hasViewableAttachments check for empty files array (returns false -> triggers fetch)', () => {
      const docEmptyFiles = {...mockDoc, files: []};
      const state = {
        ...initialState,
        documents: {documents: [docEmptyFiles], viewLoading: {}},
      };

      renderWithRedux(state);
      // !hasViewableAttachments is true, so it should fetch
      expect(fetchDocumentView).toHaveBeenCalledWith({
        documentId: mockDocumentId,
      });
    });
  });
});
