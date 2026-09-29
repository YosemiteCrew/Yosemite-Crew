'use client';

import { Button, Text } from '@/app/ui';

type MedicationHistoryStatusProps = {
  /** False until the inpatient record supplies the three identifiers. */
  ready: boolean;
  isLoading: boolean;
  /** True once a load has finished and the encounter has no recorded doses. */
  isEmpty: boolean;
  error: string | null;
  /** True when reloading is the fix, so the error offers a Refresh. */
  canRefresh: boolean;
  /** True while a write is in flight, which blocks the reload. */
  isBusy: boolean;
  onRefresh: () => void;
};

/**
 * What the history area says instead of doses: not ready yet, loading, failed,
 * or nothing scheduled. One component so the panel renders state rather than
 * assembling it inline beside the doses it describes.
 */
const MedicationHistoryStatus = ({
  ready,
  isLoading,
  isEmpty,
  error,
  canRefresh,
  isBusy,
  onRefresh,
}: MedicationHistoryStatusProps) => (
  <>
    {!ready && (
      <Text as="p" variant="body-4" className="text-text-secondary">
        Medication history will be available once the inpatient record is loaded.
      </Text>
    )}

    {isLoading && (
      <Text as="p" variant="body-4" role="status" className="text-text-secondary">
        Loading medication history…
      </Text>
    )}

    {error && (
      <div className="flex flex-wrap items-center gap-3">
        <Text as="p" variant="body-4" role="alert" className="text-text-error">
          {error}
        </Text>
        {canRefresh && (
          <Button text="Refresh" variant="secondary" onClick={onRefresh} isDisabled={isBusy} />
        )}
      </div>
    )}

    {!isLoading && ready && isEmpty && (
      <Text as="p" variant="body-4" className="text-text-secondary">
        No medication doses are scheduled for this inpatient stay.
      </Text>
    )}
  </>
);

export default MedicationHistoryStatus;
