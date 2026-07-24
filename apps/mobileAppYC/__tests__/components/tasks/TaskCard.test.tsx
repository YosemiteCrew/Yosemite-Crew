/**
 * TaskCard — warm-bone redesign coverage suite
 *
 * The card was rebuilt: no status text badges, no emoji detail rows, no
 * AvatarGroup, no LiquidGlassButton/CardActionButton. Instead it renders a
 * leading tinted icon tile, a single dot-joined meta line
 * "{categoryLabel} · {typeLabel} · {context}", a strike-through + success
 * check-circle completed state, a "Take" pill for observational-tool tasks
 * and a "Mark complete" cta pill (+ optional ellipsis) for other tasks.
 *
 * Targets the surviving logic branches:
 *  • resolveTileVisual (every category / sub-type glyph)
 *  • formattedDate (success + throw fallback) and its context slot
 *  • formattedTime (valid, no-seconds, NaN, unsplittable, undefined)
 *  • calculateNearestDosageTime (future, past-wrap, invalid-skip, empty, null)
 *  • observationalToolLabel + async OT fetch (resolved, hex-id, api name/null/throw, skips)
 *  • completed visual state (strike, check circle, 0.6 opacity)
 *  • avatar trailing stack (placeholder initials + uri image)
 *  • Take pill + Mark-complete pill rendering + press routing
 *  • edit ellipsis rendering + press
 *  • row tap (onPressView)
 *  • SwipeableActionCard prop passthrough
 */

import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react-native';
import {Image, StyleSheet} from 'react-native';
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

