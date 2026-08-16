'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import { IoTimeOutline } from 'react-icons/io5';

import { Primary } from '@/app/ui/primitives/Buttons';
import { usePrimaryOrg } from '@/app/hooks/useOrgSelectors';
import { useAuthStore } from '@/app/stores/authStore';
import { getSafeImageUrl } from '@/app/lib/urls';
import { usePrimaryOrgProfile } from '@/app/hooks/useProfiles';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
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
        <div className="flex flex-col gap-0.5">
          <span className="font-newsreader text-[16px] italic text-[var(--blue-text)]">
            Welcome back,
          </span>
          <span className="flex items-center gap-[9px]">
            <Image
              src={getSafeImageUrl(profile?.personalDetails?.profilePictureUrl, 'person')}
              alt=""
              height={38}
              width={38}
              className="max-h-[38px] min-w-[38px] rounded-full object-cover"
            />
            <span className="font-newsreader text-[27px] tracking-[-0.015em] text-[var(--ink)]">
              {fullName}
            </span>
          </span>
          <span className="mt-0.5 text-[13.5px] text-[var(--ink-muted)]">
            Your central hub for insights, performance tracking and quick access to essential tools
          </span>
        </div>
        {primaryOrg.isVerified && <StatusPill tone="success" showDot label="Verified clinic" />}
      </div>

      <PermissionGate allOf={[PERMISSIONS.ORG_EDIT]}>
        {!primaryOrg.isVerified && (
          <div className="flex w-full flex-col gap-2">
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <div className="flex items-center justify-center gap-2 rounded-[14px] border border-[var(--warn-border)] bg-[var(--warn-bg)] px-[18px] py-[11px]">
                <IoTimeOutline color="var(--warn-text)" size={15} />
                <span className="text-[13px] font-semibold text-[var(--warn-text)]">
                  Verification in progress. Limited access enabled
                </span>
              </div>
              <Primary text="Verify business profile" href="#" onClick={() => setCalOpen(true)} />
            </div>
            <div className="w-full text-[12.5px] leading-[1.55] text-[var(--ink-muted)] sm:max-w-[560px]">
              <span className="font-semibold text-[var(--blue-text)]">Note: </span>This short chat
              helps us confirm your business and add you to our trusted network of verified pet
              professionals, so you can start connecting with clients faster.
            </div>
          </div>
        )}
      </PermissionGate>
      <CalBookingOverlay open={calOpen} onClose={() => setCalOpen(false)} />
    </div>
  );
};

export default DashboardProfile;
