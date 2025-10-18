import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import BusinessDashboard, {
  HeadingDiv,
} from '@/app/pages/BusinessDashboard/BusinessDashboard';
import { useOldAuthStore } from '@/app/stores/oldAuthStore';
import { getData } from '@/app/services/axios';
import {
  convertFhirBundleToInventory,
  convertFHIRToAdminDepartments,
  convertFHIRToGraphData,
  FHIRtoJSONSpeacilityStats,
} from '@yosemite-crew/fhir';

jest.mock('next/link', () => {
  const MockLink = ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => {
    return <a href={href}>{children}</a>;
  };
  MockLink.displayName = 'MockLink';
  return MockLink;
});

jest.mock('@iconify/react/dist/iconify.js', () => ({
  Icon: (props: any) => <div data-testid="mock-icon" {...props} />,
}));
jest.mock('@/app/services/axios');
jest.mock('@/app/stores/oldAuthStore');
jest.mock('@yosemite-crew/fhir');

jest.mock('@/app/components/StatCard/StatCard', () => {
  const MockStatCard = (props: any) => (
    <div data-testid="stat-card">
      {props.title}: {props.value}
    </div>
  );
  MockStatCard.displayName = 'MockStatCard';
  return MockStatCard;
});

jest.mock('@/app/components/BarGraph/DepartmentBarChart', () => {
  const MockDepartmentBarChart = () => <div data-testid="department-bar-chart" />;
  MockDepartmentBarChart.displayName = 'MockDepartmentBarChart';
  return MockDepartmentBarChart;
});

jest.mock('@/app/components/BarGraph/AppointmentGraph', () => {
  const MockAppointmentGraph = () => <div data-testid="appointment-graph" />;
  MockAppointmentGraph.displayName = 'MockAppointmentGraph';
  return MockAppointmentGraph;
});

jest.mock('@/app/components/DataTable/BusinessdashBoardTable', () => {
  const MockBusinessdashBoardTable = (props: any) => (
    <div data-testid="business-dashboard-table">Status: {props.status}</div>
  );
  MockBusinessdashBoardTable.displayName = 'MockBusinessdashBoardTable';
  return MockBusinessdashBoardTable;
});

jest.mock('@/app/components/BarGraph/ChartCard', () => {
  const MockChartCard = () => <div data-testid="chart-card" />;
  MockChartCard.displayName = 'MockChartCard';
  return MockChartCard;
});

jest.mock('@/app/components/DataTable/InventoryTable', () => {
  const MockInventoryTable = (props: any) => (
    <div data-testid="inventory-table">CategoryID: {props.categoryId}</div>
  );
  MockInventoryTable.displayName = 'MockInventoryTable';
  return MockInventoryTable;
});

jest.mock('@/app/pages/AdminDashboardEmpty/AdminDashboardEmpty', () => ({
  GraphSelected: ({
    title,
    onSelect,
    selectedOption,
  }: {
    title: string;
    onSelect: (value: string) => void;
    selectedOption: string;
  }) => (
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
  ),
}));

jest.mock('@/app/components/CommonTabs/CommonTabForBusinessDashboard', () => {
  const MockCommonTabForBusinessDashboard = ({ onTabClick, tabs }: { onTabClick: any; tabs: any[] }) => (
    <div>
      {tabs.map((tab) => (
        <button key={tab.eventKey} onClick={() => onTabClick(tab.eventKey)}>
          {tab.title}
        </button>
      ))}
      <button onClick={() => onTabClick(tabs[0]?.eventKey, 'cancelled')}>
        Set Status to Cancelled
      </button>
    </div>
  );
  MockCommonTabForBusinessDashboard.displayName = 'MockCommonTabForBusinessDashboard';
  return MockCommonTabForBusinessDashboard;
});

jest.mock('@/app/components/CommonTabs/CommonTabForPractitioners', () => {
    const MockCommonTabForPractitioners = ({ tabs }: { tabs: any[] }) => (
        <div>
            {tabs.map((tab, index) => (
                <button key={tab.eventKey || index}>{tab.title}</button>
            ))}
        </div>
    );
    MockCommonTabForPractitioners.displayName = 'MockCommonTabForPractitioners';
    return MockCommonTabForPractitioners;
});

jest.mock('@/app/components/CommonTabs/CommonTabs', () => {
  const MockCommonTabs = ({ onTabClick }: { onTabClick: (eventKey: string) => void }) => (
    <div>
      <button onClick={() => onTabClick('mock-category-id')}>
        Inventory Tab
      </button>
    </div>
  );
  MockCommonTabs.displayName = 'MockCommonTabs';
  return MockCommonTabs;
});

const mockGetData = getData as jest.Mock;
const mockUseOldAuthStore = useOldAuthStore as unknown as jest.Mock;
const mockConvertFhirBundleToInventory =
  convertFhirBundleToInventory as jest.Mock;
const mockConvertFHIRToAdminDepartments =
  convertFHIRToAdminDepartments as jest.Mock;
const mockConvertFHIRToGraphData = convertFHIRToGraphData as jest.Mock;
const mockFHIRtoJSONSpeacilityStats =
  FHIRtoJSONSpeacilityStats as jest.Mock;

