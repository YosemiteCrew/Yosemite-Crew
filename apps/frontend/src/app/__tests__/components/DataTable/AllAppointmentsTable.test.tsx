import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import AllAppointmentsTable from '../../../components/DataTable/AllAppointmentsTable';

jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: any) => <img {...props} alt={props.alt} />,
}));

jest.mock('react-icons/fa6', () => ({
    FaUser: () => <span data-testid="user-icon" />,
}));
jest.mock('react-icons/bs', () => ({
    BsThreeDotsVertical: () => <div data-testid="dots-icon" />,
}));
jest.mock('react-icons/lu', () => ({
    LuSearch: () => <div data-testid="search-icon" />,
}));

const mockAppointments = [
    { name: "Kizie", owner: "Sky B", image: "https://d2il6osz49gpup.cloudfront.net/Images/pet.jpg", appointmentId: "DRO01-03-23-2024", reason: "Annual Health Check-Up", breed: "Beagle/Dog", time: "11:30 AM", date: "01 Sep 2024", doctor: "Dr. Emily Johnson", specialization: "Cardiology", status: "In-progress" },
];

const mockGenericTableProps: any = {};
jest.mock('@/app/components/GenericTable/GenericTable', () => ({
    __esModule: true,
    default: (props: any) => {
        Object.assign(mockGenericTableProps, props);
        return (
            <div data-testid="mock-generic-table">
                {props.data.map((row: any) => (
                    <div key={row.appointmentId}>
                        {props.columns.map((col: any) => (
                            <div key={col.key}>
                                {col.render ? col.render(row) : <span>{row[col.accessor]}</span>}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        );
    },
}));

describe('AllAppointmentsTable Component', () => {
    const user = userEvent.setup();
    let consoleLogSpy: jest.SpyInstance;
    let windowAlertSpy: jest.SpyInstance;

    beforeEach(() => {
        for (const key in mockGenericTableProps) {
            delete mockGenericTableProps[key];
        }
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        windowAlertSpy = jest.spyOn(globalThis, 'alert').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        windowAlertSpy.mockRestore();
        jest.clearAllMocks();
    });

    test('should render initial UI elements', () => {
        render(<AllAppointmentsTable />);
        expect(screen.getByRole('heading', { name: /All Appointments/i })).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Search Patient name/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Doctor' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Status' })).toBeInTheDocument();
        expect(screen.getByTestId('mock-generic-table')).toBeInTheDocument();
    });

    test('should update search input and trigger alert on form submission', async () => {
        render(<AllAppointmentsTable />);
        const searchInput = screen.getByPlaceholderText(/Search Patient name/i);
        const searchButton = screen.getByTestId('search-icon').closest('button')!;

        await user.type(searchInput, 'Kizie');
        expect(searchInput).toHaveValue('Kizie');

        await user.click(searchButton);
        expect(globalThis.alert).toHaveBeenCalledWith('Searching for: Kizie');
    });

    test('should update dropdown values on selection', async () => {
        render(<AllAppointmentsTable />);

        const doctorDropdownToggle = screen.getByRole('button', { name: 'Doctor' });

        await user.click(doctorDropdownToggle);

        const completedOption = await screen.findByRole('button', { name: 'Completed' });
        await user.click(completedOption);

        await waitFor(() => {
            expect(doctorDropdownToggle).toHaveTextContent('Completed');
        });
    });

    test('should handle actions from the dropdown menu', async () => {
        render(<AllAppointmentsTable />);
        const dotsIcons = screen.getAllByTestId('dots-icon');
        await user.click(dotsIcons[0]);

        const saveOption = await screen.findByText('Save');
        await user.click(saveOption);

        await waitFor(() => {
            expect(consoleLogSpy).toHaveBeenCalledWith('Save', expect.objectContaining({ name: 'Kizie' }));
        });
    });
});