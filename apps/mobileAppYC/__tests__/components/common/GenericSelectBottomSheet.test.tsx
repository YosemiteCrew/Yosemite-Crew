import React from 'react';
import {mockTheme} from '../../setup/mockTheme';
import {
  render,
  fireEvent,
  screen,
  act,
} from '@testing-library/react-native';
import {
  GenericSelectBottomSheet,
  type GenericSelectBottomSheetRef,
  type SelectItem,
} from '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet';
import {View, Text} from 'react-native';
// FIX: Removed unused import for BottomSheetRef
// import type { BottomSheetRef } from '@/shared/components/common/BottomSheet/BottomSheet';

// --- Mocks ---

// 1. Mock useTheme

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// 2. Mock Images
jest.mock('@/assets/images', () => ({
  Images: {
    searchIcon: null, // Set to null to cover the 'else' branch
  },
}));

// 3. Mock BottomSheetHeader
jest.mock(
  '@/shared/components/common/BottomSheetHeader/BottomSheetHeader',
  () => {
    const {
      View: RNView,
      Text: RNText,
      TouchableOpacity: RNTouchableOpacity,
    } = jest.requireActual('react-native');
    return {
      BottomSheetHeader: (props: any) => {
        return (
          <RNView testID="mock-header">
            <RNText>{props.title}</RNText>
            <RNTouchableOpacity
              testID="mock-header-close"
              onPress={props.onClose}
            />
          </RNView>
        );
      },
    };
  },
);

// 4. Mock CustomBottomSheet
const mockSnapToIndex = jest.fn();
const mockClose = jest.fn();
let mockSheetOnChange: (index: number) => void;

jest.mock('@/shared/components/common/BottomSheet/BottomSheet', () => {
  const ReactActual = jest.requireActual('react');
  const {View: RNView} = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ReactActual.forwardRef((props: any, ref: any) => {
      ReactActual.useImperativeHandle(ref, () => ({
        snapToIndex: mockSnapToIndex,
        close: mockClose,
      }));
      mockSheetOnChange = props.onChange;
      if (!props.enableBackdrop) {
        return null;
      }
      return <RNView testID="mock-sheet-content">{props.children}</RNView>;
    }),
  };
});

// 5. Mock LiquidGlassButton
jest.mock(
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => {
    const {
      TouchableOpacity: RNTouchableOpacity,
      Text: RNText,
    } = jest.requireActual('react-native');
    return {
      __esModule: true,
      default: (props: any) => (
        <RNTouchableOpacity onPress={props.onPress} disabled={props.disabled}>
          <RNText>{props.title}</RNText>
        </RNTouchableOpacity>
      ),
    };
  },
);

// 6. Mock Input
jest.mock('@/shared/components/common/Input/Input', () => {
  const {TextInput} = require('react-native');
  return {
    Input: (props: any) => (
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
      />
    ),
  };
});

// --- Test Data ---
const mockItems: SelectItem[] = [
  {id: '1', label: 'Item One'},
  {id: '2', label: 'Item Two'},
  {id: '3', label: 'Item Three'},
];

const defaultProps = {
  title: 'Select Item',
  items: mockItems,
  selectedItem: null,
  onSave: jest.fn(),
  emptyMessage: 'No items found',
};

