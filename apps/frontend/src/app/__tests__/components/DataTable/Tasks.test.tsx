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

jest.mock("next/link", () => {
  return ({ children, ...props }: any) => <a {...props}>{children}</a>;
});

jest.mock("react-icons/fa", () => ({
  FaCheckCircle: () => <div data-testid="check-icon" />,
}));
jest.mock("react-icons/io", () => ({
  IoIosCloseCircle: () => <div data-testid="close-icon" />,
}));

import Tasks from "@/app/components/DataTable/Tasks";

describe("Tasks table", () => {
  beforeEach(() => {
    for (const key in mockGenericTableProps) {
      delete mockGenericTableProps[key];
    }
  });

  test("wires data into GenericTable with correct pagination settings", () => {
    render(<Tasks />);

    expect(mockGenericTableProps.columns).toHaveLength(8);
    expect(mockGenericTableProps.bordered).toBe(false);
    expect(mockGenericTableProps.data).toHaveLength(5);
  });

  test("renders custom column content", () => {
    render(<Tasks />);
    const { columns, data } = mockGenericTableProps;
    const sample = data[0];

    const getColumn = (key: string) =>
      columns.find((col: any) => col.key === key);

    const renderedTask = render(
      <>
        {getColumn("task")?.render(sample)}
        {getColumn("to")?.render(sample)}
        {getColumn("status")?.render(sample)}
        {getColumn("actions")?.render(sample)}
      </>
    );

    expect(renderedTask.getByText(sample.task)).toBeInTheDocument();
    expect(
      renderedTask.getByText(sample.toLabel)
    ).toBeInTheDocument();
    expect(renderedTask.getByText(sample.status)).toBeInTheDocument();
    expect(renderedTask.getByTestId("check-icon")).toBeInTheDocument();
    expect(renderedTask.getByTestId("close-icon")).toBeInTheDocument();
  });
});
