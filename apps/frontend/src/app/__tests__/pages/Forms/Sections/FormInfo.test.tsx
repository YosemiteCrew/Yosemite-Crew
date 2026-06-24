import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import FormInfo from '@/app/features/forms/pages/Forms/Sections/FormInfo';

const publishFormMock = jest.fn();
const publishTemplateFormMock = jest.fn();
const archiveTemplateFormMock = jest.fn();
const unpublishTemplateFormMock = jest.fn();

jest.mock('@/app/features/forms/services/formService', () => ({
  archiveForm: jest.fn(),
  publishForm: (...args: any[]) => publishFormMock(...args),
  unpublishForm: jest.fn(),
}));

jest.mock('@/app/features/forms/services/templateFormsService', () => ({
  archiveTemplateForm: (...args: any[]) => archiveTemplateFormMock(...args),
  publishTemplateForm: (...args: any[]) => publishTemplateFormMock(...args),
  unpublishTemplateForm: (...args: any[]) => unpublishTemplateFormMock(...args),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: jest.fn((selector) =>
    selector({
      primaryOrgId: 'org-1',
      orgsById: { 'org-1': { type: 'HOSPITAL' } },
    })
  ),
}));

jest.mock('@/app/ui/overlays/Toast/Toast', () => ({
  useErrorTost: () => ({
    showErrorTost: jest.fn(),
    ErrorTostPopup: () => <div>toast</div>,
  }),
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

jest.mock('@/app/ui/primitives/Accordion/EditableAccordion', () => ({
  __esModule: true,
  default: ({ title }: any) => <div>{title}</div>,
}));

jest.mock('@/app/ui/primitives/Accordion/Accordion', () => ({
  __esModule: true,
  default: ({ title }: any) => <div>{title}</div>,
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/features/forms/pages/Forms/Sections/AddForm/components/FormRenderer', () => ({
  __esModule: true,
  default: () => <div>form-renderer</div>,
}));

jest.mock('@iconify/react', () => ({
  Icon: () => <span>icon</span>,
}));

describe('FormInfo', () => {
  beforeAll(() => {
    if ((console.error as jest.Mock).mockImplementation) {
      (console.error as jest.Mock).mockImplementation(() => {});
    } else {
      jest.spyOn(console, 'error').mockImplementation(() => {});
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    (console.error as jest.Mock).mockRestore?.();
  });

  it('publishes draft form', async () => {
    const setShowModal = jest.fn();
    publishFormMock.mockResolvedValue(undefined);

    render(
      <FormInfo
        showModal
        setShowModal={setShowModal}
        activeForm={
          {
            _id: 'f1',
            name: 'Form',
            status: 'Draft',
            fields: [],
          } as any
        }
        onEdit={jest.fn()}
        serviceOptions={[]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => {
      expect(publishFormMock).toHaveBeenCalledWith('f1');
    });
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('keeps YC library template-backed records view-only', () => {
    render(
      <FormInfo
        showModal
        setShowModal={jest.fn()}
        activeForm={
          {
            _id: 'tpl-1',
            name: 'SOAP template',
            status: 'Published',
            schema: [],
            isTemplateBacked: true,
            templateSource: 'YC_LIBRARY',
          } as any
        }
        onEdit={jest.fn()}
        serviceOptions={[]}
      />
    );

    expect(screen.getByText('View template')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unpublish' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit form' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('uses form view copy for non-editable legacy forms', () => {
    render(
      <FormInfo
        showModal
        setShowModal={jest.fn()}
        activeForm={
          {
            _id: 'f2',
            name: 'Consent',
            status: 'Published',
            schema: [],
          } as any
        }
        onEdit={jest.fn()}
        serviceOptions={[]}
        canEdit={false}
      />
    );

    expect(screen.getByText('View form')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('publishes editable organisation template records through template APIs', async () => {
    const setShowModal = jest.fn();
    publishTemplateFormMock.mockResolvedValue(undefined);

    render(
      <FormInfo
        showModal
        setShowModal={setShowModal}
        activeForm={
          {
            _id: 'tpl-2',
            templateId: 'tpl-2',
            name: 'SOAP template',
            status: 'Draft',
            schema: [],
            isTemplateBacked: true,
            templateSource: 'ORG_TEMPLATE',
          } as any
        }
        onEdit={jest.fn()}
        serviceOptions={[]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => {
      expect(publishTemplateFormMock).toHaveBeenCalledWith(
        expect.objectContaining({ templateId: 'tpl-2' }),
        'org-1'
      );
    });
    expect(publishFormMock).not.toHaveBeenCalled();
    expect(setShowModal).toHaveBeenCalledWith(false);
  });
});
