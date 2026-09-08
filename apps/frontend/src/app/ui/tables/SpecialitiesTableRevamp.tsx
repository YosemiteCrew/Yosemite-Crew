import { emptyStateCopy } from '@/app/ui/tables/tableUtils';
import React from 'react';
import Link from 'next/link';
import AvatarImage from '@/app/ui/avatars/AvatarImage';
import GenericTable from '@/app/ui/tables/GenericTable/GenericTable';
import { SpecialityWeb } from '@/app/features/organization/types/speciality';
import SpecialitiesCard from '@/app/ui/cards/SpecialitiesCard';
import { Column, NoDataMessage, ViewButton, ProfileTitle } from '@/app/ui/tables/common';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useShallow } from 'zustand/react/shallow';
import { getSafeImageUrl } from '@/app/lib/urls';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import {
  avatarAccentFor,
  initialsOf,
} from '@/app/features/organization/pages/Organization/Sections/orgDisplay';

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

  const getServiceCount = (item: SpecialityWeb) => {
    const id = getRevampId(item);
    const catalogCount = id
      ? allServices.filter((service) => service.specialityId === id && service.status === 'ACTIVE')
          .length
      : 0;
    return catalogCount > 0
      ? catalogCount
      : (item.activeServiceCount ?? item.services?.length ?? 0);
  };

  const getHeadName = (item: SpecialityWeb) =>
    item.headName ?? teams?.find((team) => team.practionerId === item.headUserId)?.name;

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
      // Counts active services only — the next column counts packages. The old
      // "Services / Packages" label was inaccurate and, at 100px, wrapped to two
      // lines and doubled the height of the sticky header band.
      label: 'Services',
      key: 'Services',
      width: '100px',
      render: (item: SpecialityWeb) => {
        return <ProfileTitle>{getServiceCount(item)}</ProfileTitle>;
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
        const headName = getHeadName(item);
        if (!headName) return <ProfileTitle>{'—'}</ProfileTitle>;
        const picUrl = headTeam?.image ?? item.headProfilePicUrl;
        return (
          <div className="appointment-profile">
            <AvatarImage
              src={getSafeImageUrl(picUrl, 'person')}
              alt={headName}
              size={36}
              className="size-9 rounded-full object-cover shrink-0"
              fallback={
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${avatarAccentFor(item.headUserId || headName)}`}
                >
                  <span aria-hidden="true">{initialsOf(headName)}</span>
                  <span className="sr-only">{headName}</span>
                </span>
              }
            />
            <div className="appointment-profile-two min-w-0">
              <div className="appointment-profile-title cell-truncate" title={headName}>
                {headName}
              </div>
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
    <div className="@container w-full">
      {/* The organization overview places this section in its wider content
          column. Use that available width, rather than the browser width, so a
          wide viewport never forces the six-column table into a narrow card. */}
      <div className="hidden w-full overflow-x-auto @4xl:block">
        <GenericTable
          itemNoun="specialities"
          data={filteredList}
          columns={columns}
          bordered={false}
          pagination
          pageSize={5}
          embedded
        />
      </div>
      <div className="grid grid-cols-1 gap-4 @sm:grid-cols-2 @4xl:hidden">
        {filteredList.length === 0 ? (
          <NoDataMessage {...emptyStateCopy('specialities')} />
        ) : (
          filteredList.map((item, i) => (
            <SpecialitiesCard
              key={(item._id ?? item.name ?? '') + i}
              speciality={item}
              serviceLabel={String(getServiceCount(item))}
              headLabel={getHeadName(item) ?? '—'}
              handleViewSpeciality={() => onManageTeam(item)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default SpecialitiesTableRevamp;
