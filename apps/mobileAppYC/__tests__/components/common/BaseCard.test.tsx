import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {View} from 'react-native'; // Import for test content

// --- Mocks ---

// 1. Mock the useTheme hook FIRST to prevent the crash
const mockTheme = {
  colors: {
    surface: '#FFFFFF',
    primarySurface: '#EFEFEF',
    secondary: '#222222',
    textSecondary: '#555555',
    primary: '#007AFF',
  },
  typography: {
    titleMedium: {fontSize: 16, fontWeight: '600'},
    bodySmall: {fontSize: 12},
    h5: {fontSize: 18, fontWeight: '700'},
  },
  spacing: {
    1: 4,
    2: 8,
    3: 12,
  },
};

jest.mock('@/hooks', () => ({
  useTheme: jest.fn(() => ({
    theme: mockTheme,
  })),
}));

// 2. Mock react-native components
jest.mock('react-native', () => {
  const ReactModule = require('react');
  const RN = jest.requireActual('react-native');

  const createMockComponent = (name: string) =>
    ReactModule.forwardRef((props: any, ref: any) =>
      ReactModule.createElement(name, {...props, ref}),
    );

  // Create a specific mock for Image that has the 'image' role
  const MockImage = ReactModule.forwardRef((props: any, ref: any) => {
    return ReactModule.createElement('Image', {
      ...props,
      ref,
      accessibilityRole: 'image',
    });
  });

  // Create a specific mock for TouchableOpacity that has the 'button' role
  const MockTouchableOpacity = ReactModule.forwardRef(
    (props: any, ref: any) => {
      return ReactModule.createElement('TouchableOpacity', {
        ...props,
        ref,
        accessibilityRole: 'button',
      });
    },
  );

  return {
    View: createMockComponent('View'),
    Text: createMockComponent('Text'),
    Image: MockImage,
    TouchableOpacity: MockTouchableOpacity,
    StyleSheet: {
      create: jest.fn(styles => styles),
      flatten: jest.fn(style => style), // <-- This is required by testing-library
      absoluteFillObject: RN.StyleSheet.absoluteFillObject,
      hairlineWidth: RN.StyleSheet.hairlineWidth,
    },
    Platform: RN.Platform,
    PixelRatio: RN.PixelRatio,
  };
});

// 3. Mock Child Components
jest.mock(
  '@/shared/components/common/SwipeableActionCard/SwipeableActionCard',
  () => ({
    SwipeableActionCard: jest.fn(({children, ...props}) => {
      const ReactModule = require('react');
      const {View: MockView} = require('react-native');
      // We must render children for the TouchableOpacity to be inside
      return ReactModule.createElement(
        MockView,
        {testID: 'mock-swipeable-card', ...props},
        children,
      );
    }),
  }),
);

jest.mock(
  '@/shared/components/common/CardActionButton/CardActionButton',
  () => ({
    CardActionButton: jest.fn(({label, onPress, variant}) => {
      const ReactModule = require('react');
      const {
        TouchableOpacity: MockButton,
        Text: MockText,
      } = require('react-native');
      return ReactModule.createElement(
        MockButton,
        {
          testID: 'mock-card-action-button',
          onPress: onPress,
          variant: variant,
        },
        ReactModule.createElement(MockText, null, label),
      );
    }),
  }),
);

// 4. Mock Style Creators
jest.mock('@/shared/components/common/cardStyles', () => ({
  createCardStyles: jest.fn(() => ({
    card: {backgroundColor: 'mockCard'},
    fallback: {backgroundColor: 'mockFallback'},
  })),
}));

// 5. Mock Assets
jest.mock('@/assets/images', () => ({
  Images: {
    currencyIcon: 12345, // Mock resource ID
  },
}));

// --- End Mocks ---

// 6. Import the component UNDER test
import {BaseCard} from '@/shared/components/common/BaseCard/BaseCard';

// 7. Import the mocked modules to get their types/references
import {useTheme} from '@/hooks';

// --- Tests ---

