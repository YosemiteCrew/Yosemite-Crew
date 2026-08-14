import SectionCard from '@/app/ui/primitives/SectionCard/SectionCard';
import SpecialitiesTableRevamp from '@/app/ui/tables/SpecialitiesTableRevamp';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SpecialityInfo from '@/app/features/organization/pages/Organization/Sections/Specialities/SpecialityInfo';
import { useSpecialitiesWithServiceNamesForPrimaryOrg } from '@/app/hooks/useSpecialities';
import { SpecialityWeb } from '@/app/features/organization/types/speciality';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import Fallback from '@/app/ui/overlays/Fallback';
import { PERMISSIONS } from '@/app/lib/permissions';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useOrgStore } from '@/app/stores/orgStore';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';

type RevampSpecialityTableRow = SpecialityWeb & {
  revampId: string;
  activeServiceCount?: number;
  activePackageCount?: number;
};

const Specialities = () => {
  const specialities = useSpecialitiesWithServiceNamesForPrimaryOrg();
  const { can } = usePermissions();
  const canEditSpecialities = can(PERMISSIONS.SPECIALITIES_EDIT_ANY);
  const router = useRouter();
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const revampSpecialities = useRevampCatalogStore((s) => s.specialities);
  const loadOrganisationCatalog = useRevampCatalogStore((s) => s.loadOrganisationCatalog);

  const [viewPopup, setViewPopup] = useState(false);
  const [activeSpeciality, setActiveSpeciality] = useState<SpecialityWeb | null>(
    specialities[0] ?? null
  );

  // Re-point the selection when the specialities list changes (adjusted during
  // render, per React's "adjusting state when a prop changes" pattern).
  const [prevSpecialities, setPrevSpecialities] = useState(specialities);
  if (prevSpecialities !== specialities) {
    setPrevSpecialities(specialities);
    setActiveSpeciality((prev) => {
      if (specialities.length === 0) return null;
      if (prev?._id) {
        const updated = specialities.find((s) => s._id === prev._id);
        if (updated) return updated;
      }
      return specialities[0];
    });
  }

  useEffect(() => {
    if (!primaryOrgId) return;
    Promise.resolve(loadOrganisationCatalog(primaryOrgId)).catch(() => undefined);
  }, [loadOrganisationCatalog, primaryOrgId]);

  const catalogSpecialities = primaryOrgId
    ? revampSpecialities.reduce<RevampSpecialityTableRow[]>((rows, speciality) => {
        if (speciality.organisationId !== primaryOrgId) return rows;
        rows.push({
          _id: speciality.id,
          revampId: speciality.id,
          organisationId: speciality.organisationId,
          name: speciality.name,
          headUserId: speciality.headVetId,
          teamMemberIds: speciality.teamMemberIds,
          activeServiceCount: speciality.activeServiceCount,
          activePackageCount: speciality.activePackageCount,
          services: [],
        });
        return rows;
      }, [])
    : [];

  return (
    <PermissionGate
      allOf={[PERMISSIONS.SPECIALITIES_VIEW_ANY]}
      fallback={<Fallback resource="specialities, services and packages" />}
    >
      <SectionCard
        title="Specialties, services & packages"
        buttonTitle="Manage"
        buttonClick={() => router.push('/organization/specialities')}
        showButton={canEditSpecialities}
      >
        <SpecialitiesTableRevamp
          filteredList={catalogSpecialities}
          onManageTeam={(s) => {
            setActiveSpeciality(s);
            setViewPopup(true);
          }}
        />
      </SectionCard>
      {activeSpeciality && (
        <SpecialityInfo
          showModal={viewPopup}
          setShowModal={setViewPopup}
          activeSpeciality={activeSpeciality}
          canEditSpecialities={canEditSpecialities}
        />
      )}
    </PermissionGate>
  );
};

export default Specialities;
