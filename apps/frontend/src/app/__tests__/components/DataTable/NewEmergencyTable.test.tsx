import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import NewEmergencyTable from '../../../components/DataTable/NewEmergencyTable';

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
jest.mock('@iconify/react/dist/iconify.js', () => ({
    Icon: (props: { icon: string }) => <div data-testid={props.icon} />,
}));

const mockGenericTableProps: any = {};
jest.mock('@/app/components/GenericTable/GenericTable', () => ({
  __esModule: true,
  default: (props: any) => {
    Object.assign(mockGenericTableProps, props);
    return <div data-testid="mock-generic-table" />;
  },
}));

const mockAppointmentData = [
    {
      name: "Kizie",
      owner: "Sky B",
      image: "https://d2il6osz49gpup.cloudfront.net/Images/pet.jpg",
      appointmentId: "DRO01-03-23-2024",
      reason: "Annual Health Check-Up",
      breed: "Beagle/Dog",
      time: "11:30 AM",
      date: "01 Sep 2024",
      doctor: "Dr. Emily Johnson",
      specialization: "Cardiology",
      status: "Done",
    },
     {
      name: "Oscar",
      owner: "Pika K",
      image: "https://d2il6osz49gpup.cloudfront.net/Images/pet.jpg",
      appointmentId: "DRO02-03-23-2024",
      reason: "Vaccination Updates",
      breed: "Egyptian/Cat",
      time: "12:15 PM",
      date: "01 Sep 2024",
      doctor: "Dr. David Brown",
      specialization: "Gastroenterology",
      status: "View",
    },
];

describe('NewEmergencyTable Component', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    for (const key in mockGenericTableProps) {
      delete mockGenericTableProps[key];
    }
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.log as jest.Mock).mockRestore();
    (window.alert as jest.Mock).mockRestore();
  });

  test('should render initial UI and pass correct props to GenericTable', () => {
    render(<NewEmergencyTable />);
    expect(screen.getByRole('heading', { name: /New Emergency/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search Patient name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Doctor' })).toBeInTheDocument();
    expect(screen.getByTestId('mock-generic-table')).toBeInTheDocument();

    expect(mockGenericTableProps.data).toHaveLength(3);
    expect(mockGenericTableProps.columns).toHaveLength(9);
    expect(mockGenericTableProps.pagination).toBe(true);
  });

  test('should update search input and trigger alert on submit', async () => {
    render(<NewEmergencyTable />);
    const searchInput = screen.getByPlaceholderText(/Search Patient name/i);
    const searchButton = screen.getByTestId('search-icon').closest('button')!;

    await user.type(searchInput, 'Kizie');
    expect(searchInput).toHaveValue('Kizie');

    await user.click(searchButton);
    expect(window.alert).toHaveBeenCalledWith('Searching for: Kizie');
  });

  test('should update dropdown values on selection', async () => {
    render(<NewEmergencyTable />);

    const dropdownToggle = screen.getByRole('button', { name: 'Doctor' });
    await user.click(dropdownToggle);

    const completedOption = screen.getByText('Completed');
    await user.click(completedOption);

  });

  test('should render all column content and handle all actions for 100% coverage', async () => {
    render(<NewEmergencyTable />);
    const { columns, data } = mockGenericTableProps;
    const doneItem = mockAppointmentData[0];
    const viewItem = mockAppointmentData[1];

    const getColumnRender = (key: string) => columns.find((c: any) => c.key === key)?.render;

    const avatarRender = getColumnRender('avatar');
    expect(render(<>{avatarRender(doneItem)}</>).getByAltText('Kizie')).toBeInTheDocument();

    const nameRender = getColumnRender('name');
    expect(render(<>{nameRender(doneItem)}</>).getByText('Kizie')).toBeInTheDocument();

    const idRender = getColumnRender('appointmentId');
    expect(render(<>{idRender(doneItem)}</>).getByText('DRO01-03-23-2024')).toBeInTheDocument();

    const reasonRender = getColumnRender('reason');
    expect(render(<>{reasonRender(doneItem)}</>).getByText('Annual Health Check-Up')).toBeInTheDocument();

    const breedRender = getColumnRender('breed');
    expect(render(<>{breedRender(doneItem)}</>).getByText('Beagle/Dog')).toBeInTheDocument();

    const dateRender = getColumnRender('date');
    const { getByText: getByDate } = render(<>{dateRender(doneItem)}</>);
    expect(getByDate('11:30 AM')).toBeInTheDocument();
    expect(getByDate('01 Sep 2024')).toBeInTheDocument();

    const doctorRender = getColumnRender('doctor');
    const { getByText: getByDoctor } = render(<>{doctorRender(doneItem)}</>);
    expect(getByDoctor('Dr. Emily Johnson')).toBeInTheDocument();
    expect(getByDoctor('Cardiology')).toBeInTheDocument();

    const actionsRender = getColumnRender('actions');

    const { container: doneContainer, rerender } = render(<>{actionsRender(doneItem)}</>);
    const doneButton = within(doneContainer).getByRole('button', { name: 'Done' });
    expect(within(doneButton).getByTestId('carbon:checkmark-filled')).toBeInTheDocument();

    rerender(<>{actionsRender(viewItem)}</>);
    const viewButton = screen.getByRole('button', { name: 'View' });
    expect(within(viewButton).getByTestId('solar:eye-bold')).toBeInTheDocument();
    await user.click(viewButton);
    expect(console.log).toHaveBeenCalledWith('View', viewItem);

    const dropdownRender = getColumnRender('actionsDropdown');
    const { container: dropdownContainer } = render(<>{dropdownRender(doneItem)}</>);

    await user.click(within(dropdownContainer).getByTestId('dots-icon'));

    await user.click(screen.getByText('Edit'));
    expect(console.log).toHaveBeenCalledWith('Edit', doneItem);

    await user.click(screen.getByText('Save'));
    expect(console.log).toHaveBeenCalledWith('Save', doneItem);

    await user.click(screen.getByText('Delete'));
    expect(console.log).toHaveBeenCalledWith('Delete', doneItem);
  });
});
