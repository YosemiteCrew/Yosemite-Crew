import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AddSpeciality from '@/app/features/organization/pages/Organization/Sections/Specialities/AddSpeciality';
import { useOrgStore } from '@/app/stores/orgStore';
import { useNotify } from '@/app/hooks/useNotify';
import { buildStarterServicesForSpeciality } from '@/app/lib/onboardingSpecialityCatalog';

const createBulkMock = jest.fn();

jest.mock('@/app/features/organization/services/specialityService', () => ({
  createBulkSpecialityServices: (...args: any[]) => createBulkMock(...args),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: jest.fn(),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: jest.fn(),
}));

jest.mock('@/app/lib/onboardingSpecialityCatalog', () => ({
  ...jest.requireActual('@/app/lib/onboardingSpecialityCatalog'),
  buildStarterServicesForSpeciality: jest.fn(),
}));

jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      close
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Accordion/Accordion', () => ({
  __esModule: true,
  default: ({ title, children, onDeleteClick }: any) => (
    <div>
      <div>{title}</div>
      <button type="button" onClick={onDeleteClick}>
        delete
      </button>
      {children}
    </div>
  ),
}));

jest.mock(
  '@/app/features/organization/pages/Organization/Sections/Specialities/SpecialityCard',
  () => ({
    __esModule: true,
    default: () => <div>speciality-card</div>,
  })
);

jest.mock('@/app/ui/inputs/SpecialitySearch/SpecialitySearchWeb', () => ({
  __esModule: true,
  default: ({ setSpecialities }: any) => (
    <button type="button" onClick={() => setSpecialities([{ name: 'Derm' }])}>
      add-speciality
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

describe('AddSpeciality', () => {
  const notify = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({
        orgsById: { 'org-1': { _id: 'org-1', type: 'HOSPITAL' } },
        primaryOrgId: 'org-1',
      })
    );
    (useNotify as jest.Mock).mockReturnValue({ notify });
    (buildStarterServicesForSpeciality as jest.Mock).mockReturnValue([]);
  });

  it('submits selected specialities', async () => {
    const setShowModal = jest.fn();
    createBulkMock.mockResolvedValue(undefined);

    render(<AddSpeciality showModal setShowModal={setShowModal} specialities={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'add-speciality' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(createBulkMock).toHaveBeenCalledWith([expect.objectContaining({ name: 'Derm' })]);
    });
    expect(notify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Specialities saved' })
    );
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('notifies an error and logs when save fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('save failed');
    createBulkMock.mockRejectedValue(error);
    const setShowModal = jest.fn();

    render(<AddSpeciality showModal setShowModal={setShowModal} specialities={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'add-speciality' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to save specialities' })
      );
    });
    expect(consoleSpy).toHaveBeenCalledWith('Failed to save specialities:', error);
    expect(setShowModal).not.toHaveBeenCalledWith(false);
    consoleSpy.mockRestore();
  });

  it('removes a speciality from the list', () => {
    render(<AddSpeciality showModal setShowModal={jest.fn()} specialities={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'add-speciality' }));
    expect(screen.getByText('Derm')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'delete' }));
    expect(screen.queryByText('Derm')).not.toBeInTheDocument();
  });

  it('closes the modal via the Close icon', () => {
    const setShowModal = jest.fn();
    render(<AddSpeciality showModal setShowModal={setShowModal} specialities={[]} />);
    fireEvent.click(screen.getByText('close'));
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('invokes the no-op onClick on the hidden spacer Close icon', () => {
    render(<AddSpeciality showModal setShowModal={jest.fn()} specialities={[]} />);
    fireEvent.click(screen.getAllByText('close')[0]);
    expect(screen.getAllByText('Add specialties')[0]).toBeInTheDocument();
  });

  it('backfills starter services onto an already-added speciality when businessType/org changes', () => {
    (buildStarterServicesForSpeciality as jest.Mock).mockReturnValue([
      { name: 'Checkup', duration: 30 },
    ]);

    const { rerender } = render(
      <AddSpeciality showModal setShowModal={jest.fn()} specialities={[]} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'add-speciality' }));
    expect(buildStarterServicesForSpeciality).not.toHaveBeenCalled();

    // Effect deps are [businessType, primaryOrgId] — change the org to trigger a re-run
    // against the already-added speciality (which has no services yet).
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({
        orgsById: { 'org-2': { _id: 'org-2', type: 'HOSPITAL' } },
        primaryOrgId: 'org-2',
      })
    );
    rerender(<AddSpeciality showModal setShowModal={jest.fn()} specialities={[]} />);

    expect(buildStarterServicesForSpeciality).toHaveBeenCalledWith('Derm', 'HOSPITAL');
  });

  it('does not backfill when the speciality already has services', () => {
    (buildStarterServicesForSpeciality as jest.Mock).mockReturnValue([
      { name: 'Checkup', duration: 30 },
    ]);

    const { rerender } = render(
      <AddSpeciality showModal setShowModal={jest.fn()} specialities={[]} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'add-speciality' }));

    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({
        orgsById: { 'org-2': { _id: 'org-2', type: 'HOSPITAL' } },
        primaryOrgId: 'org-2',
      })
    );
    rerender(<AddSpeciality showModal setShowModal={jest.fn()} specialities={[]} />);
    expect(buildStarterServicesForSpeciality).toHaveBeenCalledTimes(1);

    // Trigger the effect a second time; the speciality now already has services, so
    // applyStarterServices should short-circuit and not call the builder again.
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({
        orgsById: { 'org-3': { _id: 'org-3', type: 'HOSPITAL' } },
        primaryOrgId: 'org-3',
      })
    );
    rerender(<AddSpeciality showModal setShowModal={jest.fn()} specialities={[]} />);
    expect(buildStarterServicesForSpeciality).toHaveBeenCalledTimes(1);
  });

  it('resolves a non-hospital business type from the primary org', () => {
    (buildStarterServicesForSpeciality as jest.Mock).mockReturnValue([]);
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({
        orgsById: { 'org-1': { _id: 'org-1', type: 'GROOMER' } },
        primaryOrgId: 'org-1',
      })
    );
    const { rerender } = render(
      <AddSpeciality showModal setShowModal={jest.fn()} specialities={[]} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'add-speciality' }));

    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({
        orgsById: { 'org-1': { _id: 'org-1', type: 'BREEDER' } },
        primaryOrgId: 'org-1',
      })
    );
    rerender(<AddSpeciality showModal setShowModal={jest.fn()} specialities={[]} />);
    expect(buildStarterServicesForSpeciality).toHaveBeenCalledWith('Derm', 'BREEDER');
  });

  it('handles a missing primary org gracefully', () => {
    (buildStarterServicesForSpeciality as jest.Mock).mockReturnValue([]);
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({
        orgsById: {},
        primaryOrgId: null,
      })
    );
    const { rerender } = render(
      <AddSpeciality showModal setShowModal={jest.fn()} specialities={[]} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'add-speciality' }));

    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({
        orgsById: {},
        primaryOrgId: 'org-9',
      })
    );
    rerender(<AddSpeciality showModal setShowModal={jest.fn()} specialities={[]} />);
    expect(buildStarterServicesForSpeciality).toHaveBeenCalledWith('Derm', 'HOSPITAL');
  });
});
