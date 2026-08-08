import React from 'react';
import {mockTheme} from '../../../setup/mockTheme';
import {Alert, Text} from 'react-native';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {LegalScreen} from '../../../../src/features/legal/components/LegalScreen';
import {legalDocumentService} from '../../../../src/features/legal/services/legalDocumentService';
import {downloadDocumentToAppStorage} from '../../../../src/shared/utils/documentDownload';

jest.mock(
  '../../../../src/features/legal/services/legalDocumentService',
  () => ({
    legalDocumentService: {
      fetchLegalDocument: jest.fn(),
    },
  }),
);

jest.mock('../../../../src/shared/utils/documentDownload', () => ({
  downloadDocumentToAppStorage: jest.fn(),
}));

// --- Mocks ---

// 1. Mock Theme Hook
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// 2. Mock safe area insets
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({children, style}: any) => {
    const {View} = require('react-native');
    return <View style={style}>{children}</View>;
  },
  useSafeAreaInsets: () => ({top: 0, right: 0, bottom: 0, left: 0}),
}));

// 3. Mock Style Creators
jest.mock('../../../../src/features/legal/styles/legalStyles', () => ({
  createLegalStyles: () => ({
    safeArea: {flex: 1},
    container: {backgroundColor: 'white'},
    contentContainer: {padding: 16},
  }),
}));

jest.mock('@/shared/utils/screenStyles', () => ({
  createLiquidGlassHeaderStyles: () => ({
    topSection: {position: 'absolute'},
    topGlassShadowWrapper: {},
    topGlassCard: {},
    topGlassFallback: {},
  }),
}));

// 4. Mock LiquidGlassCard
jest.mock('@/shared/components/common/LiquidGlassCard/LiquidGlassCard', () => ({
  LiquidGlassCard: ({children}: any) => <>{children}</>,
}));

// 5. Mock Header Component
jest.mock('@/shared/components/common/Header/Header', () => {
  const {View, Text: RNText, TouchableOpacity} = require('react-native');
  return {
    Header: ({title, showBackButton, onBack}: any) => (
      <View testID="header">
        {title && <RNText testID="HeaderTitle">{title}</RNText>}
        {showBackButton && (
          <TouchableOpacity testID="HeaderBack" onPress={onBack} />
        )}
      </View>
    ),
  };
});

// Fix: Use standard View instead of <mock-legal-content-renderer>
jest.mock(
  '../../../../src/features/legal/components/LegalContentRenderer',
  () => {
    const {View} = require('react-native');
    return {
      LegalContentRenderer: (props: any) => (
        // We pass 'sectionCount' as a custom prop for verification in the test
        <View
          testID="mock-legal-content-renderer"
          sectionCount={props.sections?.length}
        />
      ),
    };
  },
);