// Warm-bone tokens (inkBody, inkFaint, blueSoft, navActive, cta, ctaText,
// success, avatar*Bg/Ink, screen, screen2, hairline, shadows.none, …) come
// from the shared complete theme so the redesigned styles never crash.
jest.mock('@/hooks', () => ({
  useTheme: () => {
    const {createMockUseTheme} = require('../../setup/mockTheme');
    return createMockUseTheme();
  },
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

// Keep the real hygiene/dietary label helpers (they now feed the meta line's
// typeLabel) but keep observational-tool resolution controllable.
jest.mock('@/features/tasks/utils/taskLabels', () => {
  const actual = jest.requireActual('@/features/tasks/utils/taskLabels');
  return {
    ...actual,
    resolveObservationalToolLabel: jest.fn((raw: string) => raw),
  };
});

jest.mock(
  '@/features/observationalTools/services/observationToolService',
  () => ({
    observationToolApi: {get: jest.fn()},
    getCachedObservationToolName: jest.fn(() => null),
  }),
);

// SwipeableActionCard is the card surface + swipe wrapper — keep it mocked so
// its passthrough props stay assertable.
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

// ---------------------------------------------------------------------------
// Fixtures / helpers
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
  category: 'general' as TaskCardProps['category'],
};

const renderCard = (props: Partial<TaskCardProps> = {}) =>
  render(<TaskCard {...baseProps} {...props} />);

const flatten = (style: unknown) => StyleSheet.flatten(style as never) ?? {};
const styleOf = (el: {props: {style?: unknown}}) => flatten(el.props.style);

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
  // Core rendering — title + dot-joined meta line
  // -------------------------------------------------------------------------

  describe('Rendering — title and meta line', () => {
    it('renders the title and the dot-joined meta line', () => {
      renderCard();
      expect(screen.getByText('Morning Walk')).toBeTruthy();
      // category · (no typeLabel for general) · companion context
      expect(screen.getByText('General · Buddy')).toBeTruthy();
    });

    it('uses the formatted date as context when no companion or time', () => {
      renderCard({companionName: '', time: undefined});
      expect(screen.getByText('General · Oct 29, 2025')).toBeTruthy();
    });

    it('falls back to the raw date string when formatDateForDisplay throws', () => {
      (formatDateForDisplay as jest.Mock).mockImplementation(() => {
        throw new Error('bad date');
      });
      renderCard({companionName: '', time: undefined});
      expect(screen.getByText(/2025-10-29/)).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Leading tinted category tile (resolveTileVisual)
  // -------------------------------------------------------------------------

  describe('Leading category tile glyph', () => {
    it('renders the checkbox glyph for the default (general) category', () => {
      renderCard();
      expect(screen.getByTestId('icon-checkbox-outline')).toBeTruthy();
    });

    it('renders the medkit glyph for medication tasks', () => {
      renderCard({
        category: 'health',
        details: {taskType: 'give-medication'},
      });
      expect(screen.getByTestId('icon-medkit-outline')).toBeTruthy();
    });

    it('renders the pulse glyph for observational-tool tasks', () => {
      renderCard({
        category: 'health',
        details: {taskType: 'take-observational-tool'},
      });
      expect(screen.getByTestId('icon-pulse-outline')).toBeTruthy();
    });

    it('renders the walk glyph for hygiene exercise tasks', () => {
      renderCard({
        category: 'hygiene',
        details: {taskType: 'take-exercise'},
      });
      expect(screen.getByTestId('icon-walk-outline')).toBeTruthy();
    });

    it('renders the sparkles glyph for other hygiene tasks', () => {
      renderCard({
        category: 'hygiene',
        details: {taskType: 'give-bath'},
      });
      expect(screen.getByTestId('icon-sparkles-outline')).toBeTruthy();
    });

    it('renders the nutrition glyph for dietary tasks', () => {
      renderCard({
        category: 'dietary',
        details: {taskType: 'meals'},
      });
      expect(screen.getByTestId('icon-nutrition-outline')).toBeTruthy();
    });

    it('renders the create glyph for custom tasks', () => {
      renderCard({category: 'custom', details: undefined});
      expect(screen.getByTestId('icon-create-outline')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Completed visual state
  // -------------------------------------------------------------------------

  describe('Completed state', () => {
    it('strikes the title and shows the success check circle', () => {
      renderCard({status: 'completed'});
      expect(styleOf(screen.getByText('Morning Walk')).textDecorationLine).toBe(
        'line-through',
      );
      expect(screen.getByTestId('icon-checkmark')).toBeTruthy();
      // context becomes "done" on the meta line
      expect(screen.getByText('General · done')).toBeTruthy();
    });

    it('shows "done {time}" context when a completed task has a time', () => {
      renderCard({status: 'completed', time: '14:30:00'});
      expect(screen.getByText('General · done 2:30 PM')).toBeTruthy();
    });

    it('treats an uppercase COMPLETED status as completed', () => {
      renderCard({status: 'COMPLETED' as TaskCardProps['status']});
      expect(screen.getByTestId('icon-checkmark')).toBeTruthy();
      expect(styleOf(screen.getByText('Morning Walk')).textDecorationLine).toBe(
        'line-through',
      );
    });

    it('applies 0.6 opacity to the card surface when completed', () => {
      renderCard({status: 'completed'});
      const card = screen.getByTestId('mock-swipe-card');
      expect(flatten(card.props.cardStyle).opacity).toBe(0.6);
    });

    it('does not strike or check a pending task', () => {
      renderCard({status: 'pending'});
      expect(
        styleOf(screen.getByText('Morning Walk')).textDecorationLine,
      ).toBeUndefined();
      expect(screen.queryByTestId('icon-checkmark')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // formattedTime — feeds the meta context slot
  // -------------------------------------------------------------------------

  describe('formattedTime context', () => {
    it('formats 24h time to a 12h display', () => {
      renderCard({time: '14:30:00'});
      expect(screen.getByText('General · 2:30 PM')).toBeTruthy();
    });

    it('formats time without seconds', () => {
      renderCard({time: '09:05'});
      expect(screen.getByText(/9:05 AM/)).toBeTruthy();
    });

    it('returns the original string when hours are NaN', () => {
      renderCard({time: 'bad:30'});
      expect(screen.getByText(/bad:30/)).toBeTruthy();
    });

    it('returns the original string when the time cannot be split', () => {
      renderCard({time: 'invalid-time-string'});
      expect(screen.getByText(/invalid-time-string/)).toBeTruthy();
    });

    it('falls back to the companion context when time is undefined', () => {
      renderCard({time: undefined});
      expect(screen.getByText('General · Buddy')).toBeTruthy();
    });

    it('returns the original value when time.split throws (non-string time)', () => {
      // A non-string truthy time makes `.split` throw, hitting the catch that
      // returns the raw value.
      renderCard({time: 123 as unknown as string});
      expect(screen.getByText('General · 123')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // calculateNearestDosageTime — medication context slot
  // -------------------------------------------------------------------------

  describe('Medication nearest dosage context', () => {
    const medicationProps: Partial<TaskCardProps> = {
      category: 'health',
      details: {taskType: 'give-medication'},
    };

    it('shows the nearest future dosage time', () => {
      renderCard({
        ...medicationProps,
        details: {
          ...(medicationProps.details as object),
          dosages: [{time: '23:59', dosage: '1'}],
        },
      });
      expect(screen.getByText(/11:59 PM/)).toBeTruthy();
    });

    it('falls back to the earliest dosage when all are in the past', () => {
      renderCard({
        ...medicationProps,
        details: {
          ...(medicationProps.details as object),
          dosages: [
            {time: '00:01', dosage: '1'},
            {time: '00:02', dosage: '2'},
          ],
        },
      });
      expect(screen.getByText(/12:01 AM/)).toBeTruthy();
    });

    it('skips invalid dosage entries and keeps the valid one', () => {
      renderCard({
        ...medicationProps,
        details: {
          ...(medicationProps.details as object),
          dosages: [
            {time: 'bad:time', dosage: '1'},
            {time: '23:59', dosage: '1'},
          ],
        },
      });
      expect(screen.getByText(/11:59 PM/)).toBeTruthy();
    });

    it('appends no time when every dosage entry is invalid', () => {
      renderCard({
        ...medicationProps,
        details: {
          ...(medicationProps.details as object),
          dosages: [{time: 'bad:time', dosage: '1'}],
        },
      });
      expect(
        screen.getByText('General · Give medication · Buddy'),
      ).toBeTruthy();
    });

    it('appends no time when the dosages array is empty', () => {
      renderCard({
        ...medicationProps,
        details: {...(medicationProps.details as object), dosages: []},
      });
      expect(
        screen.getByText('General · Give medication · Buddy'),
      ).toBeTruthy();
    });

    it('handles null dosages gracefully', () => {
      renderCard({
        ...medicationProps,
        details: {...(medicationProps.details as object), dosages: null},
      });
      expect(
        screen.getByText('General · Give medication · Buddy'),
      ).toBeTruthy();
    });

    it('skips a dosage whose time throws on split and keeps the valid one', () => {
      // A non-string time makes `.split` throw inside the map — exercises the
      // try/catch skip path (distinct from the NaN early-return).
      renderCard({
        ...medicationProps,
        details: {
          ...(medicationProps.details as object),
          dosages: [
            {time: null, dosage: '1'},
            {time: '23:59', dosage: '1'},
          ],
        },
      });
      expect(screen.getByText(/11:59 PM/)).toBeTruthy();
    });

    it('drops the nearest dosage context when formatting the selected dosage throws', () => {
      const splitOnceThenThrow = {
        split: jest
          .fn()
          .mockReturnValueOnce(['23', '59'])
          .mockImplementationOnce(() => {
            throw new Error('format failed');
          }),
      };
      renderCard({
        ...medicationProps,
        details: {
          ...(medicationProps.details as object),
          dosages: [
            {time: splitOnceThenThrow, dosage: '1'} as unknown as {
              time: string;
              dosage: string;
            },
          ],
        },
      });
      expect(
        screen.getByText('General · Give medication · Buddy'),
      ).toBeTruthy();
    });

    it('drops the nearest dosage context when display formatting has NaN hours', () => {
      const splitValidThenNaN = {
        split: jest
          .fn()
          .mockReturnValueOnce(['23', '59'])
          .mockReturnValueOnce(['bad', '10']),
      };
      renderCard({
        ...medicationProps,
        details: {
          ...(medicationProps.details as object),
          dosages: [
            {time: splitValidThenNaN, dosage: '1'} as unknown as {
              time: string;
              dosage: string;
            },
          ],
        },
      });
      expect(
        screen.getByText('General · Give medication · Buddy'),
      ).toBeTruthy();
    });

    it('picks the smaller of two future dosages (reduce comparison arm)', () => {
      // Two future dosages, largest first, so the reduce must swap to the
      // smaller upcoming time.
      renderCard({
        ...medicationProps,
        details: {
          ...(medicationProps.details as object),
          dosages: [
            {time: '23:59', dosage: '1'},
            {time: '23:58', dosage: '2'},
          ],
        },
      });
      expect(screen.getByText(/11:58 PM/)).toBeTruthy();
    });

    it('picks the earliest of two past dosages (fallback reduce comparison arm)', () => {
      // All in the past, largest first, so the earliest-dosage reduce must
      // swap to the smaller time.
      renderCard({
        ...medicationProps,
        details: {
          ...(medicationProps.details as object),
          dosages: [
            {time: '00:02', dosage: '1'},
            {time: '00:01', dosage: '2'},
          ],
        },
      });
      expect(screen.getByText(/12:01 AM/)).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // observationalToolLabel — sync resolution into the meta line
  // -------------------------------------------------------------------------

  describe('Observational tool label — sync resolution', () => {
    it('shows the resolved label when it is a readable name', async () => {
      mockResolveOtLabel.mockReturnValue('Pain Score');
      renderCard({
        category: 'health',
        details: {taskType: 'take-observational-tool', toolType: 'pain-score'},
      });
      expect(screen.getByText(/Pain Score/)).toBeTruthy();
      await act(async () => {});
      expect(mockObservationToolGet).not.toHaveBeenCalled();
    });

    it('shows the "Observational tool" fallback for a Mongo-id label', () => {
      mockResolveOtLabel.mockReturnValue('507f1f77bcf86cd799439011');
      renderCard({
        category: 'health',
        details: {
          taskType: 'take-observational-tool',
          toolType: '507f1f77bcf86cd799439011',
        },
      });
      expect(screen.getByText(/Observational tool/)).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // useEffect — async OT label fetch
  // -------------------------------------------------------------------------

  describe('Observational tool label — async fetch', () => {
    it('updates the label from the API when the initial value is a hex id', async () => {
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
        expect(screen.getByText(/Blood Pressure/)).toBeTruthy();
      });
    });

    it('keeps the "Observational tool" fallback when the API returns null', async () => {
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
        expect(mockObservationToolGet).toHaveBeenCalled();
      });
      expect(screen.getByText(/Observational tool/)).toBeTruthy();
    });

    it('keeps the "Observational tool" fallback when the API throws', async () => {
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
        expect(mockObservationToolGet).toHaveBeenCalled();
      });
      expect(screen.getByText(/Observational tool/)).toBeTruthy();
    });

    it('skips the API fetch when the label is already resolved', async () => {
      mockResolveOtLabel.mockReturnValue('Pain Score');
      mockObservationToolGet.mockResolvedValue({name: 'Should Not Be Used'});
      renderCard({
        category: 'health',
        details: {taskType: 'take-observational-tool', toolType: 'pain-score'},
      });
      await act(async () => {});
      expect(screen.getByText(/Pain Score/)).toBeTruthy();
      expect(mockObservationToolGet).not.toHaveBeenCalled();
    });

    it('does not fetch when the category is not health', async () => {
      renderCard({category: 'general', details: undefined});
      await act(async () => {});
      expect(mockObservationToolGet).not.toHaveBeenCalled();
    });

    it('does not fetch when the task type is not an observational tool', async () => {
      renderCard({
        category: 'health',
        details: {taskType: 'give-medication'},
      });
      await act(async () => {});
      expect(mockObservationToolGet).not.toHaveBeenCalled();
    });

    it('does not fetch when the toolType is falsy', async () => {
      renderCard({
        category: 'health',
        details: {taskType: 'take-observational-tool', toolType: ''},
      });
      await act(async () => {});
      expect(mockObservationToolGet).not.toHaveBeenCalled();
    });

    it('does not set the fallback label when the fetch rejects after unmount', async () => {
      // Reject only after unmount so the effect's `active` guard is false when
      // the catch runs — exercises the inactive branch (no setState).
      mockResolveOtLabel.mockReturnValue('507f1f77bcf86cd799439011');
      let rejectFetch: (reason?: unknown) => void = () => {};
      const pending = new Promise((_resolve, reject) => {
        rejectFetch = reject;
      });
      mockObservationToolGet.mockReturnValue(pending);
      const {unmount} = renderCard({
        category: 'health',
        details: {
          taskType: 'take-observational-tool',
          toolType: '507f1f77bcf86cd799439011',
        },
      });
      unmount();
      rejectFetch(new Error('network'));
      await act(async () => {
        await pending.catch(() => {});
      });
      expect(mockObservationToolGet).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Health sub-type label (typeLabel)
  // -------------------------------------------------------------------------

  describe('Health type label', () => {
    it('labels a vaccination task', () => {
      renderCard({
        category: 'health',
        details: {taskType: 'vaccination'},
      });
      expect(screen.getByText('General · Vaccination · Buddy')).toBeTruthy();
    });

    it('omits the type segment for an unrecognised health task', () => {
      // details undefined → no give-medication/observational/vaccination match,
      // so typeLabel falls through to the (absent) subcategory label.
      renderCard({category: 'health', details: undefined});
      expect(screen.getByText('General · Buddy')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Avatar trailing stack
  // -------------------------------------------------------------------------

  describe('Avatar trailing stack', () => {
    it('shows the companion initial placeholder when no avatar resolves', () => {
      mockNormalizeImageUri.mockReturnValue(null);
      renderCard({companionAvatar: undefined, assignedToName: undefined});
      expect(screen.getByText('B')).toBeTruthy();
    });

    it('appends the assignee initial placeholder', () => {
      mockNormalizeImageUri.mockReturnValue(null);
      renderCard({
        companionAvatar: undefined,
        assignedToName: 'Alice Wonder',
        assignedToAvatar: undefined,
      });
      expect(screen.getByText('B')).toBeTruthy();
      expect(screen.getByText('A')).toBeTruthy();
    });

    it('renders an image (no placeholder) when the avatar uri resolves', () => {
      mockNormalizeImageUri.mockReturnValue(
        'https://cdn.example.com/buddy.jpg',
      );
      renderCard({companionAvatar: 'buddy.jpg', assignedToName: undefined});
      expect(screen.queryByText('B')).toBeNull();
      expect(screen.UNSAFE_getAllByType(Image)).toHaveLength(1);
    });

    it('renders an assignee image when the assignee avatar uri resolves', () => {
      // Both avatars resolve to a uri → the assignee image push branch runs and
      // two <Image> avatars render (no initial placeholders).
      mockNormalizeImageUri.mockReturnValue('https://cdn.example.com/x.jpg');
      renderCard({
        companionAvatar: 'buddy.jpg',
        assignedToName: 'Alice Wonder',
        assignedToAvatar: 'alice.jpg',
      });
      expect(screen.queryByText('B')).toBeNull();
      expect(screen.queryByText('A')).toBeNull();
      expect(screen.UNSAFE_getAllByType(Image)).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // Mark-complete pill (non-OT action row)
  // -------------------------------------------------------------------------

  describe('Mark-complete pill', () => {
    it('renders the default "Mark complete" pill for a pending non-OT task', () => {
      renderCard({
        showCompleteButton: true,
        status: 'pending',
        category: 'general',
        onPressComplete: jest.fn(),
      });
      expect(screen.getByText('Mark complete')).toBeTruthy();
    });

    it('renders a custom completeButtonLabel', () => {
      renderCard({
        showCompleteButton: true,
        status: 'pending',
        category: 'general',
        completeButtonLabel: 'Mark Done',
        onPressComplete: jest.fn(),
      });
      expect(screen.getByText('Mark Done')).toBeTruthy();
    });

    it('does not render the pill when showCompleteButton is false', () => {
      renderCard({
        showCompleteButton: false,
        status: 'pending',
        onPressComplete: jest.fn(),
      });
      expect(screen.queryByText('Mark complete')).toBeNull();
    });

    it('does not render the pill when the task is completed', () => {
      renderCard({
        showCompleteButton: true,
        status: 'completed',
        onPressComplete: jest.fn(),
      });
      expect(screen.queryByText('Mark complete')).toBeNull();
    });

    it('exposes button role and the visible label as the accessibility label', () => {
      renderCard({
        showCompleteButton: true,
        status: 'pending',
        category: 'general',
        completeButtonLabel: 'Mark Done',
        onPressComplete: jest.fn(),
      });
      const pill = screen.getByLabelText('Mark Done');
      expect(pill.props.accessibilityRole).toBe('button');
    });

    it('does not render the pill when there is no complete handler', () => {
      renderCard({
        showCompleteButton: true,
        status: 'pending',
        category: 'general',
        onPressComplete: undefined,
        onPressTakeObservationalTool: undefined,
      });
      expect(screen.queryByText('Mark complete')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Take pill (observational-tool trailing)
  // -------------------------------------------------------------------------

  describe('Take pill', () => {
    it('renders a "Take" pill for a pending observational-tool task', () => {
      renderCard({
        category: 'health',
        details: {taskType: 'take-observational-tool'},
        showCompleteButton: true,
        status: 'pending',
        onPressComplete: jest.fn(),
      });
      expect(screen.getByText('Take')).toBeTruthy();
    });

    it('exposes button role and label on the "Take" pill', () => {
      renderCard({
        category: 'health',
        details: {taskType: 'take-observational-tool'},
        showCompleteButton: true,
        status: 'pending',
        onPressComplete: jest.fn(),
      });
      const pill = screen.getByLabelText('Take');
      expect(pill.props.accessibilityRole).toBe('button');
    });

    it('does not render the "Take" pill once the task is completed', () => {
      renderCard({
        category: 'health',
        details: {taskType: 'take-observational-tool'},
        showCompleteButton: true,
        status: 'completed',
        onPressComplete: jest.fn(),
      });
      expect(screen.queryByText('Take')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Complete-press routing
  // -------------------------------------------------------------------------

  describe('Complete-press routing', () => {
    it('calls onPressComplete when the Mark-complete pill is pressed', () => {
      const onPressComplete = jest.fn();
      renderCard({
        showCompleteButton: true,
        status: 'pending',
        category: 'general',
        onPressComplete,
      });
      fireEvent.press(screen.getByText('Mark complete'));
      expect(onPressComplete).toHaveBeenCalledTimes(1);
    });

    it('routes the Take pill to onPressTakeObservationalTool when provided', () => {
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
      fireEvent.press(screen.getByText('Take'));
      expect(onPressTakeObservationalTool).toHaveBeenCalledTimes(1);
      expect(onPressComplete).not.toHaveBeenCalled();
    });

    it('falls back to onPressComplete for an OT task without a take handler', () => {
      const onPressComplete = jest.fn();
      renderCard({
        showCompleteButton: true,
        status: 'pending',
        category: 'health',
        details: {taskType: 'take-observational-tool'},
        onPressTakeObservationalTool: undefined,
        onPressComplete,
      });
      fireEvent.press(screen.getByText('Take'));
      expect(onPressComplete).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Edit ellipsis (action row)
  // -------------------------------------------------------------------------

  describe('Edit ellipsis', () => {
    it('renders the ellipsis and calls onPressEdit when it is pressed', () => {
      const onPressEdit = jest.fn();
      const onPressComplete = jest.fn();
      renderCard({
        showCompleteButton: true,
        status: 'pending',
        category: 'general',
        showEditAction: true,
        onPressEdit,
        onPressComplete,
      });
      const ellipsis = screen.getByTestId('icon-ellipsis-horizontal');
      fireEvent.press(ellipsis);
      expect(onPressEdit).toHaveBeenCalledTimes(1);
      expect(onPressComplete).not.toHaveBeenCalled();
    });

    it('exposes button role and a "More options" label on the ellipsis button', () => {
      renderCard({
        showCompleteButton: true,
        status: 'pending',
        category: 'general',
        showEditAction: true,
        onPressEdit: jest.fn(),
        onPressComplete: jest.fn(),
      });
      const button = screen.getByLabelText('More options');
      expect(button.props.accessibilityRole).toBe('button');
    });

    it('does not render the ellipsis when showEditAction is false', () => {
      renderCard({
        showCompleteButton: true,
        status: 'pending',
        category: 'general',
        showEditAction: false,
        onPressEdit: jest.fn(),
        onPressComplete: jest.fn(),
      });
      expect(screen.queryByTestId('icon-ellipsis-horizontal')).toBeNull();
    });

    it('does not render the ellipsis when onPressEdit is undefined', () => {
      renderCard({
        showCompleteButton: true,
        status: 'pending',
        category: 'general',
        showEditAction: true,
        onPressEdit: undefined,
        onPressComplete: jest.fn(),
      });
      expect(screen.queryByTestId('icon-ellipsis-horizontal')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Row tap
  // -------------------------------------------------------------------------

  describe('Row tap', () => {
    it('calls onPressView when the card row is pressed', () => {
      const onPressView = jest.fn();
      renderCard({onPressView});
      fireEvent.press(screen.getByText('Morning Walk'));
      expect(onPressView).toHaveBeenCalledTimes(1);
    });

    it('exposes button role and the task title as the accessibility label when pressable', () => {
      renderCard({onPressView: jest.fn()});
      const row = screen.getByLabelText('Morning Walk');
      expect(row.props.accessibilityRole).toBe('button');
    });

    it('omits the button role when onPressView is undefined', () => {
      renderCard({onPressView: undefined});
      const row = screen.getByLabelText('Morning Walk');
      expect(row.props.accessibilityRole).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // SwipeableActionCard prop passthrough
  // -------------------------------------------------------------------------

  describe('SwipeableActionCard props', () => {
    it('passes showEditAction=true when the prop is true and the task is pending', () => {
      renderCard({showEditAction: true, status: 'pending'});
      expect(screen.getByTestId('mock-swipe-card').props.showEditAction).toBe(
        true,
      );
    });

    it('forces showEditAction=false when the task is completed', () => {
      renderCard({showEditAction: true, status: 'completed'});
      expect(screen.getByTestId('mock-swipe-card').props.showEditAction).toBe(
        false,
      );
    });

    it('forces showEditAction=false when the prop is false', () => {
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
