// __tests__/components/tasks/ObservationalToolBottomSheet.test.tsx

import React from 'react';
import {render, screen, fireEvent, act} from '@testing-library/react-native';
import {ObservationalToolBottomSheet} from '@/components/tasks/ObservationalToolBottomSheet/ObservationalToolBottomSheet';
import {resolveObservationalToolLabel} from '@/utils/taskLabels';
import type {ObservationalToolBottomSheetRef} from '@/components/tasks/ObservationalToolBottomSheet/ObservationalToolBottomSheet';
import type {ObservationalTool} from '@/features/tasks/types';
import type {
  GenericSelectBottomSheetRef,
  SelectItem,
} from '@/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet';

// --- Mocks ---

jest.mock('@/utils/taskLabels', () => ({
  resolveObservationalToolLabel: jest.fn((tool: string) => `Label for ${tool}`),
}));
const mockResolveLabel = resolveObservationalToolLabel as jest.Mock;

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

    const MockGenericSheet: React.ForwardRefRenderFunction<
      GenericSelectBottomSheetRef,
      any
    > = (props: any, ref: any) => {
      mockOnSaveCallback = props.onSave;

      ReactMock.useImperativeHandle(ref, () => ({
        open: mockInternalSheetRef.open,
        close: mockInternalSheetRef.close,
      }));

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

          <TouchableOpacity
            testID="simulate-save-feline"
            onPress={() =>
              mockOnSaveCallback({
                id: 'feline-grimace-scale',
                label: 'Label for feline-grimace-scale',
              })
            }
          />
          <TouchableOpacity
            testID="simulate-save-null"
            onPress={() => mockOnSaveCallback(null)}
          />
        </View>
      );
    };

    return {GenericSelectBottomSheet: ReactMock.forwardRef(MockGenericSheet)};
  },
);

// --- Helper ---

const mockOnSelect = jest.fn();

const renderComponent = (props: {
  selectedTool?: ObservationalTool | null;
  // FIX: Change to just 'string' to resolve SonarQube warnings
  companionType: string;
}) => {
  const ref = React.createRef<ObservationalToolBottomSheetRef>();
  render(
    <ObservationalToolBottomSheet
      ref={ref}
      selectedTool={props.selectedTool}
      // Cast to the component's expected prop type
      companionType={props.companionType as 'cat' | 'dog' | 'horse'}
      onSelect={mockOnSelect}
    />,
  );
  return {ref, mockOnSelect};
};

// --- Tests ---

describe('ObservationalToolBottomSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders and passes correct static props to GenericSelectBottomSheet', () => {
    renderComponent({companionType: 'cat'});
    expect(screen.getByTestId('mock-generic-sheet')).toBeTruthy();
    expect(screen.getByText('Title: Select observational tool')).toBeTruthy();
    expect(screen.getByText('HasSearch: false')).toBeTruthy();
    expect(screen.getByText('Mode: select')).toBeTruthy();
    expect(
      screen.getByText(
        'EmptyMessage: No observational tools available for this companion',
      ),
    ).toBeTruthy();
  });

  it('filters items for "cat" companion type', () => {
    renderComponent({companionType: 'cat'});
    expect(mockResolveLabel).toHaveBeenCalledWith('feline-grimace-scale');
    expect(mockResolveLabel).not.toHaveBeenCalledWith(
      'canine-acute-pain-scale',
    );
    expect(
      screen.getByText('Items: Label for feline-grimace-scale'),
    ).toBeTruthy();
  });

  it('filters items for "dog" companion type', () => {
    renderComponent({companionType: 'dog'});
    expect(mockResolveLabel).toHaveBeenCalledWith('canine-acute-pain-scale');
    expect(
      screen.getByText('Items: Label for canine-acute-pain-scale'),
    ).toBeTruthy();
  });

  it('filters items for "horse" companion type', () => {
    renderComponent({companionType: 'horse'});
    expect(mockResolveLabel).toHaveBeenCalledWith('equine-grimace-scale');
    expect(
      screen.getByText('Items: Label for equine-grimace-scale'),
    ).toBeTruthy();
  });

  // This test now works with the updated helper type
  it('returns an empty list if companionType is unknown', () => {
    renderComponent({companionType: 'lizard'}); // No 'as any' needed now
    expect(screen.getByText('Items:')).toBeTruthy();
    expect(screen.queryByText(/Label for/)).toBeNull();
  });

  it('passes null as selectedItem when no tool is selected', () => {
    renderComponent({companionType: 'cat', selectedTool: null});
    expect(screen.getByText('Selected: null')).toBeTruthy();
  });

  it('passes the correct selectedItem when a tool is provided', () => {
    renderComponent({
      companionType: 'cat',
      selectedTool: 'feline-grimace-scale',
    });
    expect(screen.getByText('Selected: feline-grimace-scale')).toBeTruthy();
  });

  it('calls onSelect with the item id when handleSave is triggered', () => {
    const {mockOnSelect} = renderComponent({companionType: 'cat'});
    fireEvent.press(screen.getByTestId('simulate-save-feline'));
    expect(mockOnSelect).toHaveBeenCalledWith('feline-grimace-scale');
  });

  it('does not call onSelect when handleSave is triggered with null', () => {
    const {mockOnSelect} = renderComponent({companionType: 'cat'});
    fireEvent.press(screen.getByTestId('simulate-save-null'));
    expect(mockOnSelect).not.toHaveBeenCalled();
  });

  it('exposes and calls open method via ref', () => {
    const {ref} = renderComponent({companionType: 'cat'});
    act(() => {
      ref.current?.open();
    });
    expect(mockInternalSheetRef.open).toHaveBeenCalledTimes(1);
  });

  it('exposes and calls close method via ref', () => {
    const {ref} = renderComponent({companionType: 'cat'});
    act(() => {
      ref.current?.close();
    });
    expect(mockInternalSheetRef.close).toHaveBeenCalledTimes(1);
  });
});
