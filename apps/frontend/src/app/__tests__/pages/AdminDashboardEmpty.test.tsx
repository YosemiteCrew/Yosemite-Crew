import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import AdminDashboardEmpty, { GraphSelected } from "@/app/pages/AdminDashboardEmpty/AdminDashboardEmpty";
import { useOldAuthStore } from "@/app/stores/oldAuthStore";

jest.mock("next/link", () => {
  function MockLink({ children, href }: Readonly<{ children: React.ReactNode; href: string }>) {
    return <a href={href}>{children}</a>;
  }
  MockLink.displayName = "MockLink";
  return MockLink;
});

jest.mock("@/app/stores/oldAuthStore");
const mockUseOldAuthStore = useOldAuthStore as unknown as jest.Mock;

jest.mock("@/app/components/ExploringCard/ExploringCard", () => {
  function MockExploringCard() {
    return <div data-testid="exploring-card" />;
  }
  MockExploringCard.displayName = "MockExploringCard";
  return MockExploringCard;
});

jest.mock("@/app/components/StatCard/StatCard", () => {
  function MockStatCard({ title }: Readonly<{ title: string }>) {
    return <div data-testid="stat-card">{title}</div>;
  }
  MockStatCard.displayName = "MockStatCard";
  return MockStatCard;
});

jest.mock("@/app/components/BarGraph/DynamicChartCard", () => {
  function MockDynamicChartCard({ type }: Readonly<{ type: string }>) {
    return <div data-testid={`dynamic-chart-${type === "line" ? "line" : "bar"}`} />;
  }
  MockDynamicChartCard.displayName = "MockDynamicChartCard";
  return MockDynamicChartCard;
});

jest.mock("@/app/components/BarGraph/BlankDonutCard", () => {
  function MockBlankDonutCard({ title }: Readonly<{ title: string }>) {
    return <div data-testid="blank-donut-card">{title}</div>;
  }
  MockBlankDonutCard.displayName = "MockBlankDonutCard";
  return MockBlankDonutCard;
});

jest.mock("react-icons/pi", () => ({
  PiWarningOctagonFill: function MockWarningIcon() {
    return <div data-testid="warning-icon" />;
  },
}));
jest.mock("react-icons/ai", () => ({
  AiFillPlusCircle: function MockPlusIcon() {
    return <div data-testid="plus-icon" />;
  },
}));
jest.mock("react-icons/io", () => ({
  IoMdEye: function MockEyeIcon() {
    return <div data-testid="eye-icon" />;
  },
}));

describe("AdminDashboardEmpty", () => {
  beforeEach(() => {
    mockUseOldAuthStore.mockClear();
    mockUseOldAuthStore.mockReturnValue({
      userId: "test-user",
      email: "test@test.com",
      userType: "admin",
      isVerified: null,
    });
  });

  test("renders welcome message and default elements", () => {
    render(<AdminDashboardEmpty />);
    expect(screen.getByText("Your Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Set up Your Practice")).toBeInTheDocument();
  });

  test('shows "Verification in Progress" message when isVerified is 0', () => {
    mockUseOldAuthStore.mockReturnValue({ isVerified: 0 });
    render(<AdminDashboardEmpty />);
    expect(
      screen.getByText(/Verification in Progress — Limited Access Enabled/i)
    ).toBeInTheDocument();
  });

  test('shows "profile is verified" message when isVerified is 1', () => {
    mockUseOldAuthStore.mockReturnValue({ isVerified: 1 });
    render(<AdminDashboardEmpty />);
    expect(
      screen.getByText(/Your profile is verified and good to go — no new appointments./i)
    ).toBeInTheDocument();
  });

  test("renders all stat cards and dummy tables", () => {
    render(<AdminDashboardEmpty />);
    expect(screen.getAllByTestId("stat-card").length).toBe(6);
    expect(screen.getByText("Today’s Schedule")).toBeInTheDocument();
  });

  test("handles graph selection change", async () => {
    render(<AdminDashboardEmpty />);
    const appointmentsDropdownToggle = screen.getAllByRole("button", { name: /Last 6 Months/i })[0];
    fireEvent.click(appointmentsDropdownToggle);
    const newOption = await screen.findByText("Last 1 Year");
    fireEvent.click(newOption);
    await waitFor(() => {
      expect(screen.getAllByText("Last 1 Year").length).toBeGreaterThan(0);
    });
  });
});

describe("GraphSelected", () => {
  const onSelectMock = jest.fn();
  const props = {
    title: "Test Graph",
    options: ["Option 1", "Option 2"],
    selectedOption: "Option 1",
    onSelect: onSelectMock,
  };

  test("renders correctly and handles selection", async () => {
    render(<GraphSelected {...props} />);
    expect(screen.getByText("Test Graph")).toBeInTheDocument();
    const toggleButton = screen.getByRole("button", { name: "Option 1" });
    fireEvent.click(toggleButton);
    const option2 = await screen.findByText("Option 2");
    fireEvent.click(option2);
    expect(onSelectMock).toHaveBeenCalledWith("Option 2");
  });
});