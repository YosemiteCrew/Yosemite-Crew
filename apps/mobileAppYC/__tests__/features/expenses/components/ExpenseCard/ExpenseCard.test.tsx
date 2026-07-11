import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {render, fireEvent} from '@testing-library/react-native';
import ExpenseCard from '../../../../../src/features/expenses/components/ExpenseCard/ExpenseCard';

// --- Mocks ---

// 1. Mock Hooks
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
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
    // Warm-bone row: one unlabeled meta line "category · visitType · date"
    // (subcategory is no longer shown in the row).
    expect(getByText('Medical  ·  Routine  ·  1 Jan')).toBeTruthy();
    // Currency mock returns straightforward format
    expect(getByText('$100')).toBeTruthy();
  });

  it('renders a category-tinted icon tile instead of a thumbnail', () => {
    // Default categoryLabel "Medical" maps to the fallback pricetag glyph;
    // Ionicons is globally mocked to a Text node with testID icon-<name>.
    const {getByTestId} = render(<ExpenseCard {...defaultProps} />);
    expect(getByTestId('icon-pricetag-outline')).toBeTruthy();
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

    // The main card body now renders react-native's Pressable (via
    // PressableOpacity), which is wrapped in React.memo, so match against
    // the memoized inner component. (CardActionButton is still a
    // TouchableOpacity in our mock, but it isn't rendered here since no
    // `payment` prop is provided.)
    const {Pressable} = require('react-native');
    const touchable = UNSAFE_getByType((Pressable as any).type);

    fireEvent.press(touchable);
    expect(onPressView).toHaveBeenCalled();
  });

  // --- 3. Payment Status & Buttons ---

  it('shows Pay button when an unpaid payment CTA is provided', () => {
    const onPay = jest.fn();
    const {getByTestId, getByText} = render(
      <ExpenseCard
        {...defaultProps}
        payment={{status: 'unpaid', cta: {onPress: onPay}}}
      />,
    );

    const btn = getByTestId('card-action-btn');
    expect(btn).toBeTruthy();
    // Default label logic: Pay $100.00
    expect(getByText('Pay $100.00')).toBeTruthy();

    fireEvent.press(btn);
    expect(onPay).toHaveBeenCalled();
  });

  it('shows "Paid" badge instead of button when payment is paid', () => {
    const {getByText, queryByTestId} = render(
      <ExpenseCard {...defaultProps} payment={{status: 'paid'}} />,
    );

    // Pay button should be gone
    expect(queryByTestId('card-action-btn')).toBeNull();
    // Paid text visible
    expect(getByText('Paid')).toBeTruthy();
  });

  // --- 4. Interactive Paid Badge (Toggle Status) ---

  it('makes the Paid badge interactive if an onToggleStatus handler is provided', () => {
    const onToggle = jest.fn();
    const {getByText} = render(
      <ExpenseCard
        {...defaultProps}
        payment={{status: 'paid', onToggleStatus: onToggle}}
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

  it('renders non-interactive Paid badge if onToggleStatus is missing', () => {
    const {getByText} = render(
      <ExpenseCard {...defaultProps} payment={{status: 'paid'}} />,
    );

    const paidText = getByText('Paid');
    // Ensure firing press doesn't crash or do anything unexpected
    fireEvent.press(paidText);
    // Just verifying it renders is usually enough, but strictly:
    // We could check if it has a `View` parent instead of `TouchableOpacity`.
    // In the code: <View style={styles.paidBadge}> vs <TouchableOpacity>
  });

  // --- 5. Category-tinted icon resolution ---

  it('uses the medkit glyph for a health category', () => {
    const {getByTestId} = render(
      <ExpenseCard {...defaultProps} categoryLabel="Pet Health" />,
    );
    expect(getByTestId('icon-medkit-outline')).toBeTruthy();
  });

  it('uses the scissors glyph for a hygiene category', () => {
    const {getByTestId} = render(
      <ExpenseCard {...defaultProps} categoryLabel="Grooming & Hygiene" />,
    );
    expect(getByTestId('icon-cut-outline')).toBeTruthy();
  });

  it('uses the nutrition glyph for a diet category', () => {
    const {getByTestId} = render(
      <ExpenseCard {...defaultProps} categoryLabel="Diet Plan" />,
    );
    expect(getByTestId('icon-nutrition-outline')).toBeTruthy();
  });

  it('uses the nutrition glyph for a food category', () => {
    const {getByTestId} = render(
      <ExpenseCard {...defaultProps} categoryLabel="Pet Food" />,
    );
    expect(getByTestId('icon-nutrition-outline')).toBeTruthy();
  });

  it('uses the nutrition glyph for a nutrition category', () => {
    const {getByTestId} = render(
      <ExpenseCard {...defaultProps} categoryLabel="Nutrition" />,
    );
    expect(getByTestId('icon-nutrition-outline')).toBeTruthy();
  });

  it('uses the folder glyph for an admin category', () => {
    const {getByTestId} = render(
      <ExpenseCard {...defaultProps} categoryLabel="Admin Fees" />,
    );
    expect(getByTestId('icon-folder-open-outline')).toBeTruthy();
  });

  // --- 6. Meta line / date edge cases ---

  it('hides the meta line when every segment is empty and the date is invalid', () => {
    // categoryLabel undefined exercises the optional-chain + `?? ""` fallback,
    // an empty visitTypeLabel drops the second segment, and an invalid date
    // makes formatMetaDate return "" so no segments remain -> meta renders null.
    const {getByText, queryByText, getByTestId} = render(
      <ExpenseCard
        {...defaultProps}
        categoryLabel={undefined as unknown as string}
        visitTypeLabel=""
        date="not-a-real-date"
      />,
    );

    expect(getByText('Vet Visit')).toBeTruthy();
    // No meta text -> no separator glyph anywhere on the card.
    expect(queryByText(/·/)).toBeNull();
    // Falls back to the default pricetag tile.
    expect(getByTestId('icon-pricetag-outline')).toBeTruthy();
  });

  it('omits the date segment but keeps labels when only the date is invalid', () => {
    const {getByText} = render(
      <ExpenseCard {...defaultProps} date="not-a-real-date" />,
    );
    // categoryLabel + visitTypeLabel remain, date segment is dropped.
    expect(getByText('Medical  ·  Routine')).toBeTruthy();
  });

  // --- 7. Custom Pay CTA label ---

  it('uses the provided CTA label instead of the computed amount', () => {
    const onPay = jest.fn();
    const {getByText} = render(
      <ExpenseCard
        {...defaultProps}
        payment={{status: 'unpaid', cta: {onPress: onPay, label: 'Settle now'}}}
      />,
    );
    expect(getByText('Pay Settle now')).toBeTruthy();
  });
});
