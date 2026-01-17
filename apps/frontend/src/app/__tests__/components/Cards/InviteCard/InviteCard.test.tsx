import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import InviteCard from "@/app/components/Cards/InviteCard/InviteCard";

jest.mock("@/app/utils/validators", () => ({
  toTitle: (value: string) => value.toUpperCase(),
  toTitleCase: (value: string) => value.toUpperCase(),
}));

describe("InviteCard", () => {
  it("renders invite details and handles actions", () => {
    const handleAccept = jest.fn().mockResolvedValue(undefined);
    const handleReject = jest.fn();
    const invite: any = {
      organisationName: "Good Pets",
      organisationType: "hospital",
      role: "owner",
      employmentType: "full_time",
    };

    render(
      <InviteCard
        invite={invite}
        handleAccept={handleAccept}
        handleReject={handleReject}
      />
    );

    expect(screen.getByText("Good Pets")).toBeInTheDocument();
    expect(screen.getByText("HOSPITAL")).toBeInTheDocument();
    expect(screen.getByText("OWNER")).toBeInTheDocument();
    expect(screen.getByText("FULL_TIME")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(handleAccept).toHaveBeenCalledWith(invite);

    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(handleReject).toHaveBeenCalledWith(invite);
  });
});
