import React from 'react';
import {Alert, PermissionsAndroid, Platform, Share} from 'react-native';
import RNFS from 'react-native-fs';
import {mockTheme} from '../setup/mockTheme';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
// FIX: Corrected path depth (5 levels up instead of 6)
import {DocumentPreviewScreen} from '../../../../../src/features/documents/screens/DocumentPreviewScreen/DocumentPreviewScreen';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import {fetchDocumentView} from '../../../../../src/features/documents/documentSlice';

// --- Mocks ---

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn().mockReturnValue(true);
const mockDocumentId = 'doc-123';
let mockRouteParams: any = {
  documentId: mockDocumentId,
  initialDocument: undefined,
};

// 1. Navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    canGoBack: mockCanGoBack,
  }),
  useRoute: () => ({params: mockRouteParams}),
}));

// 2. Styles
jest.mock('@/shared/utils/screenStyles', () => ({
  createScreenContainerStyles: () => ({container: {}, contentContainer: {}}),
  createErrorContainerStyles: () => ({errorContainer: {}, errorText: {}}),
  createLiquidGlassHeaderStyles: () => ({
    topSection: {},
    topGlassCard: {},
    topGlassFallback: {},
  }),
  createAllCommonStyles: () => ({
    container: {},
    contentContainer: {},
    errorContainer: {},
    errorText: {},
  }),
}));

// 3. Theme
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
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

jest.mock(
  '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen',
  () => {
    const {View: RNView} = require('react-native');
    return {
      LiquidGlassHeaderScreen: ({header, children}: any) => (
        <RNView testID="screen-layout">
          {header}
          {typeof children === 'function' ? children({}) : children}
        </RNView>
      ),
    };
  },
);

