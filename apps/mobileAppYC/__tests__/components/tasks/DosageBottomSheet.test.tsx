import React from 'react';
import {TextInput, Image} from 'react-native';
import {render, fireEvent, act} from '@testing-library/react-native';
import {
  DosageBottomSheet,
  DosageBottomSheetRef,
} from '@/features/tasks/components/DosageBottomSheet/DosageBottomSheet';
import {useTheme} from '@/hooks';

// --- Mocks ---

// Mock Hooks
jest.mock('@/hooks', () => ({
  useTheme: jest.fn(),
}));

// Mock Assets
jest.mock('@/assets/images', () => ({
  Images: {
    clockIcon: {uri: 'clock-icon'},
    deleteIcon: {uri: 'delete-icon'},
    addIcon: {uri: 'add-icon'},
  },
}));

// Mock ConfirmActionBottomSheet
jest.mock(
  '@/shared/components/common/ConfirmActionBottomSheet/ConfirmActionBottomSheet',
  () => {
    const ReactLib = require('react');
    const {
      View: MockView,
      TouchableOpacity: MockTouchableOpacity,
      Text: MockText,
    } = require('react-native');

    return {
      ConfirmActionBottomSheet: ReactLib.forwardRef((props: any, ref: any) => {
        ReactLib.useImperativeHandle(ref, () => ({
          open: jest.fn(),
          close: jest.fn(),
        }));

        return (
          <MockView testID="ConfirmActionBottomSheet">
            {props.children}
            {props.primaryButton && (
              <MockTouchableOpacity
                testID="header-save-btn"
                onPress={props.primaryButton.onPress}>
                <MockText>{props.primaryButton.label}</MockText>
              </MockTouchableOpacity>
            )}
          </MockView>
        );
      }),
    };
  },
);

// Mock SimpleDatePicker
jest.mock(
  '@/shared/components/common/SimpleDatePicker/SimpleDatePicker',
  () => {
    const {
      View: MockView,
      Button: MockButton,
      Text: MockText,
    } = require('react-native');
    return {
      SimpleDatePicker: ({show, onDateChange, onDismiss, value}: any) => {
        if (!show) return null;
        return (
          <MockView testID="SimpleDatePicker">
            <MockText testID="datepicker-value">
              {value ? value.toISOString() : ''}
            </MockText>
            <MockButton
              testID="datepicker-confirm"
              title="Confirm"
              onPress={() => {
                const date = new Date('2025-01-01T15:30:00.000Z');
                onDateChange(date);
                // In real usage, the parent would then set show=false usually, or we simulate dismiss logic here if needed
                onDismiss();
              }}
            />
            <MockButton
              testID="datepicker-dismiss"
              title="Dismiss"
              onPress={onDismiss}
            />
          </MockView>
        );
      },
    };
  },
);

// Mock Input
jest.mock('@/shared/components/common/Input/Input', () => {
  const {
    View: MockView,
    TextInput: MockTextInput,
    Text: MockText,
  } = require('react-native');
  return {
    Input: (props: any) => (
      <MockView testID="MockInput">
        <MockText>{props.label}</MockText>
        <MockTextInput
          testID={
            props.label === 'Dosage'
              ? `input-label-${props.value}`
              : `input-time-${props.value}`
          }
          value={props.value}
          onChangeText={props.onChangeText}
          editable={props.editable}
          placeholder={props.placeholder}
        />
        {props.icon}
      </MockView>
    ),
  };
});

