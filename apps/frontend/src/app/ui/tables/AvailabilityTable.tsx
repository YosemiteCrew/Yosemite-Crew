import React from 'react';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import GenericTable from '@/app/ui/tables/GenericTable/GenericTable';

import Image from 'next/image';
import { IoEyeOutline } from 'react-icons/io5';
import { Team } from '@/app/features/organization/types/team';

import AvailabilityCard from '@/app/ui/cards/AvailabilityCard';
import { toTitleCase } from '@/app/lib/validators';
import { getSafeImageUrl } from '@/app/lib/urls';

import {
  formatWeeklyWorkingHours,
  getAvailabilityStatusTone,
  toSpecialityNames,
} from '@/app/ui/tables/tableUtils';

import './DataTable.css';

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type AvailabilityTableProps = {
  filteredList: Team[];
  setActive?: (team: Team) => void;
  setView?: (open: boolean) => void;
  hideActions?: boolean;
};

const AvailabilityTable = ({
  filteredList,
  setActive,
  setView,
  hideActions = false,
}: AvailabilityTableProps) => {
  const handleViewTeam = (team: Team) => {
    setActive?.(team);
    setView?.(true);
  };

  const columns: Column<Team>[] = [
    {
      label: '',
      key: 'image',
      width: '56px',
      render: (item: Team) => (
        <div className="appointment-profile size-10">
          <Image
            src={getSafeImageUrl(item.image, 'person')}
            alt=""
            height={40}
            width={40}
            className="size-10 object-cover rounded-full"
          />
        </div>
      ),
    },
    {
      label: 'Name',
      key: 'name',
      width: '18%',
      render: (item: Team) => (
        <div className="appointment-profile">
          <div className="appointment-profile-title">{item.name || '-'}</div>
        </div>
      ),
    },
    {
      label: 'Role',
      key: 'role',
      width: '14%',
      render: (item: Team) => (
        <div className="appointment-profile-title">{toTitleCase(item.role)}</div>
      ),
    },
    {
      label: 'Speciality',
      key: 'speciality',
      width: '18%',
      render: (item: Team) => {
        const names = toSpecialityNames(item.speciality);
        if (names.length === 0) return <div className="appointment-profile-title">-</div>;
        // Joining every speciality made this the only cell in PIMS whose height
        // tracked its data: six specialities wrapped to six lines and stretched
        // the row to 159px next to a 67px neighbour. Lead with the first and
        // count the rest, keeping the full list on hover.
        const [first, ...rest] = names;
        return (
          <div className="appointment-profile-title cell-truncate" title={names.join(', ')}>
            {first}
            {rest.length > 0 && <span className="cell-overflow-count">{`+${rest.length}`}</span>}
          </div>
        );
      },
    },
    {
      label: "Today's Appointment",
      key: 'today',
      width: '14%',
      render: (item: Team) => (
        <div className="appointment-profile-title">{item.todayAppointment || '0'}</div>
      ),
    },
    {
      label: 'Weekly working hours',
      key: 'weekly',
      width: '16%',
      render: (item: Team) => (
        <div className="appointment-profile-title">
          {formatWeeklyWorkingHours(item.weeklyWorkingHours)}
        </div>
      ),
    },
    {
      label: 'Status',
      key: 'status',
      width: '12%',
      render: (item: Team) => (
        <StatusPill tone={getAvailabilityStatusTone(item.status)} label={item.status} />
      ),
    },
  ];
  const actionColoumn = {
    label: 'Actions',
    key: 'actions',
    width: '64px',
    render: (item: Team) => (
      <div className="action-btn-col">
        <button
          type="button"
          onClick={() => handleViewTeam(item)}
          aria-label={`View availability for ${item.name}`}
          className="size-[38px] rounded-full! border border-[var(--hairline)] bg-transparent text-[var(--ink-soft)] flex items-center justify-center cursor-pointer transition-colors hover:border-[var(--divider)] hover:text-[var(--ink)]"
        >
          <IoEyeOutline size={18} aria-hidden="true" />
        </button>
      </div>
    ),
  };

  const finalColoumns = hideActions ? columns : [...columns, actionColoumn];

  return (
    <div className="table-wrapper">
      <div className="table-list">
        <GenericTable
          data={filteredList}
          columns={finalColoumns}
          bordered={false}
          pagination
          pageSize={5}
        />
      </div>
      <div className="flex xl:hidden gap-4 sm:gap-10 flex-wrap">
        {(() => {
          if (filteredList.length === 0) {
            return (
              <div className="w-full py-6 flex items-center justify-center text-body-4 text-text-primary">
                No data available
              </div>
            );
          }
          return filteredList.map((item, i) => (
            <AvailabilityCard key={item._id + i} team={item} handleViewTeam={handleViewTeam} />
          ));
        })()}
      </div>
    </div>
  );
};

export default AvailabilityTable;
