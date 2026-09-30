'use client';

import Link from 'next/link';
import { IoArrowBackOutline, IoCheckmarkCircleOutline, IoRefreshOutline } from 'react-icons/io5';
import { PERMISSIONS } from '@/app/lib/permissions';
import { formatDisplayDate } from '@/app/lib/date';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useOrgStore } from '@/app/stores/orgStore';
import Fallback from '@/app/ui/overlays/Fallback';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import type { PossibleDuplicate } from '@/app/features/companions/services/patientDuplicateReviewService';
import { duplicatePairId, useDuplicateReview } from './useDuplicateReview';

const dateLabel = (value: string) => {
  const date = formatDisplayDate(value);
  return date ? `Born ${date}` : 'Date of birth not available';
};

type ReviewQueueProps = {
  matches: PossibleDuplicate[];
  canDismiss: boolean;
  busyPair: string | null;
  onDismiss: (match: PossibleDuplicate) => void;
};

const ReviewQueue = ({ matches, canDismiss, busyPair, onDismiss }: ReviewQueueProps) => (
  <ul className="space-y-3" aria-label="Possible duplicate patient pairs">
    {matches.map((match) => {
      const pairId = duplicatePairId(match);
      const matchingLabel =
        match.matchingOn === 'microchip' ? 'Same microchip' : 'Same name and birth date';
      return (
        <li
          key={pairId}
          className="rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] p-4 shadow-sm sm:p-5"
        >
          <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            {[match.patientA, match.patientB].map((patient, index) => (
              <div key={patient.id} className="min-w-0">
                {index === 1 && (
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--ink-faint)] sm:hidden">
                    Possible match
                  </span>
                )}
                <p className="truncate text-base font-semibold">
                  {patient.name || 'Unnamed patient'}
                </p>
                <p className="mt-1 text-sm text-[var(--ink-muted)]">
                  {dateLabel(patient.dateOfBirth)}
                </p>
              </div>
            ))}
            <span className="hidden rounded-full bg-[var(--field-bg)] px-3 py-1 text-xs font-medium text-[var(--ink-muted)] sm:block">
              {matchingLabel}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--divider)] pt-3">
            <span className="text-xs text-[var(--ink-muted)] sm:hidden">{matchingLabel}</span>
            {canDismiss && (
              <button
                type="button"
                onClick={() => onDismiss(match)}
                disabled={busyPair !== null}
                className="ml-auto min-h-10 rounded-xl px-3 text-sm font-semibold text-[var(--ink-muted)] transition-colors hover:bg-[var(--field-bg)] hover:text-[var(--ink)] disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                {busyPair === pairId ? 'Dismissing…' : 'Dismiss as not a match'}
              </button>
            )}
          </div>
        </li>
      );
    })}
  </ul>
);

type ReviewContentProps = ReviewQueueProps & {
  isLoading: boolean;
  hasOrganisation: boolean;
  currentLoadError: string | null;
};

const ReviewContent = ({
  isLoading,
  hasOrganisation,
  currentLoadError,
  matches,
  canDismiss,
  busyPair,
  onDismiss,
}: ReviewContentProps) => {
  if (isLoading) {
    return (
      <output aria-label="Loading possible duplicate patients" className="block space-y-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-28 animate-pulse rounded-2xl border border-[var(--hairline)] bg-[var(--field-bg)] motion-reduce:animate-none"
          />
        ))}
      </output>
    );
  }
  if (!hasOrganisation || currentLoadError) return null;
  if (matches.length === 0) {
    return (
      <section className="rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] px-5 py-10 text-center sm:px-8">
        <IoCheckmarkCircleOutline
          className="mx-auto mb-3 text-3xl text-[var(--success)]"
          aria-hidden="true"
        />
        <h2 className="text-lg font-semibold">No possible duplicates to review</h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          New matches will appear here when patient records are added.
        </p>
      </section>
    );
  }
  return (
    <ReviewQueue
      matches={matches}
      canDismiss={canDismiss}
      busyPair={busyPair}
      onDismiss={onDismiss}
    />
  );
};

const PossibleDuplicates = () => {
  const organisationId = useOrgStore((state) => state.primaryOrgId);
  const canDismiss = usePermissions().can(PERMISSIONS.COMPANIONS_EDIT_ANY);
  const review = useDuplicateReview(organisationId);

  return (
    <PermissionGate allOf={[PERMISSIONS.COMPANIONS_VIEW_ANY]} fallback={<Fallback />}>
      <main className="mx-auto w-full max-w-5xl px-4 py-6 text-[var(--ink)] sm:px-6 lg:py-8">
        <Link
          href="/companions"
          className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-medium text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          <IoArrowBackOutline aria-hidden="true" />
          Back to patients
        </Link>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-page-title">Possible duplicate patients</h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--ink-muted)]">
              Review records that share an exact microchip number or the same name and date of
              birth. No patient records are combined automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void review.refresh()}
            disabled={review.loading}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--screen)] px-3 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--field-bg)] disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <IoRefreshOutline aria-hidden="true" />
            Refresh
          </button>
        </div>

        {review.visibleError && (
          <div
            role="alert"
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/5 px-4 py-3 text-sm text-[var(--ink)]"
          >
            <span>{review.visibleError}</span>
            <button
              type="button"
              onClick={() => void review.refresh()}
              className="font-semibold underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        )}

        <ReviewContent
          isLoading={review.isLoading}
          hasOrganisation={Boolean(organisationId)}
          currentLoadError={review.currentLoadError}
          matches={review.matches}
          canDismiss={canDismiss}
          busyPair={review.busyPair}
          onDismiss={(match) => void review.dismiss(match)}
        />
      </main>
    </PermissionGate>
  );
};

export default PossibleDuplicates;
