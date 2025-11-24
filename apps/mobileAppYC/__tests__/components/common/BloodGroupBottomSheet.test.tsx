import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {
  BloodGroupBottomSheet,
  type BloodGroupBottomSheetRef,
} from '@/shared/components/common/BloodGroupBottomSheet/BloodGroupBottomSheet';

// --- Mocks ---

// 1. Create the mock function that will be asserted against
const mockGenericSelectBottomSheet = jest.fn();

// 2. Mock the child GenericSelectBottomSheet
const mockOpen = jest.fn();
const mockClose = jest.fn();

jest.mock(
  '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet',
  () => {
    const React = require('react');
    const {View} = require('react-native');

    return {
      GenericSelectBottomSheet: React.forwardRef((props: any, ref: any) => {
        // Expose the mock open/close functions via useImperativeHandle
        React.useImperativeHandle(ref, () => ({
          open: mockOpen,
          close: mockClose,
        }));

        // Call the external mock function so we can track its calls
        mockGenericSelectBottomSheet(props);

        // Render a placeholder
        return (
          <View
            testID="mock-generic-bottom-sheet"
            // Helper to test onSave
            save={(item: any) => props.onSave(item)}
          />
        );
      }),
    };
  },
);

// --- Tests ---

describe('BloodGroupBottomSheet', () => {
  const mockOnSave = jest.fn();

  beforeEach(() => {
    // Clear all mock implementations and calls before each test
    jest.clearAllMocks();
  });

  it('renders and passes correct hardcoded props to GenericSelectBottomSheet', () => {
    render(
      <BloodGroupBottomSheet
        category="cat"
        selectedBloodGroup="A"
        onSave={mockOnSave}
      />,
    );

    // Check that the child component was called with the correct static props
    expect(mockGenericSelectBottomSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Select blood group',
        hasSearch: false,
        emptyMessage: 'Please select a companion category first',
        mode: 'select',
        snapPoints: ['45%', '45%'],
        maxListHeight: 300,
      }),
    );
  });

  it('provides an empty array of items if category is null', () => {
    render(
      <BloodGroupBottomSheet
        category={null}
        selectedBloodGroup={null}
        onSave={mockOnSave}
      />,
    );

    // Check that items is an empty array
    expect(mockGenericSelectBottomSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [],
      }),
    );
  });

  it('provides correct blood group items for "cat"', () => {
    render(
      <BloodGroupBottomSheet
        category="cat"
        selectedBloodGroup={null}
        onSave={mockOnSave}
      />,
    );

    const expectedItems = [
      {id: 'A', label: 'A'},
      {id: 'B', label: 'B'},
      {id: 'AB', label: 'AB'},
      {id: 'Unknown', label: 'Unknown'},
    ];

    expect(mockGenericSelectBottomSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expectedItems,
      }),
    );
  });

  it('provides correct blood group items for "dog"', () => {
    render(
      <BloodGroupBottomSheet
        category="dog"
        selectedBloodGroup={null}
        onSave={mockOnSave}
      />,
    );

    const expectedItems = [
      {id: 'DEA 1.1 Positive', label: 'DEA 1.1 Positive'},
      {id: 'DEA 1.1 Negative', label: 'DEA 1.1 Negative'},
      {id: 'DEA 1.2 Positive', label: 'DEA 1.2 Positive'},
      {id: 'DEA 1.2 Negative', label: 'DEA 1.2 Negative'},
      {id: 'DEA 3 Positive', label: 'DEA 3 Positive'},
      {id: 'DEA 3 Negative', label: 'DEA 3 Negative'},
      {id: 'DEA 4 Positive', label: 'DEA 4 Positive'},
      {id: 'DEA 4 Negative', label: 'DEA 4 Negative'},
      {id: 'DEA 5 Positive', label: 'DEA 5 Positive'},
      {id: 'DEA 5 Negative', label: 'DEA 5 Negative'},
      {id: 'DEA 7 Positive', label: 'DEA 7 Positive'},
      {id: 'DEA 7 Negative', label: 'DEA 7 Negative'},
      {id: 'Universal Donor', label: 'Universal Donor'},
      {id: 'Unknown', label: 'Unknown'},
    ];

    expect(mockGenericSelectBottomSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expectedItems,
      }),
    );
  });

  it('provides correct blood group items for "horse"', () => {
    render(
      <BloodGroupBottomSheet
        category="horse"
        selectedBloodGroup={null}
        onSave={mockOnSave}
      />,
    );

    const expectedItems = [
      {id: 'Aa', label: 'Aa'},
      {id: 'Ca', label: 'Ca'},
      {id: 'Da', label: 'Da'},
      {id: 'Ka', label: 'Ka'},
      {id: 'Pa', label: 'Pa'},
      {id: 'Qa', label: 'Qa'},
      {id: 'Ua', label: 'Ua'},
      {id: 'Universal Donor', label: 'Universal Donor'},
      {id: 'Unknown', label: 'Unknown'},
    ];

    expect(mockGenericSelectBottomSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expectedItems,
      }),
    );
  });

  it('passes the correct selectedItem object when a blood group is selected', () => {
    render(
      <BloodGroupBottomSheet
        category="cat"
        selectedBloodGroup="AB"
        onSave={mockOnSave}
      />,
    );

    expect(mockGenericSelectBottomSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedItem: {id: 'AB', label: 'AB'},
      }),
    );
  });

  it('passes null for selectedItem when no blood group is selected', () => {
    render(
      <BloodGroupBottomSheet
        category="cat"
        selectedBloodGroup={null}
        onSave={mockOnSave}
      />,
    );

    expect(mockGenericSelectBottomSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedItem: null,
      }),
    );
  });

  it('calls onSave with the item id when the child onSave is triggered', () => {
    const {getByTestId} = render(
      <BloodGroupBottomSheet
        category="cat"
        selectedBloodGroup={null}
        onSave={mockOnSave}
      />,
    );

    const mockChildSheet = getByTestId('mock-generic-bottom-sheet');
    const selectedItem = {id: 'B', label: 'B'};

    // Simulate the child component calling its onSave prop
    fireEvent(mockChildSheet, 'save', selectedItem);

    // Expect our component's onSave to be called with just the ID
    expect(mockOnSave).toHaveBeenCalledWith('B');
  });

  it('calls onSave with null when the child onSave is triggered with null', () => {
    const {getByTestId} = render(
      <BloodGroupBottomSheet
        category="cat"
        selectedBloodGroup="A"
        onSave={mockOnSave}
      />,
    );

    const mockChildSheet = getByTestId('mock-generic-bottom-sheet');

    // Simulate the child component calling its onSave prop with null
    fireEvent(mockChildSheet, 'save', null);

    // Expect our component's onSave to be called with null
    expect(mockOnSave).toHaveBeenCalledWith(null);
  });

  it('exposes an open method via its ref', () => {
    const ref = React.createRef<BloodGroupBottomSheetRef>();
    render(
      <BloodGroupBottomSheet
        category="cat"
        selectedBloodGroup={null}
        onSave={mockOnSave}
        ref={ref}
      />,
    );

    // Call the imperative handle method
    ref.current?.open();

    // Check that the child's mock method was called
    expect(mockOpen).toHaveBeenCalledTimes(1);
  });

  it('exposes a close method via its ref', () => {
    const ref = React.createRef<BloodGroupBottomSheetRef>();
    render(
      <BloodGroupBottomSheet
        category="cat"
        selectedBloodGroup={null}
        onSave={mockOnSave}
        ref={ref}
      />,
    );

    // Call the imperative handle method
    ref.current?.close();

    // Check that the child's mock method was called
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
