import React from 'react';
import {TouchableOpacity, Image} from 'react-native';
import {render, fireEvent} from '@testing-library/react-native';
import {
  DocumentCard,
  DocumentCardProps,
} from '../../../src/shared/components/common/DocumentCard/DocumentCard';

// --- Mocks ---

// Mock Images asset
jest.mock('@/assets/images', () => ({
  Images: {
    documentFallback: {uri: 'fallback-image-png'},
  },
}));

// Mock SwipeableActionCard (Wrapper)
jest.mock(
  '@/shared/components/common/SwipeableActionCard/SwipeableActionCard',
  () => {
    const {View: RNView} = require('react-native');
    return {
      SwipeableActionCard: (props: any) => (
        <RNView testID="swipeable-card" {...props} />
      ),
    };
  },
);

// Mock helpers
jest.mock('@/shared/utils/helpers', () => ({
  formatLabel: (label: string, fallback: string) => label || fallback,
}));

// Mock hooks
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        surface: '#ffffff',
        secondary: '#000000',
        textSecondary: '#666666',
      },
      spacing: {
        '1': 4,
        '4': 16,
      },
      borderRadius: {
        base: 8,
      },
      typography: {
        labelXsBold: {fontSize: 12, fontWeight: 'bold'},
      },
    },
  }),
}));

// Mock cardStyles
jest.mock('@/shared/components/common/cardStyles', () => ({
  createCardStyles: () => ({
    card: {backgroundColor: 'white'},
    fallback: {backgroundColor: 'gray'},
  }),
}));

describe('DocumentCard Component', () => {
  const defaultProps: DocumentCardProps = {
    title: 'Vaccination Report',
    businessName: 'Happy Vet Clinic',
    visitType: 'Checkup',
    issueDate: '2023-01-15T00:00:00.000Z',
    onPress: jest.fn(),
    onPressView: jest.fn(),
    onPressEdit: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // 1. Rendering Logic
  // ===========================================================================

  it('renders correctly with all props provided', () => {
    const {getByText, getByTestId} = render(<DocumentCard {...defaultProps} />);

    expect(getByTestId('swipeable-card')).toBeTruthy();
    expect(getByText('Vaccination Report')).toBeTruthy();
    expect(getByText('Happy Vet Clinic')).toBeTruthy();
    expect(getByText('Checkup')).toBeTruthy();
    // Verify date formatting (Jan 15, 2023)
    expect(getByText('Jan 15, 2023')).toBeTruthy();
  });

  it('renders default values when props are missing or empty', () => {
    const {getByText, getAllByText} = render(
      <DocumentCard
        {...defaultProps}
        title=""
        businessName=""
        visitType=""
        issueDate="" // Empty string simulates invalid date scenario for helper logic
      />,
    );

    expect(getByText('Document')).toBeTruthy(); // Default title

    // "Business: —" and "Visit type: —" and "Issue Date: —"
    // Since "—" appears multiple times, we check specifically or check count
    const dashes = getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  // ===========================================================================
  // 2. Date Formatting Logic
  // ===========================================================================

  it('formats valid ISO date string correctly', () => {
    const {getByText} = render(
      <DocumentCard {...defaultProps} issueDate="2023-12-25" />,
    );
    expect(getByText('Dec 25, 2023')).toBeTruthy();
  });

  it('formats Date object correctly', () => {
    // @ts-ignore - Prop type says string, but helper handles Date object too
    const dateObj = new Date('2023-11-20');
    const {getByText} = render(
      // @ts-ignore
      <DocumentCard {...defaultProps} issueDate={dateObj} />,
    );
    expect(getByText('Nov 20, 2023')).toBeTruthy();
  });

  it('handles invalid date string gracefully', () => {
    const {getByText} = render(
      <DocumentCard {...defaultProps} issueDate="invalid-date-string" />,
    );
    // Should render dash for invalid date
    // Note: Because other fields might also render '—', ensure context or check existence
    // The component renders: <Text>Title: </Text><Text>—</Text>
    // So specifically checking for the dash
    const allDashes = getByText(/—/);
    expect(allDashes).toBeTruthy();
  });

  // ===========================================================================
  // 3. Image Logic
  // ===========================================================================

  it('renders provided thumbnail', () => {
    const customImage = {uri: 'custom-uri'};
    const {UNSAFE_getByType} = render(
      <DocumentCard {...defaultProps} thumbnail={customImage} />,
    );
    const image = UNSAFE_getByType(Image);
    expect(image.props.source).toEqual(customImage);
  });

  it('renders fallback image when thumbnail is undefined', () => {
    const {UNSAFE_getByType} = render(
      <DocumentCard {...defaultProps} thumbnail={undefined} />,
    );
    const image = UNSAFE_getByType(Image);
    expect(image.props.source).toEqual({uri: 'fallback-image-png'});
  });

  // ===========================================================================
  // 4. Interaction
  // ===========================================================================

  it('calls onPress when card is pressed', () => {
    const {UNSAFE_getByType} = render(<DocumentCard {...defaultProps} />);
    const touchable = UNSAFE_getByType(TouchableOpacity);

    fireEvent.press(touchable);
    expect(defaultProps.onPress).toHaveBeenCalledTimes(1);
  });

  it('passes action props to SwipeableActionCard', () => {
    const {getByTestId} = render(
      <DocumentCard {...defaultProps} showEditAction={false} />,
    );
    const card = getByTestId('swipeable-card');

    expect(card.props.onPressView).toBe(defaultProps.onPressView);
    expect(card.props.onPressEdit).toBe(defaultProps.onPressEdit);
    expect(card.props.showEditAction).toBe(false);
  });

  it('disables interaction if onPress is not provided', () => {
    const {UNSAFE_getByType} = render(
      <DocumentCard {...defaultProps} onPress={undefined} />,
    );
    const touchable = UNSAFE_getByType(TouchableOpacity);
    expect(touchable.props.disabled).toBe(true);
  });
});
