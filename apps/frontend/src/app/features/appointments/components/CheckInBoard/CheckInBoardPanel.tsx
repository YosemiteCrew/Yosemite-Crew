'use client';
import React from 'react';
import CheckInBoard, {
  type CheckInBoardProps,
} from '@/app/features/appointments/components/CheckInBoard/CheckInBoard';
import { useCheckInBoard } from '@/app/features/appointments/components/CheckInBoard/useCheckInBoard';

/** Just the edit-gated handler props the board hides when they are absent. */
type CheckInEditHandlers = Pick<
  CheckInBoardProps,
  'onSeen' | 'onComplete' | 'onCancel' | 'onNoShow' | 'onAssignRoom' | 'onAdd'
>;

/**
 * Data container for {@link CheckInBoard}. All state lives in
 * {@link useCheckInBoard}; this projects it onto the presentational board and
 * withholds the edit actions (the board hides them) when the user lacks
 * appointment edit permission. The show-all toggle stays available to everyone.
 */
const CheckInBoardPanel = () => {
  const {
    canEdit,
    entriesView,
    companionOptions,
    roomOptions,
    loading,
    error,
    busyEntryId,
    showAll,
    setShowAll,
    seen,
    complete,
    cancel,
    noShow,
    assignRoom,
    add,
  } = useCheckInBoard();

  const editHandlers: CheckInEditHandlers = canEdit
    ? {
        onSeen: (id) => void seen(id),
        onComplete: (id) => void complete(id),
        onCancel: (id) => void cancel(id),
        onNoShow: (id) => void noShow(id),
        onAssignRoom: (id, roomId) => void assignRoom(id, roomId),
        onAdd: add,
      }
    : {};

  return (
    <CheckInBoard
      entries={entriesView}
      companions={companionOptions}
      rooms={roomOptions}
      loading={loading}
      error={error}
      busyEntryId={busyEntryId}
      showAll={showAll}
      onToggleShowAll={setShowAll}
      {...editHandlers}
    />
  );
};

export default CheckInBoardPanel;
