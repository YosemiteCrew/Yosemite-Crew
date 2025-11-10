import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import OrgCard from "@/app/components/Cards/OrgCard/OrgCard";

describe("OrgCard", () => {
  test("renders organization info and status", () => {
    const org = {
      name: "Sky Blue Vet",
      type: "Clinic",
      role: "Owner",
      status: "Active",
      color: "#54B492",
      bgcolor: "#E6F4EF",
    };

    render(<OrgCard org={org} />);

    expect(screen.getByText("Sky Blue Vet")).toBeInTheDocument();
    expect(screen.getByText("Clinic")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByText("Active")).toHaveStyle({
      color: org.color,
      background: org.bgcolor,
    });
  });
});
