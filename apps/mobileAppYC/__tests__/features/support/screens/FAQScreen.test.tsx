import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {render, fireEvent, screen} from '@testing-library/react-native';
import {Platform, UIManager} from 'react-native';
import FAQScreen from '../../../../src/features/support/screens/FAQScreen';

// --- Mocks ---

// 1. Navigation
const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
    navigate: mockNavigate,
  }),
  useRoute: jest.fn(),
}));

// 2. Hooks
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// 3. Assets
jest.mock('@/assets/images', () => ({
  Images: {
    accountMailIcon: {uri: 'mail-icon'},
    rightArrow: {uri: 'arrow-icon'},
  },
}));

// 4. Child Components (Safe Mocks)
jest.mock('@/shared/components/common', () => {
  const {View, Text, TouchableOpacity} = require('react-native');
  return {
    Header: ({title, onBack, onRightPress}: any) => (
      <View>
        <Text>{title}</Text>
        <TouchableOpacity onPress={onBack} testID="header-back">
          <Text>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onRightPress} testID="header-right">
          <Text>Contact</Text>
        </TouchableOpacity>
      </View>
    ),
  };
});

jest.mock('@/shared/components/common/SearchBar/SearchBar', () => ({
  SearchBar: ({value, onChangeText, placeholder}: any) => {
    const {TextInput} = require('react-native');
    return (
      <TextInput
        testID="search-bar"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
      />
    );
  },
}));

