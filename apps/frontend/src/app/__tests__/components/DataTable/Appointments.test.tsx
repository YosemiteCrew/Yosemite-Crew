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

import Appointments from "@/app/components/DataTable/Appointments";

describe("Appointments table", () => {
  beforeEach(() => {
    for (const key in mockGenericTableProps) {
      delete mockGenericTableProps[key];
    }
  });

  test("configures GenericTable with patient data", () => {
    render(<Appointments />);
    expect(mockGenericTableProps.columns).toHaveLength(9);
    expect(mockGenericTableProps.data.length).toBeGreaterThan(0);
  });

  test("custom renderers output composite rows", () => {
    render(<Appointments />);
    const { columns, data } = mockGenericTableProps;
    const sample = data[0];

    const reasonRenderer = columns.find(
      (col: any) => col.key === "reason"
    ).render;
    const supportRenderer = columns.find(
      (col: any) => col.key === "support"
    ).render;
    const actionsRenderer = columns.find(
      (col: any) => col.key === "actions"
    ).render;

    const { getByText, getByTestId } = render(
      <>
        {reasonRenderer(sample)}
        {supportRenderer(sample)}
        {actionsRenderer(sample)}
      </>
    );

    expect(getByText(sample.reason)).toBeInTheDocument();
    expect(getByText(sample.support[0].split(" ")[0])).toBeInTheDocument();
    expect(getByTestId("check-icon")).toBeInTheDocument();
    expect(getByTestId("close-icon")).toBeInTheDocument();
  });
});
