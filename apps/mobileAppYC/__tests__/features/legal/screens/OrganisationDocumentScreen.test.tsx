import React from 'react';
import {Alert} from 'react-native';
import {render, fireEvent, waitFor, act} from '@testing-library/react-native';
import OrganisationDocumentScreen from '../../../../src/features/legal/screens/OrganisationDocumentScreen';
import {organisationDocumentService} from '../../../../src/features/legal/services/organisationDocumentService';
import {downloadDocumentToAppStorage} from '../../../../src/shared/utils/documentDownload';
import {mockTheme} from '../../../setup/mockTheme';

// --- Mocks ---

// 1. Mock Theme (Defined inline to avoid hoisting issues)
jest.mock('../../../../src/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// 2. Mock Navigation
const mockGoBack = jest.fn();
const mockRoute = {
  params: {
    organisationId: 'org-123',
    organisationName: 'Test Clinic',
    category: 'TERMS_AND_CONDITIONS',
  },
};

// 3. Mock Service
jest.mock(
  '../../../../src/features/legal/services/organisationDocumentService',
  () => ({
    organisationDocumentService: {
      fetchDocuments: jest.fn(),
      acknowledgeDocument: jest.fn(),
      getAcknowledgeStatus: jest.fn(),
    },
  }),
);

// 3b. Mock the shared download util (invoked by the Download action)
jest.mock('../../../../src/shared/utils/documentDownload', () => ({
  downloadDocumentToAppStorage: jest.fn(),
}));

// 4. Mock Child Components
jest.mock(
  '../../../../src/features/legal/components/LegalContentRenderer',
  () => {
    const {View, Text} = require('react-native');
    const getBlockKey = (block: any) =>
      block.segments.map((segment: any) => segment.text).join('|');

    return {
      LegalContentRenderer: ({sections}: any) => (
        <View testID="legal-renderer">
          {sections.map((s: any) => (
            <View key={s.id} testID={`section-${s.id}`}>
              <Text>{s.title}</Text>
              {s.blocks.map((b: any, index: number) => (
                <Text
                  key={`${s.id}-block-${getBlockKey(b)}`}
                  testID={`block-${s.id}-${index}`}>
                  {b.segments[0].text}
                </Text>
              ))}
            </View>
          ))}
        </View>
      ),
    };
  },
);

jest.mock(
  '../../../../src/shared/components/common/LiquidGlassCard/LiquidGlassCard',
  () => {
    const {View} = require('react-native');
    return {
      LiquidGlassCard: ({children, style}: any) => (
        <View testID="glass-card" style={style}>
          {children}
        </View>
      ),
    };
  },
);

jest.mock(
  '../../../../src/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => {
    const {TouchableOpacity, Text} = require('react-native');
    return {
      LiquidGlassButton: ({title, onPress}: any) => (
        <TouchableOpacity testID="retry-button" onPress={onPress}>
          <Text>{title}</Text>
        </TouchableOpacity>
      ),
    };
  },
);

