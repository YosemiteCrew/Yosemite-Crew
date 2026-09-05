import React, { useMemo } from 'react';
import RoomCard from '@/app/ui/cards/RoomCard';
import { OrganisationRoom, Speciality } from '@yosemite-crew/types';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { useSpecialitiesForPrimaryOrg } from '@/app/hooks/useSpecialities';
import { Team } from '@/app/features/organization/types/team';
import { toTitle } from '@/app/lib/validators';
import { NoDataMessage } from '@/app/ui/tables/common';

import { emptyStateCopy, joinNames } from '@/app/ui/tables/tableUtils';
import { IoEyeOutline } from 'react-icons/io5';

// `.TableShell` / `.TableDiv` live in the GenericTable sheet, and this is the one
// table that uses them without rendering GenericTable — without the explicit
// import it would inherit them only when some other table happened to be in the
// same route bundle.
import './GenericTable/Generictable.css';
import './DataTable.css';
import Switch from '@/app/ui/primitives/Switch/Switch';

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
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    className="size-[38px] shrink-0 rounded-full! border border-[var(--hairline)] bg-transparent text-[var(--ink-soft)] flex items-center justify-center cursor-pointer transition-colors hover:border-[var(--divider)] hover:text-[var(--ink)]"
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
  /* Was a 48x24 track with a 16px knob and a green fill from the status tokens.
     The shared switch is the design's 40x24 with an 18px knob, and it fills
     with --blue: availability is a setting, not a success state. */
  <Switch
    checked={checked}
    disabled={disabled}
    label={`${checked ? 'Disable' : 'Enable'} availability for ${roomName}`}
    onChange={onChange}
  />
);

const RoomCellText = ({
  value,
  className = '',
  title,
}: {
  value: React.ReactNode;
  className?: string;
  title?: string;
}) => (
  <div className={`appointment-profile-title ${className}`} title={title}>
    {value}
  </div>
);

const RoomTable = ({
  filteredList,
  setActive,
  setView,
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
      {/* The scroller nests INSIDE the shell, as GenericTable nests
          .TableBodyScroll: `.TableShell` sets `overflow: hidden` unlayered, which
          beats a layered `overflow-x-auto` utility on the same element and would
          clip the trailing columns with no way to reach them. */}
      <div className="table-list TableShell">
        {filteredList.length === 0 ? (
          <NoDataMessage {...emptyStateCopy('rooms')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="TableDiv w-full min-w-[980px]">
              <thead>
                <tr>
                  <th scope="col" aria-label="Row number"></th>
                  <th scope="col">Room name</th>
                  <th scope="col">Code</th>
                  <th scope="col">Type</th>
                  <th scope="col">Speciality</th>
                  <th scope="col">Occupancy</th>
                  <th scope="col">Assigned staff</th>
                  <th scope="col">Availability</th>
                  <th scope="col" className="text-center!">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((room, index) => {
                  const availability = getAvailability(room);
                  const occupancyLabel = getOccupancyLabel(room);
                  const specialityNames = joinNames(specialityNameById, room.assignedSpecialiteis);
                  const staffNames = joinNames(staffNameById, room.assignedStaffs);
                  return (
                    <tr key={room.id || `${room.name}-${index}`}>
                      <td className="align-middle">
                        <RoomCellText value={`${index + 1}.`} />
                      </td>
                      <td className="align-middle">
                        <RoomCellText value={room.name || '-'} />
                      </td>
                      <td className="align-middle">
                        <RoomCellText value={getRoomCode(room)} />
                      </td>
                      <td className="align-middle">
                        <RoomCellText value={toTitle(room.type)} />
                      </td>
                      <td className="max-w-56 align-middle">
                        <RoomCellText
                          value={specialityNames}
                          className="cell-truncate"
                          title={specialityNames || undefined}
                        />
                      </td>
                      <td className="align-middle">
                        <RoomCellText
                          value={occupancyLabel}
                          className={isVacantLabel(occupancyLabel) ? 'text-blue-text' : ''}
                        />
                      </td>
                      <td className="max-w-52 align-middle">
                        <RoomCellText
                          value={staffNames}
                          className="cell-truncate"
                          title={staffNames || undefined}
                        />
                      </td>
                      <td className="align-middle">
                        <div className="flex items-center">
                          <AvailabilitySwitch
                            checked={availability}
                            disabled={!canEditRoom}
                            roomName={room.name}
                            onChange={(next) => onToggleAvailability?.(room, next)}
                          />
                        </div>
                      </td>
                      <td className="align-middle">
                        <div className="action-btn-col items-center">
                          <IconButton
                            label={`View ${room.name}`}
                            onClick={() => handleViewRoom(room)}
                          >
                            <IoEyeOutline size={16} aria-hidden="true" />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="flex xl:hidden gap-4 sm:gap-10 flex-wrap">
        {filteredList.length === 0 ? (
          <NoDataMessage {...emptyStateCopy('rooms')} />
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
