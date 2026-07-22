import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import Documents from '@/app/features/organization/pages/Organization/Sections/Documents/Documents';

const useDocumentsMock = jest.fn();
const usePermissionsMock = jest.fn();
const accordionButtonSpy = jest.fn();
const documentInfoSpy = jest.fn();

jest.mock('@/app/hooks/useDocuments', () => ({
  useDocumentsForPrimaryOrg: () => useDocumentsMock(),
}));

jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => usePermissionsMock(),
}));

jest.mock('@/app/lib/validators', () => ({
  toTitle: (value: string) => value,
}));

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/primitives/SectionCard/SectionCard', () => (props: any) => {
  accordionButtonSpy(props);
  return (
    <div data-testid="accordion-button">
      {props.showButton && props.buttonTitle ? (
        <button type="button" onClick={() => props.buttonClick(true)}>
          {props.buttonTitle}
        </button>
      ) : null}
      {props.children}
    </div>
  );
});

jest.mock(
  '@/app/features/organization/pages/Organization/Sections/Documents/AddDocument',
  () => () => <div data-testid="add-document" />
);

jest.mock(
  '@/app/features/organization/pages/Organization/Sections/Documents/DocumentInfo',
  () => (props: any) => {
    documentInfoSpy(props);
    return props.showModal ? (
      <div data-testid="document-info">{props.activeDocument?.title}</div>
    ) : null;
  }
);

jest.mock('react-icons/io5', () => ({
  IoCreateOutline: () => <span data-testid="icon-template" />,
  IoDocumentTextOutline: () => <span data-testid="icon-doc" />,
  IoEllipsisHorizontal: () => <span data-testid="icon-kebab" />,
}));

const doc = (over: Partial<Record<string, unknown>> = {}) => ({
  _id: 'doc-1',
  title: 'Anaesthesia consent',
  category: 'GENERAL',
  description: 'consent',
  fileUrl: 'https://x/terms.pdf',
  ...over,
});

describe('Organization documents section', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePermissionsMock.mockReturnValue({ can: jest.fn(() => true) });
  });

  it('renders document rows with type pills for each file kind', () => {
    useDocumentsMock.mockReturnValue([
      doc(),
      doc({
        _id: 'doc-2',
        title: 'Surgery consent',
        fileUrl: 'x/consent.docx',
        description: 'equine',
      }),
      doc({ _id: 'doc-3', title: 'Notes', fileUrl: 'x/notes.txt', description: undefined }),
    ]);

    render(<Documents />);

    expect(screen.getByText('Anaesthesia consent')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText('DOC')).toBeInTheDocument();
    expect(screen.getByText('FILE')).toBeInTheDocument();
    expect(screen.getByText('GENERAL · consent')).toBeInTheDocument();
    expect(
      screen.getByText('Templates support merge fields: patient, parent, visit, practitioner')
    ).toBeInTheDocument();
    expect(accordionButtonSpy).toHaveBeenCalledWith(expect.objectContaining({ showButton: true }));
    expect(screen.getAllByTestId('icon-doc')).toHaveLength(3);
    expect(screen.queryByTestId('icon-template')).not.toBeInTheDocument();
  });

  it('marks a document with no uploaded file as a green E-SIGN template', () => {
    useDocumentsMock.mockReturnValue([
      doc({ _id: 'doc-esign', title: 'Anaesthesia consent', fileUrl: '' }),
    ]);

    render(<Documents />);

    const badge = screen.getByText('E-SIGN');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveStyle({ backgroundColor: 'var(--status-completed-bg)' });
    expect(screen.getByTestId('icon-template')).toBeInTheDocument();
    expect(screen.queryByTestId('icon-doc')).not.toBeInTheDocument();
  });

  it('opens the document info view when a row is clicked', () => {
    useDocumentsMock.mockReturnValue([doc()]);

    render(<Documents />);
    expect(screen.queryByTestId('document-info')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'View Anaesthesia consent' }));
    expect(screen.getByTestId('document-info')).toHaveTextContent('Anaesthesia consent');

    // kebab also opens the view
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Anaesthesia consent' }));
    expect(screen.getByTestId('document-info')).toBeInTheDocument();
  });

  it('shows an empty state and hides the add button without edit permission', () => {
    usePermissionsMock.mockReturnValue({ can: jest.fn(() => false) });
    useDocumentsMock.mockReturnValue([]);

    render(<Documents />);

    expect(
      screen.getByText('No documents yet. Add clinic-wide templates and files.')
    ).toBeInTheDocument();
    expect(accordionButtonSpy).toHaveBeenCalledWith(expect.objectContaining({ showButton: false }));
    // No active document -> DocumentInfo not mounted
    expect(documentInfoSpy).not.toHaveBeenCalled();
  });

  it('keeps the active document in sync as the list changes', () => {
    useDocumentsMock.mockReturnValue([doc(), doc({ _id: 'doc-2', title: 'Second' })]);
    const { rerender } = render(<Documents />);
    fireEvent.click(screen.getByRole('button', { name: 'View Anaesthesia consent' }));
    expect(screen.getByTestId('document-info')).toHaveTextContent('Anaesthesia consent');

    // Remove the active doc -> falls back to the first remaining doc
    useDocumentsMock.mockReturnValue([doc({ _id: 'doc-2', title: 'Second' })]);
    rerender(<Documents />);
    expect(screen.getByTestId('document-info')).toHaveTextContent('Second');

    // Empty list -> active document cleared, view closes
    useDocumentsMock.mockReturnValue([]);
    rerender(<Documents />);
    expect(screen.queryByTestId('document-info')).not.toBeInTheDocument();
  });
});
