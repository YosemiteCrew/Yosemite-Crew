import React from 'react';
import {Text} from 'react-native';
import {render, fireEvent} from '@testing-library/react-native';
import {LegalScreen} from '../../../../src/features/legal/components/LegalScreen';

// --- Mocks ---

// 1. Mock Theme Hook
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: '#fff',
      },
      spacing: {
        '4': 16,
      },
    },
  }),
}));

// 2. Mock Style Creator
jest.mock('../../../../src/features/legal/styles/legalStyles', () => ({
  createLegalStyles: () => ({
    safeArea: {flex: 1},
    container: {backgroundColor: 'white'},
    contentContainer: {padding: 16},
  }),
}));

// 3. Mock Child Components
// Fix: Use standard View with testID instead of non-existent JSX elements (<mock-header>)
jest.mock('@/shared/components/common', () => {
  const {View} = require('react-native');
  return {
    Header: (props: any) => (
      // Forward all props to the View so we can assert on them
      // Map onBack to onPressBack to match the fireEvent call in the test
      <View testID="header" {...props} onPressBack={props.onBack} />
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
    const header = getByTestId('header');
    expect(header.props.title).toBe('Terms of Service');

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

    const header = getByTestId('header');
    // Simulate the custom mock event defined in the Header mock above
    fireEvent(header, 'pressBack');

    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });
});
