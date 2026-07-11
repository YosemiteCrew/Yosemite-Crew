import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import SpecialityStep from '@/app/features/onboarding/components/Steps/CreateOrg/SpecialityStep';
import {
  createServicesBulk,
  createSpecialitiesBulk,
  updateService,
  deleteSpeciality,
} from '@/app/features/organization/services/specialityService';
import { createOrg, updateOrg } from '@/app/features/organization/services/orgService';
import { deleteService } from '@/app/features/organization/services/serviceService';
import { SpecialityWeb } from '@/app/features/organization/types/speciality';
import { useRouter } from 'next/navigation';
import { resolveOrgScopedRedirect } from '@/app/lib/postAuthRedirect';
import { getOnboardingSpecialityCatalog } from '@/app/lib/onboardingSpecialityCatalog';
import { Organisation, Service, Speciality } from '@yosemite-crew/types';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/app/features/organization/services/specialityService', () => ({
  createServicesBulk: jest.fn(),
  createSpecialitiesBulk: jest.fn(),
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

jest.mock('@/app/lib/postAuthRedirect', () => ({
  resolveOrgScopedRedirect: jest.fn(),
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
    (createServicesBulk as jest.Mock).mockResolvedValue([]);
    (createSpecialitiesBulk as jest.Mock).mockImplementation(async (payload: Speciality[]) =>
      payload.map((speciality) => ({
        ...speciality,
        _id: `${speciality.name}-id`,
      }))
    );
    (updateService as jest.Mock).mockResolvedValue({});
    (deleteSpeciality as jest.Mock).mockResolvedValue({});
    (deleteService as jest.Mock).mockResolvedValue({});
    (createOrg as jest.Mock).mockResolvedValue('org-1');
    (updateOrg as jest.Mock).mockResolvedValue({});
    (resolveOrgScopedRedirect as jest.Mock).mockResolvedValue('/team-onboarding?orgId=org-1');
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
    expect(createSpecialitiesBulk).not.toHaveBeenCalled();
    expect(createServicesBulk).not.toHaveBeenCalled();
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
      expect(createSpecialitiesBulk).toHaveBeenCalledWith([
        expect.objectContaining({
          name: 'Cardiology',
          organisationId: 'org-1',
          services: [],
        }),
      ]);
      expect(createServicesBulk).toHaveBeenCalledTimes(1);
      expect(createServicesBulk).toHaveBeenCalledWith([
        expect.objectContaining({
          name: 'Heart Check-up',
          organisationId: 'org-1',
          specialityId: 'Cardiology-id',
        }),
        expect.objectContaining({
          name: 'Blood Pressure Measurement',
          organisationId: 'org-1',
          specialityId: 'Cardiology-id',
        }),
      ]);
      expect(mockRouterPush).toHaveBeenCalledWith('/team-onboarding?orgId=org-1');
    });
  });

  it('shows an error if specialty creation fails', async () => {
    (createSpecialitiesBulk as jest.Mock).mockRejectedValueOnce(new Error('Fail'));

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
      expect(createSpecialitiesBulk).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'New Spec', organisationId: 'org-existing' }),
      ]);
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
      expect(createServicesBulk).toHaveBeenCalledWith([
        expect.objectContaining({
          name: 'Wellness exam',
          organisationId: 'org-existing',
          specialityId: 'spec-1',
        }),
      ]);
      expect(mockRouterPush).toHaveBeenCalledWith('/team-onboarding?orgId=org-1');
    });
  });

  // --------------------------------------------------------------------------
  // Extended coverage — pickers, service editor, and submit branches
  // --------------------------------------------------------------------------

  const makeService = (overrides: Partial<Service> = {}): Service =>
    ({
      id: '',
      name: 'Service',
      cost: 60,
      durationMinutes: 30,
      isActive: true,
      organisationId: '',
      ...overrides,
    }) as Service;

  const StatefulHarness = (
    overrides: Partial<React.ComponentProps<typeof SpecialityStep>> = {}
  ) => {
    const [specialities, setSpecialities] = React.useState<SpecialityWeb[]>(
      (overrides.specialities as SpecialityWeb[]) ?? []
    );
    const [formData, setFormData] = React.useState<Organisation>(
      (overrides.formData as Organisation) ?? baseFormData
    );
    return (
      <SpecialityStep
        {...getProps({ ...overrides, specialities, setSpecialities, formData, setFormData })}
      />
    );
  };

  it('filters the catalog as the query changes and lists matching specialties', () => {
    render(<SpecialityStep {...getProps()} />);

    const input = screen.getByPlaceholderText('Search specialties or create a custom one');
    fireEvent.focus(input);
    // Picker opens with the full catalog on focus (options carry the "starter services" copy)
    expect(
      screen.getByRole('button', { name: /General Practice.*starter services included/ })
    ).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'surgery' } });
    expect(
      screen.getByRole('button', { name: /Surgery.*starter services included/ })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Dentistry.*starter services included/ })
    ).not.toBeInTheDocument();
  });

  it('offers and adds a custom specialty when nothing in the catalog matches', () => {
    let stateCallback: ((previous: SpecialityWeb[]) => SpecialityWeb[]) | undefined;
    mockSetSpecialities.mockImplementation((callback) => {
      stateCallback = callback;
    });

    render(<SpecialityStep {...getProps()} />);

    const input = screen.getByPlaceholderText('Search specialties or create a custom one');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Underwater Basket Weaving' } });

    fireEvent.click(screen.getByRole('button', { name: /Create specialty/ }));

    expect(stateCallback).toBeDefined();
    const nextState = stateCallback?.([]);
    expect(nextState).toEqual([
      expect.objectContaining({ name: 'Underwater Basket Weaving', services: [] }),
    ]);
  });

  it('ignores a whitespace-only custom specialty when the catalog is exhausted', () => {
    const allSpecialities = getOnboardingSpecialityCatalog('HOSPITAL').map(
      (item) => ({ name: item.name, organisationId: '', services: [] }) as SpecialityWeb
    );

    render(<SpecialityStep {...getProps({ specialities: allSpecialities })} />);

    const input = screen.getByPlaceholderText('Search specialties or create a custom one');
    fireEvent.focus(input);

    // With every catalog entry already selected, the empty-state button shows an
    // empty query — clicking it must be a no-op.
    fireEvent.click(screen.getByRole('button', { name: /Create specialty/ }));
    expect(mockSetSpecialities).not.toHaveBeenCalled();
  });

  it('closes the specialty picker when clicking outside of it', () => {
    render(<SpecialityStep {...getProps()} />);

    const input = screen.getByPlaceholderText('Search specialties or create a custom one');
    fireEvent.focus(input);
    expect(
      screen.getByRole('button', { name: /General Practice.*starter services included/ })
    ).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(
      screen.queryByRole('button', { name: /General Practice.*starter services included/ })
    ).not.toBeInTheDocument();
  });

  it('closes an open service search when clicking outside of it', () => {
    render(
      <StatefulHarness
        specialities={[{ name: 'Cardiology', organisationId: '', services: [] } as SpecialityWeb]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Add service/ }));
    expect(screen.getByLabelText('Search services for Cardiology')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByLabelText('Search services for Cardiology')).not.toBeInTheDocument();
  });

  it('does not duplicate a specialty that is already selected', () => {
    let stateCallback: ((previous: SpecialityWeb[]) => SpecialityWeb[]) | undefined;
    mockSetSpecialities.mockImplementation((callback) => {
      stateCallback = callback;
    });

    render(<SpecialityStep {...getProps()} />);

    fireEvent.click(screen.getAllByRole('button', { name: /General Practice/i })[0]);

    const existing = [
      { name: 'General Practice', organisationId: '', services: [] } as SpecialityWeb,
    ];
    const nextState = stateCallback?.(existing);
    expect(nextState).toBe(existing);
  });

  it('removes a specialty and clears its open service search', () => {
    render(
      <StatefulHarness
        specialities={[
          {
            name: 'Cardiology',
            organisationId: '',
            services: [makeService({ name: 'Heart Check-up' })],
          } as SpecialityWeb,
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Add service/ }));
    expect(screen.getByLabelText('Search services for Cardiology')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Cardiology' }));

    expect(screen.queryByText('Cardiology')).not.toBeInTheDocument();
    expect(screen.getByText('No specialties added yet')).toBeInTheDocument();
  });

  it('filters available services within a specialty search', () => {
    render(
      <StatefulHarness
        specialities={[{ name: 'Cardiology', organisationId: '', services: [] } as SpecialityWeb]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Add service/ }));
    expect(screen.getByRole('button', { name: /Heart Check-up/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Blood Pressure Measurement/ })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search services for Cardiology'), {
      target: { value: 'heart' },
    });

    expect(screen.getByRole('button', { name: /Heart Murmur Evaluation/ })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Blood Pressure Measurement/ })
    ).not.toBeInTheDocument();
  });

  it('opens the editor when a template service is selected', () => {
    render(
      <StatefulHarness
        specialities={[{ name: 'Cardiology', organisationId: '', services: [] } as SpecialityWeb]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Add service/ }));
    fireEvent.click(screen.getByRole('button', { name: /Heart Check-up/ }));

    expect(screen.getByText('Edit service')).toBeInTheDocument();
    expect(screen.getByLabelText('Service name')).toHaveValue('Heart Check-up');
  });

  it('creates a custom service when the query matches no template', () => {
    render(
      <StatefulHarness
        specialities={[{ name: 'Cardiology', organisationId: '', services: [] } as SpecialityWeb]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Add service/ }));
    fireEvent.change(screen.getByLabelText('Search services for Cardiology'), {
      target: { value: 'Custom Heart Thing' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Add custom service/ }));

    expect(screen.getByText('Edit service')).toBeInTheDocument();
    expect(screen.getByLabelText('Service name')).toHaveValue('Custom Heart Thing');
  });

  it('does not create a custom service when the search query is empty', () => {
    render(
      <StatefulHarness
        specialities={[{ name: 'Custom Spec', organisationId: '', services: [] } as SpecialityWeb]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Add service/ }));
    // A speciality with no template always shows the "Add custom service" option
    fireEvent.click(screen.getByRole('button', { name: /Add custom service/ }));

    expect(screen.queryByText('Edit service')).not.toBeInTheDocument();
  });

  it('shows a validation error when saving a service without a name', () => {
    render(
      <StatefulHarness
        specialities={[
          {
            name: 'Cardiology',
            organisationId: '',
            services: [makeService({ name: 'Heart Check-up', cost: 70 })],
          } as SpecialityWeb,
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit Heart Check-up' }));
    fireEvent.change(screen.getByLabelText('Service name'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save service' }));

    expect(screen.getByText('Service name is required.')).toBeInTheDocument();
  });

  it('leaves other specialties untouched when saving a service', () => {
    const specialities = [
      {
        name: 'Cardiology',
        organisationId: '',
        services: [makeService({ name: 'Heart Check-up', cost: 70, durationMinutes: 30 })],
      } as SpecialityWeb,
      { name: 'Dentistry', organisationId: '', services: [] } as SpecialityWeb,
    ];

    let stateCallback: ((previous: SpecialityWeb[]) => SpecialityWeb[]) | undefined;
    mockSetSpecialities.mockImplementation((callback) => {
      stateCallback = callback;
    });

    render(<SpecialityStep {...getProps({ specialities })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Heart Check-up' }));
    fireEvent.change(screen.getByLabelText('Duration (mins)'), { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save service' }));

    const nextState = stateCallback?.(specialities);
    expect(nextState?.[1]).toBe(specialities[1]);
    expect(nextState?.[0].services?.[0]).toEqual(
      expect.objectContaining({ name: 'Heart Check-up', durationMinutes: 45 })
    );
  });

  it('removes a service from its specialty only', () => {
    const specialities = [
      {
        name: 'Cardiology',
        organisationId: '',
        services: [
          makeService({ name: 'Heart Check-up' }),
          makeService({ name: 'ECG / Echocardiogram' }),
        ],
      } as SpecialityWeb,
      {
        name: 'Dentistry',
        organisationId: '',
        services: [makeService({ name: 'Dental Cleaning & Scaling' })],
      } as SpecialityWeb,
    ];

    let stateCallback: ((previous: SpecialityWeb[]) => SpecialityWeb[]) | undefined;
    mockSetSpecialities.mockImplementation((callback) => {
      stateCallback = callback;
    });

    render(<SpecialityStep {...getProps({ specialities })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Heart Check-up' }));

    const nextState = stateCallback?.(specialities);
    expect(nextState?.[0].services).toEqual([
      expect.objectContaining({ name: 'ECG / Echocardiogram' }),
    ]);
    expect(nextState?.[1]).toBe(specialities[1]);
  });

  it('creates the org and merges the resolved id into form data on submit', async () => {
    let capturedFormData: Organisation | undefined;
    mockSetFormData.mockImplementation((updater) => {
      capturedFormData =
        typeof updater === 'function'
          ? (updater as (prev: Organisation) => Organisation)(baseFormData)
          : updater;
    });

    render(
      <SpecialityStep
        {...getProps({
          specialities: [
            { name: 'Cardiology', organisationId: '', services: [] } as SpecialityWeb,
          ],
        })}
      />
    );

    fireEvent.click(screen.getByTestId('btn-next'));

    await waitFor(() => {
      expect(createOrg).toHaveBeenCalledWith(baseFormData);
      expect(mockRouterPush).toHaveBeenCalledWith('/team-onboarding?orgId=org-1');
    });
    expect(capturedFormData).toEqual(expect.objectContaining({ _id: 'org-1' }));
  });

  it('matches removed specialties by name and skips initial specialties without an id', async () => {
    const initialSpecialities = [
      {
        _id: 'spec-1',
        name: 'Existing',
        organisationId: 'org-existing',
        services: [],
      } as SpecialityWeb,
      { name: 'No Id Spec', organisationId: 'org-existing', services: [] } as SpecialityWeb,
    ];

    render(
      <SpecialityStep
        {...getProps({
          formData: { ...baseFormData, _id: 'org-existing' } as Organisation,
          initialSpecialities,
          isExistingOrg: true,
          specialities: [{ name: 'Existing', organisationId: '', services: [] } as SpecialityWeb],
        })}
      />
    );

    fireEvent.click(screen.getByTestId('btn-next'));

    await waitFor(() => {
      expect(updateOrg).toHaveBeenCalled();
      expect(deleteSpeciality).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'No Id Spec' })
      );
      expect(mockRouterPush).toHaveBeenCalled();
    });
  });

  it('surfaces an error when a removed specialty fails to delete', async () => {
    (deleteSpeciality as jest.Mock).mockRejectedValueOnce(new Error('delete failed'));
    const onRedirectingChange = jest.fn();

    render(
      <SpecialityStep
        {...getProps({
          formData: { ...baseFormData, _id: 'org-existing' } as Organisation,
          initialSpecialities: [
            { _id: 'gone-1', name: 'Gone', organisationId: 'org-existing', services: [] } as SpecialityWeb,
          ],
          isExistingOrg: true,
          specialities: [{ name: 'Kept', organisationId: '', services: [] } as SpecialityWeb],
          onRedirectingChange,
        })}
      />
    );

    fireEvent.click(screen.getByTestId('btn-next'));

    await waitFor(() => {
      expect(
        screen.getByText('We could not save your specialties. Please try again.')
      ).toBeInTheDocument();
    });
    expect(onRedirectingChange).toHaveBeenLastCalledWith(false);
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('skips service diffing when a specialty id cannot be resolved', async () => {
    (createSpecialitiesBulk as jest.Mock).mockResolvedValueOnce([]);

    render(
      <SpecialityStep
        {...getProps({
          specialities: [
            {
              name: 'Orthopedics',
              organisationId: '',
              services: [makeService({ name: 'X-Ray', cost: 95, durationMinutes: 30 })],
            } as SpecialityWeb,
          ],
        })}
      />
    );

    fireEvent.click(screen.getByTestId('btn-next'));

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith('/team-onboarding?orgId=org-1');
    });
    expect(createServicesBulk).not.toHaveBeenCalled();
  });

  it('surfaces an error when saving services fails', async () => {
    (createServicesBulk as jest.Mock).mockRejectedValueOnce(new Error('service failed'));
    const onRedirectingChange = jest.fn();

    render(
      <SpecialityStep
        {...getProps({
          specialities: [
            {
              name: 'Cardiology',
              organisationId: '',
              services: [makeService({ name: 'New Service' })],
            } as SpecialityWeb,
          ],
          onRedirectingChange,
        })}
      />
    );

    fireEvent.click(screen.getByTestId('btn-next'));

    await waitFor(() => {
      expect(
        screen.getByText('We could not save your services. Please try again.')
      ).toBeInTheDocument();
    });
    expect(onRedirectingChange).toHaveBeenLastCalledWith(false);
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('reports the server message from an axios error on submit failure', async () => {
    const axiosError = Object.assign(new Error('network'), {
      isAxiosError: true,
      response: { data: { message: 'Server rejected the request' } },
    });
    (createOrg as jest.Mock).mockRejectedValueOnce(axiosError);
    const onRedirectingChange = jest.fn();

    render(
      <SpecialityStep
        {...getProps({
          specialities: [
            { name: 'Cardiology', organisationId: '', services: [] } as SpecialityWeb,
          ],
          onRedirectingChange,
        })}
      />
    );

    fireEvent.click(screen.getByTestId('btn-next'));

    await waitFor(() => {
      expect(screen.getByText('Server rejected the request')).toBeInTheDocument();
    });
    expect(onRedirectingChange).toHaveBeenLastCalledWith(false);
  });

  it('reports a generic message for a non-axios submit failure', async () => {
    (createOrg as jest.Mock).mockRejectedValueOnce(new Error('boom'));

    render(
      <SpecialityStep
        {...getProps({
          specialities: [
            { name: 'Cardiology', organisationId: '', services: [] } as SpecialityWeb,
          ],
        })}
      />
    );

    fireEvent.click(screen.getByTestId('btn-next'));

    await waitFor(() => {
      expect(
        screen.getByText('We could not save your specialties. Please try again.')
      ).toBeInTheDocument();
    });
  });

  it('leaves equivalent services untouched and dedupes duplicates on submit', async () => {
    const initialSpecialities = [
      {
        _id: 'spec-1',
        name: 'Existing',
        organisationId: 'org-existing',
        services: [
          makeService({
            id: 'svc-1',
            name: 'Care plan',
            cost: 75,
            durationMinutes: 30,
            isActive: true,
            specialityId: 'spec-1',
          }),
          makeService({
            id: 'svc-2',
            name: 'Vaccination',
            cost: 40,
            durationMinutes: 15,
            isActive: true,
            specialityId: 'spec-1',
          }),
        ],
      } as SpecialityWeb,
    ];

    const specialities = [
      {
        _id: 'spec-1',
        name: 'Existing',
        organisationId: 'org-existing',
        services: [
          makeService({
            id: 'svc-1',
            name: 'Care plan',
            cost: 75,
            durationMinutes: 30,
            isActive: true,
            specialityId: 'spec-1',
          }),
          makeService({
            id: 'svc-2',
            name: 'Vaccination',
            cost: 40,
            durationMinutes: 20,
            isActive: true,
            specialityId: 'spec-1',
          }),
          makeService({ id: '', name: 'Care plan', cost: 75, durationMinutes: 30, isActive: true }),
          makeService({ id: '', name: '   ', cost: 0, durationMinutes: 0, isActive: true }),
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
      expect(updateService).toHaveBeenCalledTimes(1);
      expect(updateService).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'svc-2', name: 'Vaccination', durationMinutes: 20 })
      );
    });
    expect(createServicesBulk).not.toHaveBeenCalled();
  });
});
