'use client';

import React, { useCallback, useEffect, useState } from 'react';
import SectionCard from '@/app/ui/primitives/SectionCard/SectionCard';
import { useOrgStore } from '@/app/stores/orgStore';
import { useNotify } from '@/app/hooks/useNotify';
import {
  bookingRequestsApi,
  type BookingRequest,
} from '@/app/features/organization/services/bookingRequestsApiService';

/**
 * Confirmed booking requests from the public page.
 *
 * This exists because without it the feature is another broken promise: a pet
 * owner submits a request, confirms their email, and it lands somewhere nobody
 * at the practice ever looks. The notification email is a prompt; this is the
 * record.
 *
 * Deliberately not a calendar. A request is not an appointment and the time is
 * not held - marking one "booked" records what the practice did in the PMS, it
 * does not create anything.
 */

const formatWhen = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
};

const STATUS_LABEL: Record<BookingRequest['status'], string> = {
  CONFIRMED: 'Awaiting you',
  BOOKED: 'Booked',
  DECLINED: 'Declined',
};

const BookingRequests = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const { notify } = useNotify();

  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // No `setLoading(true)` here: the state starts true and the effect only ever
  // clears it asynchronously. Setting it synchronously inside the effect
  // cascades a render for no benefit, since nothing can have cleared it yet.
  const load = useCallback(() => {
    if (!primaryOrgId) return;
    bookingRequestsApi
      .list(primaryOrgId)
      .then((rows) => {
        setRequests(rows);
        setFailed(false);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [primaryOrgId]);

  useEffect(() => load(), [load]);

  // Nothing to show, and nothing to scope a request to. Returning early here
  // rather than guarding inside every handler means `primaryOrgId` is a string
  // for the rest of the component, so the handlers carry one guard instead of
  // two.
  if (!primaryOrgId) return null;

  const update = (id: string, status: 'DECLINED' | 'BOOKED') => {
    if (busyId) return;
    setBusyId(id);
    bookingRequestsApi
      .setStatus(primaryOrgId, id, status)
      .then(() => {
        setRequests((current) =>
          current.map((request) => (request.id === id ? { ...request, status } : request))
        );
      })
      .catch(() =>
        notify('error', {
          title: 'Could not update the request',
          text: 'Nothing was changed. Please try again.',
        })
      )
      .finally(() => setBusyId(null));
  };

  const pending = requests.filter((request) => request.status === 'CONFIRMED');

  return (
    <SectionCard title="Booking requests" showButton={false}>
      <div className="flex flex-col gap-3">
        {loading ? (
          <p className="text-[12.5px] text-[var(--ink-muted)]">Loading requests…</p>
        ) : null}

        {!loading && failed ? (
          <p role="alert" className="text-[12.5px] text-[var(--warn-text)]">
            Could not load booking requests. Reload the page to try again.
          </p>
        ) : null}

        {!loading && !failed && requests.length === 0 ? (
          <p className="text-[12.5px] text-[var(--ink-muted)]">
            No booking requests yet. Confirmed requests from your public booking page appear here.
          </p>
        ) : null}

        {!loading && !failed && requests.length > 0 ? (
          <>
            <p className="text-[12px] text-[var(--ink-faint)]">
              {pending.length} awaiting you. These are requests, not appointments — book one in the
              diary as usual, then mark it booked here.
            </p>

            <ul className="flex flex-col gap-2.5">
              {requests.map((request) => (
                <li
                  key={request.id}
                  className="flex flex-col gap-2 rounded-[14px] border border-[var(--divider)] bg-[var(--inset)] px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-bold text-[var(--ink)]">
                      {request.petName} ({request.petSpecies}) · {request.serviceName}
                    </span>
                    <span className="block text-[12px] text-[var(--ink-muted)]">
                      {formatWhen(request.requestedStart)} · {request.durationMinutes} min
                    </span>
                    <span className="block text-[12px] text-[var(--ink-faint)]">
                      {request.ownerName} · {request.ownerEmail}
                      {request.ownerPhone ? ` · ${request.ownerPhone}` : ''}
                    </span>
                    {request.concern ? (
                      <span className="block text-[12px] text-[var(--ink-muted)]">
                        {request.concern}
                      </span>
                    ) : null}
                  </span>

                  <span className="flex shrink-0 items-center gap-2">
                    {request.status === 'CONFIRMED' ? (
                      <>
                        <button
                          type="button"
                          disabled={busyId === request.id}
                          onClick={() => update(request.id, 'BOOKED')}
                          className="rounded-full bg-[var(--cta)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--cta-text)] disabled:opacity-50"
                        >
                          Mark booked
                        </button>
                        <button
                          type="button"
                          disabled={busyId === request.id}
                          onClick={() => update(request.id, 'DECLINED')}
                          className="rounded-full border border-[var(--divider)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--ink-muted)] disabled:opacity-50"
                        >
                          Decline
                        </button>
                      </>
                    ) : (
                      <span className="text-[12px] font-semibold text-[var(--ink-faint)]">
                        {STATUS_LABEL[request.status]}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </SectionCard>
  );
};

export default BookingRequests;
