import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import AppointmentsTable from '../../../components/DataTable/AppointmentsTable';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} alt={props.alt} />,
}));
jest.mock('react-icons/fa6', () => ({
  FaUser: () => <span data-testid="user-icon" />,
}));
jest.mock('@iconify/react/dist/iconify.js', () => ({
  Icon: (props: { icon: string }) => <div data-testid={props.icon} />,
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

const mockAppointmentData = [
  {
    name: 'Bella',
    owner: 'John Doe',
    image: '/path/to/image1.jpg',
    tokenNumber: 'A-101',
    reason: 'Annual Checkup',
    petType: 'Dog',
    pet: 'Golden Retriever',
    time: '10:30 AM',
    date: '2025-10-13',
    participants: { name: 'Dr. Smith' },
    specialization: 'General Vet',
    status: 'Pending',
  },
  {
    name: 'Whiskers',
    owner: 'Jane Smith',
    image: '/path/to/image2.jpg',
    tokenNumber: 'A-102',
    reason: 'Vaccination',
    petType: 'Cat',
    pet: 'Siamese',
    time: '11:00 AM',
    date: '2025-10-13',
    participants: { name: 'Dr. Jones' },
    specialization: 'Immunology',
    status: 'In-progress',
  },
];

describe('AppointmentsTable Component', () => {
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

  test('should render GenericTable and pass correct props', () => {
    render(<AppointmentsTable data={mockAppointmentData} />);
    expect(screen.getByTestId('mock-generic-table')).toBeInTheDocument();
    expect(mockGenericTableProps.data).toEqual(mockAppointmentData);
    expect(mockGenericTableProps.columns).toHaveLength(9);
    expect(mockGenericTableProps.pagination).toBe(true);
  });

  test('should correctly render content and handle actions for all columns', async () => {
    render(<AppointmentsTable data={mockAppointmentData} />);
    const { columns } = mockGenericTableProps;
    const pendingItem = mockAppointmentData[0];
    const inProgressItem = mockAppointmentData[1];

    const getColumnRender = (key: string) => columns.find((c: any) => c.key === key).render;

    const { getByAltText } = render(<>{getColumnRender('avatar')(pendingItem)}</>);
    expect(getByAltText('Bella')).toBeInTheDocument();

    const { getByText } = render(<>{getColumnRender('name')(pendingItem)}</>);
    expect(getByText('Bella')).toBeInTheDocument();
    expect(getByText('John Doe')).toBeInTheDocument();

    const { getByText: getById } = render(<>{getColumnRender('appointmentId')(pendingItem)}</>);
    expect(getById('A-101')).toBeInTheDocument();

    const { getByText: getByReason } = render(<>{getColumnRender('reason')(pendingItem)}</>);
    expect(getByReason('Annual Checkup')).toBeInTheDocument();

    const { getByText: getByBreed } = render(<>{getColumnRender('breed')(pendingItem)}</>);
    expect(getByBreed('Golden Retriever/Dog')).toBeInTheDocument();

    const { getByText: getByDate } = render(<>{getColumnRender('date')(pendingItem)}</>);
    expect(getByDate('10:30 AM')).toBeInTheDocument();
    expect(getByDate('2025-10-13')).toBeInTheDocument();

    const { getByText: getByDoctor } = render(<>{getColumnRender('doctor')(pendingItem)}</>);
    expect(getByDoctor('Dr. Smith')).toBeInTheDocument();
    expect(getByDoctor('General Vet')).toBeInTheDocument();

    const actionsRender = getColumnRender('actions');
    const { container: pendingContainer, rerender } = render(<>{actionsRender(pendingItem)}</>);
    const viewButton = within(pendingContainer).getByRole('button');
    expect(within(viewButton).getByTestId('solar:eye-bold')).toBeInTheDocument();
    await user.click(viewButton);
    expect(console.log).toHaveBeenCalledWith('View', pendingItem);

    rerender(<>{actionsRender(inProgressItem)}</>);
    const doneButton = screen.getByRole('button', { name: 'Done' });
    expect(within(doneButton).getByTestId('carbon:checkmark-filled')).toBeInTheDocument();

    const dropdownRender = getColumnRender('actionsDropdown');
    const { container: dropdownContainer } = render(<>{dropdownRender(pendingItem)}</>);

    const toggle = within(dropdownContainer).getByTestId('dots-icon');
    await user.click(toggle);

    const editItem = screen.getByText('Edit');
    await user.click(editItem);
    expect(console.log).toHaveBeenCalledWith('Edit', pendingItem);

    const saveItem = screen.getByText('Save');
    await user.click(saveItem);
    expect(console.log).toHaveBeenCalledWith('Save', pendingItem);

    const deleteItem = screen.getByText('Delete');
    await user.click(deleteItem);
    expect(console.log).toHaveBeenCalledWith('Delete', pendingItem);
  });
});
