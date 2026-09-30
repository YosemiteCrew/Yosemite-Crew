import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNotify } from '@/app/hooks/useNotify';
import { useOrgStore } from '@/app/stores/orgStore';
import { getWeekDays } from '@/app/features/appointments/components/Calendar/weekHelpers';
import {
  getStartOfDayInPreferredTimeZone,
  getStartOfNextDayInPreferredTimeZone,
} from '@/app/lib/timezone';
import {
  createCalendarBlock,
  deleteCalendarBlock,
  fetchCalendarBlocks,
  updateCalendarBlock,
  type CalendarBlock,
  type CalendarBlockInput,
} from '@/app/features/appointments/services/calendarBlockService';

export const useCalendarBlocks = (activeCalendar: string, currentDate: Date, weekStart: Date) => {
  const { notify } = useNotify();
  const primaryOrgId = useOrgStore((state) => state.primaryOrgId);
  const [calendarBlockState, setCalendarBlockState] = useState<{
    organisationId: string | null;
    blocks: CalendarBlock[];
  }>({ organisationId: null, blocks: [] });

  // The visible days, bounded in the practice's time zone like the calendar grid.
  const blockRange = useMemo(() => {
    const days = activeCalendar === 'week' ? getWeekDays(weekStart) : [currentDate];
    return {
      from: getStartOfDayInPreferredTimeZone(days[0]),
      to: getStartOfNextDayInPreferredTimeZone(days.at(-1) ?? days[0]),
    };
  }, [activeCalendar, currentDate, weekStart]);

  const blocks = useMemo(
    () =>
      calendarBlockState.organisationId === primaryOrgId
        ? calendarBlockState.blocks.filter(
            (block) =>
              new Date(block.endAt) > blockRange.from && new Date(block.startAt) < blockRange.to
          )
        : [],
    [blockRange, calendarBlockState, primaryOrgId]
  );

  const updateBlocks = useCallback(
    (update: (blocks: CalendarBlock[]) => CalendarBlock[]) => {
      if (!primaryOrgId) return;
      setCalendarBlockState((current) => ({
        organisationId: primaryOrgId,
        blocks: update(current.organisationId === primaryOrgId ? current.blocks : []),
      }));
    },
    [primaryOrgId]
  );

  useEffect(() => {
    if (!primaryOrgId) return;
    let current = true;
    void fetchCalendarBlocks(primaryOrgId, blockRange.from, blockRange.to)
      .then((nextBlocks) => {
        if (current) updateBlocks(() => nextBlocks);
      })
      .catch(() => {
        if (current)
          notify('warning', {
            title: 'Calendar blocks unavailable',
            text: 'Try reloading the calendar.',
          });
      });
    return () => {
      current = false;
    };
  }, [blockRange, notify, primaryOrgId, updateBlocks]);

  const saveBlock = useCallback(
    async (id: string | null, input: CalendarBlockInput) => {
      if (!primaryOrgId) throw new Error('No organisation selected');
      const saved = id
        ? await updateCalendarBlock(primaryOrgId, id, input)
        : await createCalendarBlock(primaryOrgId, input);
      updateBlocks((current) =>
        id ? current.map((block) => (block.id === id ? saved : block)) : [...current, saved]
      );
    },
    [primaryOrgId, updateBlocks]
  );

  const deleteBlock = useCallback(
    async (id: string) => {
      if (!primaryOrgId) return;
      await deleteCalendarBlock(primaryOrgId, id);
      updateBlocks((current) => current.filter((block) => block.id !== id));
    },
    [primaryOrgId, updateBlocks]
  );

  return { blocks, saveBlock, deleteBlock };
};
