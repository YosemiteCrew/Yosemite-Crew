import type { Location as FHIRLocation } from "@yosemite-crew/fhirtypes";
import {
  fromFHIROrganisationRoom,
  toFHIROrganisationRoom,
  type OrganisationRoom,
} from "../organisationRoom";

export type OrganisationRoomRequestDTO = FHIRLocation;

export type OrganisationRoomResponseDTO = FHIRLocation;

export type OrganisationRoomDTOAttributes = OrganisationRoom;

export const fromOrganisationRoomRequestDTO = (
  dto: OrganisationRoomRequestDTO
): OrganisationRoomDTOAttributes => {
  const room = fromFHIROrganisationRoom(dto);

  return {
    ...room,
    id: dto.id ?? room.id,
  };
};

export const toOrganisationRoomResponseDTO = (
  room: OrganisationRoom
): OrganisationRoomResponseDTO => toFHIROrganisationRoom(room);
