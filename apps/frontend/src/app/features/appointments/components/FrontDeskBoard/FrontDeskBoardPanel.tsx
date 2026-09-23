'use client';
import React from 'react';
import FrontDeskBoard, {
  type FrontDeskBoardProps,
} from '@/app/features/appointments/components/FrontDeskBoard/FrontDeskBoard';
import { useFrontDeskBoard } from '@/app/features/appointments/components/FrontDeskBoard/useFrontDeskBoard';

/** Just the edit-gated handler props the board hides when they are absent. */
type CheckInEditHandlers = Pick<
  FrontDeskBoardProps,
  'onSeen' | 'onComplete' | 'onCancel' | 'onNoShow' | 'onAssignRoom' | 'onAdd'
>;

/**
 * Data container for {@link FrontDeskBoard}. All state lives in
 * {@link useFrontDeskBoard}; this projects it onto the presentational board and
 * withholds the edit actions (the board hides them) when the user lacks
 * appointment edit permission. The show-all toggle stays available to everyone.
 */
const FrontDeskBoardPanel = () => {
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
  } = useFrontDeskBoard();

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
    <FrontDeskBoard
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

export default FrontDeskBoardPanel;
