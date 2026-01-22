import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import Rooms from "@/app/pages/Organization/Sections/Rooms/Rooms";

const useRoomsMock = jest.fn();
const usePermissionsMock = jest.fn();
const accordionButtonSpy = jest.fn();

jest.mock("@/app/hooks/useRooms", () => ({
  useRoomsForPrimaryOrg: () => useRoomsMock(),
}));

jest.mock("@/app/hooks/usePermissions", () => ({
  usePermissions: () => usePermissionsMock(),
}));

jest.mock("@/app/components/PermissionGate", () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/components/Accordion/AccordionButton", () => (props: any) => {
  accordionButtonSpy(props);
  return <div data-testid="accordion-button">{props.children}</div>;
});

jest.mock("@/app/components/DataTable/RoomTable", () => () => (
  <div data-testid="room-table" />
));

jest.mock("@/app/pages/Organization/Sections/Rooms/AddRoom", () => () => (
  <div data-testid="add-room" />
));

jest.mock("@/app/pages/Organization/Sections/Rooms/RoomInfo", () => () => (
  <div data-testid="room-info" />
));

describe("Rooms section", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useRoomsMock.mockReturnValue([{ id: "room-1", name: "Room A" }]);
    usePermissionsMock.mockReturnValue({ can: jest.fn(() => true) });
  });

  it("renders rooms and add button when permitted", () => {
    render(<Rooms />);

    expect(screen.getByTestId("room-table")).toBeInTheDocument();
    expect(accordionButtonSpy).toHaveBeenCalledWith(
      expect.objectContaining({ showButton: true })
    );
  });
});
