import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react-native';
import {TaskFormFooter} from '@/features/tasks/components/form/TaskFormFooter';

// --- Mocks ---

// Mock the LiquidGlassButton
jest.mock(
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => {
    // Must require dependencies inside the mock factory due to Jest hoisting
    const {TouchableOpacity, Text} = require('react-native');

    // Create a mock component that simulates the real one's behavior
    const MockLiquidGlassButton = ({
      title,
      onPress,
      loading,
      disabled,
      ...props
    }: any) => (
      <TouchableOpacity
        testID="mock-liquid-glass-button"
        onPress={onPress}
        disabled={loading || disabled}
        {...props}>
        <Text>{title}</Text>
      </TouchableOpacity>
    );
    return {
      __esModule: true,
      default: jest.fn(MockLiquidGlassButton), // Mock the default export
    };
  },
);

// Get a typed reference to the mock
const MockLiquidGlassButton =
  require('@/shared/components/common/LiquidGlassButton/LiquidGlassButton')
    .default as jest.Mock;

// --- Test Setup ---

const mockOnSave = jest.fn();
const mockStyles = {
  footer: {padding: 10},
  saveButton: {height: 56},
  saveButtonText: {fontSize: 18},
};
const mockTheme = {
  colors: {
    secondary: 'blue',
    borderMuted: 'grey',
  },
};

const renderComponent = (
  props: Partial<React.ComponentProps<typeof TaskFormFooter>>,
) => {
  const defaultProps: React.ComponentProps<typeof TaskFormFooter> = {
    loading: false,
    disabled: false,
    onSave: mockOnSave,
    styles: mockStyles,
    theme: mockTheme,
  };
  return render(<TaskFormFooter {...defaultProps} {...props} />);
};

describe('TaskFormFooter', () => {
  beforeEach(() => {
    // Clear all mock calls before each test
    jest.clearAllMocks();
    MockLiquidGlassButton.mockClear();
  });

  it('renders the button with the default "Save" text', () => {
    renderComponent({});

    // Check that the button is rendered with the default text
    expect(screen.getByText('Save')).toBeTruthy();

    // Check the props passed to the mock button
    const buttonProps = MockLiquidGlassButton.mock.calls[0][0];
    expect(buttonProps.title).toBe('Save');
    expect(buttonProps.loading).toBe(false);
    expect(buttonProps.disabled).toBe(false);
  });

  it('renders the button with custom saveButtonText', () => {
    renderComponent({saveButtonText: 'Submit Task'});

    expect(screen.getByText('Submit Task')).toBeTruthy();

    const buttonProps = MockLiquidGlassButton.mock.calls[0][0];
    expect(buttonProps.title).toBe('Submit Task');
  });

  it('renders "Saving..." text and passes loading prop when loading is true', () => {
    renderComponent({loading: true, saveButtonText: 'Should Not See This'});

    expect(screen.getByText('Saving...')).toBeTruthy();

    const buttonProps = MockLiquidGlassButton.mock.calls[0][0];
    expect(buttonProps.title).toBe('Saving...');
    expect(buttonProps.loading).toBe(true);
  });

  it('passes the disabled prop to the button', () => {
    renderComponent({disabled: true});

    const buttonProps = MockLiquidGlassButton.mock.calls[0][0];
    expect(buttonProps.disabled).toBe(true);
  });

  it('calls onSave when the button is pressed', () => {
    renderComponent({});

    const button = screen.getByTestId('mock-liquid-glass-button');
    fireEvent.press(button);

    expect(mockOnSave).toHaveBeenCalledTimes(1);
  });

  it('passes all styling and theme props correctly to the button', () => {
    renderComponent({});

    const buttonProps = MockLiquidGlassButton.mock.calls[0][0];

    expect(buttonProps.style).toBe(mockStyles.saveButton);
    expect(buttonProps.textStyle).toBe(mockStyles.saveButtonText);
    expect(buttonProps.tintColor).toBe(mockTheme.colors.secondary);
    expect(buttonProps.borderColor).toBe(mockTheme.colors.borderMuted);

    // Check static props
    expect(buttonProps.forceBorder).toBe(true);
    expect(buttonProps.shadowIntensity).toBe('medium');
    expect(buttonProps.height).toBe(56);
    expect(buttonProps.borderRadius).toBe(16);
  });
});
