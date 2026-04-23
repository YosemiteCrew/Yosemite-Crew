import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import SpecialityStep from '@/app/features/onboarding/components/Steps/CreateOrg/SpecialityStep';
import {
  createService,
  createSpeciality,
  updateService,
  deleteSpeciality,
} from '@/app/features/organization/services/specialityService';
import { createOrg, updateOrg } from '@/app/features/organization/services/orgService';
import { deleteService } from '@/app/features/organization/services/serviceService';
import { SpecialityWeb } from '@/app/features/organization/types/speciality';
import { useRouter } from 'next/navigation';
import { Organisation, Service, Speciality } from '@yosemite-crew/types';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/app/features/organization/services/specialityService', () => ({
  createService: jest.fn(),
  createSpeciality: jest.fn(),
  updateService: jest.fn(),
  deleteSpeciality: jest.fn(),
  loadSpecialitiesForOrg: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/app/features/organization/services/serviceService', () => ({
  deleteService: jest.fn(),
}));

jest.mock('@/app/features/organization/services/orgService', () => ({
  createOrg: jest.fn(),
  updateOrg: jest.fn(),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ onClick, text, isDisabled }: any) => (
    <button data-testid="btn-next" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
  Secondary: ({ onClick, text }: any) => (
    <button data-testid="btn-back" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) => (showModal ? <div>{children}</div> : null),
}));

jest.mock('@/app/ui/overlays/Modal/ModalHeader', () => ({
  __esModule: true,
  default: ({ title }: any) => <div>{title}</div>,
}));

