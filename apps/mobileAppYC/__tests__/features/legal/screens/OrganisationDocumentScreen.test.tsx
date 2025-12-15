import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import OrganisationDocumentScreen from '../../../../src/features/legal/screens/OrganisationDocumentScreen';
import {organisationDocumentService} from '../../../../src/features/legal/services/organisationDocumentService';

// --- Mocks ---

// 1. Mock Theme (Defined inline to avoid hoisting issues)
jest.mock('../../../../src/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        primary: '#0000FF',
        text: '#000000',
        textSecondary: '#666666',
        cardBackground: '#FFFFFF',
        borderMuted: '#EEEEEE',
      },
      spacing: {'2': 8, '4': 16},
      borderRadius: {lg: 12},
      typography: {
        subtitleBold14: {
          fontSize: 14,
          fontWeight: 'bold',
          fontFamily: 'System',
        },
        subtitleRegular14: {fontSize: 14, fontFamily: 'System'},
        // Fix: Explicitly included to prevent crash in legalStyles.ts
        businessTitle16: {
          fontSize: 16,
          fontWeight: 'bold',
          fontFamily: 'System',
        },
      },
    },
  }),
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
    },
  }),
);

// 4. Mock Child Components
jest.mock(
  '../../../../src/features/legal/components/LegalContentRenderer',
  () => {
    const {View, Text} = require('react-native');
    return {
      LegalContentRenderer: ({sections}: any) => (
        <View testID="legal-renderer">
          {sections.map((s: any) => (
            <View key={s.id} testID={`section-${s.id}`}>
              <Text>{s.title}</Text>
              {s.blocks.map((b: any, index: number) => (
                <Text
                  key={`${s.id}-block-${index}`}
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
}));

describe('OrganisationDocumentScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    const {getByText: getByText3} = render(
      <OrganisationDocumentScreen
        navigation={{goBack: mockGoBack} as any}
        route={
          {params: {...mockRoute.params, organisationName: undefined}} as any
        }
      />,
    );
    await waitFor(() => expect(getByText3('Terms & Conditions')).toBeTruthy());
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
  });

  it('uses fallback title if document title is missing', async () => {
    const mockDocs = [{id: 'doc-no-title', description: 'Content'}]; // Title undefined
    (organisationDocumentService.fetchDocuments as jest.Mock).mockResolvedValue(
      mockDocs,
    );

    const {findByText} = render(
      <OrganisationDocumentScreen
        navigation={{goBack: mockGoBack} as any}
        route={mockRoute as any}
      />,
    );

    // Should use the screen's base title ('Terms & Conditions') as section title
    await findByText('Terms & Conditions');
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
    const {getByTestId} = render(
      <OrganisationDocumentScreen
        navigation={{goBack: mockGoBack} as any}
        route={mockRoute as any}
      />,
    );

    fireEvent.press(getByTestId('header-back'));
    expect(mockGoBack).toHaveBeenCalled();
  });
});
