import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import InviteCard from "@/app/components/Cards/InviteCard/InviteCard";

describe("InviteCard", () => {
  test("renders invite details and actions", () => {
    const invite = { name: "Paws Clinic", type: "Hospital", role: "Vet" };
    render(<InviteCard invite={invite} />);

    expect(screen.getByText("Paws Clinic")).toBeInTheDocument();
    expect(screen.getByText("Hospital")).toBeInTheDocument();
    expect(screen.getByText("Vet")).toBeInTheDocument();
    expect(screen.getByText("Accept")).toBeInTheDocument();
    expect(screen.getByText("Decline")).toBeInTheDocument();
  });
});