describe('BusinessDashboard', () => {
  const mockUserId = 'test-user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseOldAuthStore.mockReturnValue(mockUserId);
    mockGetData.mockImplementation((url: string) => {
      if (url.includes('getDepartmentsOfBusiness')) {
        return Promise.resolve({
          status: 200,
          data: { data: [{ id: 'dept1', name: 'Cardiology' }] },
        });
      }
      if (url.includes('GetAddInventoryCategory')) {
        return Promise.resolve({
          status: 200,
          data: { data: [{ category: 'cat1', id: '1' }] },
        });
      }
      if (url.startsWith('fhir/v1') || url.startsWith('/api/inventory')) {
        return Promise.resolve({
          status: 200,
          data: { resourceType: 'Bundle', entry: [] },
        });
      }
      return Promise.resolve({ status: 200, data: {} });
    });
    mockConvertFhirBundleToInventory.mockReturnValue({ data: [] });
    mockConvertFHIRToAdminDepartments.mockReturnValue([
      { id: 'dept1', name: 'Cardiology', count: 10, eventKey: 'cardiology' },
    ]);
    mockConvertFHIRToGraphData.mockReturnValue([]);
    mockFHIRtoJSONSpeacilityStats.mockReturnValue([
      { name: 'Cardiology', booked: 5, completed: 5 },
    ]);
  });

  it('fetches all necessary data on initial render when userId is available', async () => {
    render(<BusinessDashboard />);

    await waitFor(() => {
      expect(mockGetData).toHaveBeenCalledWith(
        `api/auth/getDepartmentsOfBusiness?userId=${mockUserId}`
      );
      expect(mockGetData).toHaveBeenCalledWith(
        `/api/inventory/InventoryItem?userId=${mockUserId}&searchCategory=`
      );
      expect(mockGetData).toHaveBeenCalledWith(
        `fhir/admin/GetAddInventoryCategory?bussinessId=${mockUserId}&type=category`
      );
    });
  });

  it('updates appointmentFilter state via onTabClick prop', async () => {
    render(<BusinessDashboard />);

    const appointmentsTabButton = await screen.findByRole('button', {
      name: 'Appointments',
    });
    fireEvent.click(appointmentsTabButton);

    const setStatusButton = await screen.findByRole('button', {
      name: 'Set Status to Cancelled',
    });
    fireEvent.click(setStatusButton);
  });

  it('renders dashboard welcome message and static elements', async () => {
    render(<BusinessDashboard />);
    await screen.findByText('Your Dashboard');
    expect(screen.getByText('Manage Clinic Visibility')).toBeInTheDocument();
    expect(screen.getByText('Invite Practice Member')).toBeInTheDocument();
  });

  it('renders all StatCards with correct data', async () => {
    render(<BusinessDashboard />);
    await screen.findByRole('button', { name: 'Cardiology' });
    expect(screen.getByText('Revenue (Today): 158')).toBeInTheDocument();
    expect(screen.getByText('Appointments (Today): 122')).toBeInTheDocument();
    expect(screen.getByText('Staff on-duty: 45')).toBeInTheDocument();
    expect(
      screen.getByText('Inventory Out-of-Stock: $7,298')
    ).toBeInTheDocument();
  });

  it('does not fetch data if userId is not available', () => {
    mockUseOldAuthStore.mockReturnValue(null);
    render(<BusinessDashboard />);
    expect(mockGetData).not.toHaveBeenCalled();
  });

  it('handles API errors gracefully during data fetch', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    mockGetData.mockRejectedValue(new Error('API Fetch Failed'));
    render(<BusinessDashboard />);
    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error fetching'),
        expect.any(Error)
      );
    });
    consoleErrorSpy.mockRestore();
  });

  it('updates state and re-fetches speciality appointments when filter changes', async () => {
    render(<BusinessDashboard />);
    await screen.findByRole('button', { name: 'Cardiology' });
    const specialityFilter = screen.getByTestId(
      'select-Speciality-wise appointments'
    );
    fireEvent.change(specialityFilter, { target: { value: 'Last 6 Months' } });
    await waitFor(() => {
      expect(mockGetData).toHaveBeenCalledWith(
        `fhir/v1/List?reportType=specialityWiseAppointments&userId=${mockUserId}&LastDays=6`
      );
    });
  });

  it('updates other graph filters on selection change', async () => {
    render(<BusinessDashboard />);
    await screen.findByRole('button', { name: 'Cardiology' });
    const appointmentsFilter = screen.getByTestId(
      'select-Appointments & Assessments'
    );
    fireEvent.change(appointmentsFilter, { target: { value: 'Last 6 Months' } });
    await waitFor(() => {
      expect(appointmentsFilter).toHaveValue('Last 6 Months');
    });
  });

  it('fetches inventory details when an inventory tab is clicked', async () => {
    render(<BusinessDashboard />);
    const inventoryTab = await screen.findByRole('button', {
      name: 'Inventory Tab',
    });
    fireEvent.click(inventoryTab);
    await waitFor(() => {
      expect(mockGetData).toHaveBeenCalledWith(
        `/api/inventory/InventoryItem?userId=${mockUserId}&searchCategory=mock-category-id`
      );
    });
  });
});

describe('HeadingDiv', () => {
  it('renders only the headname', () => {
    render(<HeadingDiv Headname="Test Heading" />);
    expect(screen.getByText('Test Heading')).toBeInTheDocument();
  });

  it('renders headname and headspan', () => {
    render(<HeadingDiv Headname="Test Heading" Headspan="10" />);
    expect(screen.getByText('(10)')).toBeInTheDocument();
  });

  it('renders a link with text and icon when all props are provided', () => {
    render(
      <HeadingDiv
        Headname="Test"
        btntext="Click Me"
        href="/test"
        icon="test-icon"
      />
    );
    const link = screen.getByRole('link', { name: /Click Me/i });
    expect(link).toHaveAttribute('href', '/test');
  });

  it('does not render a link if href is missing', () => {
    render(<HeadingDiv Headname="Test" btntext="Click Me" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});