describe('SpecialityStep Component', () => {
  const mockPrevStep = jest.fn();
  const mockSetFormData = jest.fn();
  const mockSetSpecialities = jest.fn();
  const mockRouterPush = jest.fn();

  const baseFormData: Organisation = {
    _id: '',
    address: {
      addressLine: '123 Main St',
      city: 'Austin',
      country: 'United States',
      postalCode: '73301',
      state: 'TX',
    },
    name: 'Test Org',
    phoneNo: '+11234567890',
    taxId: 'TAX-1',
    type: 'HOSPITAL',
  } as unknown as Organisation;

  beforeEach(() => {
    jest.resetAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockRouterPush });
    (createService as jest.Mock).mockResolvedValue({});
    (createSpeciality as jest.Mock).mockImplementation(async (payload: Speciality) => ({
      ...payload,
      _id: `${payload.name}-id`,
    }));
    (updateService as jest.Mock).mockResolvedValue({});
    (deleteSpeciality as jest.Mock).mockResolvedValue({});
    (deleteService as jest.Mock).mockResolvedValue({});
    (createOrg as jest.Mock).mockResolvedValue('org-1');
    (updateOrg as jest.Mock).mockResolvedValue({});
  });

  const getProps = (overrides: Partial<React.ComponentProps<typeof SpecialityStep>> = {}) => ({
    formData: baseFormData,
    initialSpecialities: [],
    isExistingOrg: false,
    prevStep: mockPrevStep,
    specialities: [] as SpecialityWeb[],
    setFormData: mockSetFormData,
    setSpecialities: mockSetSpecialities,
    ...overrides,
  });

  it('renders the new empty state and recommendations', () => {
    render(<SpecialityStep {...getProps()} />);

    expect(screen.getByText('Specialties and services')).toBeInTheDocument();
    expect(screen.getByText('No specialties added yet')).toBeInTheDocument();
    expect(screen.getByText('Recommended for hospitals')).toBeInTheDocument();
  });

  it('calls prevStep when Back button is clicked', () => {
    render(<SpecialityStep {...getProps()} />);

    fireEvent.click(screen.getByTestId('btn-back'));

    expect(mockPrevStep).toHaveBeenCalled();
  });

  it('adds a recommended specialty with starter services', () => {
    let stateCallback: ((previous: SpecialityWeb[]) => SpecialityWeb[]) | undefined;
    mockSetSpecialities.mockImplementation((callback) => {
      stateCallback = callback;
    });

    render(<SpecialityStep {...getProps()} />);

    fireEvent.click(screen.getAllByRole('button', { name: /General Practice/i })[0]);

    expect(stateCallback).toBeDefined();
    const nextState = stateCallback?.([]);

    expect(nextState).toHaveLength(1);
    expect(nextState?.[0]).toEqual(
      expect.objectContaining({
        name: 'General Practice',
        services: expect.arrayContaining([
          expect.objectContaining({ name: 'General Consult' }),
          expect.objectContaining({ name: 'Health Certificate' }),
        ]),
      })
    );
  });

  it('opens the service editor and saves duration and price changes', () => {
    const specialities = [
      {
        name: 'Cardiology',
        organisationId: '',
        services: [
          {
            id: '',
            cost: 70,
            durationMinutes: 30,
            isActive: true,
            name: 'Heart Check-up',
            organisationId: '',
          } as Service,
        ],
      } as SpecialityWeb,
    ];

    let stateCallback: ((previous: SpecialityWeb[]) => SpecialityWeb[]) | undefined;
    mockSetSpecialities.mockImplementation((callback) => {
      stateCallback = callback;
    });

    render(<SpecialityStep {...getProps({ specialities })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Heart Check-up' }));
    fireEvent.change(screen.getByLabelText('Duration (mins)'), { target: { value: '45' } });
    fireEvent.change(screen.getByLabelText('Price (USD)'), { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save service' }));

    const nextState = stateCallback?.(specialities);
    expect(nextState?.[0].services?.[0]).toEqual(
      expect.objectContaining({ durationMinutes: 45, cost: 120, name: 'Heart Check-up' })
    );
  });

  it('does not submit if the specialties list is empty', () => {
    render(<SpecialityStep {...getProps()} />);

    fireEvent.click(screen.getByTestId('btn-next'));

    expect(screen.getByText('Add at least one specialty to continue')).toBeInTheDocument();
    expect(createOrg).not.toHaveBeenCalled();
    expect(createSpeciality).not.toHaveBeenCalled();
    expect(createService).not.toHaveBeenCalled();
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('creates a new org, specialty, and service rows on success', async () => {
    const specialities = [
      {
        name: 'Cardiology',
        organisationId: '',
        services: [
          {
            id: '',
            cost: 70,
            durationMinutes: 20,
            isActive: true,
            name: 'Heart Check-up',
            organisationId: '',
          },
          {
            id: '',
            cost: 65,
            durationMinutes: 20,
            isActive: true,
            name: 'Blood Pressure Measurement',
            organisationId: '',
          },
        ],
      } as SpecialityWeb,
    ];

    render(<SpecialityStep {...getProps({ specialities })} />);

    fireEvent.click(screen.getByTestId('btn-next'));

    await waitFor(() => {
      expect(createOrg).toHaveBeenCalledWith(baseFormData);
      expect(createSpeciality).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Cardiology',
          organisationId: 'org-1',
          services: [],
        })
      );
      expect(createService).toHaveBeenCalledTimes(2);
      expect(createService).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Heart Check-up',
          organisationId: 'org-1',
          specialityId: 'Cardiology-id',
        })
      );
      expect(mockRouterPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows an error if specialty creation fails', async () => {
    (createSpeciality as jest.Mock).mockRejectedValueOnce(new Error('Fail'));

    const specialities = [
      { name: 'Cardiology', organisationId: '', services: [] } as SpecialityWeb,
    ];

    render(<SpecialityStep {...getProps({ specialities })} />);

    fireEvent.click(screen.getByTestId('btn-next'));

    await waitFor(() => {
      expect(
        screen.getByText('We could not save your specialties. Please try again.')
      ).toBeInTheDocument();
    });
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('updates an existing org instead of creating a new one', async () => {
    const existingSpeciality = {
      _id: 'spec-1',
      name: 'Existing',
      organisationId: 'org-existing',
      services: [],
    } as SpecialityWeb;

    render(
      <SpecialityStep
        {...getProps({
          formData: { ...baseFormData, _id: 'org-existing' } as Organisation,
          initialSpecialities: [existingSpeciality],
          isExistingOrg: true,
          specialities: [
            existingSpeciality,
            { name: 'New Spec', organisationId: '', services: [] } as SpecialityWeb,
          ],
        })}
      />
    );

    fireEvent.click(screen.getByTestId('btn-next'));

    await waitFor(() => {
      expect(updateOrg).toHaveBeenCalledWith(expect.objectContaining({ _id: 'org-existing' }));
      expect(createOrg).not.toHaveBeenCalled();
      expect(createSpeciality).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Spec', organisationId: 'org-existing' })
      );
    });
  });

  it('updates deleted, edited, and newly added services for an existing speciality', async () => {
    const initialSpecialities = [
      {
        _id: 'spec-1',
        name: 'Existing',
        organisationId: 'org-existing',
        services: [
          {
            id: 'svc-1',
            name: 'Care plan',
            cost: 75,
            durationMinutes: 30,
            isActive: true,
            organisationId: 'org-existing',
            specialityId: 'spec-1',
          },
          {
            id: 'svc-2',
            name: 'Vaccination',
            cost: 40,
            durationMinutes: 15,
            isActive: true,
            organisationId: 'org-existing',
            specialityId: 'spec-1',
          },
        ],
      } as SpecialityWeb,
    ];

    const specialities = [
      {
        _id: 'spec-1',
        name: 'Existing',
        organisationId: 'org-existing',
        services: [
          {
            id: 'svc-1',
            name: 'Care plan',
            cost: 95,
            durationMinutes: 45,
            isActive: true,
            organisationId: 'org-existing',
            specialityId: 'spec-1',
          },
          {
            id: '',
            name: 'Wellness exam',
            cost: 55,
            durationMinutes: 20,
            isActive: true,
            organisationId: 'org-existing',
            specialityId: 'spec-1',
          },
        ],
      } as SpecialityWeb,
    ];

    render(
      <SpecialityStep
        {...getProps({
          formData: { ...baseFormData, _id: 'org-existing' } as Organisation,
          initialSpecialities,
          isExistingOrg: true,
          specialities,
        })}
      />
    );

    fireEvent.click(screen.getByTestId('btn-next'));

    await waitFor(() => {
      expect(updateOrg).toHaveBeenCalledWith(expect.objectContaining({ _id: 'org-existing' }));
      expect(updateService).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'svc-1',
          name: 'Care plan',
          cost: 95,
          durationMinutes: 45,
          specialityId: 'spec-1',
        })
      );
      expect(deleteService).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'svc-2',
          name: 'Vaccination',
        })
      );
      expect(createService).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Wellness exam',
          organisationId: 'org-existing',
          specialityId: 'spec-1',
        })
      );
      expect(mockRouterPush).toHaveBeenCalledWith('/dashboard');
    });
  });
});
