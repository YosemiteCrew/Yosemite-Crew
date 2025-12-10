import React from 'react';
import {render, act} from '@testing-library/react-native';
// Import View to be used in the mock factory
import GenderBottomSheet, {
  type GenderBottomSheetRef,
} from '@/shared/components/common/GenderBottomSheet/GenderBottomSheet';
// Use aliased path for type import for consistency
import type {
  SelectItem,
} from '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet';
import type {CompanionGender} from '@/features/companion/types';

// --- Mocks ---

const mockSheetOpen = jest.fn();
const mockSheetClose = jest.fn();
const mockChildSheet = jest.fn();
let mockChildOnSave: (item: SelectItem | null) => void;

// Mock the child component
jest.mock(
  '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet',
  () => {
    const ReactActual = jest.requireActual('react');
    // This require() will work because of the global jest.setup.js
    const {View: RNView} = jest.requireActual('react-native');

    // This component is a NAMED export, not default.
    return {
      __esModule: true, // Mark as ES Module
      GenericSelectBottomSheet: ReactActual.forwardRef((props: any, ref: any) => {
        ReactActual.useImperativeHandle(ref, () => ({
          open: mockSheetOpen,
          close: mockSheetClose,
        }));
        // Store the onSave callback to be triggered by tests
        mockChildOnSave = props.onSave;
        // Spy on all props passed to the child
        mockChildSheet(props);
        return <RNView testID="mock-generic-select" />;
      }),
    };
  },
);

// --- Tests ---

describe('GenderBottomSheet', () => {
  const mockOnSave = jest.fn();
  const genderItems: SelectItem[] = [
    {id: 'male', label: 'Male'},
    {id: 'female', label: 'Female'},
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders and passes correct static props to GenericSelectBottomSheet', () => {
    render(<GenderBottomSheet onSave={mockOnSave} />);

    expect(mockChildSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Select Gender',
        items: genderItems,
        selectedItem: null,
        hasSearch: false,
        emptyMessage: 'No gender options available',
        mode: 'select',
        snapPoints: ['30%', '35%'],
        maxListHeight: 300,
      }),
    );
  });

  it('forwards open and close refs', () => {
    const ref = React.createRef<GenderBottomSheetRef>();
    render(<GenderBottomSheet onSave={mockOnSave} ref={ref} />);

    act(() => {
      ref.current?.open();
    });
    expect(mockSheetOpen).toHaveBeenCalledTimes(1);

    act(() => {
      ref.current?.close();
    });
    expect(mockSheetClose).toHaveBeenCalledTimes(1);
  });

  it('calls onSave with the gender ID when an item is selected', () => {
    render(<GenderBottomSheet onSave={mockOnSave} />);

    act(() => {
      mockChildOnSave(genderItems[0]); // Simulate selecting 'Male'
    });

    expect(mockOnSave).toHaveBeenCalledWith('male');
    expect(mockOnSave).toHaveBeenCalledTimes(1);
  });

  it('does not call onSave when selection is null', () => {
    render(<GenderBottomSheet onSave={mockOnSave} />);

    act(() => {
      mockChildOnSave(null); // Simulate pressing save with no selection
    });

    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('correctly calculates selectedItem using "selected" prop', () => {
    render(<GenderBottomSheet onSave={mockOnSave} selected="male" />);

    expect(mockChildSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedItem: genderItems[0], // Male
      }),
    );
  });

  it('correctly calculates selectedItem using "selectedGender" prop', () => {
    render(<GenderBottomSheet onSave={mockOnSave} selectedGender="female" />);

    expect(mockChildSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedItem: genderItems[1], // Female
      }),
    );
  });

  it('prioritizes "selected" prop over "selectedGender" prop', () => {
    render(
      <GenderBottomSheet
        onSave={mockOnSave}
        selected="male"
        selectedGender="female"
      />,
    );

    expect(mockChildSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedItem: genderItems[0], // Male
      }),
    );
  });

  it('passes null as selectedItem when no selection is provided', () => {
    render(<GenderBottomSheet onSave={mockOnSave} />);
    expect(mockChildSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedItem: null,
      }),
    );
  });

  it('passes null as selectedItem when selection is invalid', () => {
    render(
      <GenderBottomSheet
        onSave={mockOnSave}
        selected={'unknown' as CompanionGender}
      />,
    );
    expect(mockChildSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedItem: null,
      }),
    );
  });
});
