import React from 'react';
import {render, fireEvent, screen} from '@testing-library/react-native';
import {ReminderSection} from '../../../../../../src/features/tasks/screens/AddTaskScreen/components/ReminderSection';
import {mockTheme} from '../../../../../setup/mockTheme';

// --- Mocks ---

// Mock style utils to return predictable style objects for testing
jest.mock('@/shared/utils/formStyles', () => ({
  createFormStyles: jest.fn(() => ({
    toggleSection: {testID: 'toggle-section'},
    toggleLabel: {color: 'black'},
    reminderPillsContainer: {testID: 'pills-container'},
    reminderPill: {backgroundColor: 'grey'},
    reminderPillSelected: {backgroundColor: 'blue'},
    reminderPillText: {color: 'white'},
    reminderPillTextSelected: {color: 'yellow'},
  })),
}));

describe('ReminderSection', () => {
  const mockUpdateField = jest.fn();
  
  const mockOptions = ['5-mins-prior', '1-hour-prior'];

  const defaultProps = {
    formData: {
      reminderEnabled: false,
      reminderOptions: null,
    } as any,
    updateField: mockUpdateField,
    reminderOptions: mockOptions as any[],
    theme: mockTheme,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders basic toggle section correctly (disabled state)', () => {
    render(<ReminderSection {...defaultProps} />);

    expect(screen.getByText('Reminder')).toBeTruthy();
    const switchElement = screen.getByRole('switch');
    expect(switchElement.props.value).toBe(false);

    // Should NOT render options container
    // Note: createFormStyles mock returns 'reminderPillsContainer' as a key,
    // checking if any element with those styles exists or if the pills exist
    expect(screen.queryByText('5-mins-prior')).toBeNull();
  });

  it('calls updateField when switch is toggled', () => {
    render(<ReminderSection {...defaultProps} />);

    const switchElement = screen.getByRole('switch');
    fireEvent(switchElement, 'onValueChange', true);

    expect(mockUpdateField).toHaveBeenCalledWith('reminderEnabled', true);
  });

  it('renders options when enabled', () => {
    const props = {
      ...defaultProps,
      formData: {
        ...defaultProps.formData,
        reminderEnabled: true,
      },
    };

    render(<ReminderSection {...props} />);

    expect(screen.getByText('5-mins-prior')).toBeTruthy();
    expect(screen.getByText('1-hour-prior')).toBeTruthy();
  });

  it('selects an option when clicked (was unselected)', () => {
    const props = {
      ...defaultProps,
      formData: {
        ...defaultProps.formData,
        reminderEnabled: true,
        reminderOptions: null, // No current selection
      },
    };

    render(<ReminderSection {...props} />);

    const optionPill = screen.getByText('5-mins-prior');
    fireEvent.press(optionPill);

    expect(mockUpdateField).toHaveBeenCalledWith(
      'reminderOptions',
      '5-mins-prior',
    );
  });

  it('deselects an option when clicked (was already selected)', () => {
    const props = {
      ...defaultProps,
      formData: {
        ...defaultProps.formData,
        reminderEnabled: true,
        reminderOptions: '5-mins-prior', // Currently selected
      },
    };

    render(<ReminderSection {...props} />);

    const optionPill = screen.getByText('5-mins-prior');
    fireEvent.press(optionPill);

    // Branch: if (isSelected) updateField(..., null)
    expect(mockUpdateField).toHaveBeenCalledWith('reminderOptions', null);
  });

  it('applies correct styles for selected vs unselected options', () => {
    const props = {
      ...defaultProps,
      formData: {
        ...defaultProps.formData,
        reminderEnabled: true,
        reminderOptions: '5-mins-prior', // First option selected
      },
    };

    render(<ReminderSection {...props} />);

    // 1. Verify Selected Item Styles
    const selectedText = screen.getByText('5-mins-prior');

    expect(selectedText.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({color: 'yellow'}), // From mock reminderPillTextSelected
      ]),
    );

    // 2. Verify Unselected Item Styles
    const unselectedText = screen.getByText('1-hour-prior');
    const unselectedPill = unselectedText.parent;

    // Should NOT contain selected style
    expect(unselectedPill?.props.style).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({backgroundColor: 'blue'}),
      ]),
    );
  });
});
