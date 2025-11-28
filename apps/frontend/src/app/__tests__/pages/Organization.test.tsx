import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img alt={props.alt || "mock-image"} {...props} />,
}));

jest.mock("@/app/components/ProtectedRoute", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="protected-route">{children}</div>
  ),
}));

jest.mock("@/app/components/Accordion/AccordionButton", () => ({
  __esModule: true,
  default: ({ title, children, buttonTitle, buttonClick }: any) => (
    <div data-testid={`accordion-${title}`}>
      <span>{title}</span>
      {buttonTitle ? (
        <button type="button" onClick={() => buttonClick?.(true)}>
          {buttonTitle}
        </button>
      ) : null}
      <div>{children}</div>
    </div>
  ),
}));

jest.mock("@/app/components/DataTable/SpecialitiesTable", () => ({
  __esModule: true,
  default: () => <div data-testid="specialities-table" />,
}));
jest.mock("@/app/components/DataTable/AvailabilityTable", () => ({
  __esModule: true,
  default: () => <div data-testid="availability-table" />,
}));
jest.mock("@/app/components/DataTable/RoomTable", () => ({
  __esModule: true,
  default: () => <div data-testid="room-table" />,
}));
jest.mock("@/app/components/DataTable/DocumentsTable", () => ({
  __esModule: true,
  default: () => <div data-testid="documents-table" />,
}));

import ProtectedOrganizations from "@/app/pages/Organization";

describe("Organization page", () => {
  test("renders organization profile inside protected route", () => {
    render(<ProtectedOrganizations />);

    expect(screen.getByTestId("protected-route")).toBeInTheDocument();
    expect(
      screen.getByText("San Francisco Medical Center"),
    ).toBeInTheDocument();

    expect(screen.getByTestId("accordion-Organization profile")).toBeInTheDocument();
    expect(screen.getByTestId("accordion-Specialties")).toBeInTheDocument();
    expect(screen.getByTestId("accordion-Team")).toBeInTheDocument();
    expect(screen.getByTestId("accordion-Rooms")).toBeInTheDocument();
    expect(screen.getByTestId("accordion-Company documents")).toBeInTheDocument();

    expect(screen.getByTestId("specialities-table")).toBeInTheDocument();
    expect(screen.getByTestId("availability-table")).toBeInTheDocument();
    expect(screen.getByTestId("room-table")).toBeInTheDocument();
    expect(screen.getByTestId("documents-table")).toBeInTheDocument();
  });

  test("triggers accordion add buttons without crashing", () => {
    render(<ProtectedOrganizations />);

    fireEvent.click(screen.getAllByText("Add")[0]);
    fireEvent.click(screen.getAllByText("Add")[1]);
    fireEvent.click(screen.getAllByText("Add")[2]);
  });
});
