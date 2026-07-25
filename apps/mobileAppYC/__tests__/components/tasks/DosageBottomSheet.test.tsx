import React from 'react';
import {TextInput, Image} from 'react-native';
import {render, fireEvent, act} from '@testing-library/react-native';
import {
  DosageBottomSheet,
  DosageBottomSheetRef,
} from '@/features/tasks/components/DosageBottomSheet/DosageBottomSheet';
import {useTheme} from '@/hooks';

// --- Mocks ---

// Mock Hooks (hoist-safe + jest.fn so tests can override with mockReturnValue)
jest.mock('@/hooks', () => {
  const {mockTheme: theme} = require('../setup/mockTheme');
  return {
    __esModule: true,
    useTheme: jest.fn(() => ({theme, isDark: false})),
  };
});

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

  it('resets to latest dosages when props change', () => {
    const {getByTestId, rerender, ref} = setup({
      dosages: [{id: '1', label: 'Initial', time: '2023-01-01T08:00:00.000Z'}],
    });

    expect(getByTestId('input-label-Initial')).toBeTruthy();

    rerender(
      <DosageBottomSheet
        ref={ref}
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

  it('exposes button role and label on the "Add" row', () => {
    const {getByLabelText} = setup({dosages: []});
    const addButton = getByLabelText('Add dose');
    expect(addButton.props.accessibilityRole).toBe('button');
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

    expect(deleteIcon!.parent!.props.accessibilityRole).toBe('button');
    expect(deleteIcon!.parent!.props.accessibilityLabel).toBe('Remove dose');

    // FIX: Added non-null assertion (!) for TS error
    fireEvent.press(deleteIcon!.parent!);

    expect(queryByTestId('input-label-ToRemove')).toBeNull();
  });

  it('updates dosage label when text changes, leaving other dosages untouched', () => {
    const {getByTestId} = setup({
      dosages: [
        {id: '1', label: 'OldLabel', time: '2023-01-01T08:00:00.000Z'},
        {id: '2', label: 'OtherDose', time: '2023-01-01T09:00:00.000Z'},
      ],
    });

    const labelInput = getByTestId('input-label-OldLabel');
    fireEvent.changeText(labelInput, 'NewLabel');

    expect(getByTestId('input-label-NewLabel')).toBeTruthy();
    expect(getByTestId('input-label-OtherDose')).toBeTruthy();
  });

  it('opens time picker and updates time on confirm', async () => {
    const initialTime = '2023-01-01T10:00:00.000Z';
    const {getByTestId, queryByTestId, getByLabelText, UNSAFE_getAllByType} =
      setup({
        dosages: [{id: '1', label: 'Dose', time: initialTime}],
      });

    // 1. Open Picker
    const images = UNSAFE_getAllByType(Image);
    const clockIcon = images.find(img => img.props.source.uri === 'clock-icon');

    const timeButton = getByLabelText(/^Time, /);
    expect(timeButton.props.accessibilityRole).toBe('button');

    // FIX: Added non-null assertion (!) for TS error
    fireEvent.press(clockIcon!.parent!);

    expect(getByTestId('SimpleDatePicker')).toBeTruthy();

    // 2. Confirm New Time
    fireEvent.press(getByTestId('datepicker-confirm'));

    // 3. Verify Picker Closed (State update happens inside component)
    expect(queryByTestId('SimpleDatePicker')).toBeNull();

    // 4. Verify Save uses new time
    await act(async () => {
      fireEvent.press(getByTestId('header-save-btn'));
    });

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

    it('handles an ISO-shaped string that parses to an invalid Date', () => {
      const {UNSAFE_getAllByType} = setup({
        dosages: [{id: '1', label: 'BadISO', time: 'not-a-realT-date'}],
      });

      const inputs = UNSAFE_getAllByType(TextInput);
      const timeInput = inputs[1];
      expect(timeInput.props.value).toBe('Invalid time');
    });

    it('handles NaN/Corrupt Time-only format', () => {
      const {UNSAFE_getAllByType} = setup({
        dosages: [{id: '1', label: 'Corrupt', time: 'NaN:NaN'}],
      });

      const inputs = UNSAFE_getAllByType(TextInput);
      const timeInput = inputs[1];
      expect(timeInput.props.value).toBe('Invalid time');
    });

    it('catches a thrown error when the dosage time is not a string and falls back gracefully', () => {
      const {UNSAFE_getAllByType, getByTestId} = setup({
        dosages: [{id: '1', label: 'Broken', time: null as any}],
      });

      const inputs = UNSAFE_getAllByType(TextInput);
      const timeInput = inputs[1];
      expect(timeInput.props.value).toBe('Invalid time');

      const images = UNSAFE_getAllByType(Image);
      const clockIcon = images.find(
        img => img.props.source.uri === 'clock-icon',
      );
      fireEvent.press(clockIcon!.parent!);

      // getDateFromDosageTime also hit its catch and fell back to `new Date()`.
      const pickerVal = getByTestId('datepicker-value').props.children;
      expect(pickerVal).toBeTruthy();
    });
  });

  describe('Save Handling', () => {
    it('ignores a second save press while the first save is still in flight', async () => {
      let resolveSave: () => void = () => {};
      mockOnSave.mockImplementation(
        () =>
          new Promise<void>(resolve => {
            resolveSave = resolve;
          }),
      );
      const {getByTestId} = setup({
        dosages: [{id: '1', label: 'Dose', time: '10:00:00'}],
      });

      const saveButton = getByTestId('header-save-btn');
      await act(async () => {
        fireEvent.press(saveButton);
      });
      await act(async () => {
        fireEvent.press(saveButton);
      });

      expect(mockOnSave).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveSave();
      });
    });

    it('warns and recovers when onSave rejects', async () => {
      mockOnSave.mockRejectedValueOnce(new Error('save failed'));
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const {getByTestId} = setup({
        dosages: [{id: '1', label: 'Dose', time: '10:00:00'}],
      });

      await act(async () => {
        fireEvent.press(getByTestId('header-save-btn'));
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[DosageBottomSheet] Failed to save dosages',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });
});
