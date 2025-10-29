// __tests__/components/tasks/TaskFrequencyBottomSheet.test.tsx

import React from 'react';
import {render, screen, fireEvent, act} from '@testing-library/react-native';
import {TaskFrequencyBottomSheet} from '@/components/tasks/TaskFrequencyBottomSheet/TaskFrequencyBottomSheet';
import {resolveTaskFrequencyLabel} from '@/utils/taskLabels';
import type {TaskFrequencyBottomSheetRef} from '@/components/tasks/TaskFrequencyBottomSheet/TaskFrequencyBottomSheet';
import type {TaskFrequency} from '@/features/tasks/types';
import type {
  GenericSelectBottomSheetRef,
  SelectItem,
} from '@/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet';

// --- Mocks ---

// Mock the task label utility
jest.mock('@/utils/taskLabels', () => ({
  resolveTaskFrequencyLabel: jest.fn((freq: string) => `Label for ${freq}`),
}));
const mockResolveLabel = resolveTaskFrequencyLabel as jest.Mock;

// Mock the child GenericSelectBottomSheet
const mockInternalSheetRef = {
  open: jest.fn(),
  close: jest.fn(),
};
let mockOnSaveCallback: (item: SelectItem | null) => void;

jest.mock(
  '@/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet',
  () => {
    const ReactMock = require('react');
    const {View, Text, TouchableOpacity} = require('react-native');

    // Define the render function with explicit types
    const MockGenericSheet: React.ForwardRefRenderFunction<
      GenericSelectBottomSheetRef,
      any // Props can be 'any' for the mock
    > = (props, ref) => {
      mockOnSaveCallback = props.onSave; // Store the onSave callback

      ReactMock.useImperativeHandle(ref, () => ({
        open: mockInternalSheetRef.open,
        close: mockInternalSheetRef.close,
      }));

      // Render props so we can test them
      return (
        <View testID="mock-generic-sheet">
          <Text>Title: {props.title}</Text>
          <Text>Selected: {props.selectedItem?.id || 'null'}</Text>
          <Text>
            Items: {props.items.map((i: SelectItem) => i.label).join(', ')}
          </Text>
          <Text>HasSearch: {String(props.hasSearch)}</Text>
          <Text>Mode: {props.mode}</Text>
          <Text>EmptyMessage: {props.emptyMessage}</Text>

          {/* Add buttons to simulate interactions */}
          <TouchableOpacity
            testID="simulate-save-daily"
            onPress={() =>
              mockOnSaveCallback({id: 'daily', label: 'Label for daily'})
            }
          />
          <TouchableOpacity
            testID="simulate-save-null"
            onPress={() => mockOnSaveCallback(null)}
          />
        </View>
      );
    };

    // Pass the typed function to forwardRef
    return {GenericSelectBottomSheet: ReactMock.forwardRef(MockGenericSheet)};
  },
);

// --- Helper ---

const mockOnSelect = jest.fn();

const renderComponent = (selectedFrequency: TaskFrequency | null = null) => {
  const ref = React.createRef<TaskFrequencyBottomSheetRef>();
  render(
    <TaskFrequencyBottomSheet
      ref={ref}
      selectedFrequency={selectedFrequency}
      onSelect={mockOnSelect}
    />,
  );
  return {ref, mockOnSelect};
};

// --- Tests ---

describe('TaskFrequencyBottomSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders and passes correct static props to GenericSelectBottomSheet', () => {
    renderComponent();

    expect(screen.getByTestId('mock-generic-sheet')).toBeTruthy();
    expect(screen.getByText('Title: Task frequency')).toBeTruthy();
    expect(screen.getByText('HasSearch: false')).toBeTruthy();
    expect(screen.getByText('Mode: select')).toBeTruthy();
    expect(
      screen.getByText('EmptyMessage: No frequencies available'),
    ).toBeTruthy();
  });

  it('builds and passes frequency items correctly', () => {
    renderComponent();

    // Check that the label resolver was called for each frequency
    expect(mockResolveLabel).toHaveBeenCalledWith('once');
    expect(mockResolveLabel).toHaveBeenCalledWith('daily');
    expect(mockResolveLabel).toHaveBeenCalledWith('every-day');
    expect(mockResolveLabel).toHaveBeenCalledWith('weekly');
    expect(mockResolveLabel).toHaveBeenCalledWith('monthly');

    // Check that the items are passed to the mock
    const expectedLabels = [
      'Label for once',
      'Label for daily',
      'Label for every-day',
      'Label for weekly',
      'Label for monthly',
    ].join(', ');
    expect(screen.getByText(`Items: ${expectedLabels}`)).toBeTruthy();
  });

  it('passes null as selectedItem when no frequency is selected', () => {
    renderComponent(null);
    expect(screen.getByText('Selected: null')).toBeTruthy();
  });

  it('passes the correct selectedItem when a frequency is provided', () => {
    renderComponent('weekly');

    // Check that the label resolver was called an extra time for the selected item
    expect(mockResolveLabel).toHaveBeenCalledWith('weekly');
    expect(screen.getByText('Selected: weekly')).toBeTruthy();
  });

  it('calls onSelect with the item id when handleSave is triggered', () => {
    const {mockOnSelect} = renderComponent();

    fireEvent.press(screen.getByTestId('simulate-save-daily'));

    expect(mockOnSelect).toHaveBeenCalledWith('daily');
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
  });

  it('does not call onSelect when handleSave is triggered with null', () => {
    const {mockOnSelect} = renderComponent();

    fireEvent.press(screen.getByTestId('simulate-save-null'));

    expect(mockOnSelect).not.toHaveBeenCalled();
  });

  it('exposes and calls open method via ref', () => {
    const {ref} = renderComponent();

    act(() => {
      ref.current?.open();
    });

    expect(mockInternalSheetRef.open).toHaveBeenCalledTimes(1);
  });

  it('exposes and calls close method via ref', () => {
    const {ref} = renderComponent();

    act(() => {
      ref.current?.close();
    });

    expect(mockInternalSheetRef.close).toHaveBeenCalledTimes(1);
  });
});
