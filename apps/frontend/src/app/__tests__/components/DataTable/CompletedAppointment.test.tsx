import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import CompletedAppointment from '../../../components/DataTable/CompletedAppointment';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} alt={props.alt} />,
}));
jest.mock('react-icons/fa6', () => ({
  FaUser: () => <span data-testid="user-icon" />,
  FaEye: () => <span data-testid="eye-icon" />,
}));
jest.mock('react-icons/bs', () => ({
  BsThreeDotsVertical: () => <div data-testid="dots-icon" />,
}));

const mockGenericTableProps: any = {};
jest.mock('@/app/components/GenericTable/GenericTable', () => ({
  __esModule: true,
  default: (props: any) => {
    Object.assign(mockGenericTableProps, props);
    return <div data-testid="mock-generic-table" />;
  },
}));

const mockData = {
  data: [
    {
      name: 'Buddy',
      owner: 'John Doe',
      image: '/path/to/buddy.jpg',
      tokenNumber: 'A-101',
      reason: 'Annual Checkup',
      petType: 'Dog',
      pet: 'Golden Retriever',
      time: '10:30 AM',
      date: '2025-10-13',
      participants: { name: 'Dr. Smith' },
      specialization: 'Cardiology',
      status: 'In-progress',
    },
  ],
};

describe('CompletedAppointment Component', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    for (const key in mockGenericTableProps) {
      delete mockGenericTableProps[key];
    }
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.log as jest.Mock).mockRestore();
  });

  test('should pass the correct data and columns to GenericTable', () => {
    render(<CompletedAppointment data={mockData.data} />);

    expect(screen.getByTestId('mock-generic-table')).toBeInTheDocument();

    expect(mockGenericTableProps.data).toEqual(mockData.data);
    expect(mockGenericTableProps.columns).toHaveLength(9);
    expect(mockGenericTableProps.pagination).toBe(true);
    expect(mockGenericTableProps.pageSize).toBe(3);
  });

  test('should render all column content correctly and handle actions', async () => {
    render(<CompletedAppointment data={mockData.data} />);

    const { columns, data } = mockGenericTableProps;
    const item = data[0];

    const getColumnRender = (key: string) => columns.find((c: any) => c.key === key)?.render;

    const avatarRender = getColumnRender('avatar');
    const { getByAltText } = render(<>{avatarRender(item)}</>);
    expect(getByAltText('Buddy')).toBeInTheDocument();

    const nameRender = getColumnRender('name');
    const { getByText } = render(<>{nameRender(item)}</>);
    expect(getByText('Buddy')).toBeInTheDocument();
    expect(getByText('John Doe')).toBeInTheDocument();

    const idRender = getColumnRender('appointmentId');
    expect(render(<>{idRender(item)}</>).getByText('A-101')).toBeInTheDocument();

    const reasonRender = getColumnRender('reason');
    expect(render(<>{reasonRender(item)}</>).getByText('Annual Checkup')).toBeInTheDocument();

    const breedRender = getColumnRender('breed');
    expect(render(<>{breedRender(item)}</>).getByText('Dog/Golden Retriever')).toBeInTheDocument();

    const dateRender = getColumnRender('date');
    const { container: dateContainer } = render(<>{dateRender(item)}</>);
    expect(within(dateContainer).getByText('10:30 AM')).toBeInTheDocument();
    expect(within(dateContainer).getByText('2025-10-13')).toBeInTheDocument();

    const doctorRender = getColumnRender('doctor');
    const { container: doctorContainer } = render(<>{doctorRender(item)}</>);
    expect(within(doctorContainer).getByText('Dr. Smith')).toBeInTheDocument();
    expect(within(doctorContainer).getByText('Cardiology')).toBeInTheDocument();

    const actionsRender = getColumnRender('actions');
    const { getByRole } = render(<>{actionsRender(item)}</>);
    const viewButton = getByRole('button', { name: 'View' });
    await user.click(viewButton);
    expect(console.log).toHaveBeenCalledWith('View', item);

    const dropdownRender = getColumnRender('actionsDropdown');
    const { container: dropdownContainer } = render(<>{dropdownRender(item)}</>);

    const toggle = within(dropdownContainer).getByTestId('dots-icon');
    await user.click(toggle);

    await user.click(screen.getByText('Edit'));
    expect(console.log).toHaveBeenCalledWith('Edit', item);

    await user.click(screen.getByText('Save'));
    expect(console.log).toHaveBeenCalledWith('Save', item);

    await user.click(screen.getByText('Delete'));
    expect(console.log).toHaveBeenCalledWith('Delete', item);
  });
});
