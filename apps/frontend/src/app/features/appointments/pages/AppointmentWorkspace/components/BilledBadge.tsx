import React from 'react';
import { LuCheck } from 'react-icons/lu';

/**
 * Small green "Billed" pill shown on a services/packages or prescription line
 * item once it is on a finalized/paid invoice. A billed item is read-only and
 * cannot be deleted; new items can still be added alongside it.
 */
const BilledBadge = () => (
  <span className="inline-flex items-center gap-1 rounded-2xl border border-pill-success-border bg-pill-success-bg px-2 py-0.5 text-caption-2 font-medium text-pill-success-text">
    <LuCheck size={12} aria-hidden="true" />
    Billed
  </span>
);

export default BilledBadge;
