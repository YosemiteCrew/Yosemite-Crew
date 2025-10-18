import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { Table as BootstrapTable } from "react-bootstrap";
import GenericTable, { Column } from "@/app/components/GenericTable/GenericTable";

jest.mock("react-bootstrap", () => ({
    ...jest.requireActual("react-bootstrap"),
    Table: jest.fn(({ children, responsive, bordered, ...props }) => <table {...props}>{children}</table>),
    Button: jest.fn(({ children, onClick, disabled }) => (
        <button onClick={onClick} disabled={disabled}>
            {children}
        </button>
    )),
}));

jest.mock("react-icons/fi", () => ({
    FiArrowLeft: () => <svg>Prev</svg>,
    FiArrowRight: () => <svg>Next</svg>,
}));

const MockedTable = BootstrapTable as unknown as jest.Mock;

interface MockData {
    id: number;
    name: string;
    role: string;
    toString: () => string;
}

const mockData: MockData[] = Array.from({ length: 25 }, (_, i) => ({
    id: i + 1,
    name: `User ${i + 1}`,
    role: i % 3 === 0 ? 'Admin' : 'User',
    toString: function() { return (this.id).toString(); },
}));


const mockColumns: Column<MockData>[] = [
    { label: "ID", key: "id", width: "50px" },
    { label: "Name", key: "name" },
    {
        label: "Role",
        key: "role",
        render: (item) => <span style={{ color: "blue" }}>Role {item.role}</span>,
    },
];

describe("GenericTable Component", () => {
    beforeEach(() => {
      MockedTable.mockClear();
    });

    it("should render headers and all data rows without pagination", () => {
        render(<GenericTable data={mockData} columns={mockColumns} />);

        expect(screen.getByText("ID")).toBeInTheDocument();
        expect(screen.getByText("Name")).toBeInTheDocument();
        expect(screen.getByText("Role")).toBeInTheDocument();
        expect(screen.getByText("User 1")).toBeInTheDocument();
        expect(screen.getByText("User 25")).toBeInTheDocument();
        const rows = screen.getAllByRole("row");
        expect(rows).toHaveLength(26);
        expect(screen.queryByText("Next")).not.toBeInTheDocument();
    });

    it("should render only headers when data is empty", () => {
        render(<GenericTable data={[]} columns={mockColumns} />);
        expect(screen.getByText("ID")).toBeInTheDocument();
        const rows = screen.getAllByRole("row");
        expect(rows).toHaveLength(1);
    });

    it("should render with pagination and show the first page", () => {
        render(<GenericTable data={mockData} columns={mockColumns} pagination pageSize={10} />);

        expect(screen.getByText("User 1")).toBeInTheDocument();
        expect(screen.getByText("User 10")).toBeInTheDocument();
        expect(screen.queryByText("User 11")).not.toBeInTheDocument();

        expect(screen.getByText((content, element) => element?.textContent === "Showing 10 of 25")).toBeInTheDocument();
        expect(screen.getByText("Prev").closest("button")).toBeDisabled();
        expect(screen.getByText("Next").closest("button")).not.toBeDisabled();
    });

    it("should navigate to the next and previous pages", async () => {
        const user = userEvent.setup();
        render(<GenericTable data={mockData} columns={mockColumns} pagination pageSize={10} />);

        const nextButton = screen.getByText("Next").closest("button")!;
        const prevButton = screen.getByText("Prev").closest("button")!;

        await user.click(nextButton);
        expect(screen.getByText("User 11")).toBeInTheDocument();
        expect(screen.getByText((content, element) => element?.textContent === "Showing 20 of 25")).toBeInTheDocument();
        expect(prevButton).not.toBeDisabled();

        await user.click(prevButton);
        expect(screen.getByText("User 1")).toBeInTheDocument();
        expect(screen.getByText((content, element) => element?.textContent === "Showing 10 of 25")).toBeInTheDocument();
        expect(prevButton).toBeDisabled();
    });

    it("should disable the 'Next' button on the last page", async () => {
        const user = userEvent.setup();
        render(<GenericTable data={mockData} columns={mockColumns} pagination pageSize={10} />);

        const nextButton = screen.getByText("Next").closest("button")!;

        await user.click(nextButton);
        await user.click(nextButton);

        expect(screen.getByText("User 21")).toBeInTheDocument();
        expect(screen.getByText((content, element) => element?.textContent === "Showing 25 of 25")).toBeInTheDocument();
        expect(nextButton).toBeDisabled();
    });

    it("should use a custom render function for cells", () => {
        render(<GenericTable data={mockData} columns={mockColumns} />);

        const adminRoleElement = screen.getAllByText('Role Admin')[0];
        expect(adminRoleElement).toBeInTheDocument();
        expect(adminRoleElement).toHaveStyle('color: rgb(0, 0, 255)');
    });

    it("should apply column widths correctly", () => {
        render(<GenericTable data={mockData} columns={mockColumns} />);

        const idHeader = screen.getByText("ID");
        expect(idHeader).toHaveStyle("width: 50px");

        const firstIdCell = screen.getByText("1").closest("td");
        expect(firstIdCell).toHaveStyle("width: 50px");
    });

    it("should not show pagination if total pages is 1 or less", () => {
        render(<GenericTable data={mockData.slice(0, 5)} columns={mockColumns} pagination pageSize={10} />);
        expect(screen.queryByText("Next")).not.toBeInTheDocument();
    });

    it("should render a bordered table when bordered prop is true", () => {
        render(<GenericTable data={mockData} columns={mockColumns} bordered={true} />);
        expect(MockedTable.mock.calls.at(-1)[0].bordered).toBe(true);
    });

    it("should render a non-bordered table by default", () => {
    render(<GenericTable data={mockData} columns={mockColumns} />);
    expect(MockedTable.mock.calls.at(-1)[0].bordered).toBe(false);
    });
});