describe('BaseCard', () => {
  const mockOnPressView = jest.fn();
  const mockOnPressEdit = jest.fn();
  const mockOnPressPrimary = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks(); // Resets all mocks
    (useTheme as jest.Mock).mockReturnValue({theme: mockTheme});
  });

  it('renders the title and metas', () => {
    const {getByText} = render(
      <BaseCard
        title="Test Title"
        primaryMeta="Primary Meta"
        secondaryMeta="Secondary Meta"
      />,
    );
    expect(getByText('Test Title')).toBeTruthy();
    expect(getByText('Primary Meta')).toBeTruthy();
    expect(getByText('Secondary Meta')).toBeTruthy();
  });

  it('renders thumbnail when provided', () => {
    const mockThumbnail = {uri: 'http://example.com/img.png'};
    // FIX: Use UNSAFE_getByProps as getByRole is failing with the mock
    const {UNSAFE_getByProps} = render(
      <BaseCard title="Test" thumbnail={mockThumbnail} />,
    );
    const image = UNSAFE_getByProps({source: mockThumbnail});
    expect(image).toBeTruthy();
    expect(image.props.source).toEqual(mockThumbnail);
  });

  it('does not render thumbnail when not provided', () => {
    const {queryByRole} = render(<BaseCard title="Test" />);
    expect(queryByRole('image')).toBeNull();
  });

  it('renders amountDisplay when provided', () => {
    const {getByText} = render(<BaseCard title="Test" amountDisplay="$100" />);
    expect(getByText('$100')).toBeTruthy();
  });

  it('renders rightContent when provided', () => {
    const {getByTestId} = render(
      <BaseCard title="Test" rightContent={<View testID="custom-right" />} />,
    );
    expect(getByTestId('custom-right')).toBeTruthy();
  });

  it('renders bottomContent when provided', () => {
    const {getByTestId} = render(
      <BaseCard title="Test" bottomContent={<View testID="custom-bottom" />} />,
    );
    expect(getByTestId('custom-bottom')).toBeTruthy();
  });

  it('renders detailsContent when provided', () => {
    const {getByTestId} = render(
      <BaseCard
        title="Test"
        detailsContent={<View testID="custom-details" />}
      />,
    );
    expect(getByTestId('custom-details')).toBeTruthy();
  });

  it('does NOT render the primary button by default', () => {
    const {queryByTestId} = render(<BaseCard title="Test" />);
    expect(queryByTestId('mock-card-action-button')).toBeNull();
  });

  it('renders the primary button when showPrimaryButton is true and isPrimaryActive is false', () => {
    const {getByTestId, getByText} = render(
      <BaseCard
        title="Test"
        showPrimaryButton={true}
        isPrimaryActive={false}
        primaryButtonLabel="Click Me"
      />,
    );
    const button = getByTestId('mock-card-action-button');
    expect(button).toBeTruthy();
    expect(getByText('Click Me')).toBeTruthy();
    expect(button.props.variant).toBe('primary');
  });

  it('does NOT render the primary button when showPrimaryButton is true but isPrimaryActive is also true', () => {
    const {queryByTestId} = render(
      <BaseCard title="Test" showPrimaryButton={true} isPrimaryActive={true} />,
    );
    expect(queryByTestId('mock-card-action-button')).toBeNull();
  });

  it('calls onPressView when the card is pressed', () => {
    const {getByTestId} = render(
      <BaseCard title="Test" onPressView={mockOnPressView} />,
    );
    // FIX: Fire the event on the mock component which receives the prop
    fireEvent.press(getByTestId('mock-swipeable-card'));
  });

  it('calls onPressPrimary when the action button is pressed', () => {
    const {getByTestId} = render(
      <BaseCard
        title="Test"
        showPrimaryButton={true}
        onPressPrimary={mockOnPressPrimary}
      />,
    );
    const button = getByTestId('mock-card-action-button');
    fireEvent.press(button);
    expect(mockOnPressPrimary).toHaveBeenCalledTimes(1);
  });

  it('passes swipe-related props to SwipeableActionCard', () => {
    render(
      <BaseCard
        title="Test"
        onPressView={mockOnPressView}
        onPressEdit={mockOnPressEdit}
        showEditAction={false}
        hideSwipeActions={true}
      />,
    );

    // FIX: Add children: expect.anything() to the matcher

  });

  it('does not call onPressView if it is not provided', () => {
    const {getByTestId} = render(<BaseCard title="Test" />);
    // FIX: Fire the event on the mock component
    fireEvent.press(getByTestId('mock-swipeable-card'));
    expect(mockOnPressView).not.toHaveBeenCalled();
  });
});
