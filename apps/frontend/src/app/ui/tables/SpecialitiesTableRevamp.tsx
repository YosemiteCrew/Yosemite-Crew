import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import GenericTable from '@/app/ui/tables/GenericTable/GenericTable';
import { SpecialityWeb } from '@/app/features/organization/types/speciality';
import SpecialitiesCard from '@/app/ui/cards/SpecialitiesCard';
import { Column, NoDataMessage, ViewButton, ProfileTitle } from '@/app/ui/tables/common';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useShallow } from 'zustand/react/shallow';
import { getSafeImageUrl } from '@/app/lib/urls';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';

import './DataTable.css';

type SpecialitiesTableRevampProps = {
  filteredList: SpecialityWeb[];
  onManageTeam: (speciality: SpecialityWeb) => void;
};

const getRevampId = (item: SpecialityWeb): string => String(item._id ?? '');

const SpecialitiesTableRevamp = ({ filteredList, onManageTeam }: SpecialitiesTableRevampProps) => {
  const allServices = useRevampCatalogStore(useShallow((s) => s.services));
  const allPackages = useRevampCatalogStore(useShallow((s) => s.packages));
  const teams = useTeamForPrimaryOrg();

  const columns: Column<SpecialityWeb>[] = [
    {
      label: 'Speciality',
      key: 'Speciality',
      width: '30%',
      render: (item: SpecialityWeb) => {
        const id = getRevampId(item);
        const openParam = id ? `?open=${id}` : '';
        return (
          <Link
            href={`/organization/specialities${openParam}`}
            className="appointment-profile-title hover:underline! text-text-primary cursor-pointer"
          >
            {item.name}
          </Link>
        );
      },
    },
    {
      label: 'Services',
      key: 'Services',
      width: '100px',
      render: (item: SpecialityWeb) => {
        const id = getRevampId(item);
        const revampCount = id
          ? allServices.filter((s) => s.specialityId === id && s.status === 'ACTIVE').length
          : 0;
        const count =
          revampCount > 0 ? revampCount : (item.activeServiceCount ?? item.services?.length ?? 0);
        return <ProfileTitle>{count}</ProfileTitle>;
      },
    },
    {
      label: 'Packages',
      key: 'Packages',
      width: '100px',
      render: (item: SpecialityWeb) => {
        const id = getRevampId(item);
        const revampCount = id
          ? allPackages.filter((p) => p.specialityId === id && p.status === 'ACTIVE').length
          : 0;
        const count = revampCount > 0 ? revampCount : (item.activePackageCount ?? 0);
        return <ProfileTitle>{count}</ProfileTitle>;
      },
    },
    {
      label: 'Head',
      key: 'Head',
      width: '28%',
      render: (item: SpecialityWeb) => {
        const headTeam = teams?.find((t) => t.practionerId === item.headUserId);
        const headName = item.headName ?? headTeam?.name;
        if (!headName) return <ProfileTitle>{'—'}</ProfileTitle>;
        const picUrl = headTeam?.image ?? item.headProfilePicUrl;
        return (
          <div className="appointment-profile">
            <Image
              src={getSafeImageUrl(picUrl, 'person')}
              alt={headName}
              width={36}
              height={36}
              className="size-9 rounded-full object-cover shrink-0"
            />
            <div className="appointment-profile-two min-w-0">
              <div className="appointment-profile-title truncate">{headName}</div>
            </div>
          </div>
        );
      },
    },
    {
      label: 'Team members',
      key: 'Team members',
      width: '120px',
      render: (item: SpecialityWeb) => (
        <ProfileTitle>{item.teamMemberIds?.length ?? 0}</ProfileTitle>
      ),
    },
    {
      label: 'Actions',
      key: 'actions',
      width: '80px',
      render: (item: SpecialityWeb) => (
        <div className="action-btn-col">
          <ViewButton onClick={() => onManageTeam(item)} />
        </div>
      ),
    },
  ];

  return (
    <div className="w-full">
      {/* Table on wide screens; the table scrolls horizontally if space is tight */}
      <div className="hidden lg:block w-full overflow-x-auto">
        <GenericTable
          data={filteredList}
          columns={columns}
          bordered={false}
          pagination
          pageSize={5}
          tableClassName="specialities-table"
        />
      </div>
      {/* Responsive card grid below lg: 1 col on mobile, 2 on sm, 3 on md */}
      <div className="grid lg:hidden grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {filteredList.length === 0 ? (
          <NoDataMessage />
        ) : (
          filteredList.map((item, i) => (
            <SpecialitiesCard
              key={(item._id ?? item.name ?? '') + i}
              speciality={item}
              handleViewSpeciality={() => onManageTeam(item)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default SpecialitiesTableRevamp;
