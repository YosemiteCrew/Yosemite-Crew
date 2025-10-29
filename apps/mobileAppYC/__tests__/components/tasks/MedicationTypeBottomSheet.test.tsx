// __tests__/components/tasks/MedicationTypeBottomSheet.test.tsx

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { MedicationTypeBottomSheet } from '@/components/tasks/MedicationTypeBottomSheet/MedicationTypeBottomSheet';
import { resolveMedicationTypeLabel } from '@/utils/taskLabels';
import type { MedicationTypeBottomSheetRef } from '@/components/tasks/MedicationTypeBottomSheet/MedicationTypeBottomSheet';
import type { MedicationType } from '@/features/tasks/types';
import type { GenericSelectBottomSheetRef, SelectItem } from '@/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet';


jest.mock('@/utils/taskLabels', () => ({
  resolveMedicationTypeLabel: jest.fn((type: string) => `Label for ${type}`),
}));
const mockResolveLabel = resolveMedicationTypeLabel as jest.Mock;

const mockInternalSheetRef = {
  open: jest.fn(),
  close: jest.fn(),
};
let mockOnSaveCallback: (item: SelectItem | null) => void;

jest.mock('@/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet', () => {
  const ReactMock = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');

  const MockGenericSheet: React.ForwardRefRenderFunction<
    GenericSelectBottomSheetRef,
    any
  > = (props, ref) => {
    mockOnSaveCallback = props.onSave;

    ReactMock.useImperativeHandle(ref, () => ({
      open: mockInternalSheetRef.open,
      close: mockInternalSheetRef.close,
    }));

    return (
      <View testID="mock-generic-sheet">
        <Text>Title: {props.title}</Text>
        <Text>Selected: {props.selectedItem?.id || 'null'}</Text>
        <Text>Items: {props.items.map((i: SelectItem) => i.label).join(', ')}</Text>
        <Text>HasSearch: {String(props.hasSearch)}</Text>
        <Text>Mode: {props.mode}</Text>

        {/* Add buttons to simulate interactions */}
        <TouchableOpacity
          testID="simulate-save-injection"
          onPress={() => mockOnSaveCallback({ id: 'injection', label: 'Label for injection' })}
        />
        <TouchableOpacity
          testID="simulate-save-null"
          onPress={() => mockOnSaveCallback(null)}
        />
      </View>
    );
  };

  return { GenericSelectBottomSheet: ReactMock.forwardRef(MockGenericSheet) };
});


const mockOnSelect = jest.fn();

const renderComponent = (
  selectedType: MedicationType | null = null,
) => {
  const ref = React.createRef<MedicationTypeBottomSheetRef>();
  render(
    <MedicationTypeBottomSheet
      ref={ref}
      selectedType={selectedType}
      onSelect={mockOnSelect}
    />,
  );
  return { ref, mockOnSelect };
};


describe('MedicationTypeBottomSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders and passes correct static props to GenericSelectBottomSheet', () => {
    renderComponent();

    expect(screen.getByTestId('mock-generic-sheet')).toBeTruthy();
    expect(screen.getByText('Title: Medication type')).toBeTruthy();
    expect(screen.getByText('HasSearch: true')).toBeTruthy(); // Different from the last component
    expect(screen.getByText('Mode: select')).toBeTruthy();
  });

  it('builds and passes medication type items correctly', () => {
    renderComponent();

    expect(mockResolveLabel).toHaveBeenCalledWith('tablets-pills');
    expect(mockResolveLabel).toHaveBeenCalledWith('capsule');
    expect(mockResolveLabel).toHaveBeenCalledWith('liquids');
    expect(mockResolveLabel).toHaveBeenCalledWith('sprinkle-capsules');

    const expectedLabels = [
      'Label for tablets-pills',
      'Label for capsule',
      'Label for liquids',
      'Label for topical-medicine',
      'Label for injection',
      'Label for inhales',
      'Label for patches',
      'Label for suppositories',
      'Label for sprinkle-capsules',
    ].join(', ');
    expect(screen.getByText(`Items: ${expectedLabels}`)).toBeTruthy();
  });

  it('passes null as selectedItem when no type is selected', () => {
    renderComponent(null);
    expect(screen.getByText('Selected: null')).toBeTruthy();
  });

  it('passes the correct selectedItem when a type is provided', () => {
    renderComponent('injection');

    expect(mockResolveLabel).toHaveBeenCalledWith('injection');
    expect(screen.getByText('Selected: injection')).toBeTruthy();
  });

  it('calls onSelect with the item id when handleSave is triggered', () => {
    const { mockOnSelect } = renderComponent();

    fireEvent.press(screen.getByTestId('simulate-save-injection'));

    expect(mockOnSelect).toHaveBeenCalledWith('injection');
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
  });

  it('does not call onSelect when handleSave is triggered with null', () => {
    const { mockOnSelect } = renderComponent();

    fireEvent.press(screen.getByTestId('simulate-save-null'));

    expect(mockOnSelect).not.toHaveBeenCalled();
  });

  it('exposes and calls open method via ref', () => {
    const { ref } = renderComponent();

    act(() => {
      ref.current?.open();
    });

    expect(mockInternalSheetRef.open).toHaveBeenCalledTimes(1);
  });

  it('exposes and calls close method via ref', () => {
    const { ref } = renderComponent();

    act(() => {
      ref.current?.close();
    });

    expect(mockInternalSheetRef.close).toHaveBeenCalledTimes(1);
  });
});