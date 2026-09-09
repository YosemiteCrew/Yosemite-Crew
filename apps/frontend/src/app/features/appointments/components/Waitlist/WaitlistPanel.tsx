'use client';
import React from 'react';
import Waitlist from '@/app/features/appointments/components/Waitlist/Waitlist';
import { useWaitlist } from '@/app/features/appointments/components/Waitlist/useWaitlist';
import type { WaitlistEntryView } from '@/app/features/appointments/components/Waitlist/Waitlist';

type WaitlistPanelProps = {
  /**
   * A waitlist entry has no time slot to book directly - "Book" opens the
   * ordinary New Appointment form (pre-filled from the entry) and lets staff
   * pick one through the normal create flow. Without this, there is nothing
   * for the Book action to do, so it stays hidden rather than wired to a call
   * that can only fail.
   */
  onBookAppointment?: (entry: WaitlistEntryView) => void;
};

/**
 * Data container for {@link Waitlist}. All state lives in {@link useWaitlist};
 * this projects it onto the presentational panel and withholds the edit actions
 * (the panel hides them) when the user lacks appointment edit permission.
 */
const WaitlistPanel = ({ onBookAppointment }: WaitlistPanelProps) => {
  const {
    canEdit,
    entriesView,
    companionOptions,
    loading,
    error,
    busyEntryId,
    offer,
    cancel,
    add,
  } = useWaitlist();

  return (
    <Waitlist
      entries={entriesView}
      companions={companionOptions}
      loading={loading}
      error={error}
      busyEntryId={busyEntryId}
      onOffer={canEdit ? (id) => void offer(id) : undefined}
      onBook={canEdit && onBookAppointment ? onBookAppointment : undefined}
      onCancel={canEdit ? (id) => void cancel(id) : undefined}
      onAdd={canEdit ? add : undefined}
    />
  );
};

export default WaitlistPanel;