describe('DosageBottomSheet', () => {
  const mockOnSave = jest.fn();
  const mockOnSheetChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useTheme as jest.Mock).mockReturnValue({
      theme: {
        colors: {borderMuted: '#ccc', error: 'red', secondary: 'blue'},
        spacing: {2: 8, 3: 12, 4: 16, 6: 24},
        typography: {button: {fontSize: 16}},
      },
    });
  });

  const setup = (props: any = {}) => {
    const ref = React.createRef<DosageBottomSheetRef>();
    const defaultProps = {
      dosages: [],
      onSave: mockOnSave,
      onSheetChange: mockOnSheetChange,
      ...props,
    };
    const utils = render(<DosageBottomSheet ref={ref} {...defaultProps} />);
    return {...utils, ref};
  };

  it('renders correctly and exposes open/close methods via ref', () => {
    const {ref, getByTestId} = setup();

    expect(getByTestId('ConfirmActionBottomSheet')).toBeTruthy();

    act(() => {
      ref.current?.open();
      ref.current?.close();
    });
  });

  it('synchronizes state when dosages prop changes', () => {
    const {getByTestId, rerender} = setup({
      dosages: [{id: '1', label: 'Initial', time: '2023-01-01T08:00:00.000Z'}],
    });

    expect(getByTestId('input-label-Initial')).toBeTruthy();

    rerender(
      <DosageBottomSheet
        dosages={[
          {id: '2', label: 'Updated', time: '2023-01-01T09:00:00.000Z'},
        ]}
        onSave={mockOnSave}
      />,
    );

    expect(getByTestId('input-label-Updated')).toBeTruthy();
  });

  it('adds a new dosage when Add button is pressed', () => {
    // FIX: Using getByDisplayValue to find the input with the default value
    const {getByText, getAllByTestId, getByDisplayValue} = setup({dosages: []});

    fireEvent.press(getByText('Add'));

    const inputs = getAllByTestId('MockInput');
    expect(inputs.length).toBe(2);

    expect(getByDisplayValue('Dose 1')).toBeTruthy();
  });

  it('removes a dosage when delete button is pressed', () => {
    const {queryByTestId, UNSAFE_getAllByType} = setup({
      dosages: [{id: '1', label: 'ToRemove', time: '2023-01-01T08:00:00.000Z'}],
    });

    expect(queryByTestId('input-label-ToRemove')).toBeTruthy();

    const images = UNSAFE_getAllByType(Image);
    const deleteIcon = images.find(
      img => img.props.source.uri === 'delete-icon',
    );

    // FIX: Added non-null assertion (!) for TS error
    fireEvent.press(deleteIcon!.parent!);

    expect(queryByTestId('input-label-ToRemove')).toBeNull();
  });

  it('updates dosage label when text changes', () => {
    const {getByTestId} = setup({
      dosages: [{id: '1', label: 'OldLabel', time: '2023-01-01T08:00:00.000Z'}],
    });

    const labelInput = getByTestId('input-label-OldLabel');
    fireEvent.changeText(labelInput, 'NewLabel');

    expect(getByTestId('input-label-NewLabel')).toBeTruthy();
  });

  it('opens time picker and updates time on confirm', async () => {
    const initialTime = '2023-01-01T10:00:00.000Z';
    const {getByTestId, queryByTestId, UNSAFE_getAllByType} = setup({
      dosages: [{id: '1', label: 'Dose', time: initialTime}],
    });

    // 1. Open Picker
    const images = UNSAFE_getAllByType(Image);
    const clockIcon = images.find(img => img.props.source.uri === 'clock-icon');

    // FIX: Added non-null assertion (!) for TS error
    fireEvent.press(clockIcon!.parent!);

    expect(getByTestId('SimpleDatePicker')).toBeTruthy();

    // 2. Confirm New Time
    fireEvent.press(getByTestId('datepicker-confirm'));

    // 3. Verify Picker Closed (State update happens inside component)
    expect(queryByTestId('SimpleDatePicker')).toBeNull();

    // 4. Verify Save uses new time
    fireEvent.press(getByTestId('header-save-btn'));
    expect(mockOnSave).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          time: '2025-01-01T15:30:00.000Z',
        }),
      ]),
    );
  });

  it('dismisses time picker without changing time', () => {
    const {getByTestId, queryByTestId, UNSAFE_getAllByType} = setup({
      dosages: [{id: '1', label: 'Dose', time: '2023-01-01T10:00:00.000Z'}],
    });

    const images = UNSAFE_getAllByType(Image);
    const clockIcon = images.find(img => img.props.source.uri === 'clock-icon');

    // FIX: Added non-null assertion (!) for TS error
    fireEvent.press(clockIcon!.parent!);

    expect(getByTestId('SimpleDatePicker')).toBeTruthy();

    fireEvent.press(getByTestId('datepicker-dismiss'));

    expect(queryByTestId('SimpleDatePicker')).toBeNull();
  });

  describe('Data Formatting & Parsing Logic', () => {
    it('handles ISO string format', () => {
      const {UNSAFE_getAllByType, getByTestId} = setup({
        dosages: [{id: '1', label: 'ISO', time: '2023-01-01T13:30:00.000Z'}],
      });

      const inputs = UNSAFE_getAllByType(TextInput);
      const timeInput = inputs[1];
      expect(timeInput.props.value).not.toBe('Invalid time');

      const images = UNSAFE_getAllByType(Image);
      const clockIcon = images.find(
        img => img.props.source.uri === 'clock-icon',
      );

      // FIX: Added non-null assertion (!) for TS error
      fireEvent.press(clockIcon!.parent!);

      const pickerVal = getByTestId('datepicker-value').props.children;
      expect(pickerVal).toContain('2023-01-01T13:30:00.000Z');
    });

    it('handles Time-only string format (HH:mm:ss)', () => {
      const {UNSAFE_getAllByType, getByTestId} = setup({
        dosages: [{id: '1', label: 'TimeOnly', time: '14:30:00'}],
      });

      const inputs = UNSAFE_getAllByType(TextInput);
      const timeInput = inputs[1];
      expect(timeInput.props.value).not.toBe('Invalid time');

      const images = UNSAFE_getAllByType(Image);
      const clockIcon = images.find(
        img => img.props.source.uri === 'clock-icon',
      );

      // FIX: Added non-null assertion (!) for TS error
      fireEvent.press(clockIcon!.parent!);

      const pickerVal = getByTestId('datepicker-value').props.children;
      // Verify it parsed successfully into a Date object (ISO string output)
      expect(pickerVal).toContain('T');
    });

    it('handles Invalid time string', () => {
      const {UNSAFE_getAllByType, getByTestId} = setup({
        dosages: [{id: '1', label: 'Invalid', time: 'not-a-time'}],
      });

      const inputs = UNSAFE_getAllByType(TextInput);
      const timeInput = inputs[1];
      expect(timeInput.props.value).toBe('Invalid time');

      const images = UNSAFE_getAllByType(Image);
      const clockIcon = images.find(
        img => img.props.source.uri === 'clock-icon',
      );

      // FIX: Added non-null assertion (!) for TS error
      fireEvent.press(clockIcon!.parent!);

      const pickerVal = getByTestId('datepicker-value').props.children;
      expect(pickerVal).toBeTruthy();
    });

    it('handles NaN/Corrupt Time-only format', () => {
      const {UNSAFE_getAllByType} = setup({
        dosages: [{id: '1', label: 'Corrupt', time: 'NaN:NaN'}],
      });

      const inputs = UNSAFE_getAllByType(TextInput);
      const timeInput = inputs[1];
      expect(timeInput.props.value).toBe('Invalid time');
    });
  });
});
