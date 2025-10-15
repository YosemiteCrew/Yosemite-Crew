import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import BusinessDashboard, {
  HeadingDiv,
} from "@/app/pages/BusinessDashboard/BusinessDashboard";
import { useOldAuthStore } from "@/app/stores/oldAuthStore";
import { getData } from "@/app/services/axios";
import {
  convertFhirBundleToInventory,
  convertFHIRToAdminDepartments,
  convertFHIRToGraphData,
  FHIRtoJSONSpeacilityStats,
} from "@yosemite-crew/fhir";

jest.mock("next/link", () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

jest.mock("@iconify/react/dist/iconify.js", () => ({
  Icon: function MockIcon(props: any) {
    return <div data-testid="mock-icon" {...props} />;
  },
}));

jest.mock("@/app/services/axios");
jest.mock("@/app/stores/oldAuthStore");
jest.mock("@yosemite-crew/fhir");

jest.mock("@/app/components/StatCard/StatCard", () => function MockStatCard(props: any) {
  return (
    <div data-testid="stat-card">
      {props.title}: {props.value}
    </div>
  );
});
jest.mock("@/app/components/BarGraph/DepartmentBarChart", () => function MockDepartmentBarChart() {
  return <div data-testid="department-bar-chart"></div>;
});
jest.mock("@/app/components/BarGraph/AppointmentGraph", () => function MockAppointmentGraph() {
  return <div data-testid="appointment-graph"></div>;
});
jest.mock(
  "@/app/components/DataTable/BusinessdashBoardTable",
  () => function MockBusinessdashBoardTable(props: any) {
    return <div data-testid="business-dashboard-table">Status: {props.status}</div>;
  }
);
jest.mock("@/app/components/BarGraph/ChartCard", () => function MockChartCard() {
  return <div data-testid="chart-card"></div>;
});
jest.mock("@/app/components/DataTable/InventoryTable", () => function MockInventoryTable(props: any) {
  return <div data-testid="inventory-table">CategoryID: {props.categoryId}</div>;
});
jest.mock(
  "@/app/pages/AdminDashboardEmpty/AdminDashboardEmpty",
  () => ({
    GraphSelected: function MockGraphSelected({
      title,
      onSelect,
      selectedOption,
    }: {
      title: string;
      onSelect: (value: string) => void;
      selectedOption: string;
    }) {
      return (
        <div>
          <label htmlFor={title}>{title}</label>
          <select
            id={title}
            data-testid={`select-${title}`}
            value={selectedOption}
            onChange={(e) => onSelect(e.target.value)}
          >
            <option value="Last 30 Days">Last 30 Days</option>
            <option value="Last 1 Month">Last 1 Month</option>
            <option value="Last 3 Months">Last 3 Months</option>
            <option value="Last 6 Months">Last 6 Months</option>
          </select>
        </div>
      );
    },
  })
);
jest.mock(
  "@/app/components/CommonTabs/CommonTabForBusinessDashboard",
  () => function MockCommonTabForBusinessDashboard({
    onTabClick,
    tabs,
  }: {
    onTabClick: (eventKey?: string, status?: string) => void;
    tabs: any[];
  }) {
    return (
      <div>
        {tabs.map((tab) => (
          <button key={tab.eventKey} onClick={() => onTabClick(tab.eventKey)}>
            {tab.title}
          </button>
        ))}
        <button onClick={() => onTabClick(undefined, "cancelled")}>
          Set Status to Cancelled
        </button>
        {tabs.length > 0 && tabs[0].content}
      </div>
    );
  }
);
jest.mock(
  "@/app/components/CommonTabs/CommonTabForPractitioners",
  () => function MockCommonTabForPractitioners({ tabs }: { tabs: any[] }) {
    return (
      <div>
        {tabs.map((tab) => (
          <button key={tab.eventKey}>{tab.title}</button>
        ))}
      </div>
    );
  }
);
jest.mock(
  "@/app/components/CommonTabs/CommonTabs",
  () => function MockCommonTabs({ onTabClick }: { onTabClick: (eventKey: string) => void }) {
    return (
      <div>
        <button onClick={() => onTabClick("mock-category-id")}>
          Inventory Tab
        </button>
      </div>
    );
  }
);

const mockGetData = getData as jest.Mock;
const mockUseOldAuthStore = useOldAuthStore as unknown as jest.Mock;
const mockConvertFhirBundleToInventory =
convertFhirBundleToInventory as jest.Mock;
const mockConvertFHIRToAdminDepartments =
  convertFHIRToAdminDepartments as jest.Mock;
const mockConvertFHIRToGraphData = convertFHIRToGraphData as jest.Mock;
const mockFHIRtoJSONSpeacilityStats = FHIRtoJSONSpeacilityStats as jest.Mock;

describe("BusinessDashboard", () => {
  const mockUserId = "test-user-123";

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseOldAuthStore.mockReturnValue(mockUserId);
    mockGetData.mockResolvedValue({ status: 200, data: { data: {} } });
    mockConvertFhirBundleToInventory.mockReturnValue({ data: [] });
    mockConvertFHIRToAdminDepartments.mockReturnValue([]);
    mockConvertFHIRToGraphData.mockReturnValue([]);
    mockFHIRtoJSONSpeacilityStats.mockReturnValue([]);
  });

  test("renders dashboard welcome message and static elements", () => {
    render(<BusinessDashboard />);
    expect(screen.getByText("Your Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Manage Clinic Visibility")).toBeInTheDocument();
    expect(screen.getByText("Invite Practice Member")).toBeInTheDocument();
  });

  test("renders all StatCards with correct data", () => {
    render(<BusinessDashboard />);
    expect(screen.getByText("Revenue (Today): 158")).toBeInTheDocument();
    expect(screen.getByText("Appointments (Today): 122")).toBeInTheDocument();
    expect(screen.getByText("Staff on-duty: 45")).toBeInTheDocument();
    expect(screen.getByText("Inventory Out-of-Stock: $7,298")).toBeInTheDocument();
  });

  test("does not fetch data if userId is not available", () => {
    mockUseOldAuthStore.mockReturnValue(null);
    render(<BusinessDashboard />);
    expect(mockGetData).not.toHaveBeenCalled();
  });

  test("fetches all necessary data on initial render when userId is available", async () => {
    render(<BusinessDashboard />);
    await waitFor(() => {
      expect(mockGetData).toHaveBeenCalledWith(
        `/api/inventory/InventoryItem?userId=${mockUserId}&searchCategory=`
      );
    });
  });

  test("handles API errors gracefully during data fetch", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockGetData.mockRejectedValue(new Error("API Fetch Failed"));
    render(<BusinessDashboard />);
    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error fetching inventory data:",
        expect.any(Error)
      );
    });
    consoleErrorSpy.mockRestore();
  });

  test("updates state and re-fetches speciality appointments when filter changes", async () => {
    render(<BusinessDashboard />);
    const specialityFilter = screen.getByTestId("select-Speciality-wise appointments");
    fireEvent.change(specialityFilter, { target: { value: "Last 6 Months" } });

    await waitFor(() => {
      expect(mockGetData).toHaveBeenCalledWith(
        `fhir/v1/List?reportType=specialityWiseAppointments&userId=${mockUserId}&LastDays=6`
      );
    });
  });

  test("updates other graph filters on selection change", async () => {
    render(<BusinessDashboard />);
    const appointmentsFilter = screen.getByTestId("select-Appointments & Assessments");
    fireEvent.change(appointmentsFilter, { target: { value: "Last 6 Months" } });
    await waitFor(() => {
      expect(appointmentsFilter).toHaveValue("Last 6 Months");
    });
  });

  test("updates appointmentFilter state via onTabClick prop", async () => {
    render(<BusinessDashboard />);
    fireEvent.click(screen.getByRole("button", { name: "Set Status to Cancelled" }));
    await waitFor(() => {
      expect(screen.getByTestId("business-dashboard-table")).toHaveTextContent("Status: cancelled");
    });
  });

  test("fetches inventory details when an inventory tab is clicked", async () => {
    render(<BusinessDashboard />);
    const inventoryTab = await screen.findByRole("button", { name: "Inventory Tab" });
    fireEvent.click(inventoryTab);
    await waitFor(() => {
      expect(mockGetData).toHaveBeenCalledWith(
        `/api/inventory/InventoryItem?userId=${mockUserId}&searchCategory=mock-category-id`
      );
    });
  });
});

describe("HeadingDiv", () => {
  test("renders only the headname", () => {
    render(<HeadingDiv Headname="Test Heading" />);
    expect(screen.getByText("Test Heading")).toBeInTheDocument();
  });

  test("renders headname and headspan", () => {
    render(<HeadingDiv Headname="Test Heading" Headspan="10" />);
    expect(screen.getByText("(10)")).toBeInTheDocument();
  });

  test("renders a link with text and icon when all props are provided", () => {
    render(
      <HeadingDiv
        Headname="Test"
        btntext="Click Me"
        href="/test"
        icon="test-icon"
      />
    );
    const link = screen.getByRole("link", { name: /Click Me/i });
    expect(link).toHaveAttribute("href", "/test");
  });

  test("does not render a link if href is missing", () => {
    render(<HeadingDiv Headname="Test" btntext="Click Me" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});