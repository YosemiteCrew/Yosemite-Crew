import React from 'react';
import {mockTheme} from '../../../setup/mockTheme';
import {Text} from 'react-native';
import {render, fireEvent} from '@testing-library/react-native';
import {LegalScreen} from '../../../../src/features/legal/components/LegalScreen';

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
        sections={[]}
      />,
    );

    const backButton = getByTestId('HeaderBack');
    fireEvent.press(backButton);

    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });
});
