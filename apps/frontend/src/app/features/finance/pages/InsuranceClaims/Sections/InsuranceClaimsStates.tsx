'use client';
import React from 'react';
import { Secondary } from '@/app/ui/primitives/Buttons';

type InsuranceClaimsStatesProps = {
  loading: boolean;
  error: string | null;
  onReload: () => void;
  isEmpty: boolean;
  /** Why the list is empty, resolved by the container from filter and query. */
  emptyMessage: string;
};

/**
 * The list's loading, error and empty placeholders, which are mutually
 * exclusive with the table. Returns null once there are claims to show, so the
 * page reads as `<States/>` then the table rather than three inline branches.
 */
const InsuranceClaimsStates = ({
  loading,
  error,
  onReload,
  isEmpty,
  emptyMessage,
}: InsuranceClaimsStatesProps) => {
  if (loading) {
    return <div className="h-40 rounded-2xl bg-card-hover animate-pulse" aria-hidden="true" />;
  }

  if (error) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-danger-100 p-3!">
        <p role="alert" className="text-body-4 text-text-error">
          {error}
        </p>
        <Secondary text="Retry" onClick={onReload} ariaLabel="Retry loading insurance claims" />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="border border-card-border rounded-2xl px-6! py-10! text-center">
        <p className="text-body-3 text-text-primary">No insurance claims yet</p>
        <p className="text-body-4 text-text-secondary">{emptyMessage}</p>
      </div>
    );
  }

  return null;
};

export default InsuranceClaimsStates;
