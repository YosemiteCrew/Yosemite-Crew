import React from 'react';
import {render} from '@testing-library/react-native';
import {BusinessSearchDropdown} from '@/features/linkedBusinesses/components/BusinessSearchDropdown';

const mockSearchDropdownWithBackdrop = jest.fn();
jest.mock(
  '@/shared/components/common/SearchDropdownOverlay/SearchDropdownWithBackdrop',
  () => {
    const {View} = require('react-native');
    return {
      SearchDropdownWithBackdrop: (props: any) => {
        mockSearchDropdownWithBackdrop(props);
        return <View testID="search-dropdown-with-backdrop" />;
      },
    };
  },
);

describe('BusinessSearchDropdown', () => {
  const item = {id: 'b1', name: 'Vet Clinic', address: '123 Main St'} as any;
  const baseProps = {
    visible: true,
    items: [item],
    onSelect: jest.fn(),
    onDismiss: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders and passes visible, items, onDismiss, and glass config through', () => {
    render(<BusinessSearchDropdown {...baseProps} top={50} maxHeight={300} />);

    expect(mockSearchDropdownWithBackdrop).toHaveBeenCalledWith(
      expect.objectContaining({
        visible: true,
        items: baseProps.items,
        top: 50,
        maxHeight: 300,
        onDismiss: baseProps.onDismiss,
        useGlassCard: true,
        glassEffect: 'regular',
      }),
    );
  });

  it('maps keyExtractor, onPress, title, subtitle, and initials from the item shape', () => {
    render(<BusinessSearchDropdown {...baseProps} />);

    const props = mockSearchDropdownWithBackdrop.mock.calls[0][0];
    expect(props.keyExtractor(item)).toBe('b1');
    expect(props.title(item)).toBe('Vet Clinic');
    expect(props.subtitle(item)).toBe('123 Main St');
    expect(props.initials(item)).toBe('Vet Clinic');

    props.onPress(item);
    expect(baseProps.onSelect).toHaveBeenCalledWith(item);
  });
});