jest.mock('@/shared/components/common/PillSelector/PillSelector', () => ({
  PillSelector: ({options, onSelect, selectedId}: any) => {
    const {View, TouchableOpacity, Text} = require('react-native');
    return (
      <View>
        {options.map((o: any) => (
          <TouchableOpacity
            key={o.id}
            testID={`pill-${o.id}`}
            onPress={() => onSelect(o.id)}
            accessibilityState={{selected: selectedId === o.id}}>
            <Text>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  },
}));

jest.mock('@/shared/components/common/LiquidGlassCard/LiquidGlassCard', () => ({
  LiquidGlassCard: ({children, style}: any) => {
    const {View} = require('react-native');
    return <View style={style}>{children}</View>;
  },
}));

jest.mock(
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => ({
    __esModule: true,
    default: ({title, onPress, style}: any) => {
      const {TouchableOpacity, Text} = require('react-native');
      return (
        <TouchableOpacity
          onPress={onPress}
          testID={`btn-${title}`}
          style={style}>
          <Text>{title}</Text>
        </TouchableOpacity>
      );
    },
  }),
);

// 5. Data Mocking
// We add an 'empty_cat' to FAQ_CATEGORIES but ensure no entries match it in FAQ_ENTRIES
jest.mock('../../../../src/features/support/data/faqData', () => ({
  FAQ_CATEGORIES: [
    {id: 'all', label: 'All'},
    {id: 'cat1', label: 'Cat 1'},
    {id: 'cat2', label: 'Cat 2'},
    {id: 'empty_cat', label: 'Empty Category'},
  ],
  FAQ_ENTRIES: [
    {
      id: 'faq1',
      categoryIds: ['cat1'],
      question: 'Question 1',
      answer: 'Answer 1 contains keyword.',
      relatedIds: ['faq2'],
    },
    {
      id: 'faq2',
      categoryIds: ['cat1'],
      question: 'Question 2',
      answer: 'Answer 2',
      relatedIds: [],
    },
    {
      id: 'faq3',
      categoryIds: ['cat2'],
      question: 'Question 3',
      answer: 'Answer 3',
      relatedIds: [],
    },
  ],
}));

describe('FAQScreen', () => {
  const mockNavigation: any = {
    goBack: mockGoBack,
    navigate: mockNavigate,
  };
  const mockRoute: any = {params: {}};

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly and navigates back', () => {
    render(<FAQScreen navigation={mockNavigation} route={mockRoute} />);
    expect(screen.getByText('FAQs')).toBeTruthy();

    fireEvent.press(screen.getByTestId('header-back'));
    expect(mockGoBack).toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('header-right'));
    expect(mockNavigate).toHaveBeenCalledWith('ContactUs');
  });

  it('expands and collapses FAQ items', () => {
    render(<FAQScreen navigation={mockNavigation} route={mockRoute} />);

    // FAQ1 is expanded by default. Verify its answer is shown.
    expect(screen.getByText('Answer 1 contains keyword.')).toBeTruthy();

    // Collapse FAQ1
    fireEvent.press(screen.getByText('Question 1'));

    // Answer should be gone
    expect(screen.queryByText('Answer 1 contains keyword.')).toBeNull();

    // Expand FAQ1 again
    fireEvent.press(screen.getByText('Question 1'));
    expect(screen.getByText('Answer 1 contains keyword.')).toBeTruthy();
  });

  it('filters FAQs by Category', () => {
    render(<FAQScreen navigation={mockNavigation} route={mockRoute} />);

    // Default: All
    expect(screen.getByText('Question 1')).toBeTruthy();
    expect(screen.getByText('Question 3')).toBeTruthy();

    // Select Cat 2
    fireEvent.press(screen.getByTestId('pill-cat2'));

    // FAQ 3 (Cat 2) should be visible
    expect(screen.getByText('Question 3')).toBeTruthy();
    // FAQ 1 (Cat 1) should be hidden
    expect(screen.queryByText('Question 1')).toBeNull();
  });

  it('filters FAQs by Search Query', () => {
    render(<FAQScreen navigation={mockNavigation} route={mockRoute} />);
    const searchBar = screen.getByTestId('search-bar');

    // Search by question text
    fireEvent.changeText(searchBar, 'Question 3');
    expect(screen.getByText('Question 3')).toBeTruthy();
    expect(screen.queryByText('Question 1')).toBeNull();

    // Search by answer text ('keyword' is in Answer 1)
    fireEvent.changeText(searchBar, 'keyword');
    expect(screen.getByText('Question 1')).toBeTruthy();
    expect(screen.queryByText('Question 3')).toBeNull();
  });

  it('Search: resets category to "all" if different category selected', () => {
    render(<FAQScreen navigation={mockNavigation} route={mockRoute} />);

    // 1. Select Cat 2 (shows Question 3 only)
    fireEvent.press(screen.getByTestId('pill-cat2'));
    expect(screen.queryByText('Question 1')).toBeNull();

    // 2. Search for something in Question 1
    const searchBar = screen.getByTestId('search-bar');
    fireEvent.changeText(searchBar, 'Question 1');

    // 3. Should switch to "all" automatically and show Question 1
    expect(screen.getByText('Question 1')).toBeTruthy();
  });

  it('Empty States: Handles no search results', () => {
    render(<FAQScreen navigation={mockNavigation} route={mockRoute} />);
    const searchBar = screen.getByTestId('search-bar');

    fireEvent.changeText(searchBar, 'NonExistentTerm');

    expect(
      screen.getByText('No FAQs found for "NonExistentTerm"'),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Try searching with different keywords or browse by category',
      ),
    ).toBeTruthy();
  });

  it('Empty States: Handles no category results', () => {
    // Select the 'Empty Category' which has no matching FAQs in our mock data
    render(<FAQScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByTestId('pill-empty_cat'));

    // Should see the category empty message
    expect(screen.getByText('No FAQs available in this category')).toBeTruthy();
    // Subtext for search should NOT be visible
    expect(
      screen.queryByText(
        'Try searching with different keywords or browse by category',
      ),
    ).toBeNull();
  });

  it('Interaction: Helpful buttons toggle state', () => {
    render(<FAQScreen navigation={mockNavigation} route={mockRoute} />);

    // FAQ1 is expanded.
    const btnYes = screen.getAllByTestId('btn-Yes')[0];
    fireEvent.press(btnYes);

    // Toggle off logic
    fireEvent.press(btnYes);

    // Click No
    const btnNo = screen.getAllByTestId('btn-No')[0];
    fireEvent.press(btnNo);
  });

  it('Interaction: Related Questions navigation', () => {
    render(<FAQScreen navigation={mockNavigation} route={mockRoute} />);

    // FAQ 1 is expanded. It lists FAQ 2 as related.
    // Note: getAllByText('Question 2') will find:
    // 1. The Related Question link inside FAQ 1 card.
    // 2. The actual FAQ 2 card in the list.
    // The Related Question link is rendered *before* the FAQ 2 card because FAQ 1 comes first in the list.
    const relatedLinks = screen.getAllByText('Question 2');

    // Click the related link (index 0)
    fireEvent.press(relatedLinks[0]);

    // Verify that FAQ 2 is now expanded.
    // FAQ 2 answer is "Answer 2".
    expect(screen.getByText('Answer 2')).toBeTruthy();

    // Verify toggle logic: FAQ 1 answer should be gone as accordion switches focus
    expect(screen.queryByText('Answer 1 contains keyword.')).toBeNull();
  });

  it('Related Questions: clears filter if navigating from filtered view', () => {
    render(<FAQScreen navigation={mockNavigation} route={mockRoute} />);

    // 1. Set a search filter that matches FAQ 1 but NOT FAQ 2 directly.
    const searchBar = screen.getByTestId('search-bar');
    fireEvent.changeText(searchBar, 'keyword');

    // FAQ 1 is shown. FAQ 2 (Question 2) is hidden from main list,
    // BUT visible as a "Related Question" inside FAQ 1.
    expect(screen.queryByText('Answer 2')).toBeNull();

    // 2. Click related link to Question 2
    // Since Question 2 is hidden from main list, there should only be ONE 'Question 2' text (the link).
    const relatedLinks = screen.getByText('Question 2');
    fireEvent.press(relatedLinks);

    // 3. Expect search to be cleared and FAQ 3 (previously filtered out) to appear
    expect(screen.getByText('Question 3')).toBeTruthy();
  });

  it('Android LayoutAnimation: executes top-level conditional logic', () => {
    // Use isolateModules to force re-evaluation of the module code
    jest.isolateModules(() => {
      // Mock Platform
      Platform.OS = 'android';

      // Mock UIManager
      UIManager.setLayoutAnimationEnabledExperimental = jest.fn();

      // Ensure we are in "Old Arch" mode for this test path
      // @ts-ignore
      globalThis.nativeFabricUIManager = undefined;

      // Require the file to run the top-level check
      require('../../../../src/features/support/screens/FAQScreen');

      expect(
        UIManager.setLayoutAnimationEnabledExperimental,
      ).toHaveBeenCalledWith(true);
    });

    // Restore Platform to avoid side effects
    Platform.OS = 'ios';
  });
});
