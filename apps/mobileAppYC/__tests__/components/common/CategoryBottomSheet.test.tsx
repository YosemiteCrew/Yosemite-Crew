import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import {
  CategoryBottomSheet,
  type CategoryBottomSheetRef,
} from '@/shared/components/common/CategoryBottomSheet/CategoryBottomSheet';
import type {SelectItem} from '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet';

// --- Mocks ---

// This is the main mock we'll use to spy on the props passed to GenericSelectBottomSheet
const mockGenericSelectBottomSheet = jest.fn();

// Mock functions for the internal BottomSheet ref
const mockOpen = jest.fn();
const mockClose = jest.fn();

// Mock the child GenericSelectBottomSheet
jest.mock(
  '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet',
  () => {
    // Dependencies must be required *inside* the mock factory
    const ReactActual = jest.requireActual('react');
    const {View: RNView} = jest.requireActual('react-native');

    return {
      GenericSelectBottomSheet: ReactActual.forwardRef((props: any, ref: any) => {
        // Expose mock methods for useImperativeHandle
        ReactActual.useImperativeHandle(ref, () => ({
          open: mockOpen,
          close: mockClose,
        }));

        // Call our spy function with the received props
        mockGenericSelectBottomSheet(props);

        // Render a placeholder we can interact with
        return (
          <RNView
            testID="mock-generic-bottom-sheet"
            // Helper to simulate the onSave prop being called
            save={(item: any) => props.onSave(item)}
          />
        );
      }),
    };
  },
);

// --- Test Setup ---

const mockCategories: SelectItem[] = [
  {id: 'admin', label: 'Admin'},
  {id: 'health', label: 'Health'},
  {id: 'hygiene-maintenance', label: 'Hygiene maintenance'},
  {id: 'dietary-plans', label: 'Dietary plans'},
  {id: 'others', label: 'Others'},
];

