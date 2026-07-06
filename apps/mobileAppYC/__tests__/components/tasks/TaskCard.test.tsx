/**
 * TaskCard — full coverage test suite
 *
 * Targets 90%+ coverage across:
 *  • calculateNearestDosageTime (future, past-wrap, invalid, empty)
 *  • formattedTime (valid, invalid, missing)
 *  • formattedNearestDosage (valid, invalid)
 *  • observationalToolLabel (hex-id fallback, known label, non-OT)
 *  • useEffect OT fetch (already resolved, API success, API throws)
 *  • renderTaskDetails (medication, OT, hygiene, dietary, no match, undefined)
 *  • avatar logic (URI vs placeholder, with/without assignee)
 *  • status badges (completed, pending, cancelled)
 *  • showCompleteButton + completeButtonVariant (liquid-glass, CardActionButton variants)
 *  • handleCompletePress (OT task vs regular)
 *  • SwipeableActionCard passthrough props
 */

import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react-native';
import {TaskCard} from '@/features/tasks/components/TaskCard/TaskCard';
import type {TaskCardProps} from '@/features/tasks/components/TaskCard/TaskCard';
import {formatDateForDisplay} from '@/shared/components/common/SimpleDatePicker/dateTimeFormat';
import {createCardStyles} from '@/shared/components/common/cardStyles';
import {normalizeImageUri} from '@/shared/utils/imageUri';
import {resolveObservationalToolLabel} from '@/features/tasks/utils/taskLabels';
import {observationToolApi} from '@/features/observationalTools/services/observationToolService';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        secondary: 'purple',
        textSecondary: 'gray',
        successSurface: 'lightgreen',
        success: 'green',
        warningSurface: 'lightyellow',
        warning: 'orange',
        errorSurface: 'lightsalmon',
        error: 'red',
        borderMuted: 'lightgray',
        white: 'white',
      },
      spacing: {
        '1': 4,
        '2': 8,
        '2.5': 10,
        '3': 12,
        '4': 16,
        '12': 48,
        '14': 56,
        '18': 72,
      },
      borderRadius: {full: 9999, md: 8},
      typography: {
        h6Clash: {fontSize: 14, fontWeight: '600'},
        bodySmall: {fontSize: 12},
        labelSmall: {fontSize: 11},
        button: {fontSize: 14},
      },
    },
    isDark: false,
  }),
}));

jest.mock('@/shared/components/common/SimpleDatePicker/dateTimeFormat', () => ({
  formatDateForDisplay: jest.fn(() => 'Oct 29, 2025'),
}));

jest.mock('@/shared/components/common/cardStyles', () => ({
  createCardStyles: jest.fn(() => ({card: {}, fallback: {}})),
}));

jest.mock('@/shared/utils/imageUri', () => ({
  normalizeImageUri: jest.fn((uri: string | undefined) => uri ?? null),
}));

jest.mock('@/features/tasks/utils/taskLabels', () => ({
  resolveObservationalToolLabel: jest.fn((raw: string) => raw),
}));

jest.mock(
  '@/features/observationalTools/services/observationToolService',
  () => ({
    observationToolApi: {get: jest.fn()},
  }),
);

jest.mock(
  '@/shared/components/common/SwipeableActionCard/SwipeableActionCard',
  () => ({
    SwipeableActionCard: jest.fn(({children, ...props}) => {
      const {View} = require('react-native');
      return (
        <View testID="mock-swipe-card" {...props}>
          {children}
        </View>
      );
    }),
  }),
);

jest.mock(
  '@/shared/components/common/CardActionButton/CardActionButton',
  () => ({
    CardActionButton: jest.fn(({label, onPress, variant}) => {
      const {TouchableOpacity, Text} = require('react-native');
      return (
        <TouchableOpacity
          testID={`mock-action-button-${variant ?? 'default'}`}
          onPress={onPress}>
          <Text>{label}</Text>
        </TouchableOpacity>
      );
    }),
  }),
);

jest.mock(
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => ({
    LiquidGlassButton: jest.fn(({title, onPress}) => {
      const {TouchableOpacity, Text} = require('react-native');
      return (
        <TouchableOpacity testID="mock-liquid-glass-button" onPress={onPress}>
          <Text>{title}</Text>
        </TouchableOpacity>
      );
    }),
  }),
);

