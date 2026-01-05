import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {View} from 'react-native';
import {render, screen, fireEvent} from '@testing-library/react-native';
import {
  Separator,
  RowButton,
  ReadOnlyRow,
} from '@/shared/components/common/FormRowComponents';

// --- Mocks ---

// 1. Mock 'react-redux'
jest.mock('react-redux', () => ({
  useDispatch: jest.fn(() => jest.fn()),
  useSelector: jest.fn(),
}));

// 2. Mock 'react-native' COMPLETELY (No requireActual) to avoid NativeModule crashes
jest.mock('react-native', () => {
  const ReactActual = jest.requireActual('react');

  const createMockComponent = (name: string) =>
    ReactActual.forwardRef((props: any, ref: any) =>
      ReactActual.createElement(name, {...props, ref}, props.children),
    );

  return {
    View: createMockComponent('View'),
    Text: createMockComponent('Text'),
    TouchableOpacity: createMockComponent('TouchableOpacity'),
    Image: createMockComponent('Image'),
    StyleSheet: {
      create: (styles: any) => styles,
      flatten: (styles: any) =>
        Array.isArray(styles) ? Object.assign({}, ...styles) : styles,
      hairlineWidth: 1,
    },
    Platform: {
      OS: 'ios',
      select: (selects: any) => selects.ios,
    },
  };
});

// 3. Mock useTheme


jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// 4. Mock Images
const mockRightArrow = {uri: 'right-arrow-png'};
jest.mock('@/assets/images', () => ({
  Images: {
    rightArrow: mockRightArrow,
  },
}));

// --- Tests ---

describe('FormRowComponents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Separator', () => {
    it('renders correctly with theme styles', () => {
      render(<Separator />);
      // Since we mocked View, we basically just check if it rendered without crashing
      // In a unit test with full mocks, confirming render is usually sufficient for visual-only components
      // unless we inspect props on the mocked View.
      const separator = screen.UNSAFE_getByType(View);
      expect(separator).toBeTruthy();
      expect(separator.props.style).toEqual(
        expect.objectContaining({
          borderBottomColor: mockTheme.colors.border,
        }),
      );
    });
  });

  describe('RowButton', () => {
    const mockOnPress = jest.fn();

    it('renders label and value correctly', () => {
      render(
        <RowButton label="My Label" value="My Value" onPress={mockOnPress} />,
      );

      expect(screen.getByText('My Label')).toBeTruthy();
      expect(screen.getByText('My Value')).toBeTruthy();
      // Check for the arrow image using UNSAFE_getByProps because we mocked Image
    });

    it('renders a placeholder space when value is empty', () => {
      render(<RowButton label="My Label" value="" onPress={mockOnPress} />);

      expect(screen.getByText('My Label')).toBeTruthy();
      // It renders '—' (em dash) for empty values
      expect(screen.getByText('—')).toBeTruthy();
    });

    it('calls onPress when pressed', () => {
      render(<RowButton label="Click Me" onPress={mockOnPress} />);

      fireEvent.press(screen.getByText('Click Me'));
      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('ReadOnlyRow', () => {
    it('renders label and value correctly', () => {
      render(<ReadOnlyRow label="Read Label" value="Read Value" />);

      expect(screen.getByText('Read Label')).toBeTruthy();
      expect(screen.getByText('Read Value')).toBeTruthy();
    });

    it('renders a placeholder space when value is missing', () => {
      render(<ReadOnlyRow label="Read Label" />);

      expect(screen.getByText('Read Label')).toBeTruthy();
      // It renders '—' (em dash) for empty values
      expect(screen.getByText('—')).toBeTruthy();
    });
  });
});
