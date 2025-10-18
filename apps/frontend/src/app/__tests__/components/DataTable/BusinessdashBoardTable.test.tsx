import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import BusinessdashBoardTable from '../../../components/DataTable/BusinessdashBoardTable';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} alt={props.alt || 'avatar'} />,
}));

jest.mock('react-icons/fa6', () => ({
  FaUser: () => <span data-testid="user-icon" />,
  FaEye: () => <span data-testid="eye-icon" />,
}));

const mockRouterPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

const mockGetData = jest.fn();
jest.mock('@/app/services/axios', () => ({
  getData: (url: string) => mockGetData(url),
}));

jest.mock('@yosemite-crew/fhir', () => ({
  fromFHIR: (data: any) => data,
}));

jest.mock('@/app/stores/oldAuthStore', () => ({
  useOldAuthStore: (selector: (state: any) => any) => {
    const state = { userId: 'mock-user-123' };
    return selector(state);
  },
}));

const mockGenericTableProps: any = {};
jest.mock('@/app/components/GenericTable/GenericTable', () => ({
  __esModule: true,
  default: (props: any) => {
    Object.assign(mockGenericTableProps, props);
    return (
      <div data-testid="mock-generic-table">
        {props.data.map((item: any, index: number) => (
          <div key={item.id}>
            {props.columns.map((col: any) => (
              <div key={col.key}>
                {/* FIX: Replaced `&&` with optional chaining `?.()` for the function call */}
                {col.render?.(item, index)}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  },
}));

const mockApiData = {
  status: 200,
  data: {
    data: [
      { _id: '1', petName: 'Buddy', ownerName: 'John Doe', petImage: '/img.png', tokenNumber: 'A1', purposeOfVisit: 'Checkup', breed: 'Golden Retriever', appointmentTime: '10:00 AM', appointmentDate: '2025-10-13', doctorName: 'Dr. Smith', departmentName: 'Cardiology', appointmentStatus: 'accepted' },
      { _id: '2', petName: 'Lucy', ownerName: 'Jane Doe', petImage: '/img2.png', tokenNumber: 'A2', purposeOfVisit: 'Vaccination', breed: 'Siamese', appointmentTime: '11:00 AM', appointmentDate: '2025-10-13', doctorName: 'Dr. Jones', departmentName: 'General', appointmentStatus: 'in-progress' },
      { _id: '3', petName: 'Max', ownerName: 'Jim Beam', petImage: '/img3.png', tokenNumber: 'A3', purposeOfVisit: 'Injury', breed: 'Labrador', appointmentTime: '12:00 PM', appointmentDate: '2025-10-13', doctorName: 'Dr. Eva', departmentName: 'Orthopedics', appointmentStatus: 'checked-in' },
      { _id: '4', petName: 'Daisy', ownerName: 'Ann Lee', petImage: '/img4.png', tokenNumber: 'A4', purposeOfVisit: 'Follow-up', breed: 'Poodle', appointmentTime: '01:00 PM', appointmentDate: '2025-10-13', doctorName: 'Dr. Smith', departmentName: 'Cardiology', appointmentStatus: 'fulfilled' },
    ],
  },
};

describe('BusinessdashBoardTable Component', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetData.mockResolvedValue(mockApiData);
  });

  test('should fetch data on mount with default status and render the table', async () => {
    render(<BusinessdashBoardTable />);

    expect(mockGetData).toHaveBeenCalledWith('/api/appointments/getAllAppointments?doctorId=&userId=mock-user-123&status=accepted');

    await waitFor(() => {
      expect(screen.getByTestId('mock-generic-table')).toBeInTheDocument();
      expect(mockGenericTableProps.data).toHaveLength(3);
      expect(mockGenericTableProps.data[0].name).toBe('Buddy');
    });

    expect(screen.getByText('Buddy')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('A2')).toBeInTheDocument();
    expect(screen.getByText('Dr. Eva')).toBeInTheDocument();
  });

  test('should re-fetch data when the status prop changes', async () => {
    const { rerender } = render(<BusinessdashBoardTable status="accepted" />);

    await waitFor(() => {
        expect(mockGetData).toHaveBeenCalledWith(expect.stringContaining('status=accepted'));
    });

    rerender(<BusinessdashBoardTable status="pending" />);

    await waitFor(() => {
        expect(mockGetData).toHaveBeenCalledWith(expect.stringContaining('status=pending'));
    });

    expect(mockGetData).toHaveBeenCalledTimes(2);
  });

  test('should navigate when "See All" button is clicked', async () => {
    render(<BusinessdashBoardTable />);
    const seeAllButton = screen.getByRole('button', { name: 'See All' });
    await user.click(seeAllButton);
    expect(mockRouterPush).toHaveBeenCalledWith('/AppointmentVet');
  });

  test('should handle API errors gracefully', async () => {
    mockGetData.mockRejectedValue(new Error('API Error'));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<BusinessdashBoardTable />);

    await waitFor(() => {
      expect(mockGenericTableProps.data).toHaveLength(0);
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith("Error fetching appointments:", expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  test('should normalize various appointment statuses correctly', async () => {
    render(<BusinessdashBoardTable />);

    await waitFor(() => {
      const normalizedData = mockGenericTableProps.data;
      expect(normalizedData[0].status).toBe('Confirmed');
      expect(normalizedData[1].status).toBe('In-Progress');
      expect(normalizedData[2].status).toBe('Checked-In');
    });
  });
});