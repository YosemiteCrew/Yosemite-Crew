import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import SpecialityInfo from '@/app/features/organization/pages/Organization/Sections/Specialities/SpecialityInfo';

const deleteSpecialityMock = jest.fn();
const updateSpecialityMock = jest.fn();
const updateServiceMock = jest.fn();
const deleteServiceMock = jest.fn();

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: () => [{ _id: 'team-1', name: 'Alex' }],
}));

jest.mock('@/app/features/organization/services/specialityService', () => ({
  deleteSpeciality: (...args: any[]) => deleteSpecialityMock(...args),
  updateSpeciality: (...args: any[]) => updateSpecialityMock(...args),
  updateService: (...args: any[]) => updateServiceMock(...args),
}));

jest.mock('@/app/features/organization/services/serviceService', () => ({
  deleteService: (...args: any[]) => deleteServiceMock(...args),
}));

jest.mock('react-icons/md', () => ({
  MdDeleteForever: () => <span>delete</span>,
}));

jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) => (showModal ? <div>{children}</div> : null),
}));

jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) => (showModal ? <div>{children}</div> : null),
}));

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock('@/app/ui/primitives/Buttons/Delete', () => ({
  __esModule: true,
  default: ({ onClick, text }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons/Primary', () => ({
  __esModule: true,
  default: ({ onClick, text }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Secondary: ({ onClick, text }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

const accordionCalls: any[] = [];

jest.mock('@/app/ui/primitives/Accordion/EditableAccordion', () => (props: any) => {
  accordionCalls.push(props);
  return <div data-testid="editable-accordion" />;
});

jest.mock('@/app/ui/primitives/SectionContainer/SectionContainer', () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));

jest.mock('@/app/ui/primitives/Accordion/Accordion', () => (props: any) => (
  <div>
    <div>{props.title}</div>
    <div>{props.children}</div>
  </div>
));

jest.mock('@/app/ui/inputs/ServiceSearch/ServiceSearchEdit', () => () => (
  <div data-testid="service-search" />
));

jest.mock('@/app/features/organization/pages/Specialities/ServicesTab', () => ({
  __esModule: true,
  default: ({ specialityId, organisationId }: any) => (
    <div data-testid="services-tab">
      Services {specialityId} {organisationId}
    </div>
  ),
}));

jest.mock('@/app/features/organization/pages/Specialities/PackagesTab', () => ({
  __esModule: true,
  default: ({ specialityId, organisationId }: any) => (
    <div data-testid="packages-tab">
      Packages {specialityId} {organisationId}
    </div>
  ),
}));

describe('SpecialityInfo modal', () => {
  const activeSpeciality: any = {
    _id: 'spec-1',
    organisationId: 'org-1',
    name: 'Surgery',
    headUserId: 'team-1',
    headName: 'Alex',
    teamMemberIds: ['team-1'],
    services: [
      {
        _id: 'service-1',
        name: 'Consult',
        description: 'Desc',
        durationMinutes: 30,
        cost: 50,
        maxDiscount: 5,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    accordionCalls.length = 0;
  });

  it('deletes speciality and updates core details', async () => {
    render(
      <SpecialityInfo
        showModal
        setShowModal={jest.fn()}
        activeSpeciality={activeSpeciality}
        canEditSpecialities
      />
    );

    fireEvent.click(screen.getByText('delete'));
    fireEvent.click(screen.getByText('Delete'));
    await accordionCalls[0].onSave({
      name: 'Updated',
      headName: 'team-1',
    });

    expect(updateSpecialityMock).toHaveBeenCalled();
    expect(deleteSpecialityMock).toHaveBeenCalled();
  });

  it('renders inline services and packages management', () => {
    render(
      <SpecialityInfo
        showModal
        setShowModal={jest.fn()}
        activeSpeciality={activeSpeciality}
        canEditSpecialities
      />
    );

    expect(screen.getByText('Services & Packages')).toBeInTheDocument();
    expect(screen.getByTestId('services-tab')).toHaveTextContent('Services spec-1 org-1');
    expect(screen.getByTestId('packages-tab')).toHaveTextContent('Packages spec-1 org-1');
  });
});
