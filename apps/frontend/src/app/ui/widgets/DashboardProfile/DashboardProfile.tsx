'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import { FaClock } from 'react-icons/fa6';

import { Primary } from '@/app/ui/primitives/Buttons';
import { usePrimaryOrg } from '@/app/hooks/useOrgSelectors';
import { useAuthStore } from '@/app/stores/authStore';
import { getSafeImageUrl } from '@/app/lib/urls';
import { usePrimaryOrgProfile } from '@/app/hooks/useProfiles';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import dynamic from 'next/dynamic';
const CalBookingOverlay = dynamic(() => import('@/app/ui/overlays/CalBookingOverlay'), {
  ssr: false,
});

const DashboardProfile = () => {
  const profile = usePrimaryOrgProfile();
  const primaryOrg = usePrimaryOrg();
  const attributes = useAuthStore((s) => s.attributes);
  const [calOpen, setCalOpen] = useState(false);

  if (!primaryOrg) return null;

  const fullName = `${attributes?.given_name || ''} ${attributes?.family_name || ''}`.trim();

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex w-full flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="font-newsreader text-[16px] italic" style={{ color: 'var(--pink)' }}>
            Welcome back,
          </span>
          <span className="flex items-center gap-2.5">
            <Image
              src={getSafeImageUrl(profile?.personalDetails?.profilePictureUrl, 'person')}
              alt=""
              height={38}
              width={38}
              className="max-h-[38px] min-w-[38px] rounded-full object-cover"
            />
            <span className="font-newsreader text-[27px] tracking-[-0.015em] text-text-primary">
              {fullName}
            </span>
          </span>
          <span className="mt-0.5 text-[13.5px] text-text-tertiary">
            Your central hub for insights, performance tracking and quick access to essential tools
          </span>
        </div>
        {primaryOrg.isVerified && (
          <span className="flex items-center gap-2 rounded-full border border-card-border bg-[var(--pill-raised)] px-3.5 py-2 text-[12.5px] font-semibold text-text-primary">
            <span
              className="h-[7px] w-[7px] rounded-full"
              style={{ background: 'var(--success)' }}
              aria-hidden="true"
            />
            Verified clinic
          </span>
        )}
      </div>

      <PermissionGate allOf={[PERMISSIONS.ORG_EDIT]}>
        {!primaryOrg.isVerified && (
          <div className="flex w-full flex-col gap-2">
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <div className="flex items-center justify-center gap-2 rounded-2xl bg-card-warning px-6 py-3">
                <FaClock color="var(--color-warning-600)" size={16} />
                <span className="text-body-4-emphasis text-pending-text">
                  Verification in progress — Limited access enabled
                </span>
              </div>
              <Primary text="Verify business profile" href="#" onClick={() => setCalOpen(true)} />
            </div>
            <div className="text-caption-1 text-text-primary w-full sm:max-w-125">
              <span className="text-text-brand">Note : </span>This short chat helps us confirm your
              business and add you to our trusted network of verified pet professionals - so you can
              start connecting with clients faster.
            </div>
          </div>
        )}
      </PermissionGate>
      <CalBookingOverlay open={calOpen} onClose={() => setCalOpen(false)} />
    </div>
  );
};

export default DashboardProfile;
