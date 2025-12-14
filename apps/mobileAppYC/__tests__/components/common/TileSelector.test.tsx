import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {TileSelector} from '../../../src/shared/components/common/TileSelector/TileSelector';
import {View} from 'react-native';

// --- Mocks ---

// Mock useTheme hook
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        border: 'gray',
        background: 'white',
        primary: 'blue',
        primarySurface: 'lightblue',
        text: 'black',
      },
      spacing: {
        '3': 12,
        '5': 20,
      },
      borderRadius: {
        lg: 8,
      },
      typography: {
        body: {fontSize: 14},
      },
    },
  }),
}));

describe('TileSelector Component', () => {
  const mockOnSelect = jest.fn();
  const options = [
    {value: 'opt1', label: 'Option 1'},
    {value: 'opt2', label: 'Option 2'},
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // 1. Rendering Logic
  // ===========================================================================

  it('renders all options correctly', () => {
    const {getByText} = render(
      <TileSelector
        options={options}
        selectedValue={null}
        onSelect={mockOnSelect}
      />,
    );

    expect(getByText('Option 1')).toBeTruthy();
    expect(getByText('Option 2')).toBeTruthy();
  });

  it('renders empty view if options are empty', () => {
    const {toJSON} = render(
      <TileSelector
        options={[]}
        selectedValue={null}
        onSelect={mockOnSelect}
      />,
    );
    // Should render a View with container style
    expect(toJSON()).toBeTruthy();
  });

  // ===========================================================================
  // 2. Interaction Logic
  // ===========================================================================

  it('calls onSelect with the correct value when an option is pressed', () => {
    const {getByText} = render(
      <TileSelector
        options={options}
        selectedValue={null}
        onSelect={mockOnSelect}
      />,
    );

    fireEvent.press(getByText('Option 1'));
    expect(mockOnSelect).toHaveBeenCalledWith('opt1');

    fireEvent.press(getByText('Option 2'));
    expect(mockOnSelect).toHaveBeenCalledWith('opt2');
  });

  // ===========================================================================
  // 3. Styling Logic
  // ===========================================================================

  it('applies selected styles to the selected item', () => {
    const {getByText} = render(
      <TileSelector
        options={options}
        selectedValue="opt1" // Option 1 is selected
        onSelect={mockOnSelect}
      />,
    );

    const option1Text = getByText('Option 1');
    const option2Text = getByText('Option 2');

    // React Native Testing Library returns the Text component.
    // We check its parent (TouchableOpacity) for tile styles if needed,
    // or check the Text style itself which changes color/weight.

    // Check Text Styles
    // Option 1 (Selected): Should have primary color
    const style1 = option1Text.props.style;
    // Flatten styles to find the selected color (blue)
    const flatStyle1 = [style1].flat();
    expect(flatStyle1).toEqual(
      expect.arrayContaining([
        expect.objectContaining({color: 'blue', fontWeight: '600'}),
      ]),
    );

    // Option 2 (Unselected): Should have text color
    const style2 = option2Text.props.style;
    const flatStyle2 = [style2].flat();
    expect(flatStyle2).toEqual(
      expect.arrayContaining([
        expect.objectContaining({color: 'black', fontWeight: '500'}),
      ]),
    );
  });

  it('applies custom style props if provided', () => {
    // This covers lines passing style, tileStyle, labelStyle, etc.
    const customStyle = {backgroundColor: 'red'};
    const {getByText, UNSAFE_getByType} = render(
      <TileSelector
        options={options}
        selectedValue="opt1"
        onSelect={mockOnSelect}
        style={customStyle}
        tileStyle={{width: 100}}
        selectedTileStyle={{borderColor: 'green'}}
        labelStyle={{fontSize: 20}}
        selectedLabelStyle={{textDecorationLine: 'underline'}}
      />,
    );

    const container = UNSAFE_getByType(View);
    // The container is the first View. Note: RNTL often wraps in a container,
    // so we might need to be specific or use testID if finding by Type is ambiguous.
    // However, the first View inside the render result is usually our component root.
    expect(container.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining(customStyle)]),
    );

    // Check selected item specific styles
    const selectedText = getByText('Option 1');
    const selectedTextStyles = [selectedText.props.style].flat();
    expect(selectedTextStyles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({textDecorationLine: 'underline'}),
      ]),
    );
  });
});
