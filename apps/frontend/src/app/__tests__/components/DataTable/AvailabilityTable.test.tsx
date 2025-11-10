import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockGenericTableProps: any = {};
jest.mock("@/app/components/GenericTable/GenericTable", () => ({
  __esModule: true,
  default: (props: any) => {
    Object.assign(mockGenericTableProps, props);
    return <div data-testid="mock-generic-table" />;
  },
}));

jest.mock("next/image", () => {
  return ({ alt = "", ...props }: any) => <img alt={alt} {...props} />;
});

jest.mock("next/link", () => {
  return ({ children, ...props }: any) => <a {...props}>{children}</a>;
});

jest.mock("react-icons/fa", () => ({
  FaCheckCircle: () => <div data-testid="check-icon" />,
}));
jest.mock("react-icons/io", () => ({
  IoIosCloseCircle: () => <div data-testid="close-icon" />,
}));

import AvailabilityTable from "@/app/components/DataTable/AvailabilityTable";

describe("AvailabilityTable", () => {
  beforeEach(() => {
    for (const key in mockGenericTableProps) {
      delete mockGenericTableProps[key];
    }
  });

  test("provides staff availability data to GenericTable", () => {
    render(<AvailabilityTable />);

    expect(mockGenericTableProps.columns).toHaveLength(7);
    expect(mockGenericTableProps.data).toHaveLength(5);
    expect(mockGenericTableProps.bordered).toBe(false);
  });

  test("column renderers include status and actions", () => {
    render(<AvailabilityTable />);
    const { columns, data } = mockGenericTableProps;
    const sample = data[0];

    const statusRenderer = columns.find(
      (col: any) => col.key === "status"
    ).render;
    const actionsRenderer = columns.find(
      (col: any) => col.key === "actions"
    ).render;

    const { getByText, getByTestId } = render(
      <>
        {statusRenderer(sample)}
        {actionsRenderer(sample)}
      </>
    );

    expect(getByText(sample.status)).toBeInTheDocument();
    expect(getByTestId("check-icon")).toBeInTheDocument();
    expect(getByTestId("close-icon")).toBeInTheDocument();
  });
});
