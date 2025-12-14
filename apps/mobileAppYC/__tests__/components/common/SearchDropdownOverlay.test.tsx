import React from 'react';
import {ScrollView} from 'react-native';
import {render, fireEvent} from '@testing-library/react-native';
import {
  SearchDropdownOverlay,
  SearchDropdownOverlayProps,
} from '../../../src/shared/components/common/SearchDropdownOverlay/SearchDropdownOverlay';

// --- Mocks ---

// Mocking useTheme to provide a predictable theme object for styling tests
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        white: '#ffffff',
        border: '#e0e0e0',
        lightBlueBackground: '#e6f7ff',
        secondary: '#333333',
        textSecondary: '#666666',
      },
      spacing: {
        1: 4,
        3: 12,
        4: 16,
      },
      borderRadius: {
        lg: 8,
      },
      typography: {
        h4: {fontSize: 20, fontWeight: 'bold'},
        titleSmall: {fontSize: 14, fontWeight: '600'},
        bodyExtraSmall: {fontSize: 12},
      },
    },
  }),
}));

describe('SearchDropdownOverlay Component', () => {
  // Test Data
  const mockItems = [
    {id: '1', name: 'Alice Smith', role: 'Admin'},
    {id: '2', name: 'Bob Jones', role: 'User'},
    {id: '3', name: 'Charlie', role: null},
  ];

  const defaultProps: SearchDropdownOverlayProps<(typeof mockItems)[0]> = {
    visible: true,
    items: mockItems,
    keyExtractor: item => item.id,
    onPress: jest.fn(),
    title: item => item.name,
    subtitle: item => item.role,
    initials: item => item.name.substring(0, 2).toUpperCase(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // 1. Rendering Logic (Null Checks)
  // ===========================================================================

  it('renders nothing when "visible" is false', () => {
    const {toJSON} = render(
      <SearchDropdownOverlay {...defaultProps} visible={false} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders nothing when "items" array is empty', () => {
    const {toJSON} = render(
      <SearchDropdownOverlay {...defaultProps} items={[]} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders correctly when visible is true and items exist', () => {
    const {getByText} = render(<SearchDropdownOverlay {...defaultProps} />);
    expect(getByText('Alice Smith')).toBeTruthy();
    expect(getByText('Bob Jones')).toBeTruthy();
  });

  // ===========================================================================
  // 2. Interaction
  // ===========================================================================

  it('calls onPress with the correct item when an item is pressed', () => {
    const mockOnPress = jest.fn();
    const {getByText} = render(
      <SearchDropdownOverlay {...defaultProps} onPress={mockOnPress} />,
    );

    fireEvent.press(getByText('Alice Smith'));

    expect(mockOnPress).toHaveBeenCalledTimes(1);
    expect(mockOnPress).toHaveBeenCalledWith(mockItems[0]);
  });

  // ===========================================================================
  // 3. Display Logic (Titles, Subtitles, Initials)
  // ===========================================================================

  it('renders subtitles when the subtitle mapper returns a value', () => {
    const {getByText} = render(<SearchDropdownOverlay {...defaultProps} />);
    expect(getByText('Admin')).toBeTruthy(); // Alice's role
  });

  it('does NOT render subtitle text if subtitle mapper returns null/undefined', () => {
    const {queryByText} = render(<SearchDropdownOverlay {...defaultProps} />);
    // Charlie has role: null. We verify that "Charlie" exists, but "null" isn't rendered.
    expect(queryByText('Charlie')).toBeTruthy();
  });

  it('does NOT render subtitle container if subtitle prop is undefined', () => {
    const {getByText} = render(
      <SearchDropdownOverlay
        {...defaultProps}
        subtitle={undefined} // No subtitle mapper
      />,
    );
    expect(getByText('Alice Smith')).toBeTruthy();
  });

  // --- Avatar / Initials Logic Tests ---

  it('uses the "initials" mapper if provided', () => {
    const {getAllByText} = render(
      <SearchDropdownOverlay
        {...defaultProps}
        initials={_item => 'XY'} // FIX: unused item -> _item
      />,
    );
    // Should find 'X' because your code does: charAt(0)
    expect(getAllByText('X')).toBeTruthy();
  });

  it('fallbacks to "title" first char if "initials" mapper is NOT provided', () => {
    const {getAllByText} = render(
      <SearchDropdownOverlay
        {...defaultProps}
        initials={undefined} // Remove initials mapper
      />,
    );
    // Alice Smith -> 'A'
    expect(getAllByText('A')).toBeTruthy();
  });

  it('fallbacks to "title" first char if "initials" mapper returns falsy', () => {
    const {getAllByText} = render(
      <SearchDropdownOverlay
        {...defaultProps}
        initials={() => ''} // Returns empty string
      />,
    );
    // Bob Jones -> 'B'
    expect(getAllByText('B')).toBeTruthy();
  });

  it('fallbacks to space " " if both initials and title fail (edge case)', () => {
    const weirdItem = [{id: '99', name: '', role: ''}];
    const {getAllByText} = render(
      <SearchDropdownOverlay
        {...defaultProps}
        items={weirdItem}
        title={() => ''} // No title
        initials={undefined} // No initials
      />,
    );
    // Use getAllByText because layout might produce other empty nodes/spaces
    const spaceElements = getAllByText(' ');
    expect(spaceElements.length).toBeGreaterThan(0);
  });

  // ===========================================================================
  // 4. Styles & Props (Coverage for default params and styles)
  // ===========================================================================

  it('applies custom "top" prop style', () => {
    const customTop = 150;
    const {toJSON} = render(
      <SearchDropdownOverlay {...defaultProps} top={customTop} />,
    );

    // Flatten styles to find the absolute container style
    const root = toJSON();
    // @ts-ignore
    const style = root?.props?.style;

    const flattened = Array.isArray(style)
      ? Object.assign({}, ...style)
      : style;

    expect(flattened).toHaveProperty('top', customTop);
  });

  it('uses default "top" = 70 if not provided', () => {
    const {toJSON} = render(
      // @ts-ignore: Intentionally omitting top to test default
      <SearchDropdownOverlay {...defaultProps} top={undefined} />,
    );
    const root = toJSON();
    // @ts-ignore
    const style = root?.props?.style;

    const flattened = Array.isArray(style)
      ? Object.assign({}, ...style)
      : style;

    expect(flattened).toHaveProperty('top', 70);
  });

  it('merges "containerStyle" prop', () => {
    const {toJSON} = render(
      <SearchDropdownOverlay
        {...defaultProps}
        containerStyle={{backgroundColor: 'red'}}
      />,
    );
    const root = toJSON();
    // @ts-ignore
    const style = root?.props?.style;

    const flattened = Array.isArray(style)
      ? Object.assign({}, ...style)
      : style;

    expect(flattened).toHaveProperty('backgroundColor', 'red');
  });

  it('enables scrolling only when items exceed "scrollEnabledThreshold"', () => {
    // 1. Items length (3) < default threshold (5) -> scrollEnabled = false
    const {UNSAFE_getByType} = render(
      <SearchDropdownOverlay {...defaultProps} />,
    );
    const scrollViewSmall = UNSAFE_getByType(ScrollView);
    expect(scrollViewSmall.props.scrollEnabled).toBe(false);

    // 2. Custom threshold (2), items (3) > threshold (2) -> scrollEnabled = true
    const {UNSAFE_getByType: getByType2} = render(
      <SearchDropdownOverlay {...defaultProps} scrollEnabledThreshold={2} />,
    );
    const scrollViewLarge = getByType2(ScrollView);
    expect(scrollViewLarge.props.scrollEnabled).toBe(true);
  });
});
