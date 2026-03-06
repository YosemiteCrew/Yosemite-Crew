import React from 'react';
import {render, act, fireEvent} from '@testing-library/react-native';
// Fix Import Path: 3 levels up (../../../) to reach src from __tests__/components/common/
import {
  SubcategoryBottomSheet,
  SubcategoryBottomSheetRef,
} from '../../../src/shared/components/common/SubcategoryBottomSheet/SubcategoryBottomSheet';

// --- Mocks ---

const mockOpen = jest.fn();
const mockClose = jest.fn();

// Fix Mock Path: 3 levels up (../../../)
jest.mock(
  '../../../src/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet',
  () => {
    // Require React and RN components inside the factory to avoid hoisting issues
    const ReactLib = require('react');
    const {View, Text, Button} = require('react-native');

    return {
      GenericSelectBottomSheet: ReactLib.forwardRef(
        ({title, items, onSave, selectedItem, emptyMessage}: any, ref: any) => {
          ReactLib.useImperativeHandle(ref, () => ({
            open: mockOpen,
            close: mockClose,
          }));

          return (
            <View testID="generic-select-sheet">
              <Text testID="sheet-title">{title}</Text>
              <Text testID="empty-message">{emptyMessage}</Text>
              {items.map((item: any) => (
                <Text key={item.id} testID={`item-${item.id}`}>
                  {item.label}
                </Text>
              ))}
              <Text testID="selected-item">
                {selectedItem ? selectedItem.id : 'none'}
              </Text>
              {/* Mock Buttons to trigger save/clear actions */}
              <Button
                title="Save Item"
                onPress={() => onSave({id: 'test-id', label: 'Test Label'})}
                testID="save-btn"
              />
              <Button
                title="Clear Selection"
                onPress={() => onSave(null)}
                testID="clear-btn"
              />
            </View>
          );
        },
      ),
    };
  },
);

describe('SubcategoryBottomSheet', () => {
  const mockOnSave = jest.fn();
  const ref = React.createRef<SubcategoryBottomSheetRef>();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // 1. Rendering & Data Mapping
  // ===========================================================================

  it('renders correctly with "admin" category items', () => {
    const {getByTestId} = render(
      <SubcategoryBottomSheet
        ref={ref}
        category="admin"
        selectedSubcategory={null}
        onSave={mockOnSave}
      />,
    );

    // Check title formatting: "Admin" -> "Admin\nsub category"
    expect(getByTestId('sheet-title').props.children).toContain('Admin');

    // Check specific items exist
    expect(getByTestId('item-passport')).toBeTruthy();
    expect(getByTestId('item-insurance')).toBeTruthy();
  });

  it('renders correctly with "health" category items', () => {
    const {getByTestId} = render(
      <SubcategoryBottomSheet
        ref={ref}
        category="health"
        selectedSubcategory={null}
        onSave={mockOnSave}
      />,
    );

    expect(getByTestId('item-hospital-visits')).toBeTruthy();
    expect(getByTestId('item-lab-tests')).toBeTruthy();
  });

  it('renders correctly with complex category names ("hygiene-maintenance")', () => {
    const {getByTestId} = render(
      <SubcategoryBottomSheet
        ref={ref}
        category="hygiene-maintenance"
        selectedSubcategory={null}
        onSave={mockOnSave}
      />,
    );

    // Title formatting logic: "Hygiene maintenance"
    const title = getByTestId('sheet-title').props.children;
    expect(title).toMatch(/Hygiene maintenance/i);

    expect(getByTestId('item-grooming-visits')).toBeTruthy();
  });

  it('renders empty list for unknown or null category', () => {
    const {queryByTestId} = render(
      <SubcategoryBottomSheet
        ref={ref}
        category={null}
        selectedSubcategory={null}
        onSave={mockOnSave}
      />,
    );

    // Generic sheet should render, but items shouldn't exist
    expect(queryByTestId('sheet-title')?.props.children).toBe('Sub category');
  });

  it('renders empty list for invalid category key', () => {
    const {queryByTestId} = render(
      <SubcategoryBottomSheet
        ref={ref}
        category="invalid-category"
        selectedSubcategory={null}
        onSave={mockOnSave}
      />,
    );

    // Check that known items are missing
    expect(queryByTestId('item-passport')).toBeNull();
  });

  // ===========================================================================
  // 2. Selection & State
  // ===========================================================================

  it('initializes with a selected subcategory if valid', () => {
    const {getByTestId} = render(
      <SubcategoryBottomSheet
        ref={ref}
        category="admin"
        selectedSubcategory="insurance"
        onSave={mockOnSave}
      />,
    );

    expect(getByTestId('selected-item').props.children).toBe('insurance');
  });

  it('initializes with null if selectedSubcategory does not exist in category', () => {
    const {getByTestId} = render(
      <SubcategoryBottomSheet
        ref={ref}
        category="admin"
        selectedSubcategory="invalid-id"
        onSave={mockOnSave}
      />,
    );

    expect(getByTestId('selected-item').props.children).toBe('none');
  });

  // ===========================================================================
  // 3. Imperative Handle (Open/Close)
  // ===========================================================================

  it('calls open on internal ref when imperative open is called', () => {
    render(
      <SubcategoryBottomSheet
        ref={ref}
        category="admin"
        selectedSubcategory={null}
        onSave={mockOnSave}
      />,
    );

    act(() => {
      ref.current?.open();
    });

    expect(mockOpen).toHaveBeenCalled();
  });

  it('resets internal state on open based on props', () => {
    // 1. Initial Render with NO selection
    const {getByTestId, rerender} = render(
      <SubcategoryBottomSheet
        ref={ref}
        category="admin"
        selectedSubcategory={null}
        onSave={mockOnSave}
      />,
    );
    expect(getByTestId('selected-item').props.children).toBe('none');

    // 2. Update Props to HAVE selection
    rerender(
      <SubcategoryBottomSheet
        ref={ref}
        category="admin"
        selectedSubcategory="passport"
        onSave={mockOnSave}
      />,
    );

    // 3. Call Open -> Should sync state to props
    act(() => {
      ref.current?.open();
    });

    expect(getByTestId('selected-item').props.children).toBe('passport');
  });

  it('calls close on internal ref', () => {
    render(
      <SubcategoryBottomSheet
        ref={ref}
        category="admin"
        selectedSubcategory={null}
        onSave={mockOnSave}
      />,
    );

    act(() => {
      ref.current?.close();
    });

    expect(mockClose).toHaveBeenCalled();
  });

  // ===========================================================================
  // 4. Interactions (Save)
  // ===========================================================================

  it('calls onSave with item ID when saved', () => {
    const {getByTestId} = render(
      <SubcategoryBottomSheet
        ref={ref}
        category="admin"
        selectedSubcategory={null}
        onSave={mockOnSave}
      />,
    );

    const saveBtn = getByTestId('save-btn');

    fireEvent.press(saveBtn);

    // Our mock button sends {id: 'test-id'}
    expect(mockOnSave).toHaveBeenCalledWith('test-id');
  });

  it('calls onSave with null when cleared', () => {
    const {getByTestId} = render(
      <SubcategoryBottomSheet
        ref={ref}
        category="admin"
        selectedSubcategory={null}
        onSave={mockOnSave}
      />,
    );

    const clearBtn = getByTestId('clear-btn');

    fireEvent.press(clearBtn);

    expect(mockOnSave).toHaveBeenCalledWith(null);
  });
});