describe('CategoryBottomSheet', () => {
  const mockOnSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes static props and all categories to GenericSelectBottomSheet', () => {
    render(<CategoryBottomSheet selectedCategory={null} onSave={mockOnSave} />);

    expect(mockGenericSelectBottomSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Select Category',
        items: mockCategories,
        hasSearch: false,
        emptyMessage: 'No categories available',
        mode: 'select',
        snapPoints: ['40%', '40%'],
        maxListHeight: 250,
      }),
    );
  });

  it('correctly maps selectedCategory to selectedItem on initial render', () => {
    render(
      <CategoryBottomSheet selectedCategory="health" onSave={mockOnSave} />,
    );

    expect(mockGenericSelectBottomSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedItem: mockCategories.find(c => c.id === 'health'),
      }),
    );
  });

  it('passes selectedItem as null if selectedCategory is null', () => {
    render(<CategoryBottomSheet selectedCategory={null} onSave={mockOnSave} />);

    expect(mockGenericSelectBottomSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedItem: null,
      }),
    );
  });

  it('passes selectedItem as null if selectedCategory is invalid', () => {
    render(
      <CategoryBottomSheet selectedCategory="invalid-id" onSave={mockOnSave} />,
    );

    expect(mockGenericSelectBottomSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedItem: null,
      }),
    );
  });

  it('calls onSave with the item id when an item is saved', () => {
    const {getByTestId} = render(
      <CategoryBottomSheet selectedCategory={null} onSave={mockOnSave} />,
    );

    const childSheet = getByTestId('mock-generic-bottom-sheet');
    const selectedItem = mockCategories[0]; // 'admin'

    // Wrap state update in act()
    act(() => {
      fireEvent(childSheet, 'save', selectedItem);
    });

    // Expect our component's onSave to be called with just the ID
    expect(mockOnSave).toHaveBeenCalledWith('admin');
  });

  it('calls onSave with null when null is saved', () => {
    const {getByTestId} = render(
      <CategoryBottomSheet selectedCategory="admin" onSave={mockOnSave} />,
    );

    const childSheet = getByTestId('mock-generic-bottom-sheet');
    // Wrap state update in act()
    act(() => {
      fireEvent(childSheet, 'save', null);
    });

    expect(mockOnSave).toHaveBeenCalledWith(null);
  });

  it('exposes an open method via its ref', () => {
    const ref = React.createRef<CategoryBottomSheetRef>();
    render(
      <CategoryBottomSheet
        selectedCategory={null}
        onSave={mockOnSave}
        ref={ref}
      />,
    );

    // Wrap state update in act()
    act(() => {
      ref.current?.open();
    });
    expect(mockOpen).toHaveBeenCalledTimes(1);
  });

  it('exposes a close method via its ref', () => {
    const ref = React.createRef<CategoryBottomSheetRef>();
    render(
      <CategoryBottomSheet
        selectedCategory={null}
        onSave={mockOnSave}
        ref={ref}
      />,
    );

    act(() => {
      ref.current?.close();
    });
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('resets internal state to the prop value when open is called', () => {
    const ref = React.createRef<CategoryBottomSheetRef>();
    // 1. Initial render with "admin"
    const {getByTestId} = render(
      <CategoryBottomSheet
        selectedCategory="admin"
        onSave={mockOnSave}
        ref={ref}
      />,
    );

    // Check initial state
    expect(mockGenericSelectBottomSheet).toHaveBeenLastCalledWith(
      expect.objectContaining({
        selectedItem: mockCategories.find(c => c.id === 'admin'),
      }),
    );

    // 2. Simulate user selecting "health"
    const childSheet = getByTestId('mock-generic-bottom-sheet');
    act(() => {
      fireEvent(
        childSheet,
        'save',
        mockCategories.find(c => c.id === 'health'),
      );
    });

    // Check internal state is now "health"
    expect(mockGenericSelectBottomSheet).toHaveBeenLastCalledWith(
      expect.objectContaining({
        selectedItem: mockCategories.find(c => c.id === 'health'),
      }),
    );
    expect(mockOnSave).toHaveBeenLastCalledWith('health');

    // 3. Call open() - this should reset the state back to the original prop ("admin")
    act(() => {
      ref.current?.open();
    });

    // Check that state was reset
    expect(mockGenericSelectBottomSheet).toHaveBeenLastCalledWith(
      expect.objectContaining({
        selectedItem: mockCategories.find(c => c.id === 'admin'),
      }),
    );
    expect(mockOpen).toHaveBeenCalledTimes(1);
  });

  it('resets internal state to null when open is called and prop is null', () => {
    const ref = React.createRef<CategoryBottomSheetRef>();
    // 1. Initial render with null
    const {getByTestId} = render(
      <CategoryBottomSheet
        selectedCategory={null}
        onSave={mockOnSave}
        ref={ref}
      />,
    );

    expect(mockGenericSelectBottomSheet).toHaveBeenLastCalledWith(
      expect.objectContaining({selectedItem: null}),
    );

    // 2. Simulate user selecting "health"
    const childSheet = getByTestId('mock-generic-bottom-sheet');
    act(() => {
      fireEvent(
        childSheet,
        'save',
        mockCategories.find(c => c.id === 'health'),
      );
    });

    expect(mockGenericSelectBottomSheet).toHaveBeenLastCalledWith(
      expect.objectContaining({
        selectedItem: mockCategories.find(c => c.id === 'health'),
      }),
    );
    expect(mockOnSave).toHaveBeenLastCalledWith('health');

    // 3. Call open() - this should reset the state back to the original prop (null)
    act(() => {
      ref.current?.open();
    });

    // Check that state was reset to null
    expect(mockGenericSelectBottomSheet).toHaveBeenLastCalledWith(
      expect.objectContaining({selectedItem: null}),
    );
    expect(mockOpen).toHaveBeenCalledTimes(1);
  });
});