jest.mock('@/features/documents/components/DocumentAttachmentViewer', () => {
  const {
    View: RNView,
    Text: RNText,
    TouchableOpacity: RNTouchableOpacity,
  } = require('react-native');
  const DocumentAttachmentViewer = ({onPdfTouchStart, onPdfTouchEnd}: any) => (
    <RNView testID="mock-attachment-viewer">
      <RNText>Attachment Viewer</RNText>
      <RNTouchableOpacity testID="pdf-touch-start" onPress={onPdfTouchStart} />
      <RNTouchableOpacity testID="pdf-touch-end" onPress={onPdfTouchEnd} />
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

// 7. Filesystem (override the lightweight jest.setup mock with a downloadable stub)
jest.mock('react-native-fs', () => ({
  __esModule: true,
  default: {
    DownloadDirectoryPath: '/downloads',
    DocumentDirectoryPath: '/documents',
    mkdir: jest.fn(() => Promise.resolve()),
    downloadFile: jest.fn(() => ({promise: Promise.resolve()})),
    stat: jest.fn(() => Promise.resolve({size: 1024})),
  },
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
    files: [
      {
        id: 'f1',
        viewUrl: 'https://example.com/view.pdf',
        downloadUrl: 'https://example.com/view.pdf',
      },
    ],
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
    mockRouteParams = {
      documentId: mockDocumentId,
      initialDocument: undefined,
    };
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
      const {getAllByText, getByTestId} = renderWithRedux();
      // Title appears in the header title block
      expect(getAllByText('Vaccination Report').length).toBeGreaterThan(0);
      expect(getByTestId('document-preview-header')).toBeTruthy();
    });

    it('renders info card with correct details', () => {
      const {getByText, getAllByText} = renderWithRedux();
      // Title (header title block)
      expect(getAllByText('Vaccination Report').length).toBeGreaterThan(0);
      // Companion name (meta row)
      expect(getByText('Buddy')).toBeTruthy();
      // Business name (meta row)
      expect(getByText('Happy Vet Clinic')).toBeTruthy();
      // Date formatting in the header subtitle: Jan 15, 2023
      expect(getByText('Jan 15, 2023')).toBeTruthy();
    });

    it('renders "Unknown" companion if companion is missing', () => {
      const stateNoCompanion = {
        ...initialState,
        companion: {companions: []},
      };
      const {getByText} = renderWithRedux(stateNoCompanion);
      expect(getByText('Unknown')).toBeTruthy();
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

    it('renders the initial route document when redux refresh drops the entry', () => {
      mockRouteParams = {
        documentId: mockDocumentId,
        initialDocument: mockDoc,
      };
      const emptyState = {
        companion: {companions: [mockCompanion]},
        documents: {documents: [], viewLoading: {}},
      };

      const {getAllByText} = renderWithRedux(emptyState);
      expect(getAllByText('Vaccination Report').length).toBeGreaterThan(0);
    });

    it('renders the attachment viewer', () => {
      const {getByTestId} = renderWithRedux();
      expect(getByTestId('mock-attachment-viewer')).toBeTruthy();
    });

    it('does not refetch when the document already has a local file uri', () => {
      const stateWithLocalFile = {
        ...initialState,
        documents: {
          documents: [
            {
              ...mockDoc,
              files: [
                {
                  id: 'local-file',
                  uri: 'file:///tmp/clinical-packet.pdf',
                  viewUrl: 'file:///tmp/clinical-packet.pdf',
                  downloadUrl: 'file:///tmp/clinical-packet.pdf',
                },
              ],
            },
          ],
          viewLoading: {},
        },
      };

      renderWithRedux(stateWithLocalFile);

      expect(fetchDocumentView).not.toHaveBeenCalled();
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

  // --- 5. Derived content (dates, subcategory, file meta) ---

  describe('Derived content', () => {
    it('formats an ISO (YYYY-MM-DD) issue date via parseISODate', () => {
      const doc = {...mockDoc, issueDate: '2023-01-15'};
      const state = {
        ...initialState,
        documents: {documents: [doc], viewLoading: {}},
      };
      const {getByText} = renderWithRedux(state);
      expect(getByText('Jan 15, 2023')).toBeTruthy();
    });

    it('renders the subcategory label when a real subcategory is set', () => {
      const doc = {...mockDoc, category: 'others', subcategory: 'weight-logs'};
      const state = {
        ...initialState,
        documents: {documents: [doc], viewLoading: {}},
      };
      const {getByText} = renderWithRedux(state);
      expect(getByText(/Weight logs/)).toBeTruthy();
    });

    it('falls back to the raw subcategory id when it is not in the category', () => {
      const doc = {...mockDoc, category: 'others', subcategory: 'zzz-missing'};
      const state = {
        ...initialState,
        documents: {documents: [doc], viewLoading: {}},
      };
      const {getByText} = renderWithRedux(state);
      expect(getByText(/zzz-missing/)).toBeTruthy();
    });

    it('falls back to the raw subcategory id when the category is unknown', () => {
      const doc = {
        ...mockDoc,
        category: 'unknown-cat',
        subcategory: 'orphan-sub',
      };
      const state = {
        ...initialState,
        documents: {documents: [doc], viewLoading: {}},
      };
      const {getByText} = renderWithRedux(state);
      expect(getByText(/orphan-sub/)).toBeTruthy();
    });

    it('renders file meta with an uppercased extension and MB size', () => {
      const doc = {
        ...mockDoc,
        files: [
          {
            id: 'f1',
            name: 'report.PDF',
            type: 'application/pdf',
            size: 2 * 1024 * 1024,
            viewUrl: 'https://example.com/view.pdf',
            downloadUrl: 'https://example.com/view.pdf',
          },
        ],
      };
      const state = {
        ...initialState,
        documents: {documents: [doc], viewLoading: {}},
      };
      const {getByText} = renderWithRedux(state);
      expect(getByText(/2\.0 MB/)).toBeTruthy();
    });

    it('renders file meta with a KB size and mime-type fallback', () => {
      const doc = {
        ...mockDoc,
        files: [
          {
            id: 'f1',
            name: 'noext',
            type: 'pdf',
            size: 2048,
            viewUrl: 'https://example.com/view.pdf',
            downloadUrl: 'https://example.com/view.pdf',
          },
        ],
      };
      const state = {
        ...initialState,
        documents: {documents: [doc], viewLoading: {}},
      };
      const {getByText} = renderWithRedux(state);
      expect(getByText(/2 KB/)).toBeTruthy();
    });
  });

  // --- 6. PDF interaction toggles ---

  describe('PDF interaction', () => {
    it('runs the pdf touch start/end handlers without crashing', () => {
      const {getByTestId} = renderWithRedux();
      fireEvent.press(getByTestId('pdf-touch-start'));
      fireEvent.press(getByTestId('pdf-touch-end'));
      expect(getByTestId('mock-attachment-viewer')).toBeTruthy();
    });
  });

  // --- 7. Sharing ---

  describe('Sharing', () => {
    beforeEach(() => {
      (Alert as any).alert = jest.fn();
      (Share as any).share = jest
        .fn()
        .mockResolvedValue({action: 'sharedAction'});
    });

    it('shares the document including the primary uri', async () => {
      const {getByLabelText} = renderWithRedux();
      fireEvent.press(getByLabelText('Share document'));
      await waitFor(() => expect(Share.share).toHaveBeenCalled());
      expect(Share.share).toHaveBeenCalledWith({
        title: 'Vaccination Report for Buddy',
        message: 'Vaccination Report for Buddy\n\nhttps://example.com/view.pdf',
        url: 'https://example.com/view.pdf',
      });
    });

    it('resolves the share uri from downloadUrl when viewUrl is absent', async () => {
      const doc = {
        ...mockDoc,
        files: [{id: 'f1', downloadUrl: 'https://dl.example/report.pdf'}],
      };
      const state = {
        ...initialState,
        documents: {documents: [doc], viewLoading: {}},
      };
      const {getByLabelText} = renderWithRedux(state);
      fireEvent.press(getByLabelText('Share document'));
      await waitFor(() => expect(Share.share).toHaveBeenCalled());
      expect(Share.share).toHaveBeenCalledWith(
        expect.objectContaining({url: 'https://dl.example/report.pdf'}),
      );
    });

    it('shares only the label when no file uri is available', async () => {
      const doc = {...mockDoc, files: [{id: 'f1'}]};
      const state = {
        ...initialState,
        documents: {documents: [doc], viewLoading: {}},
      };
      const {getByLabelText} = renderWithRedux(state);
      fireEvent.press(getByLabelText('Share document'));
      await waitFor(() => expect(Share.share).toHaveBeenCalled());
      expect(Share.share).toHaveBeenCalledWith({
        title: 'Vaccination Report for Buddy',
        message: 'Vaccination Report for Buddy',
        url: '',
      });
    });

    it('alerts with the error message when sharing throws an Error', async () => {
      (Share.share as jest.Mock).mockRejectedValueOnce(
        new Error('share exploded'),
      );
      const {getByLabelText} = renderWithRedux();
      fireEvent.press(getByLabelText('Share document'));
      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'share exploded'),
      );
    });

    it('alerts with a fallback message when sharing throws a non-Error', async () => {
      (Share.share as jest.Mock).mockRejectedValueOnce('nope');
      const {getByLabelText} = renderWithRedux();
      fireEvent.press(getByLabelText('Share document'));
      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to share'),
      );
    });
  });

  // --- 8. Downloading ---

  describe('Downloading', () => {
    beforeEach(() => {
      (Alert as any).alert = jest.fn();
    });

    afterEach(() => {
      (Platform as any).OS = 'ios';
      (Platform as any).Version = undefined;
      (RNFS as any).DownloadDirectoryPath = '/downloads';
    });

    it('downloads the primary file on iOS', async () => {
      const doc = {
        ...mockDoc,
        files: [
          {
            id: 'f1',
            name: 'report.pdf',
            s3Url: 'https://s3.example/report.pdf',
          },
        ],
      };
      const state = {
        ...initialState,
        documents: {documents: [doc], viewLoading: {}},
      };
      const {getByLabelText} = renderWithRedux(state);
      fireEvent.press(getByLabelText('Download document'));
      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith(
          'Download complete',
          expect.stringContaining('/downloads/report.pdf'),
        ),
      );
      expect(RNFS.downloadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          fromUrl: 'https://s3.example/report.pdf',
          toFile: '/downloads/report.pdf',
          discretionary: true,
        }),
      );
    });

    it('alerts when there is no download link', async () => {
      const doc = {...mockDoc, files: [{id: 'f1'}]};
      const state = {
        ...initialState,
        documents: {documents: [doc], viewLoading: {}},
      };
      const {getByLabelText} = renderWithRedux(state);
      fireEvent.press(getByLabelText('Download document'));
      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith(
          'Unavailable',
          expect.stringContaining('could not find a download link'),
        ),
      );
      expect(RNFS.downloadFile).not.toHaveBeenCalled();
    });

    it('alerts when the download fails', async () => {
      (RNFS.mkdir as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
      const {getByLabelText} = renderWithRedux();
      fireEvent.press(getByLabelText('Download document'));
      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith(
          'Download failed',
          expect.stringContaining('Unable to download'),
        ),
      );
    });

    it('requests storage permission on legacy Android and aborts when denied', async () => {
      (Platform as any).OS = 'android';
      (Platform as any).Version = 30;
      (PermissionsAndroid as any).PERMISSIONS = {
        READ_EXTERNAL_STORAGE: 'read_ext',
      };
      (PermissionsAndroid as any).RESULTS = {
        GRANTED: 'granted',
        DENIED: 'denied',
      };
      (PermissionsAndroid as any).request = jest
        .fn()
        .mockResolvedValue('denied');
      const {getByLabelText} = renderWithRedux();
      fireEvent.press(getByLabelText('Download document'));
      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith(
          'Permission needed',
          expect.stringContaining('storage permission'),
        ),
      );
      expect(PermissionsAndroid.request).toHaveBeenCalledWith('read_ext');
      expect(RNFS.downloadFile).not.toHaveBeenCalled();
    });

    it('downloads on legacy Android when permission is granted', async () => {
      (Platform as any).OS = 'android';
      (Platform as any).Version = 30;
      (RNFS as any).DownloadDirectoryPath = undefined;
      (PermissionsAndroid as any).PERMISSIONS = {
        READ_EXTERNAL_STORAGE: 'read_ext',
      };
      (PermissionsAndroid as any).RESULTS = {
        GRANTED: 'granted',
        DENIED: 'denied',
      };
      (PermissionsAndroid as any).request = jest
        .fn()
        .mockResolvedValue('granted');
      const doc = {
        ...mockDoc,
        files: [{id: 'f1', viewUrl: 'https://example.com/legacy.pdf'}],
      };
      const state = {
        ...initialState,
        documents: {documents: [doc], viewLoading: {}},
      };
      const {getByLabelText} = renderWithRedux(state);
      fireEvent.press(getByLabelText('Download document'));
      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith(
          'Download complete',
          expect.stringContaining('/documents/document'),
        ),
      );
      expect(RNFS.downloadFile).toHaveBeenCalledWith(
        expect.objectContaining({toFile: '/documents/document'}),
      );
    });
  });
});
