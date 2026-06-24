import React, { useMemo } from 'react';
import RoomCard from '@/app/ui/cards/RoomCard';
import { OrganisationRoom, Speciality } from '@yosemite-crew/types';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { useSpecialitiesForPrimaryOrg } from '@/app/hooks/useSpecialities';
import { Team } from '@/app/features/organization/types/team';
import { toTitle } from '@/app/lib/validators';
import { NoDataMessage } from '@/app/ui/tables/common';

import { joinNames } from '@/app/ui/tables/tableUtils';
import { IoCreateOutline, IoEyeOutline } from 'react-icons/io5';

import './DataTable.css';

type RoomUnit = {
  id?: string;
  name?: string;
  occupied?: boolean;
};

type RoomManagementRoom = OrganisationRoom & {
  code?: string;
  availability?: {
    isAvailable?: boolean;
  };
  occupancyStatus?: 'OCCUPIED' | 'VACANT';
  unitCount?: number;
  units?: RoomUnit[];
};

type RoomTableProps = {
  filteredList: RoomManagementRoom[];
  setActive?: (room: RoomManagementRoom) => void;
  setView?: (open: boolean) => void;
  onEdit?: (room: RoomManagementRoom) => void;
  onToggleAvailability?: (room: RoomManagementRoom, isAvailable: boolean) => void;
  canEditRoom?: boolean;
};

const getRoomCode = (room: RoomManagementRoom) => room.code || room.id || '-';

const getAvailability = (room: RoomManagementRoom) =>
  room.availableNow ?? room.availability?.isAvailable ?? true;

const getOccupancyLabel = (room: RoomManagementRoom) => {
  const units = room.units ?? [];
  if (room.occupancyStatus === 'OCCUPIED') return 'Occupied';
  if (room.occupancyStatus === 'VACANT') return 'Vacant';
  if (!units.length) return '-';
  const vacantUnits = units.filter((unit) => !unit.occupied).length;
  if (vacantUnits === 0) return 'Occupied';
  return vacantUnits === units.length ? 'Vacant' : `Vacant (${vacantUnits})`;
};

const isVacantLabel = (label: string) => label.startsWith('Vacant');

const IconButton = ({
  label,
  onClick,
  children,
  isPrimary = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  isPrimary?: boolean;
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    className={`hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] size-10 shrink-0 rounded-full! border flex items-center justify-center cursor-pointer transition-colors ${
      isPrimary
        ? 'border-text-primary bg-text-primary text-white'
        : 'border-text-primary bg-white text-text-primary hover:border-text-brand hover:text-text-brand'
    }`}
  >
    {children}
  </button>
);

const AvailabilitySwitch = ({
  checked,
  disabled,
  onChange,
  roomName,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
  roomName: string;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={`${checked ? 'Disable' : 'Enable'} availability for ${roomName}`}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className="inline-flex h-6 w-12 shrink-0 items-center rounded-full p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    style={{
      backgroundColor: checked ? 'var(--color-success-bright)' : 'var(--color-neutral-300)',
    }}
  >
    <span
      aria-hidden="true"
      className={`block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-0'
      }`}
    />
  </button>
);

const RoomCellText = ({
  value,
  className = '',
}: {
  value: React.ReactNode;
  className?: string;
}) => <div className={`appointment-profile-title ${className}`}>{value}</div>;

const RoomTable = ({
  filteredList,
  setActive,
  setView,
  onEdit,
  onToggleAvailability,
  canEditRoom = false,
}: RoomTableProps) => {
  const teams = useTeamForPrimaryOrg();
  const specialities = useSpecialitiesForPrimaryOrg();

  const staffNameById = useMemo(() => {
    return teams?.reduce((acc: Record<string, string>, s: Team) => {
      const name = s.name ?? '';
      if (s.practionerId) {
        acc[s.practionerId] = name;
      }
      if (s._id) {
        acc[s._id] = name;
      }
      return acc;
    }, {});
  }, [teams]);

  const specialityNameById = useMemo(() => {
    return specialities?.reduce((acc: Record<string, string>, sp: Speciality) => {
      acc[sp._id || sp.name] = sp.name ?? '';
      return acc;
    }, {});
  }, [specialities]);

  const handleViewRoom = (room: RoomManagementRoom) => {
    setActive?.(room);
    setView?.(true);
  };

  return (
    <div className="table-wrapper">
      <div className="table-list overflow-x-auto">
        {filteredList.length === 0 ? (
          <NoDataMessage />
        ) : (
          <table className="w-full min-w-[980px] border-collapse">
            <thead>
              <tr>
                <th
                  className="px-4 py-3 text-left text-body-4-emphasis text-text-secondary"
                  aria-label="Row number"
                ></th>
                <th className="px-4 py-3 text-left text-body-4-emphasis text-text-secondary">
                  Room name
                </th>
                <th className="px-4 py-3 text-left text-body-4-emphasis text-text-secondary">
                  Code
                </th>
                <th className="px-4 py-3 text-left text-body-4-emphasis text-text-secondary">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-body-4-emphasis text-text-secondary">
                  Speciality
                </th>
                <th className="px-4 py-3 text-left text-body-4-emphasis text-text-secondary">
                  Occupancy
                </th>
                <th className="px-4 py-3 text-left text-body-4-emphasis text-text-secondary">
                  Assigned Staff
                </th>
                <th className="px-4 py-3 text-left text-body-4-emphasis text-text-secondary">
                  Availability
                </th>
                <th className="px-4 py-3 text-center text-body-4-emphasis text-text-secondary">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((room, index) => {
                const availability = getAvailability(room);
                const occupancyLabel = getOccupancyLabel(room);
                return (
                  <tr
                    key={room.id || `${room.name}-${index}`}
                    className="border-b border-card-border last:border-b-0"
                  >
                    <td className="px-4 py-4 align-middle">
                      <RoomCellText value={`${index + 1}.`} />
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <RoomCellText value={room.name || '-'} />
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <RoomCellText value={getRoomCode(room)} />
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <RoomCellText value={toTitle(room.type)} />
                    </td>
                    <td className="max-w-56 px-4 py-4 align-middle">
                      <RoomCellText
                        value={joinNames(specialityNameById, room.assignedSpecialiteis)}
                      />
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <RoomCellText
                        value={occupancyLabel}
                        className={isVacantLabel(occupancyLabel) ? 'text-blue-text' : ''}
                      />
                    </td>
                    <td className="max-w-52 px-4 py-4 align-middle">
                      <RoomCellText value={joinNames(staffNameById, room.assignedStaffs)} />
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <div className="flex items-center">
                        <AvailabilitySwitch
                          checked={availability}
                          disabled={!canEditRoom}
                          roomName={room.name}
                          onChange={(next) => onToggleAvailability?.(room, next)}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <div className="action-btn-col items-center">
                        <IconButton
                          label={`View ${room.name}`}
                          onClick={() => handleViewRoom(room)}
                          isPrimary
                        >
                          <IoEyeOutline size={16} aria-hidden="true" />
                        </IconButton>
                        {canEditRoom && (
                          <IconButton label={`Edit ${room.name}`} onClick={() => onEdit?.(room)}>
                            <IoCreateOutline size={16} aria-hidden="true" />
                          </IconButton>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className="flex xl:hidden gap-4 sm:gap-10 flex-wrap">
        {filteredList.length === 0 ? (
          <NoDataMessage />
        ) : (
          filteredList.map((item, i) => (
            <RoomCard
              key={item.name + i}
              room={item}
              handleViewRoom={handleViewRoom}
              staffNameById={staffNameById}
              specialityNameById={specialityNameById}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default RoomTable;
