import React from 'react';
import {Image} from 'react-native';
import {render} from '@testing-library/react-native';
// Path: 6 levels up to project root, then to src
import {
  ViewField,
  ViewTouchField,
} from '../../../../../../src/features/tasks/screens/TaskViewScreen/components/ViewField';

// --- Mocks ---

// 1. Mock Shared Components
// We mock the shared components to verify the props passed to them without testing their internal logic.
const mockInput = jest.fn();
const mockTouchableInput = jest.fn();

jest.mock('@/shared/components/common', () => ({
  Input: (props: any) => {
    mockInput(props);
    const {View, Text} = require('react-native');
    return (
      <View testID="mock-input">
        <Text>{props.label}</Text>
        <Text>{props.value}</Text>
      </View>
    );
  },
  TouchableInput: (props: any) => {
    mockTouchableInput(props);
    const {View, Text} = require('react-native');
    return (
      <View testID="mock-touchable-input">
        <Text>{props.label}</Text>
        <Text>{props.value}</Text>
        {/* Render rightComponent to verify icon presence */}
        {props.rightComponent}
      </View>
    );
  },
}));

describe('ViewField Components', () => {
  beforeEach(() => {
    mockInput.mockClear();
    mockTouchableInput.mockClear();
  });

  describe('ViewField', () => {
    const defaultProps = {
      label: 'Test Label',
      value: 'Test Value',
      fieldGroupStyle: {marginBottom: 10},
      textAreaStyle: {color: 'red'},
    };

    it('renders correctly and passes props to Input', () => {
      const {getByTestId, getByText} = render(<ViewField {...defaultProps} />);

      expect(getByTestId('mock-input')).toBeTruthy();
      expect(getByText('Test Label')).toBeTruthy();
      expect(getByText('Test Value')).toBeTruthy();

      // Verify specific props passed to Input
      expect(mockInput).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Test Label',
          value: 'Test Value',
          editable: false, // Key requirement: should be read-only
          inputStyle: defaultProps.textAreaStyle,
        }),
      );
    });

    it('passes multiline props correctly', () => {
      render(
        <ViewField {...defaultProps} multiline={true} numberOfLines={4} />,
      );

      expect(mockInput).toHaveBeenCalledWith(
        expect.objectContaining({
          multiline: true,
          numberOfLines: 4,
        }),
      );
    });
  });

  describe('ViewTouchField', () => {
    const defaultProps = {
      label: 'Touch Label',
      value: 'Touch Value',
      fieldGroupStyle: {marginBottom: 10},
      iconStyle: {width: 20, height: 20},
    };

    it('renders correctly without icon', () => {
      const {getByTestId, getByText} = render(
        <ViewTouchField {...defaultProps} />,
      );

      expect(getByTestId('mock-touchable-input')).toBeTruthy();
      expect(getByText('Touch Label')).toBeTruthy();
      expect(getByText('Touch Value')).toBeTruthy();

      // Verify props passed to TouchableInput
      expect(mockTouchableInput).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Touch Label',
          value: 'Touch Value',
          rightComponent: undefined, // No icon provided
        }),
      );
    });

    it('renders correctly with icon', () => {
      const mockIconSource = {uri: 'http://example.com/icon.png'};

      const {} = render(
        <ViewTouchField {...defaultProps} icon={mockIconSource} />,
      );

      // Since we render rightComponent in the mock, we can check if the Image was created correctly.
      // However, Image inside React Native might not be easily queryable if standard RNTL mocks are active.
      // We can rely on the mock call arguments instead for precision.

      const lastCall = mockTouchableInput.mock.calls[0][0];
      const rightComponent = lastCall.rightComponent;

      // Verify rightComponent is a React Element (Image)
      expect(React.isValidElement(rightComponent)).toBe(true);
      expect(rightComponent.type).toBe(Image);
      expect(rightComponent.props.source).toEqual(mockIconSource);
      expect(rightComponent.props.style).toEqual(defaultProps.iconStyle);
    });

    it('provides a no-op onPress handler', () => {
      render(<ViewTouchField {...defaultProps} />);

      const lastCall = mockTouchableInput.mock.calls[0][0];
      expect(typeof lastCall.onPress).toBe('function');

      // execute to ensure it doesn't throw
      expect(() => lastCall.onPress()).not.toThrow();
    });
  });
});
