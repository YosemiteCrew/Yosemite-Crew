'use client';
import React from 'react';
import Waitlist from '@/app/features/appointments/components/Waitlist/Waitlist';
import { useWaitlist } from '@/app/features/appointments/components/Waitlist/useWaitlist';
import type { WaitlistEntryView } from '@/app/features/appointments/components/Waitlist/Waitlist';

type WaitlistPanelProps = {
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
    book,
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
      onBook={
        canEdit
          ? (entry) => (onBookAppointment ? onBookAppointment(entry) : void book(entry.id))
          : undefined
      }
      onCancel={canEdit ? (id) => void cancel(id) : undefined}
      onAdd={canEdit ? add : undefined}
    />
  );
};

export default WaitlistPanel;
