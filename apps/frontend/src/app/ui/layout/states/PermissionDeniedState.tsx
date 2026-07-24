'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { IoLockClosedOutline } from 'react-icons/io5';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { useOrgStore } from '@/app/stores/orgStore';
import './states.css';

export type PermissionDeniedStateProps = {
  /** Denied resource label (e.g. "Finance") — real data, not hardcoded. */
  resource?: string;
  /** What the role can't view (e.g. "invoices and payouts"); defaults to the resource. */
  detail?: string;
  /** Explicit role override; otherwise resolved from the active org membership. */
  role?: string;
  /** Org whose membership role is shown; defaults to the primary org. */
  orgId?: string | null;
  onRequestAccess?: () => void;
  onBack?: () => void;
};

const PermissionDeniedState = ({
  resource = 'this area',
  detail,
  role,
  orgId,
  onRequestAccess,
  onBack,
}: PermissionDeniedStateProps) => {
  const router = useRouter();
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const membershipsByOrgId = useOrgStore((s) => s.membershipsByOrgId);

  const activeOrgId = orgId ?? primaryOrgId;
  const membership = activeOrgId ? membershipsByOrgId[activeOrgId] : undefined;
  const resolvedRole =
    role ?? membership?.roleDisplay ?? membership?.roleCode ?? 'your current role';
  const resolvedDetail = detail ?? resource;

  const handleRequestAccess = onRequestAccess ?? (() => router.push('/organization'));
  const handleBack = onBack ?? (() => router.back());

  return (
    <div className="yc-state-wrap">
      <div className="yc-state-card">
        <span className="yc-state-icon yc-state-icon--warn" aria-hidden>
          <IoLockClosedOutline size={25} />
        </span>
        <div className="yc-state-title">You don&apos;t have access to {resource}</div>
        <p className="yc-state-text">
          Your role ({resolvedRole}) can&apos;t view {resolvedDetail}. An owner or manager can
          change this in Organization → Team.
        </p>
        <div className="yc-state-actions">
          <Primary text="Request access" onClick={handleRequestAccess} />
          <Secondary text="Back" onClick={handleBack} />
        </div>
      </div>
    </div>
  );
};

export default PermissionDeniedState;
