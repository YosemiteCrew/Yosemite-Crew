import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import OrganizationList from "../../../components/DataTable/OrganizationList";

jest.mock("react-icons/ai", () => ({
  AiFillMinusCircle: () => <div data-testid="minus-icon" />,
}));

const mockGenericTableProps: any = {};
jest.mock("@/app/components/GenericTable/GenericTable", () => ({
  __esModule: true,
  default: (props: any) => {
    Object.assign(mockGenericTableProps, props);
    return <div data-testid="mock-generic-table" />;
  },
}));

const demoData = [
  {
    name: "Paws & Tails Health Club",
    type: "Hospital",
    role: "Owner",
    status: "Pending",
    color: "#f68523",
    bgcolor: "#fef3e9",
  },
];

describe("OrganizationList Component", () => {
  beforeEach(() => {
    for (const key in mockGenericTableProps) {
      delete mockGenericTableProps[key];
    }
  });

  test("should pass the correct data, columns, and props to GenericTable", () => {
    render(<OrganizationList />);

    expect(screen.getByTestId("mock-generic-table")).toBeInTheDocument();

    expect(mockGenericTableProps.columns).toHaveLength(4);
    expect(mockGenericTableProps.bordered).toBe(false);
    expect(mockGenericTableProps.pagination).toBe(true);
    expect(mockGenericTableProps.pageSize).toBe(3);
  });
});
