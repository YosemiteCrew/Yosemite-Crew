import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {
  VisitTypeBottomSheet,
  VisitTypeBottomSheetRef,
} from '../../../src/shared/components/common/VisitTypeBottomSheet/VisitTypeBottomSheet';

jest.mock(
  '../../../src/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet',
  () => {
    const ReactLib = require('react');
    const {View: RNView, Button: RNButton} = require('react-native');

    return {
      GenericSelectBottomSheet: ReactLib.forwardRef((props: any, ref: any) => {
        // Expose imperative methods to the parent (VisitTypeBottomSheet)
        ReactLib.useImperativeHandle(ref, () => ({
          open: jest.fn(),
          close: jest.fn(),
        }));

        return (
          <RNView testID="generic-select-sheet">
            {/* Helper to verify selected item prop */}
            <RNView testID="selected-label">
              {props.selectedItem ? props.selectedItem.label : 'None'}
            </RNView>

            {/* Helper button to trigger onSave with a specific item */}
            <RNButton
              testID="trigger-save-hospital"
              title="Save Hospital"
              onPress={() => props.onSave({id: 'hospital', label: 'Hospital'})}
            />

            {/* Helper button to trigger onSave with null (clearing selection) */}
            <RNButton
              testID="trigger-save-null"
              title="Clear Selection"
              onPress={() => props.onSave(null)}
            />
          </RNView>
        );
      }),
    };
  },
);

describe('VisitTypeBottomSheet Component', () => {
  const mockOnSave = jest.fn();
  let ref: React.RefObject<VisitTypeBottomSheetRef | null>;

  beforeEach(() => {
    jest.clearAllMocks();
    ref = React.createRef();
  });

  // ===========================================================================
  // 1. Rendering & Initialization
  // ===========================================================================

  it('renders correctly', () => {
    const {getByTestId} = render(
      <VisitTypeBottomSheet
        ref={ref}
        selectedVisitType={null}
        onSave={mockOnSave}
      />,
    );
    expect(getByTestId('generic-select-sheet')).toBeTruthy();
  });

  it('initializes state with the correct selected item based on ID', () => {
    const {getByTestId} = render(
      <VisitTypeBottomSheet
        ref={ref}
        selectedVisitType="groomer"
        onSave={mockOnSave}
      />,
    );
    // The mock renders the selected label. "groomer" -> "Groomer"
    expect(getByTestId('selected-label').props.children).toBe('Groomer');
  });

  it('initializes state with null if ID is not found or null', () => {
    const {getByTestId} = render(
      <VisitTypeBottomSheet
        ref={ref}
        selectedVisitType="invalid-id"
        onSave={mockOnSave}
      />,
    );
    expect(getByTestId('selected-label').props.children).toBe('None');
  });

  // ===========================================================================
  // 2. Ref Methods (Open/Close) & State Reset
  // ===========================================================================

  it('calls internal close when close() is called via ref', () => {
    render(
      <VisitTypeBottomSheet
        ref={ref}
        selectedVisitType={null}
        onSave={mockOnSave}
      />,
    );

    // Ensure ref is populated and call close
    expect(ref.current).not.toBeNull();
    expect(() => ref.current?.close()).not.toThrow();
  });

  it('resets internal state based on props when open() is called via ref', async () => {
    const {getByTestId, rerender} = render(
      <VisitTypeBottomSheet
        ref={ref}
        selectedVisitType="boarder"
        onSave={mockOnSave}
      />,
    );

    // Initial check
    expect(getByTestId('selected-label').props.children).toBe('Boarder');

    // Change prop but don't re-mount fully (simulate parent state change)
    rerender(
      <VisitTypeBottomSheet
        ref={ref}
        selectedVisitType="shop"
        onSave={mockOnSave}
      />,
    );

    // Call open - this should trigger setTempVisitType(VISIT_TYPES.find...)
    // Since this triggers a state update, we wait for the UI to update
    ref.current?.open();

    await waitFor(() => {
      expect(getByTestId('selected-label').props.children).toBe('Shop');
    });
  });

  it('resets internal state to null when open() is called with invalid/null prop', async () => {
    const {getByTestId, rerender} = render(
      <VisitTypeBottomSheet
        ref={ref}
        selectedVisitType="hospital"
        onSave={mockOnSave}
      />,
    );

    // Initially Hospital
    expect(getByTestId('selected-label').props.children).toBe('Hospital');

    // Rerender with null
    rerender(
      <VisitTypeBottomSheet
        ref={ref}
        selectedVisitType={null}
        onSave={mockOnSave}
      />,
    );

    ref.current?.open();

    await waitFor(() => {
      expect(getByTestId('selected-label').props.children).toBe('None');
    });
  });

  // ===========================================================================
  // 3. Interaction (Saving)
  // ===========================================================================

  it('calls onSave with correct ID when an item is selected', () => {
    const {getByTestId} = render(
      <VisitTypeBottomSheet
        ref={ref}
        selectedVisitType={null}
        onSave={mockOnSave}
      />,
    );

    fireEvent.press(getByTestId('trigger-save-hospital'));

    expect(mockOnSave).toHaveBeenCalledTimes(1);
    expect(mockOnSave).toHaveBeenCalledWith('hospital');
  });

  it('calls onSave with null when selection is cleared', () => {
    const {getByTestId} = render(
      <VisitTypeBottomSheet
        ref={ref}
        selectedVisitType="hospital"
        onSave={mockOnSave}
      />,
    );

    fireEvent.press(getByTestId('trigger-save-null'));

    expect(mockOnSave).toHaveBeenCalledTimes(1);
    expect(mockOnSave).toHaveBeenCalledWith(null);
  });
});
