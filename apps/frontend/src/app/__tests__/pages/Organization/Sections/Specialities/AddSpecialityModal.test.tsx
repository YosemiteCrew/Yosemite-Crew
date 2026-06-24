import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="center-modal">{children}</div> : null,
}));

jest.mock('@/app/ui/overlays/Modal/ModalHeader', () => ({
  __esModule: true,
  default: ({ title, onClose }: any) => (
    <div>
      <span>{title}</span>
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange, error }: any) => (
    <label>
      {inlabel}
      <input aria-label={inlabel} value={value} onChange={onChange} />
      {error && <span role="alert">{error}</span>}
    </label>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons/Primary', () => ({
  __esModule: true,
  default: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons/Secondary', () => ({
  __esModule: true,
  default: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

const mockAddSpeciality = jest.fn();
let mockSpecialities: Array<{ name: string; organisationId: string }> = [];
jest.mock('@/app/stores/revampCatalogStore', () => ({
  useRevampCatalogStore: (selector: any) =>
    selector({ addSpeciality: mockAddSpeciality, specialities: mockSpecialities }),
}));

const mockNotify = jest.fn();
jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: mockNotify }),
}));

import AddSpecialityModal from '@/app/features/organization/pages/Specialities/AddSpecialityModal';

const defaultProps = {
  showModal: true,
  setShowModal: jest.fn(),
  organisationId: 'org-1',
};

describe('AddSpecialityModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSpecialities = [];
  });

  it('renders the modal when showModal is true', () => {
    render(<AddSpecialityModal {...defaultProps} />);
    expect(screen.getByTestId('center-modal')).toBeInTheDocument();
    expect(screen.getAllByText('Add Speciality').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Add Speciality' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('does not render when showModal is false', () => {
    render(<AddSpecialityModal {...defaultProps} showModal={false} />);
    expect(screen.queryByTestId('center-modal')).not.toBeInTheDocument();
  });

  it('shows validation error when submitting empty name', () => {
    render(<AddSpecialityModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Speciality' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Speciality name is required.');
    expect(mockAddSpeciality).not.toHaveBeenCalled();
  });

  it('shows validation error when submitting whitespace-only name', () => {
    render(<AddSpecialityModal {...defaultProps} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Speciality' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Speciality name is required.');
  });

  it('clears error when user starts typing', () => {
    render(<AddSpecialityModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Speciality' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Dermatology' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('submits valid name, calls addSpeciality, notifies, and closes', async () => {
    const setShowModal = jest.fn();
    render(<AddSpecialityModal {...defaultProps} setShowModal={setShowModal} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Dermatology' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Speciality' }));

    await waitFor(() => {
      expect(mockAddSpeciality).toHaveBeenCalledWith('Dermatology', 'org-1');
      expect(mockNotify).toHaveBeenCalledWith(
        'success',
        expect.objectContaining({ title: 'Speciality added' })
      );
      expect(setShowModal).toHaveBeenCalledWith(false);
    });
  });

  it('rejects duplicate names in the same organisation', () => {
    mockSpecialities = [{ name: 'Dermatology', organisationId: 'org-1' }];
    render(<AddSpecialityModal {...defaultProps} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: ' dermatology ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Speciality' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'A speciality with this name already exists.'
    );
    expect(mockAddSpeciality).not.toHaveBeenCalled();
  });

  it('trims the name before submitting', async () => {
    const setShowModal = jest.fn();
    render(<AddSpecialityModal {...defaultProps} setShowModal={setShowModal} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Cardiology  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Speciality' }));

    await waitFor(() => {
      expect(mockAddSpeciality).toHaveBeenCalledWith('Cardiology', 'org-1');
    });
  });

  it('Cancel button closes modal and resets state', () => {
    const setShowModal = jest.fn();
    render(<AddSpecialityModal {...defaultProps} setShowModal={setShowModal} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Oncology' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(setShowModal).toHaveBeenCalledWith(false);
    expect(mockAddSpeciality).not.toHaveBeenCalled();
  });

  it('ModalHeader close button closes modal', () => {
    const setShowModal = jest.fn();
    render(<AddSpecialityModal {...defaultProps} setShowModal={setShowModal} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(setShowModal).toHaveBeenCalledWith(false);
  });
});
