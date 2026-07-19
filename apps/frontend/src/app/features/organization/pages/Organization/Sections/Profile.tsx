import React, { useState } from 'react';
import { IoCheckmark } from 'react-icons/io5';
import OrgProfileBand from '@/app/features/organization/pages/Organization/Sections/OrgProfileBand';
import OrgProfileEditCards from '@/app/features/organization/pages/Organization/Sections/OrgProfileEditCards';
import { useOrgProfileForm } from '@/app/features/organization/pages/Organization/Sections/useOrgProfileForm';
import { Organisation } from '@yosemite-crew/types';
import { PERMISSIONS } from '@/app/lib/permissions';
import { usePermissions } from '@/app/hooks/usePermissions';

type ProfileProps = {
  primaryOrg: Organisation;
};

const Profile = ({ primaryOrg }: ProfileProps) => {
  const form = useOrgProfileForm(primaryOrg);
  const [isEditing, setIsEditing] = useState(false);
  const { can } = usePermissions();
  const canEditOrg = can(PERMISSIONS.ORG_EDIT);

  if (!isEditing) {
    return (
      <OrgProfileBand org={form.formData} canEdit={canEditOrg} onEdit={() => setIsEditing(true)} />
    );
  }

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center justify-between gap-3">
        <div className="font-newsreader text-[22px] tracking-[-0.015em] text-[var(--ink)]">
          Edit organization profile
        </div>
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          className="inline-flex h-[38px] flex-none items-center gap-[7px] rounded-full bg-[var(--cta)] px-4! text-[12.5px] font-semibold text-[var(--cta-text)] hover:opacity-90 transition-opacity cursor-pointer"
        >
          <IoCheckmark size={14} aria-hidden="true" />
          Done
        </button>
      </div>
      <OrgProfileEditCards form={form} canEditOrg={canEditOrg} />
    </div>
  );
};

export default Profile;