jest.mock('@/shared/components/common/AvatarGroup/AvatarGroup', () => ({
  AvatarGroup: jest.fn(({avatars}) => {
    const {View} = require('react-native');
    return <View testID="mock-avatar-group" avatars={avatars} />;
  }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockNormalizeImageUri = normalizeImageUri as jest.Mock;
const mockResolveOtLabel = resolveObservationalToolLabel as jest.Mock;
const mockObservationToolGet = observationToolApi.get as jest.Mock;

const baseProps: TaskCardProps = {
  title: 'Morning Walk',
  categoryLabel: 'General',
  date: '2025-10-29T10:00:00.000Z',
  companionName: 'Buddy',
  status: 'pending',
  category: 'general',
};

const renderCard = (props: Partial<TaskCardProps> = {}) =>
  render(<TaskCard {...baseProps} {...props} />);

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('TaskCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNormalizeImageUri.mockImplementation(
      (uri: string | undefined) => uri ?? null,
    );
    mockResolveOtLabel.mockImplementation((raw: string) => raw);
    mockObservationToolGet.mockResolvedValue(null);
    (formatDateForDisplay as jest.Mock).mockReturnValue('Oct 29, 2025');
    (createCardStyles as jest.Mock).mockReturnValue({card: {}, fallback: {}});
  });

  // -------------------------------------------------------------------------
  // Basic rendering
  // -------------------------------------------------------------------------

  describe('Rendering — core content', () => {
    it('renders title, companion name and formatted date', () => {
      renderCard();
      expect(screen.getByText('Morning Walk')).toBeTruthy();
      expect(screen.getByText('Buddy')).toBeTruthy();
      expect(screen.getByText(/Oct 29, 2025/)).toBeTruthy();
    });

    it('falls back to raw date string when formatDateForDisplay throws', () => {
      (formatDateForDisplay as jest.Mock).mockImplementation(() => {
        throw new Error('bad date');
      });
      renderCard({date: '2025-10-29T10:00:00.000Z'});
      expect(screen.getByText(/2025-10-29/)).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Status badges
  // -------------------------------------------------------------------------

  describe('Status badges', () => {
    it('shows Completed badge for COMPLETED status', () => {
      renderCard({status: 'completed'});
      expect(screen.getByText('Completed')).toBeTruthy();
      expect(screen.queryByText('Pending')).toBeNull();
      expect(screen.queryByText('Cancelled')).toBeNull();
    });

    it('shows Pending badge for PENDING status', () => {
      renderCard({status: 'pending'});
      expect(screen.getByText('Pending')).toBeTruthy();
      expect(screen.queryByText('Completed')).toBeNull();
    });

    it('shows Cancelled badge for CANCELLED status (lowercase)', () => {
      renderCard({status: 'cancelled'});
      expect(screen.getByText('Cancelled')).toBeTruthy();
      expect(screen.queryByText('Pending')).toBeNull();
    });

    it('shows Cancelled badge for CANCELLED status (uppercase)', () => {
      renderCard({status: 'CANCELLED' as any});
      expect(screen.getByText('Cancelled')).toBeTruthy();
    });

    it('shows no badge for unknown status', () => {
      renderCard({status: 'unknown' as any});
      expect(screen.queryByText('Completed')).toBeNull();
      expect(screen.queryByText('Pending')).toBeNull();
      expect(screen.queryByText('Cancelled')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Time formatting
  // -------------------------------------------------------------------------

  describe('formattedTime', () => {
    it('formats 24h time to 12h display', () => {
      renderCard({time: '14:30:00'});
      expect(screen.getByText('Oct 29, 2025 - 2:30 PM')).toBeTruthy();
    });

    it('formats time without seconds', () => {
      renderCard({time: '09:05'});
      expect(screen.getByText(/9:05 AM/)).toBeTruthy();
    });

    it('returns original string when hours are NaN', () => {
      renderCard({time: 'bad:30'});
      expect(screen.getByText(/Oct 29, 2025 - bad:30/)).toBeTruthy();
    });

    it('returns original string when time format cannot be split', () => {
      renderCard({time: 'invalid-time-string'});
      expect(screen.getByText(/invalid-time-string/)).toBeTruthy();
    });

    it('shows no time suffix when time is undefined', () => {
      renderCard({time: undefined});
      expect(screen.getByText('Oct 29, 2025')).toBeTruthy();
    });

    it('shows no time suffix when time is empty string', () => {
      renderCard({time: ''});
      expect(screen.getByText('Oct 29, 2025')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // calculateNearestDosageTime + formattedNearestDosage
  // -------------------------------------------------------------------------

  describe('Medication nearest dosage time', () => {
    const medicationProps: Partial<TaskCardProps> = {
      category: 'health',
      details: {
        taskType: 'give-medication',
        medicineName: 'Apoquel',
        medicineType: 'Tablet',
      },
    };

    it('displays nearest future dosage time', () => {
      // Use a time well in the future (23:59) so it is always "upcoming today"
      renderCard({
        ...medicationProps,
        details: {
          ...medicationProps.details,
          dosages: [{time: '23:59', dosage: '1', label: '1 tab'}],
        },
      });
      expect(screen.getByText(/11:59 PM/)).toBeTruthy();
    });

    it('falls back to earliest dosage when all dosages are in the past', () => {
      // 00:01 is always in the past
      renderCard({
        ...medicationProps,
        details: {
          ...medicationProps.details,
          dosages: [
            {time: '00:01', dosage: '1', label: 'early tab'},
            {time: '00:02', dosage: '2', label: 'later tab'},
          ],
        },
      });
      // Should display 12:01 AM (the earliest)
      expect(screen.getByText(/12:01 AM/)).toBeTruthy();
    });

    it('handles empty dosages array gracefully (no time appended)', () => {
      renderCard({
        ...medicationProps,
        details: {
          ...medicationProps.details,
          dosages: [],
        },
      });
      // With no dosages nearestDosageTime is null → task time is used (none provided)
      expect(screen.getByText('Oct 29, 2025')).toBeTruthy();
    });

    it('handles null dosages gracefully', () => {
      renderCard({
        ...medicationProps,
        details: {
          ...medicationProps.details,
          dosages: null,
        },
      });
      expect(screen.getByText('Oct 29, 2025')).toBeTruthy();
    });

    it('skips invalid dosage time entries', () => {
      // One invalid, one valid future entry
      renderCard({
        ...medicationProps,
        details: {
          ...medicationProps.details,
          dosages: [
            {time: 'bad:time', dosage: '1', label: 'skip'},
            {time: '23:59', dosage: '1', label: 'valid'},
          ],
        },
      });
      expect(screen.getByText(/11:59 PM/)).toBeTruthy();
    });

    it('returns null (no time) when all dosage entries have invalid times', () => {
      renderCard({
        ...medicationProps,
        details: {
          ...medicationProps.details,
          dosages: [{time: 'bad:time', dosage: '1', label: 'skip'}],
        },
      });
      expect(screen.getByText('Oct 29, 2025')).toBeTruthy();
    });

    it('does not display dosage time for non-medication health tasks', () => {
      renderCard({
        category: 'health',
        details: {taskType: 'take-observational-tool', toolType: 'Pain Score'},
        time: '09:00:00',
      });
      // Should show task time, not dosage time
      expect(screen.getByText(/9:00 AM/)).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // observationalToolLabel (sync resolution)
  // -------------------------------------------------------------------------

  describe('observationalToolLabel — sync resolution', () => {
    it('shows the resolved label when resolveObservationalToolLabel returns a name', () => {
      mockResolveOtLabel.mockReturnValue('Pain Score');
      renderCard({
        category: 'health',
        details: {taskType: 'take-observational-tool', toolType: 'pain-score'},
      });
      expect(screen.getByText('📋 Tool: Pain Score')).toBeTruthy();
    });

    it('shows "Observational tool" when resolved value looks like a Mongo ID', () => {
      mockResolveOtLabel.mockReturnValue('507f1f77bcf86cd799439011');
      renderCard({
        category: 'health',
        details: {
          taskType: 'take-observational-tool',
          toolType: '507f1f77bcf86cd799439011',
        },
      });
      // The hex-id branch sets observationalToolLabel to 'Observational tool'
      // which triggers the API fetch path; API returns null so label stays
      expect(screen.getByText(/Observational tool/)).toBeTruthy();
    });

    it('returns null for non-OT health task', () => {
      renderCard({
        category: 'health',
        details: {
          taskType: 'give-medication',
          medicineName: 'X',
          medicineType: 'Y',
        },
      });
      expect(screen.queryByText(/📋/)).toBeNull();
    });

    it('returns null for non-health category', () => {
      renderCard({category: 'general', details: undefined});
      expect(screen.queryByText(/📋/)).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // useEffect — async OT label fetch
  // -------------------------------------------------------------------------

  describe('useEffect — OT label async fetch', () => {
    it('updates label from API when initial label is a hex ID', async () => {
      mockResolveOtLabel.mockReturnValue('507f1f77bcf86cd799439011');
      mockObservationToolGet.mockResolvedValue({name: 'Blood Pressure'});

      renderCard({
        category: 'health',
        details: {
          taskType: 'take-observational-tool',
          toolType: '507f1f77bcf86cd799439011',
        },
      });

      await waitFor(() => {
        expect(screen.getByText('📋 Tool: Blood Pressure')).toBeTruthy();
      });
    });

    it('keeps "Observational tool" fallback when API returns null', async () => {
      mockResolveOtLabel.mockReturnValue('507f1f77bcf86cd799439011');
      mockObservationToolGet.mockResolvedValue(null);

      renderCard({
        category: 'health',
        details: {
          taskType: 'take-observational-tool',
          toolType: '507f1f77bcf86cd799439011',
        },
      });

      await waitFor(() => {
        expect(screen.getByText('📋 Tool: Observational tool')).toBeTruthy();
      });
    });

    it('keeps "Observational tool" fallback when API throws', async () => {
      mockResolveOtLabel.mockReturnValue('507f1f77bcf86cd799439011');
      mockObservationToolGet.mockRejectedValue(new Error('network'));

      renderCard({
        category: 'health',
        details: {
          taskType: 'take-observational-tool',
          toolType: '507f1f77bcf86cd799439011',
        },
      });

      await waitFor(() => {
        expect(screen.getByText('📋 Tool: Observational tool')).toBeTruthy();
      });
    });

    it('skips API fetch when label is already resolved (not a hex ID)', async () => {
      mockResolveOtLabel.mockReturnValue('Pain Score');
      mockObservationToolGet.mockResolvedValue({name: 'Should Not Be Used'});

      renderCard({
        category: 'health',
        details: {taskType: 'take-observational-tool', toolType: 'pain-score'},
      });

      await waitFor(() => {
        expect(screen.getByText('📋 Tool: Pain Score')).toBeTruthy();
      });
      expect(mockObservationToolGet).not.toHaveBeenCalled();
    });

    it('does not run fetch when category is not health', async () => {
      renderCard({category: 'general', details: undefined});
      // Give any pending microtasks a tick
      await act(async () => {});
      expect(mockObservationToolGet).not.toHaveBeenCalled();
    });

    it('does not run fetch when taskType is not take-observational-tool', async () => {
      renderCard({
        category: 'health',
        details: {
          taskType: 'give-medication',
          medicineName: 'X',
          medicineType: 'Y',
        },
      });
      await act(async () => {});
      expect(mockObservationToolGet).not.toHaveBeenCalled();
    });

    it('does not run fetch when toolType is falsy', async () => {
      mockResolveOtLabel.mockReturnValue('Observational tool');
      renderCard({
        category: 'health',
        details: {taskType: 'take-observational-tool', toolType: ''},
      });
      await act(async () => {});
      expect(mockObservationToolGet).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // renderTaskDetails
  // -------------------------------------------------------------------------

  describe('renderTaskDetails', () => {
    it('renders medication name, type, and dosage labels', () => {
      renderCard({
        category: 'health',
        details: {
          taskType: 'give-medication',
          medicineName: 'Metacam',
          medicineType: 'Liquid',
          dosages: [{label: '0.5ml'}, {label: '0.5ml'}],
        },
      });
      expect(screen.getByText('💊 Metacam (Liquid)')).toBeTruthy();
      expect(screen.getByText('Doses: 0.5ml, 0.5ml')).toBeTruthy();
    });

    it('renders medication without dosages section when dosages is empty', () => {
      renderCard({
        category: 'health',
        details: {
          taskType: 'give-medication',
          medicineName: 'Metacam',
          medicineType: 'Liquid',
          dosages: [],
        },
      });
      expect(screen.getByText('💊 Metacam (Liquid)')).toBeTruthy();
      expect(screen.queryByText(/Doses:/)).toBeNull();
    });

    it('renders medication without dosages section when dosages is absent', () => {
      renderCard({
        category: 'health',
        details: {
          taskType: 'give-medication',
          medicineName: 'Metacam',
          medicineType: 'Liquid',
        },
      });
      expect(screen.getByText('💊 Metacam (Liquid)')).toBeTruthy();
      expect(screen.queryByText(/Doses:/)).toBeNull();
    });

    it('renders observational tool label', () => {
      mockResolveOtLabel.mockReturnValue('Weight Check');
      renderCard({
        category: 'health',
        details: {
          taskType: 'take-observational-tool',
          toolType: 'Weight Check',
        },
      });
      expect(screen.getByText('📋 Tool: Weight Check')).toBeTruthy();
    });

    it('renders hygiene task description', () => {
      renderCard({
        category: 'hygiene',
        details: {description: 'Brush teeth'},
      });
      expect(screen.getByText('Brush teeth')).toBeTruthy();
    });

    it('renders dietary task description', () => {
      renderCard({
        category: 'dietary',
        details: {description: '1 cup kibble'},
      });
      expect(screen.getByText('1 cup kibble')).toBeTruthy();
    });

    it('renders nothing for hygiene task without description', () => {
      renderCard({category: 'hygiene', details: {}});
      expect(screen.queryByText(/💊/)).toBeNull();
      expect(screen.queryByText(/📋/)).toBeNull();
    });

    it('renders nothing when details is undefined', () => {
      renderCard({details: undefined});
      expect(screen.queryByText(/💊/)).toBeNull();
      expect(screen.queryByText(/📋/)).toBeNull();
    });

    it('renders nothing for unrecognised category+details combination', () => {
      renderCard({
        category: 'general',
        details: {description: 'should not appear'},
      });
      expect(screen.queryByText('should not appear')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Avatar logic
  // -------------------------------------------------------------------------

  describe('Avatar logic', () => {
    it('uses URI when companionAvatar normalizes to a string', () => {
      mockNormalizeImageUri.mockReturnValue(
        'https://cdn.example.com/buddy.jpg',
      );
      renderCard({companionAvatar: 'buddy.jpg', assignedToName: undefined});
      const group = screen.getByTestId('mock-avatar-group');
      expect(group.props.avatars).toEqual([
        {uri: 'https://cdn.example.com/buddy.jpg'},
      ]);
    });

    it('uses placeholder initial when companionAvatar normalizes to null', () => {
      mockNormalizeImageUri.mockReturnValue(null);
      renderCard({companionAvatar: undefined, assignedToName: undefined});
      const group = screen.getByTestId('mock-avatar-group');
      expect(group.props.avatars).toEqual([{placeholder: 'B'}]);
    });

    it('appends assignee URI when assignedToAvatar is provided', () => {
      mockNormalizeImageUri
        .mockReturnValueOnce('buddy.png') // companion
        .mockReturnValueOnce('john.png'); // assignee
      renderCard({
        companionAvatar: 'buddy.png',
        assignedToName: 'John Doe',
        assignedToAvatar: 'john.png',
      });
      const group = screen.getByTestId('mock-avatar-group');
      expect(group.props.avatars).toEqual([
        {uri: 'buddy.png'},
        {uri: 'john.png'},
      ]);
    });

    it('appends assignee placeholder when assignedToAvatar normalizes to null', () => {
      mockNormalizeImageUri
        .mockReturnValueOnce(null) // companion
        .mockReturnValueOnce(null); // assignee
      renderCard({
        companionAvatar: undefined,
        assignedToName: 'Alice Wonder',
        assignedToAvatar: undefined,
      });
      const group = screen.getByTestId('mock-avatar-group');
      expect(group.props.avatars).toEqual([
        {placeholder: 'B'},
        {placeholder: 'A'},
      ]);
    });

    it('does not append assignee when assignedToName is undefined', () => {
      mockNormalizeImageUri.mockReturnValue(null);
      renderCard({assignedToName: undefined});
      const group = screen.getByTestId('mock-avatar-group');
      expect(group.props.avatars).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Complete button variants
  // -------------------------------------------------------------------------

  describe('showCompleteButton — button variants', () => {
    it('renders LiquidGlassButton (default variant) with custom label', () => {
      renderCard({
        showCompleteButton: true,
        status: 'pending',
        completeButtonVariant: 'liquid-glass',
        completeButtonLabel: 'Mark Done',
        onPressComplete: jest.fn(),
      });
      expect(screen.getByTestId('mock-liquid-glass-button')).toBeTruthy();
      expect(screen.getByText('Mark Done')).toBeTruthy();
    });

    it('renders CardActionButton for primary variant', () => {
      renderCard({
        showCompleteButton: true,
        status: 'pending',
        completeButtonVariant: 'primary',
        onPressComplete: jest.fn(),
      });
      expect(screen.getByTestId('mock-action-button-primary')).toBeTruthy();
    });

    it('renders CardActionButton for success variant', () => {
      renderCard({
        showCompleteButton: true,
        status: 'pending',
        completeButtonVariant: 'success',
        onPressComplete: jest.fn(),
      });
      expect(screen.getByTestId('mock-action-button-success')).toBeTruthy();
    });

    it('renders CardActionButton for secondary variant', () => {
      renderCard({
        showCompleteButton: true,
        status: 'pending',
        completeButtonVariant: 'secondary',
        onPressComplete: jest.fn(),
      });
      expect(screen.getByTestId('mock-action-button-secondary')).toBeTruthy();
    });

    it('does not render button when showCompleteButton is false', () => {
      renderCard({showCompleteButton: false, status: 'pending'});
      expect(screen.queryByTestId('mock-liquid-glass-button')).toBeNull();
      expect(screen.queryByTestId(/mock-action-button/)).toBeNull();
    });

    it('does not render button when task is completed', () => {
      renderCard({showCompleteButton: true, status: 'completed'});
      expect(screen.queryByTestId('mock-liquid-glass-button')).toBeNull();
    });

    it('does not render button when handleCompletePress is undefined', () => {
      renderCard({
        showCompleteButton: true,
        status: 'pending',
        onPressComplete: undefined,
        onPressTakeObservationalTool: undefined,
      });
      expect(screen.queryByTestId('mock-liquid-glass-button')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // handleCompletePress routing
  // -------------------------------------------------------------------------

  describe('handleCompletePress routing', () => {
    it('calls onPressComplete for non-OT tasks', () => {
      const onPressComplete = jest.fn();
      renderCard({
        showCompleteButton: true,
        status: 'pending',
        onPressComplete,
        category: 'general',
      });
      fireEvent.press(screen.getByTestId('mock-liquid-glass-button'));
      expect(onPressComplete).toHaveBeenCalledTimes(1);
    });

    it('calls onPressTakeObservationalTool for OT tasks when provided', () => {
      const onPressTakeObservationalTool = jest.fn();
      const onPressComplete = jest.fn();
      renderCard({
        showCompleteButton: true,
        status: 'pending',
        category: 'health',
        details: {taskType: 'take-observational-tool'},
        onPressTakeObservationalTool,
        onPressComplete,
      });
      fireEvent.press(screen.getByTestId('mock-liquid-glass-button'));
      expect(onPressTakeObservationalTool).toHaveBeenCalledTimes(1);
      expect(onPressComplete).not.toHaveBeenCalled();
    });

    it('falls back to onPressComplete for OT task when onPressTakeObservationalTool is absent', () => {
      const onPressComplete = jest.fn();
      renderCard({
        showCompleteButton: true,
        status: 'pending',
        category: 'health',
        details: {taskType: 'take-observational-tool'},
        onPressTakeObservationalTool: undefined,
        onPressComplete,
      });
      fireEvent.press(screen.getByTestId('mock-liquid-glass-button'));
      expect(onPressComplete).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // SwipeableActionCard prop passthrough
  // -------------------------------------------------------------------------

  describe('SwipeableActionCard props', () => {
    it('passes showEditAction=true when prop is true and task is pending', () => {
      renderCard({showEditAction: true, status: 'pending'});
      expect(screen.getByTestId('mock-swipe-card').props.showEditAction).toBe(
        true,
      );
    });

    it('forces showEditAction=false when task is completed', () => {
      renderCard({showEditAction: true, status: 'completed'});
      expect(screen.getByTestId('mock-swipe-card').props.showEditAction).toBe(
        false,
      );
    });

    it('forces showEditAction=false when prop is false', () => {
      renderCard({showEditAction: false, status: 'pending'});
      expect(screen.getByTestId('mock-swipe-card').props.showEditAction).toBe(
        false,
      );
    });

    it('passes hideSwipeActions=true', () => {
      renderCard({hideSwipeActions: true});
      expect(screen.getByTestId('mock-swipe-card').props.hideSwipeActions).toBe(
        true,
      );
    });

    it('passes onPressView and onPressEdit through', () => {
      const onPressView = jest.fn();
      const onPressEdit = jest.fn();
      renderCard({onPressView, onPressEdit});
      const card = screen.getByTestId('mock-swipe-card');
      expect(card.props.onPressView).toBe(onPressView);
      expect(card.props.onPressEdit).toBe(onPressEdit);
    });
  });
});
