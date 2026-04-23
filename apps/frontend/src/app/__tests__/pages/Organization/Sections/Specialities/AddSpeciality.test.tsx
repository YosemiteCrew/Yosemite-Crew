import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AddSpeciality from '@/app/features/organization/pages/Organization/Sections/Specialities/AddSpeciality';
import { useOrgStore } from '@/app/stores/orgStore';

const createBulkMock = jest.fn();

jest.mock('@/app/features/organization/services/specialityService', () => ({
  createBulkSpecialityServices: (...args: any[]) => createBulkMock(...args),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: jest.fn(),
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
  beforeEach(() => {
    jest.clearAllMocks();
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({
        orgsById: { 'org-1': { _id: 'org-1', type: 'HOSPITAL' } },
        primaryOrgId: 'org-1',
      })
    );
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
    expect(setShowModal).toHaveBeenCalledWith(false);
  });
});
