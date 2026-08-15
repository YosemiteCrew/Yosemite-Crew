import React from 'react';
import PermissionDeniedState from '@/app/ui/layout/states/PermissionDeniedState';

export type FallbackProps = {
  /**
   * What the caller could not see, e.g. "invoices and payouts". Naming it lets
   * the notice say which permission is missing instead of just "Not authorized".
   */
  resource?: string;
  /** Org whose membership role is quoted; defaults to the primary org. */
  orgId?: string | null;
};

/**
 * Section-level permission denial.
 *
 * Previously this rendered a bare red "Not authorized" line: error styling for
 * a non-error state, with no role named and no way forward. A permission
 * boundary is an expected condition, so it now renders the shared
 * PermissionDeniedState in its compact `inline` variant, which quotes the
 * caller's real role and offers a request-access route.
 *
 * Page-level gates should pass `deniedResource` to PermissionGate instead,
 * which renders the full centered card.
 */
const Fallback = ({ resource, orgId }: FallbackProps = {}) => (
  <PermissionDeniedState
    variant="inline"
    resource={resource ?? 'this section'}
    detail={resource}
    orgId={orgId}
  />
);

export default Fallback;
