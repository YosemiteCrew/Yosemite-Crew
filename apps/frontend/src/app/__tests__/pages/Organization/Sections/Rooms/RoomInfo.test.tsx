import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";

import RoomInfo from "@/app/pages/Organization/Sections/Rooms/RoomInfo";

const updateRoomMock = jest.fn();
const deleteRoomMock = jest.fn();
const accordionCalls: any[] = [];

jest.mock("@/app/services/roomService", () => ({
  updateRoom: (...args: any[]) => updateRoomMock(...args),
  deleteRoom: (...args: any[]) => deleteRoomMock(...args),
}));

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: () => [{ _id: "team-1", name: "Alex" }],
}));

jest.mock("@/app/hooks/useSpecialities", () => ({
  useSpecialitiesForPrimaryOrg: () => [{ _id: "spec-1", name: "Surgery" }],
}));

jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ showModal, children }: any) => (showModal ? <div>{children}</div> : null),
}));

jest.mock("@/app/components/Icons/Close", () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock("@/app/components/Accordion/EditableAccordion", () => (props: any) => {
  accordionCalls.push(props);
  return <div data-testid="room-accordion" />;
});

describe("RoomInfo modal", () => {
  const activeRoom: any = {
    id: "room-1",
    name: "Room A",
    type: "EXAM",
    assignedSpecialiteis: [],
    assignedStaffs: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    accordionCalls.length = 0;
  });

  it("updates room on save", async () => {
    render(
      <RoomInfo
        showModal
        setShowModal={jest.fn()}
        activeRoom={activeRoom}
        canEditRoom
      />
    );

    await accordionCalls[0].onSave({
      name: "Updated",
      type: "EXAM",
      assignedSpecialiteis: [],
      assignedStaffs: [],
    });

    expect(updateRoomMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "room-1", name: "Updated" })
    );
  });
});
