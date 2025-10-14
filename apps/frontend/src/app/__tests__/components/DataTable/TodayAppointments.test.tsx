import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import TodayAppointments from '@/app/components/DataTable/TodayAppointments';

// Mock for Next.js Image component
jest.mock('next/image', () => {
    const MockImage = (props: any) => {
        // eslint-disable-next-line @next/next/no-img-element
        return <img {...props} alt={props.alt} />;
    };
    // Add display name to suppress build warnings
    MockImage.displayName = 'MockNextImage';
    return {
        __esModule: true,
        default: MockImage,
    };
});


// Mocks for react-icons
jest.mock('react-icons/fa6', () => ({
    FaUser: () => <span data-testid="user-icon" />,
    FaEye: () => <span data-testid="eye-icon" />,
}));
jest.mock('react-icons/bs', () => ({
    BsThreeDotsVertical: () => <div data-testid="dots-icon" />,
}));
jest.mock('react-icons/lu', () => ({
    LuSearch: () => <div data-testid="search-icon" />,
}));

// Mock the API service layer
const mockGetData = jest.fn();
const mockPutData = jest.fn();
jest.mock('@/app/services/axios', () => ({
    getData: (url: string) => mockGetData(url),
    putData: (url: string, payload: any) => mockPutData(url, payload),
}));

// Mock the fhir utility
jest.mock('@yosemite-crew/fhir', () => ({
    fhirToNormalForTable: (data: any) => ({
        Appointments: data,
        totalAppointments: data.length,
    }),
}));

// Mock GenericTable
jest.mock('@/app/components/GenericTable/GenericTable', () => {
    // FIX: Convert the anonymous function to a named component and add a displayName.
    const MockGenericTable = ({ columns, data }: { columns: any[], data: any[] }) => (
        <div data-testid="mock-generic-table">
            {data.map((item, index) => (
                <div key={item.id || index} data-testid={`table-row-${index}`}>
                    {columns.map(column => (
                        column.render ? <div key={column.key}>{column.render(item)}</div> : null
                    ))}
                </div>
            ))}
        </div>
    );
    MockGenericTable.displayName = 'MockGenericTable';
    return MockGenericTable;
});

const mockDoctors = {
    status: 200,
    data: { data: [{ id: 'doc-1', name: 'Dr. Smith' }, { id: 'doc-2', name: 'Dr. Jones' }] },
};

const mockAppointments = {
    status: 200,
    data: {
        fhirData: [
            { _id: 'appt-1', petName: 'Buddy', doctorName: 'Dr. Smith', appointmentStatus: 'accepted' },
            { _id: 'appt-2', petName: 'Lucy', doctorName: 'Dr. Jones', appointmentStatus: 'inProgress' },
        ],
    },
};

describe('TodayAppointments Component', () => {
    const user = userEvent.setup();
    const onCountUpdateMock = jest.fn();
    const onRefreshAllMock = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetData.mockImplementation((url) => {
            if (url.includes('practiceDoctors')) return Promise.resolve(mockDoctors);
            if (url.includes('getAllAppointmentsToAction')) return Promise.resolve(mockAppointments);
            return Promise.reject(new Error(`No mock for URL: ${url}`));
        });
        mockPutData.mockResolvedValue({ status: 200 });
    });

    test('should fetch initial data and render', async () => {
        render(<TodayAppointments userId="mock-user-id" onCountUpdate={onCountUpdateMock} onAppointmentUpdate={0} onRefreshAll={onRefreshAllMock} />);
        await waitFor(() => {
            expect(screen.getByTestId('mock-generic-table')).toBeInTheDocument();
            expect(onCountUpdateMock).toHaveBeenCalledWith(2);
        });
    });

    test('should re-fetch data when a doctor is selected', async () => {
        render(<TodayAppointments userId="mock-user-id" onCountUpdate={jest.fn()} onAppointmentUpdate={0} onRefreshAll={jest.fn()} />);

        const dropdownToggle = await screen.findByRole('button', { name: 'Doctor' });
        await user.click(dropdownToggle);

        const drSmithDropdownItem = await screen.findByRole('button', { name: 'Dr. Smith' });
        await user.click(drSmithDropdownItem);

        await waitFor(() => {
            expect(mockGetData).toHaveBeenCalledWith(
                '/fhir/v1/getAllAppointmentsToAction?userId=doc-1&type=today&limit=1000'
            );
        });

        expect(dropdownToggle).toHaveTextContent('Dr. Smith');
    });

    test('should reset doctor filter when default "Doctor" option is selected', async () => {
        render(<TodayAppointments userId="mock-user-id" onCountUpdate={jest.fn()} onAppointmentUpdate={0} onRefreshAll={jest.fn()} />);

        const dropdownToggle = await screen.findByRole('button', { name: 'Doctor' });
        await user.click(dropdownToggle);
        const drSmithOption = await screen.findByRole('button', { name: 'Dr. Smith' });
        await user.click(drSmithOption);
        await waitFor(() => expect(dropdownToggle).toHaveTextContent('Dr. Smith'));

        await user.click(dropdownToggle);
        const doctorOptions = await screen.findAllByRole('button', { name: 'Doctor' });
        const doctorResetItem = doctorOptions.find(el => el.tagName === 'A');
        await user.click(doctorResetItem!);

        await waitFor(() => {
            expect(mockGetData).toHaveBeenCalledWith(
                '/fhir/v1/getAllAppointmentsToAction?userId=mock-user-id&type=today&limit=1000'
            );
        });
        expect(dropdownToggle).toHaveTextContent('Doctor');
    });

    test('should call putData and refresh when a status is changed', async () => {
        render(<TodayAppointments userId="mock-user-id" onCountUpdate={jest.fn()} onAppointmentUpdate={0} onRefreshAll={onRefreshAllMock} />);
        const actionMenus = await screen.findAllByTestId('dots-icon');
        await user.click(actionMenus[0]);

        const inProgressOption = await screen.findByRole('button', { name: 'In-Progress' });
        await user.click(inProgressOption);

        await waitFor(() => {
            expect(mockPutData).toHaveBeenCalledWith('/fhir/v1/updateAppointmentStatus/appt-1', { status: 'inProgress' });
            expect(onRefreshAllMock).toHaveBeenCalledTimes(1);
        });
    });
});