jest.mock('../../../../src/shared/components/common', () => ({
  Header: ({title, onBack}: any) => {
    const {TouchableOpacity, Text, View} = require('react-native');
    return (
      <View testID="header">
        <Text>{title}</Text>
        <TouchableOpacity testID="header-back" onPress={onBack}>
          <Text>Back</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({children, style}: any) => {
    const {View} = require('react-native');
    return <View style={style}>{children}</View>;
  },
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));

describe('OrganisationDocumentScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (
      organisationDocumentService.getAcknowledgeStatus as jest.Mock
    ).mockResolvedValue({
      acknowledged: false,
      version: null,
      acknowledgedAt: null,
    });
  });

  // ===========================================================================
  // 1. Loading & Headers
  // ===========================================================================

  it('renders loading state initially', async () => {
    // Hold the promise to verify loading state
    (organisationDocumentService.fetchDocuments as jest.Mock).mockReturnValue(
      new Promise(() => {}),
    );

    const {getByText} = render(
      <OrganisationDocumentScreen
        navigation={{goBack: mockGoBack} as any}
        route={mockRoute as any}
      />,
    );

    expect(getByText('Loading terms & conditions…')).toBeTruthy();
  });

  it('displays correct title variants', async () => {
    (organisationDocumentService.fetchDocuments as jest.Mock).mockResolvedValue(
      [],
    );

    // 1. Privacy Policy
    const {getByText, unmount} = render(
      <OrganisationDocumentScreen
        navigation={{goBack: mockGoBack} as any}
        route={
          {params: {...mockRoute.params, category: 'PRIVACY_POLICY'}} as any
        }
      />,
    );
    await waitFor(() =>
      expect(getByText('Test Clinic Privacy Policy')).toBeTruthy(),
    );
    unmount();

    // 2. Cancellation Policy
    const {getByText: getByText2, unmount: unmount2} = render(
      <OrganisationDocumentScreen
        navigation={{goBack: mockGoBack} as any}
        route={
          {
            params: {...mockRoute.params, category: 'CANCELLATION_POLICY'},
          } as any
        }
      />,
    );
    await waitFor(() =>
      expect(getByText2('Test Clinic Cancellation Policy')).toBeTruthy(),
    );
    unmount2();

    // 3. Fallback Title (No Organisation Name)
    const {getByText: getByText3, unmount: unmount3} = render(
      <OrganisationDocumentScreen
        navigation={{goBack: mockGoBack} as any}
        route={
          {params: {...mockRoute.params, organisationName: undefined}} as any
        }
      />,
    );
    await waitFor(() => expect(getByText3('Terms & Conditions')).toBeTruthy());
    await waitFor(() =>
      expect(getByText3('No content available')).toBeTruthy(),
    );
    unmount3();
  });

  // ===========================================================================
  // 2. Content Logic (toParagraphBlocks & Mapping)
  // ===========================================================================

  it('renders content sections and splits paragraphs correctly', async () => {
    const mockDocs = [
      {
        id: 'doc-1',
        title: 'Section 1',
        description: 'Paragraph One.\n\nParagraph Two.',
      },
    ];
    (organisationDocumentService.fetchDocuments as jest.Mock).mockResolvedValue(
      mockDocs,
    );

    const {getByTestId, findByText} = render(
      <OrganisationDocumentScreen
        navigation={{goBack: mockGoBack} as any}
        route={mockRoute as any}
      />,
    );

    await findByText('Section 1');
    await waitFor(() =>
      expect(
        organisationDocumentService.getAcknowledgeStatus,
      ).toHaveBeenCalled(),
    );

    // Check that description was split into 2 blocks
    expect(getByTestId('block-doc-1-0')).toHaveTextContent('Paragraph One.');
    expect(getByTestId('block-doc-1-1')).toHaveTextContent('Paragraph Two.');
  });

  it('renders fallback text if description is missing or empty', async () => {
    const mockDocs = [
      {id: 'doc-empty', title: 'Empty', description: null},
      {id: 'doc-whitespace', title: 'Whitespace', description: '   '},
    ];
    (organisationDocumentService.fetchDocuments as jest.Mock).mockResolvedValue(
      mockDocs,
    );

    const {findAllByText} = render(
      <OrganisationDocumentScreen
        navigation={{goBack: mockGoBack} as any}
        route={mockRoute as any}
      />,
    );

    const fallbacks = await findAllByText(
      'No additional details were provided for this document.',
    );
    // One for null, one for whitespace string
    expect(fallbacks).toHaveLength(2);
    await waitFor(() =>
      expect(
        organisationDocumentService.getAcknowledgeStatus,
      ).toHaveBeenCalled(),
    );
  });

  it('uses fallback title if document title is missing', async () => {
    const mockDocs = [{id: 'doc-no-title', description: 'Content'}]; // Title undefined
    (organisationDocumentService.fetchDocuments as jest.Mock).mockResolvedValue(
      mockDocs,
    );

    const {findAllByText} = render(
      <OrganisationDocumentScreen
        navigation={{goBack: mockGoBack} as any}
        route={mockRoute as any}
      />,
    );

    // Should use the screen's base title ('Terms & Conditions') as section title.
    // It now appears in more than one place (paper-sheet title + section title),
    // so assert at least one match rather than a unique one.
    expect((await findAllByText('Terms & Conditions')).length).toBeGreaterThan(
      0,
    );
    await waitFor(() =>
      expect(
        organisationDocumentService.getAcknowledgeStatus,
      ).toHaveBeenCalled(),
    );
  });

  it('generates ID if document ID is missing', async () => {
    const mockDocs = [{title: 'Generated ID', description: 'Content'}]; // ID undefined
    (organisationDocumentService.fetchDocuments as jest.Mock).mockResolvedValue(
      mockDocs,
    );

    const {findByText} = render(
      <OrganisationDocumentScreen
        navigation={{goBack: mockGoBack} as any}
        route={mockRoute as any}
      />,
    );

    await findByText('Generated ID');
    await waitFor(() =>
      expect(
        organisationDocumentService.getAcknowledgeStatus,
      ).toHaveBeenCalled(),
    );
  });

  // ===========================================================================
  // 3. Error & Empty States
  // ===========================================================================

  it('renders empty state when list is empty', async () => {
    (organisationDocumentService.fetchDocuments as jest.Mock).mockResolvedValue(
      [],
    );

    const {findByText} = render(
      <OrganisationDocumentScreen
        navigation={{goBack: mockGoBack} as any}
        route={mockRoute as any}
      />,
    );

    await findByText('No content available');
    await findByText('Test Clinic has not shared a terms & conditions yet.');
  });

  it('renders empty state when result is null (safety check)', async () => {
    (organisationDocumentService.fetchDocuments as jest.Mock).mockResolvedValue(
      null,
    );

    const {findByText} = render(
      <OrganisationDocumentScreen
        navigation={{goBack: mockGoBack} as any}
        route={mockRoute as any}
      />,
    );

    await findByText('No content available');
  });

  it('renders error state and allows retry', async () => {
    // 1. Fail
    (
      organisationDocumentService.fetchDocuments as jest.Mock
    ).mockRejectedValueOnce(new Error('Network Error'));

    const {getByText, getByTestId, findByText} = render(
      <OrganisationDocumentScreen
        navigation={{goBack: mockGoBack} as any}
        route={mockRoute as any}
      />,
    );

    await findByText('Unable to load');
    expect(getByText('Network Error')).toBeTruthy();

    // 2. Succeed on Retry
    (organisationDocumentService.fetchDocuments as jest.Mock).mockResolvedValue(
      [{id: '1', title: 'Success'}],
    );

    fireEvent.press(getByTestId('retry-button'));

    await findByText('Success');
    await waitFor(() =>
      expect(
        organisationDocumentService.getAcknowledgeStatus,
      ).toHaveBeenCalled(),
    );
  });

  it('renders default error message if error object is malformed', async () => {
    (
      organisationDocumentService.fetchDocuments as jest.Mock
    ).mockRejectedValueOnce('String Error');

    const {findByText} = render(
      <OrganisationDocumentScreen
        navigation={{goBack: mockGoBack} as any}
        route={mockRoute as any}
      />,
    );

    await findByText(
      'Unable to load this document right now. Please try again.',
    );
  });

  // ===========================================================================
  // 4. Navigation
  // ===========================================================================

  it('navigates back on header press', async () => {
    (organisationDocumentService.fetchDocuments as jest.Mock).mockResolvedValue(
      [],
    );
    const {getByTestId, findByText} = render(
      <OrganisationDocumentScreen
        navigation={{goBack: mockGoBack} as any}
        route={mockRoute as any}
      />,
    );

    await findByText('No content available');

    fireEvent.press(getByTestId('header-back'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  // ===========================================================================
  // 5. Document actions (Download & Acknowledge)
  // ===========================================================================

  it('downloads the real PDF when the download action is pressed', async () => {
    const mockDocs = [
      {
        id: 'doc-1',
        title: 'Section 1',
        description: 'Body text.',
        version: 3,
        pdfUrl: 'https://cdn.example/org-docs/org-123/terms-v3.pdf',
      },
    ];
    (organisationDocumentService.fetchDocuments as jest.Mock).mockResolvedValue(
      mockDocs,
    );
    (downloadDocumentToAppStorage as jest.Mock).mockResolvedValue(
      '/app/Downloads/Test-Clinic-Terms-Conditions-v3.pdf',
    );
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const {getByTestId, findByTestId} = render(
      <OrganisationDocumentScreen
        navigation={{goBack: mockGoBack} as any}
        route={mockRoute as any}
      />,
    );

    await findByTestId('organisation-document-download');
    await waitFor(() =>
      expect(
        organisationDocumentService.getAcknowledgeStatus,
      ).toHaveBeenCalled(),
    );

    fireEvent.press(getByTestId('organisation-document-download'));

    await waitFor(() =>
      expect(downloadDocumentToAppStorage).toHaveBeenCalledWith(
        'https://cdn.example/org-docs/org-123/terms-v3.pdf',
        expect.stringContaining('.pdf'),
      ),
    );
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        'Download complete',
        expect.stringContaining(
          '/app/Downloads/Test-Clinic-Terms-Conditions-v3.pdf',
        ),
      ),
    );
  });

  it('shows an unavailable alert when the document has no pdfUrl yet', async () => {
    const mockDocs = [
      {id: 'doc-1', title: 'Section 1', description: 'Body text.'},
    ];
    (organisationDocumentService.fetchDocuments as jest.Mock).mockResolvedValue(
      mockDocs,
    );
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const {getByTestId, findByTestId} = render(
      <OrganisationDocumentScreen
        navigation={{goBack: mockGoBack} as any}
        route={mockRoute as any}
      />,
    );

    await findByTestId('organisation-document-download');

    fireEvent.press(getByTestId('organisation-document-download'));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        'Unavailable',
        expect.stringContaining('download link'),
      ),
    );
    expect(downloadDocumentToAppStorage).not.toHaveBeenCalled();
  });

  it('records acknowledgment via the API and navigates back on success', async () => {
    const mockDocs = [
      {id: 'doc-1', title: 'Section 1', description: 'Body text.', version: 3},
    ];
    (organisationDocumentService.fetchDocuments as jest.Mock).mockResolvedValue(
      mockDocs,
    );
    (
      organisationDocumentService.acknowledgeDocument as jest.Mock
    ).mockResolvedValue(undefined);

    const {getByTestId, findByTestId} = render(
      <OrganisationDocumentScreen
        navigation={{goBack: mockGoBack} as any}
        route={mockRoute as any}
      />,
    );

    await findByTestId('organisation-document-acknowledge');

    await act(async () => {
      fireEvent.press(getByTestId('organisation-document-acknowledge'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      organisationDocumentService.acknowledgeDocument,
    ).toHaveBeenCalledWith({
      organisationId: 'org-123',
      documentId: 'doc-1',
      category: 'TERMS_AND_CONDITIONS',
      version: 3,
    });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('shows an inline error and stays on screen if acknowledging fails', async () => {
    const mockDocs = [
      {id: 'doc-1', title: 'Section 1', description: 'Body text.', version: 1},
    ];
    (organisationDocumentService.fetchDocuments as jest.Mock).mockResolvedValue(
      mockDocs,
    );
    (
      organisationDocumentService.acknowledgeDocument as jest.Mock
    ).mockRejectedValue(new Error('Network down'));

    const {getByTestId, findByTestId, findByText} = render(
      <OrganisationDocumentScreen
        navigation={{goBack: mockGoBack} as any}
        route={mockRoute as any}
      />,
    );

    await findByTestId('organisation-document-acknowledge');

    await act(async () => {
      fireEvent.press(getByTestId('organisation-document-acknowledge'));
      await Promise.resolve();
      await Promise.resolve();
    });

    await findByText('Network down');
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('shows the already-acknowledged state when the current version was already accepted', async () => {
    const mockDocs = [
      {id: 'doc-1', title: 'Section 1', description: 'Body text.', version: 2},
    ];
    (organisationDocumentService.fetchDocuments as jest.Mock).mockResolvedValue(
      mockDocs,
    );
    (
      organisationDocumentService.getAcknowledgeStatus as jest.Mock
    ).mockResolvedValue({
      acknowledged: true,
      version: 2,
      acknowledgedAt: '2026-01-01',
    });

    const {findByText} = render(
      <OrganisationDocumentScreen
        navigation={{goBack: mockGoBack} as any}
        route={mockRoute as any}
      />,
    );

    await findByText('Acknowledged');
  });

  // ===========================================================================
  // 6. Category fallback + empty-state clinic fallback
  // ===========================================================================

  it('falls back to the generic title and clinic label for an unknown category', async () => {
    (organisationDocumentService.fetchDocuments as jest.Mock).mockResolvedValue(
      [],
    );

    const {findByText} = render(
      <OrganisationDocumentScreen
        navigation={{goBack: mockGoBack} as any}
        route={
          {
            params: {
              organisationId: 'org-123',
              organisationName: undefined,
              category: 'UNKNOWN_CATEGORY',
            },
          } as any
        }
      />,
    );

    // Unknown category -> baseTitle 'Document'; undefined org -> 'This clinic'
    await findByText('Document');
    await findByText('This clinic has not shared a document yet.');
  });

  // ===========================================================================
  // 7. Effect cancellation (unmount before the request settles)
  // ===========================================================================

  it('ignores a resolved request after the screen unmounts', async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    (organisationDocumentService.fetchDocuments as jest.Mock).mockReturnValue(
      new Promise(resolve => {
        resolveFetch = resolve;
      }),
    );

    const {unmount} = render(
      <OrganisationDocumentScreen
        navigation={{goBack: mockGoBack} as any}
        route={mockRoute as any}
      />,
    );

    unmount();

    await act(async () => {
      resolveFetch([{id: 'late', title: 'Late', description: 'Late body.'}]);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(organisationDocumentService.fetchDocuments).toHaveBeenCalledTimes(1);
  });

  it('ignores a rejected request after the screen unmounts', async () => {
    let rejectFetch: (reason: unknown) => void = () => {};
    (organisationDocumentService.fetchDocuments as jest.Mock).mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectFetch = reject;
      }),
    );

    const {unmount} = render(
      <OrganisationDocumentScreen
        navigation={{goBack: mockGoBack} as any}
        route={mockRoute as any}
      />,
    );

    unmount();

    await act(async () => {
      rejectFetch(new Error('Too late'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(organisationDocumentService.fetchDocuments).toHaveBeenCalledTimes(1);
  });
});
