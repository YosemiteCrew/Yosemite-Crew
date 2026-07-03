import React from 'react';
import GenericTable from '@/app/ui/tables/GenericTable/GenericTable';
import { SpecialityWeb } from '@/app/features/organization/types/speciality';
import SpecialitiesCard from '@/app/ui/cards/SpecialitiesCard';
import { Column, NoDataMessage, ViewButton, ProfileTitle } from '@/app/ui/tables/common';

import { getServiceNames } from '@/app/ui/tables/tableUtils';

import './DataTable.css';

type SpecialitiesTableProps = {
  filteredList: SpecialityWeb[];
  setActive: (speciality: any) => void;
  setView: (open: boolean) => void;
};

const SpecialitiesTable = ({ filteredList, setActive, setView }: SpecialitiesTableProps) => {
  const handleViewSpeciality = (speciality: any) => {
    setActive(speciality);
    setView(true);
  };

  const columns: Column<SpecialityWeb>[] = [
    {
      label: 'Speciality',
      key: 'Speciality',
      width: '22%',
      render: (item: SpecialityWeb) => <ProfileTitle>{item.name}</ProfileTitle>,
    },
    {
      label: 'Services / Packages',
      key: 'Services',
      width: '30%',
      render: (item: SpecialityWeb) => (
        <ProfileTitle>{getServiceNames(item.services) || '—'}</ProfileTitle>
      ),
    },
    {
      label: 'Team members',
      key: 'Team members',
      width: '14%',
      render: (item: SpecialityWeb) => (
        <ProfileTitle>{item.teamMemberIds?.length ?? 0}</ProfileTitle>
      ),
    },
    {
      label: 'Head',
      key: 'Head',
      width: '22%',
      render: (item: SpecialityWeb) => <ProfileTitle>{item.headName || '—'}</ProfileTitle>,
    },
    {
      label: 'Actions',
      key: 'actions',
      width: '64px',
      render: (item: SpecialityWeb) => (
        <div className="action-btn-col">
          <ViewButton onClick={() => handleViewSpeciality(item)} />
        </div>
      ),
    },
  ];

  return (
    <div className="w-full">
      <div className="hidden xl:flex">
        <GenericTable
          data={filteredList}
          columns={columns}
          bordered={false}
          pagination
          pageSize={5}
        />
      </div>
      <div className="flex xl:hidden gap-4 sm:gap-10 flex-wrap">
        {filteredList.length === 0 ? (
          <NoDataMessage />
        ) : (
          filteredList.map((item, i) => (
            <SpecialitiesCard
              key={item.name + i}
              speciality={item}
              handleViewSpeciality={handleViewSpeciality}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default SpecialitiesTable;
