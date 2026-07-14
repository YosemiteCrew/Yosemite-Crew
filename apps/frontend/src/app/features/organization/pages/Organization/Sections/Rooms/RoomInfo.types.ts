import type { OrganisationRoom, RoomReferenceMapping } from '@yosemite-crew/types';

export type RoomUnitDetails = {
  id: string;
  name: string;
  size: string;
  count: number;
  occupied?: boolean;
};

export type ManagedRoom = Omit<OrganisationRoom, 'assignedSpecialiteis' | 'assignedStaffs'> & {
  code?: string;
  assignedSpecialiteis?: string[];
  assignedStaffs?: string[];
  availability?: {
    isAvailable?: boolean;
    days?: string;
    startTime?: string;
    endTime?: string;
    species?: string | string[];
    totalUnits?: number;
  };
  unitCount?: number;
  units?: RoomUnitDetails[];
  equipment?: string[];
  archived?: boolean;
};

export type RoomFormInput = Omit<ManagedRoom, 'assignedSpecialiteis' | 'assignedStaffs'> & {
  assignedSpecialiteis?: RoomReferenceMapping[] | string[];
  assignedStaffs?: RoomReferenceMapping[] | string[];
};
