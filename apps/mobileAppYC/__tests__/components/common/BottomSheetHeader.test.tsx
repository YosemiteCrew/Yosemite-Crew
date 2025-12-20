import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {BottomSheetHeader} from '@/shared/components/common/BottomSheetHeader/BottomSheetHeader';
import {Images} from '@/assets/images';
import {mockTheme} from '../../setup/mockTheme';

// --- Mocks ---

jest.mock('@/assets/images', () => ({
  Images: {
    crossIcon: 12345, // Default mock for the happy path
  },
}));

jest.mock('react-native', () => {
  const ReactActual = jest.requireActual('react');
  const RN = jest.requireActual('react-native');

  const createMockComponent = (name: string, testID?: string) =>
    ReactActual.forwardRef((props: any, ref: any) => {
      return ReactActual.createElement(name, {
        ...props,
        ref,
        // Add a default testID if one isn't provided
        testID: props.testID || testID,
      });
    });

  return {
    View: createMockComponent('View'),
    Text: createMockComponent('Text'),
    // FIX: Add a stable testID for the button
    TouchableOpacity: createMockComponent(
      'TouchableOpacity',
      'mock-touchable-opacity',
    ),
    // FIX: Add a stable testID for the icon
    Image: createMockComponent('Image', 'mock-image'),
    StyleSheet: {
      create: jest.fn(styles => styles),
      flatten: jest.fn(style => style),
      absoluteFillObject: RN.StyleSheet.absoluteFillObject,
      hairlineWidth: RN.StyleSheet.hairlineWidth,
    },
    Platform: RN.Platform,
    PixelRatio: RN.PixelRatio,
  };
});

// --- Test Setup ---


describe('BottomSheetHeader', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    (Images as any).crossIcon = 12345;
  });

  it('renders the title correctly', () => {
    const {getByText} = render(
      <BottomSheetHeader
        title="My Test Title"
        onClose={mockOnClose}
        theme={mockTheme}
      />,
    );
    expect(getByText('My Test Title')).toBeTruthy();
  });

  it('renders the close button and icon when crossIcon is available', () => {
    const {getByTestId} = render(
      <BottomSheetHeader
        title="Test"
        onClose={mockOnClose}
        theme={mockTheme}
      />,
    );

    // FIX: Use getByTestId for both button and icon
    const closeButton = getByTestId('mock-touchable-opacity');
    const closeIcon = getByTestId('mock-image');

    expect(closeButton).toBeTruthy();
    expect(closeIcon).toBeTruthy();
    expect(closeIcon.props.source).toBe(12345);
  });

  it('calls onClose when the close button is pressed', () => {
    const {getByTestId} = render(
      <BottomSheetHeader
        title="Test"
        onClose={mockOnClose}
        theme={mockTheme}
      />,
    );

    // FIX: Use getByTestId to find the button
    const closeButton = getByTestId('mock-touchable-opacity');
    fireEvent.press(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('does not render the close button if crossIcon is null', () => {
    (Images as any).crossIcon = null;
    const {queryByTestId} = render(
      <BottomSheetHeader
        title="Test"
        onClose={mockOnClose}
        theme={mockTheme}
      />,
    );
    // FIX: Use queryByTestId for both
    expect(queryByTestId('mock-touchable-opacity')).toBeNull();
    expect(queryByTestId('mock-image')).toBeNull();
  });

  it('does not render the close button if crossIcon is undefined', () => {
    (Images as any).crossIcon = undefined;
    const {queryByTestId} = render(
      <BottomSheetHeader
        title="Test"
        onClose={mockOnClose}
        theme={mockTheme}
      />,
    );
    // FIX: Use queryByTestId for both
    expect(queryByTestId('mock-touchable-opacity')).toBeNull();
    expect(queryByTestId('mock-image')).toBeNull();
  });
});