describe('LegalScreen', () => {
  const mockNavigation = {
    goBack: jest.fn(),
  };

  const mockSections = [
    {id: '1', title: 'Intro', blocks: []},
    {id: '2', title: 'Details', blocks: []},
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Basic Rendering & Prop Passing ---

  it('renders the screen with correct title and passes sections to renderer', () => {
    // Fix: Switched from UNSAFE_getByType to getByTestId
    const {getByTestId} = render(
      <LegalScreen
        // @ts-ignore - partial navigation mock is sufficient for this test
        navigation={mockNavigation}
        route={{} as any}
        title="Terms of Service"
        docType="terms"
        sections={mockSections}
      />,
    );

    // Verify Header Title
    const headerTitle = getByTestId('HeaderTitle');
    expect(headerTitle).toHaveTextContent('Terms of Service');

    // Verify Content Renderer receives correct props (sections array)
    // We access the prop 'sectionCount' we manually injected in the mock above
    const contentRenderer = getByTestId('mock-legal-content-renderer');
    expect(contentRenderer.props.sectionCount).toBe(2);
  });

  // --- 2. Extra Content Rendering ---

  it('renders extraContent if provided (e.g. additional footer info)', () => {
    const {getByText} = render(
      <LegalScreen
        // @ts-ignore
        navigation={mockNavigation}
        route={{} as any}
        title="Privacy Policy"
        docType="privacy"
        sections={mockSections}
        extraContent={<Text>Additional Info</Text>}
      />,
    );

    expect(getByText('Additional Info')).toBeTruthy();
  });

  // --- 3. Navigation Interactions ---

  it('navigates back when header back button is pressed', () => {
    const {getByTestId} = render(
      <LegalScreen
        // @ts-ignore
        navigation={mockNavigation}
        route={{} as any}
        title="Back Test"
        docType="terms"
        sections={[]}
      />,
    );

    const backButton = getByTestId('HeaderBack');
    fireEvent.press(backButton);

    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });

  // --- 4. Header height measurement ---

  it('adds top padding to the scroll content once the header height is measured', () => {
    const {UNSAFE_root, UNSAFE_getByType} = render(
      <LegalScreen
        // @ts-ignore
        navigation={mockNavigation}
        route={{} as any}
        title="Height Test"
        docType="terms"
        sections={mockSections}
      />,
    );
    const {ScrollView} = require('react-native');

    const {View} = require('react-native');
    const topSectionView = UNSAFE_root.findAllByType(View).find(
      (node: any) => node.props.style?.position === 'absolute',
    );
    fireEvent(topSectionView, 'layout', {
      nativeEvent: {layout: {height: 90}},
    });

    const scrollView = UNSAFE_getByType(ScrollView);
    expect(scrollView.props.contentContainerStyle).toEqual([
      {padding: 16},
      {paddingTop: 90 + mockTheme.spacing['3']},
    ]);
  });

  // --- 5. Document meta (serif title + last-updated pill) ---

  it('renders the serif display title and last-updated pill from meta', () => {
    const {getByText} = render(
      <LegalScreen
        // @ts-ignore
        navigation={mockNavigation}
        route={{} as any}
        title="Terms & Conditions"
        docType="terms"
        sections={mockSections}
        meta={{
          displayTitle: 'Terms of service',
          lastUpdated: '10 Jul 2026',
          version: 'v1.0',
        }}
      />,
    );

    expect(getByText('Terms of service')).toBeTruthy();
    expect(getByText('Last updated 10 Jul 2026 · v1.0')).toBeTruthy();
  });

  it('falls back to the plain title when no meta is provided', () => {
    const {getAllByText, queryByText} = render(
      <LegalScreen
        // @ts-ignore
        navigation={mockNavigation}
        route={{} as any}
        title="Privacy Policy"
        docType="privacy"
        sections={mockSections}
      />,
    );

    // Display title falls back to the title prop (also shown in the header),
    // and there is no "Last updated" pill.
    expect(getAllByText('Privacy Policy').length).toBeGreaterThan(0);
    expect(queryByText(/Last updated/)).toBeNull();
  });

  // --- 6. On-page nav chips ---

  it('renders nav chips and switches the active chip on press', () => {
    const {getByText} = render(
      <LegalScreen
        // @ts-ignore
        navigation={mockNavigation}
        route={{} as any}
        title="Privacy Policy"
        docType="privacy"
        sections={mockSections}
        navChips={['What we collect', 'Your rights']}
      />,
    );

    expect(getByText('What we collect')).toBeTruthy();
    // Pressing the second chip drives the active-chip state branch.
    fireEvent.press(getByText('Your rights'));
    expect(getByText('Your rights')).toBeTruthy();
  });

  // --- 7. Download as PDF ---

  it('fetches the real PDF and downloads it when the download button is pressed', async () => {
    const meta = {
      displayTitle: 'Terms of service',
      lastUpdated: '10 Jul 2026',
      version: 'v1.0',
    };
    (legalDocumentService.fetchLegalDocument as jest.Mock).mockResolvedValue({
      pdfUrl: 'https://cdn.example/legal/terms-v1.pdf',
      version: 'v1',
      lastUpdated: '2026-03-01',
    });
    (downloadDocumentToAppStorage as jest.Mock).mockResolvedValue(
      '/app/Downloads/Terms-Conditions-v1.pdf',
    );
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const {getByLabelText} = render(
      <LegalScreen
        // @ts-ignore
        navigation={mockNavigation}
        route={{} as any}
        title="Terms & Conditions"
        docType="terms"
        sections={mockSections}
        meta={meta}
      />,
    );

    fireEvent.press(getByLabelText('Download as PDF'));

    await waitFor(() =>
      expect(legalDocumentService.fetchLegalDocument).toHaveBeenCalledWith(
        'terms',
      ),
    );
    await waitFor(() =>
      expect(downloadDocumentToAppStorage).toHaveBeenCalledWith(
        'https://cdn.example/legal/terms-v1.pdf',
        'Terms-Conditions-v1.pdf',
      ),
    );
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        'Download complete',
        expect.stringContaining('/app/Downloads/Terms-Conditions-v1.pdf'),
      ),
    );
  });

  it('shows a download-failed alert when fetching the PDF fails', async () => {
    (legalDocumentService.fetchLegalDocument as jest.Mock).mockRejectedValue(
      new Error('Network down'),
    );
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const {getByLabelText} = render(
      <LegalScreen
        // @ts-ignore
        navigation={mockNavigation}
        route={{} as any}
        title="Privacy Policy"
        docType="privacy"
        sections={mockSections}
      />,
    );

    fireEvent.press(getByLabelText('Download as PDF'));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('Download failed', 'Network down'),
    );
    expect(downloadDocumentToAppStorage).not.toHaveBeenCalled();
  });

  it('does not re-measure when the layout height is unchanged', () => {
    const {UNSAFE_root, UNSAFE_getByType} = render(
      <LegalScreen
        // @ts-ignore
        navigation={mockNavigation}
        route={{} as any}
        title="Height Test"
        docType="terms"
        sections={mockSections}
      />,
    );
    const {ScrollView} = require('react-native');

    const {View} = require('react-native');
    const topSectionView = UNSAFE_root.findAllByType(View).find(
      (node: any) => node.props.style?.position === 'absolute',
    );
    fireEvent(topSectionView, 'layout', {nativeEvent: {layout: {height: 0}}});

    const scrollView = UNSAFE_getByType(ScrollView);
    expect(scrollView.props.contentContainerStyle).toEqual([
      {padding: 16},
      null,
    ]);
  });
});
