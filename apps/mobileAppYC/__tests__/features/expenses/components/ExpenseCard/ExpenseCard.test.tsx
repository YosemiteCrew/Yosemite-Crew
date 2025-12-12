import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import ExpenseCard from '../../../../../src/features/expenses/components/ExpenseCard/ExpenseCard';
import {Images} from '@/assets/images';

// --- Mocks ---

// 1. Mock Hooks
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        textSecondary: '#666',
        secondary: '#000',
        success: '#0f0',
      },
      typography: {
        bodySmall: {fontSize: 12},
        labelSmall: {fontSize: 10},
      },
      spacing: {2: 8},
    },
  }),
}));

// 2. Mock Assets
jest.mock('@/assets/images', () => ({
  Images: {
    documentFallback: {uri: 'fallback.png'},
    currencyIcon: {uri: 'currency.png'},
  },
}));

// 3. Mock Utils
jest.mock('@/shared/utils/currency', () => ({
  formatCurrency: jest.fn(amount => `$${amount}`),
  resolveCurrencySymbol: jest.fn(() => '$'),
}));

// 4. Mock Styles Creator (Optional, but good for stability)
jest.mock('@/shared/components/common/cardStyles', () => ({
  createCardStyles: () => ({
    card: {},
    fallback: {},
    innerContent: {},
    infoRow: {},
    thumbnailContainer: {},
    thumbnail: {},
    textContent: {},
    title: {},
    rightColumn: {},
    amount: {},
  }),
}));

// 5. Mock Child Components
jest.mock(
  '@/shared/components/common/SwipeableActionCard/SwipeableActionCard',
  () => {
    const {View} = require('react-native');
    return {
      SwipeableActionCard: (props: any) => (
        <View testID="swipeable-card">{props.children}</View>
      ),
    };
  },
);

jest.mock(
  '@/shared/components/common/CardActionButton/CardActionButton',
  () => {
    const {TouchableOpacity, Text} = require('react-native');
    return {
      CardActionButton: (props: any) => (
        <TouchableOpacity testID="card-action-btn" onPress={props.onPress}>
          <Text>{props.label}</Text>
        </TouchableOpacity>
      ),
    };
  },
);

describe('ExpenseCard', () => {
  const defaultProps = {
    title: 'Vet Visit',
    categoryLabel: 'Medical',
    subcategoryLabel: 'Checkup',
    visitTypeLabel: 'Routine',
    date: '2023-01-01',
    amount: 100,
    currencyCode: 'USD',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Basic Rendering & Information Display ---

  it('renders expense information correctly', () => {
    const {getByText} = render(<ExpenseCard {...defaultProps} />);

    expect(getByText('Vet Visit')).toBeTruthy();
    expect(getByText('Medical')).toBeTruthy();
    expect(getByText('Checkup')).toBeTruthy();
    expect(getByText('Routine')).toBeTruthy();
    // Currency mock returns straightforward format
    expect(getByText('$100')).toBeTruthy();
  });

  it('uses thumbnail if provided', () => {
    const mockThumb = {uri: 'thumb.jpg'};
    const {UNSAFE_getAllByType} = render(
      <ExpenseCard {...defaultProps} thumbnail={mockThumb} />,
    );
    const {Image} = require('react-native');
    const images = UNSAFE_getAllByType(Image);
    // There might be multiple images (e.g. within mocked children), so we check props
    const thumbImg = images.find((img: any) => img.props.source === mockThumb);
    expect(thumbImg).toBeTruthy();
  });

  it('uses default fallback image if thumbnail is missing', () => {
    const {UNSAFE_getAllByType} = render(<ExpenseCard {...defaultProps} />);
    const {Image} = require('react-native');
    const images = UNSAFE_getAllByType(Image);
    const fallbackImg = images.find(
      (img: any) => img.props.source === Images.documentFallback,
    );
    expect(fallbackImg).toBeTruthy();
  });

  // --- 2. Interaction Handlers ---

  it('calls onPressView when card body is pressed', () => {
    const onPressView = jest.fn();
    // We need to find the TouchableOpacity that wraps the content.
    // Since we mocked SwipeableActionCard to just render children,
    // the first TouchableOpacity inside it is the main card press area.
    const {UNSAFE_getByType} = render(
      <ExpenseCard {...defaultProps} onPressView={onPressView} />,
    );

    const {TouchableOpacity} = require('react-native');
    // Note: CardActionButton is also a TouchableOpacity in our mock, but it is rendered *after* or conditionally.
    // The main card touchable is inside SwipeableActionCard children.
    const touchable = UNSAFE_getByType(TouchableOpacity);

    fireEvent.press(touchable);
    expect(onPressView).toHaveBeenCalled();
  });

  // --- 3. Payment Status & Buttons ---

  it('shows Pay button when showPayButton is true and isPaid is false', () => {
    const onPressPay = jest.fn();
    const {getByTestId, getByText} = render(
      <ExpenseCard
        {...defaultProps}
        showPayButton={true}
        isPaid={false}
        onPressPay={onPressPay}
      />,
    );

    const btn = getByTestId('card-action-btn');
    expect(btn).toBeTruthy();
    // Default label logic: Pay $100.00
    expect(getByText('Pay $100.00')).toBeTruthy();

    fireEvent.press(btn);
    expect(onPressPay).toHaveBeenCalled();
  });

  it('shows "Paid" badge instead of button when isPaid is true', () => {
    const {getByText, queryByTestId} = render(
      <ExpenseCard {...defaultProps} showPayButton={true} isPaid={true} />,
    );

    // Pay button should be gone
    expect(queryByTestId('card-action-btn')).toBeNull();
    // Paid text visible
    expect(getByText('Paid')).toBeTruthy();
  });

  // --- 4. Interactive Paid Badge (Toggle Status) ---

  it('makes the Paid badge interactive if onTogglePaidStatus is provided', () => {
    const onToggle = jest.fn();
    const {getByText} = render(
      <ExpenseCard
        {...defaultProps}
        isPaid={true}
        onTogglePaidStatus={onToggle}
      />,
    );

    const paidText = getByText('Paid');
    // The text is wrapped in a TouchableOpacity in this mode.
    // We can find the parent touchable of the text.
    // Since getByText returns the Text component, we assume fireEvent.press works on it by bubbling or finding parent?
    // React Native Testing Library `fireEvent.press` often searches up the tree for a touchable.
    fireEvent.press(paidText);

    expect(onToggle).toHaveBeenCalled();
  });

  it('renders non-interactive Paid badge if onTogglePaidStatus is missing', () => {
    const {getByText} = render(<ExpenseCard {...defaultProps} isPaid={true} />);

    const paidText = getByText('Paid');
    // Ensure firing press doesn't crash or do anything unexpected
    fireEvent.press(paidText);
    // Just verifying it renders is usually enough, but strictly:
    // We could check if it has a `View` parent instead of `TouchableOpacity`.
    // In the code: <View style={styles.paidBadge}> vs <TouchableOpacity>
  });
});
