import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import Specialities from '@/app/features/organization/pages/Organization/Sections/Specialities/Specialities';
import { useOrgStore } from '@/app/stores/orgStore';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useRouter } from 'next/navigation';

const useSpecialitiesMock = jest.fn();
const usePermissionsMock = jest.fn();
const accordionButtonSpy = jest.fn();
const specialitiesTableRevampSpy = jest.fn();
const specialityInfoSpy = jest.fn();

jest.mock('@/app/hooks/useSpecialities', () => ({
  useSpecialitiesWithServiceNamesForPrimaryOrg: () => useSpecialitiesMock(),
}));

jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => usePermissionsMock(),
}));

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/primitives/Accordion/AccordionButton', () => (props: any) => {
  accordionButtonSpy(props);
  return (
    <div data-testid="accordion-button">
      {props.showButton && (
        <button type="button" onClick={props.buttonClick}>
          {props.buttonTitle}
        </button>
      )}
      {props.children}
    </div>
  );
});

jest.mock('@/app/ui/tables/SpecialitiesTableRevamp', () => (props: any) => {
  specialitiesTableRevampSpy(props);
  return (
    <div data-testid="specialities-table-revamp">
      <button type="button" onClick={() => props.onManageTeam({ _id: 'spec-3', name: 'Boarding' })}>
        manage-team
      </button>
    </div>
  );
});

jest.mock(
  '@/app/features/organization/pages/Organization/Sections/Specialities/SpecialityInfo',
  () => (props: any) => {
    specialityInfoSpy(props);
    return <div data-testid="speciality-info" />;
  }
);

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: jest.fn(),
}));

jest.mock('@/app/stores/revampCatalogStore', () => ({
  useRevampCatalogStore: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('Specialities section', () => {
  const push = jest.fn();
  const loadOrganisationCatalog = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    useSpecialitiesMock.mockReturnValue([{ _id: 'spec-1', name: 'Surgery', services: [] }]);
    usePermissionsMock.mockReturnValue({ can: jest.fn(() => true) });
    (useRouter as jest.Mock).mockReturnValue({ push });
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ primaryOrgId: 'org-1' })
    );
    (useRevampCatalogStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({
        specialities: [
          { id: 'rev-1', organisationId: 'org-1', name: 'Surgery', headVetId: 'vet-1' },
          { id: 'rev-2', organisationId: 'org-other', name: 'Dental', headVetId: 'vet-2' },
        ],
        loadOrganisationCatalog,
      })
    );
  });

  it('renders the accordion action button when the user can edit specialities', () => {
    render(<Specialities />);

    expect(screen.getByTestId('specialities-table-revamp')).toBeInTheDocument();
    expect(accordionButtonSpy).toHaveBeenCalledWith(expect.objectContaining({ showButton: true }));
  });

  it('resyncs the active speciality when the list refreshes with an updated match', () => {
    useSpecialitiesMock.mockReturnValue([{ _id: 'spec-1', name: 'Surgery v2', services: [] }]);
    const { rerender } = render(<Specialities />);
    useSpecialitiesMock.mockReturnValue([{ _id: 'spec-1', name: 'Surgery v3', services: [] }]);
    rerender(<Specialities />);
    expect(specialityInfoSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ activeSpeciality: expect.objectContaining({ name: 'Surgery v3' }) })
    );
  });

  it('falls back to the first speciality when the previously active one is removed', () => {
    useSpecialitiesMock.mockReturnValue([{ _id: 'spec-1', name: 'Surgery', services: [] }]);
    const { rerender } = render(<Specialities />);
    useSpecialitiesMock.mockReturnValue([{ _id: 'spec-9', name: 'Dermatology', services: [] }]);
    rerender(<Specialities />);
    expect(specialityInfoSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ activeSpeciality: expect.objectContaining({ _id: 'spec-9' }) })
    );
  });

  it('clears the active speciality when the list becomes empty', () => {
    useSpecialitiesMock.mockReturnValue([{ _id: 'spec-1', name: 'Surgery', services: [] }]);
    const { rerender } = render(<Specialities />);
    useSpecialitiesMock.mockReturnValue([]);
    rerender(<Specialities />);
    expect(screen.queryByTestId('speciality-info')).not.toBeInTheDocument();
  });

  it('does not render SpecialityInfo when there is no active speciality up front', () => {
    useSpecialitiesMock.mockReturnValue([]);
    render(<Specialities />);
    expect(screen.queryByTestId('speciality-info')).not.toBeInTheDocument();
  });

  describe('catalog table', () => {
    it('renders the revamp table filtered to the primary org and navigates on Manage click', () => {
      render(<Specialities />);
      expect(screen.getByTestId('specialities-table-revamp')).toBeInTheDocument();
      expect(specialitiesTableRevampSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          filteredList: [expect.objectContaining({ revampId: 'rev-1', name: 'Surgery' })],
        })
      );

      fireEvent.click(screen.getByRole('button', { name: 'Manage' }));
      expect(push).toHaveBeenCalledWith('/organization/specialities');
    });

    it('loads the organisation catalog for the primary org', async () => {
      render(<Specialities />);
      await waitFor(() => expect(loadOrganisationCatalog).toHaveBeenCalledWith('org-1'));
    });

    it('does not load the catalog when there is no primary org', () => {
      (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
        selector({ primaryOrgId: null })
      );
      render(<Specialities />);
      expect(loadOrganisationCatalog).not.toHaveBeenCalled();
    });

    it('swallows a rejected loadOrganisationCatalog call', async () => {
      loadOrganisationCatalog.mockRejectedValueOnce(new Error('load failed'));
      render(<Specialities />);
      await waitFor(() => expect(loadOrganisationCatalog).toHaveBeenCalled());
    });

    it('renders an empty catalog list when there is no primary org', () => {
      (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
        selector({ primaryOrgId: null })
      );
      render(<Specialities />);
      expect(specialitiesTableRevampSpy).toHaveBeenCalledWith(
        expect.objectContaining({ filteredList: [] })
      );
    });

    it('opens SpecialityInfo via onManageTeam from the revamp table', () => {
      render(<Specialities />);
      fireEvent.click(screen.getByText('manage-team'));
      expect(specialityInfoSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ activeSpeciality: expect.objectContaining({ _id: 'spec-3' }) })
      );
    });
  });
});