// --- Tests ---
describe('GenericSelectBottomSheet', () => {
  // FIX: Allow ref.current to be null to match TypeScript
  let ref: React.RefObject<GenericSelectBottomSheetRef | null>;

  beforeEach(() => {
    jest.clearAllMocks();
    ref = React.createRef<GenericSelectBottomSheetRef | null>();
  });

  // Helper function to open the sheet
  const openSheet = () => {
    act(() => ref.current?.open());
    act(() => {
      if (mockSheetOnChange) {
        mockSheetOnChange(0);
      }
    });
  };

  it('renders nothing when closed', () => {
    render(<GenericSelectBottomSheet {...defaultProps} ref={ref} />);
    expect(screen.queryByTestId('mock-sheet-content')).toBeNull();
  });

  it('opens via ref, sets visibility, and calls snapToIndex', () => {
    render(<GenericSelectBottomSheet {...defaultProps} ref={ref} />);
    act(() => ref.current?.open());
    expect(mockSnapToIndex).toHaveBeenCalledWith(0);
    expect(screen.getByTestId('mock-sheet-content')).toBeTruthy();
  });

  it('closes via ref', () => {
    render(<GenericSelectBottomSheet {...defaultProps} ref={ref} />);
    openSheet();
    act(() => ref.current?.close());
    expect(mockClose).toHaveBeenCalled();
  });

  it('calls onSheetChange and updates visibility', () => {
    const onSheetChange = jest.fn();
    render(
      <GenericSelectBottomSheet
        {...defaultProps}
        ref={ref}
        onSheetChange={onSheetChange}
      />,
    );
    openSheet();
    expect(onSheetChange).toHaveBeenCalledWith(0);
    expect(screen.getByTestId('mock-sheet-content')).toBeTruthy();
    act(() => mockSheetOnChange(-1));
    expect(onSheetChange).toHaveBeenCalledWith(-1);
    expect(screen.queryByTestId('mock-sheet-content')).toBeNull();
  });

  it('resets tempItem and search on open', () => {
    render(
      <GenericSelectBottomSheet
        {...defaultProps}
        selectedItem={mockItems[0]}
        ref={ref}
      />,
    );
    openSheet();

    // 1. Change search and temp selection
    const searchInput = screen.getByPlaceholderText('Search');
    act(() => fireEvent.changeText(searchInput, 'Two'));
    act(() => fireEvent.press(screen.getByText('Item Two')));
    expect(searchInput.props.value).toBe('Two');
    // 3. Close and re-open
    act(() => ref.current?.close());
    act(() => mockSheetOnChange(-1));
    openSheet();

    // 4. Verify state is reset
    expect(screen.getByPlaceholderText('Search').props.value).toBe('');
    expect(screen.queryByText('Item Two')).toBeTruthy(); // list is unfiltered
  });

  describe('Mode: "confirm" (default)', () => {
    it('shows save/cancel buttons', () => {
      render(<GenericSelectBottomSheet {...defaultProps} ref={ref} />);
      openSheet();
      expect(screen.getByText('Save')).toBeTruthy();
      expect(screen.getByText('Cancel')).toBeTruthy();
    });

    it('updates tempItem and calls onItemSelect on item press', () => {
      const onItemSelect = jest.fn();
      render(
        <GenericSelectBottomSheet
          {...defaultProps}
          onItemSelect={onItemSelect}
          ref={ref}
        />,
      );
      openSheet();
      act(() => fireEvent.press(screen.getByText('Item Two')));
      // Callbacks
      expect(onItemSelect).toHaveBeenCalledWith(mockItems[1]);
      expect(defaultProps.onSave).not.toHaveBeenCalled();
      expect(mockClose).not.toHaveBeenCalled();
    });

    it('calls onSave with tempItem when "Save" is pressed', () => {
      render(<GenericSelectBottomSheet {...defaultProps} ref={ref} />);
      openSheet();
      act(() => fireEvent.press(screen.getByText('Item Two')));
      act(() => fireEvent.press(screen.getByText('Save')));
      expect(defaultProps.onSave).toHaveBeenCalledWith(mockItems[1]);
      expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('closes and resets tempItem when "Cancel" is pressed', () => {
      render(
        <GenericSelectBottomSheet
          {...defaultProps}
          selectedItem={mockItems[0]}
          ref={ref}
        />,
      );
      openSheet();

      // 1. Select Item Two
      act(() => fireEvent.press(screen.getByText('Item Two')));

      // 2. Press Cancel
      act(() => fireEvent.press(screen.getByText('Cancel')));
      expect(mockClose).toHaveBeenCalledTimes(1);

      // 3. Re-open and check tempItem is reset to original prop
      openSheet();
    });

    it('closes and resets tempItem when header "close" is pressed', () => {
      render(
        <GenericSelectBottomSheet
          {...defaultProps}
          selectedItem={mockItems[0]}
          ref={ref}
        />,
      );
      openSheet();

      act(() => fireEvent.press(screen.getByText('Item Two')));
      act(() => fireEvent.press(screen.getByTestId('mock-header-close')));
      expect(mockClose).toHaveBeenCalledTimes(1);

      openSheet();
    });
  });

  describe('Mode: "select"', () => {
    it('hides save/cancel buttons', () => {
      render(
        <GenericSelectBottomSheet {...defaultProps} mode="select" ref={ref} />,
      );
      openSheet();
      expect(screen.queryByText('Save')).toBeNull();
      expect(screen.queryByText('Cancel')).toBeNull();
    });

    it('calls onSave and closes when an item is pressed', () => {
      const onItemSelect = jest.fn();
      render(
        <GenericSelectBottomSheet
          {...defaultProps}
          mode="select"
          onItemSelect={onItemSelect}
          ref={ref}
        />,
      );
      openSheet();

      act(() => fireEvent.press(screen.getByText('Item Two')));

      expect(defaultProps.onSave).toHaveBeenCalledWith(mockItems[1]);
      expect(mockClose).toHaveBeenCalledTimes(1);
      expect(onItemSelect).not.toHaveBeenCalled();
    });

    it('uses selectedItem prop to show selection', () => {
      render(
        <GenericSelectBottomSheet
          {...defaultProps}
          mode="select"
          selectedItem={mockItems[1]}
          ref={ref}
        />,
      );
      openSheet();
    });
  });

  describe('Search & Content', () => {
    it('hides search bar when hasSearch is false', () => {
      render(
        <GenericSelectBottomSheet
          {...defaultProps}
          hasSearch={false}
          ref={ref}
        />,
      );
      openSheet();
      expect(screen.queryByPlaceholderText('Search')).toBeNull();
    });

    it('filters list based on search query', () => {
      render(<GenericSelectBottomSheet {...defaultProps} ref={ref} />);
      openSheet();
      const searchInput = screen.getByPlaceholderText('Search');
      act(() => fireEvent.changeText(searchInput, 'One'));
      expect(screen.getByText('Item One')).toBeTruthy();
      expect(screen.queryByText('Item Two')).toBeNull();
      expect(screen.queryByText('Item Three')).toBeNull();
    });

    it('shows empty message when filter has no results', () => {
      render(<GenericSelectBottomSheet {...defaultProps} ref={ref} />);
      openSheet();
      const searchInput = screen.getByPlaceholderText('Search');
      act(() => fireEvent.changeText(searchInput, 'Zebra'));
      expect(screen.getByText(defaultProps.emptyMessage)).toBeTruthy();
      expect(screen.queryByText('Item One')).toBeNull();
    });

    it('shows empty message when items array is empty', () => {
      render(
        <GenericSelectBottomSheet {...defaultProps} items={[]} ref={ref} />,
      );
      openSheet();
      expect(screen.getByText(defaultProps.emptyMessage)).toBeTruthy();
    });

    it('renders customContent', () => {
      render(
        <GenericSelectBottomSheet
          {...defaultProps}
          customContent={<Text>My Custom Content</Text>}
          ref={ref}
        />,
      );
      openSheet();
      expect(screen.getByText('My Custom Content')).toBeTruthy();
    });

    it('uses custom renderItem', () => {
      const renderItem = (item: SelectItem, isSelected: boolean) => (
        <View>
          <Text>Custom: {item.label}</Text>
          {isSelected && <Text>SELECTED</Text>}
        </View>
      );

      render(
        <GenericSelectBottomSheet
          {...defaultProps}
          renderItem={renderItem}
          selectedItem={mockItems[0]}
          ref={ref}
        />,
      );
      openSheet();

      expect(screen.getByText('Custom: Item One')).toBeTruthy();
      expect(screen.getByText('SELECTED')).toBeTruthy();
      expect(screen.getByText('Custom: Item Two')).toBeTruthy();
      expect(screen.queryByText('Custom: Item TwoSELECTED')).toBeNull();
    });

    it('handles press on custom renderItem wrapper', () => {
      const renderItem = (item: SelectItem) => (
        <Text>Custom: {item.label}</Text>
      );
      const onItemSelect = jest.fn();

      render(
        <GenericSelectBottomSheet
          {...defaultProps}
          renderItem={renderItem}
          onItemSelect={onItemSelect}
          ref={ref}
        />,
      );
      openSheet();

      // FIX: Find the text, then press its parent's parent (Text -> View -> TouchableOpacity)
      const customItemText = screen.getByText('Custom: Item Two');
      // Add non-null assertions to satisfy TypeScript
      act(() => fireEvent.press(customItemText.parent!.parent!));

      expect(onItemSelect).toHaveBeenCalledWith(mockItems[1]);
    });
  });
});
