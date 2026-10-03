import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import FormInfo from '@/app/features/forms/pages/Forms/Sections/FormInfo';
import { registerPlugin, unregisterPlugin } from '@/app/features/plugins/registry';
import type { FormsProps } from '@/app/features/forms/types/forms';

const publishFormMock = jest.fn();
const publishTemplateFormMock = jest.fn();
const archiveTemplateFormMock = jest.fn();
const unpublishTemplateFormMock = jest.fn();
const mockShowErrorTost = jest.fn();

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
    showErrorTost: mockShowErrorTost,
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
  default: ({ title, data, fields }: any) => (
    <div data-testid={`editable-${title}`}>
      {title}:{data?.templateSource ?? 'none'}
      {fields
        ?.find((field: any) => field.key === 'services')
        ?.options?.map((option: any) => option.label)
        .join(',')}
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Accordion/Accordion', () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div>
      <div>{title}</div>
      {children}
    </div>
  ),
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

jest.mock('@/app/ui/icons/Icon', () => ({
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
    unregisterPlugin('form-info-test');
  });

  afterEach(() => unregisterPlugin('form-info-test'));

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
    expect(screen.getByTestId('editable-Usage & visibility')).toHaveTextContent('YC_LIBRARY');
    expect(screen.getByRole('button', { name: 'Unpublish' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit form' })).toBeInTheDocument();
    // The shared panel header contributes exactly one close control.
    expect(screen.getAllByRole('button', { name: 'close' })).toHaveLength(1);
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

  it('does not expose an unavailable linked service identifier', () => {
    render(
      <FormInfo
        showModal
        setShowModal={jest.fn()}
        activeForm={
          {
            _id: 'f-service',
            name: 'Consent',
            status: 'Published',
            schema: [],
            services: ['missing-service-id'],
          } as any
        }
        onEdit={jest.fn()}
        serviceOptions={[]}
      />
    );

    expect(screen.getByTestId('editable-Usage & visibility')).toHaveTextContent(
      'Unavailable service'
    );
    expect(screen.queryByText('missing-service-id')).not.toBeInTheDocument();
  });

  it('renders form previews and detail extensions with working actions', () => {
    const setShowModal = jest.fn();
    const onEdit = jest.fn();
    const form = {
      _id: 'f-extension',
      name: 'Consent',
      status: 'Draft',
      schema: [{ id: 'consent', type: 'text' }],
    } as any;
    const DetailTab: React.FC<{
      formId: string;
      organisationId: string;
      form: FormsProps;
    }> = ({ formId, organisationId }) => <span>{`detail-tab-${formId}-${organisationId}`}</span>;
    const DetailAction: React.FC<{
      formId: string;
      organisationId: string;
      form: FormsProps;
      onAction: () => void;
    }> = ({ onAction }) => (
      <button type="button" onClick={onAction}>
        Plugin action
      </button>
    );

    registerPlugin({
      id: 'form-info-test',
      name: 'Form info test',
      version: '1.0.0',
      extensions: [
        { id: 'detail-tab', extensionPointId: 'forms.detail.tabs', component: DetailTab },
        { id: 'detail-action', extensionPointId: 'forms.detail.actions', component: DetailAction },
      ],
    });

    render(
      <FormInfo
        showModal
        setShowModal={setShowModal}
        activeForm={form}
        onEdit={onEdit}
        serviceOptions={[]}
      />
    );

    expect(screen.getByText('Form preview')).toBeInTheDocument();
    expect(screen.getByText('form-renderer')).toBeInTheDocument();
    expect(screen.getByText('detail-tab-f-extension-org-1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Plugin action' }));
    expect(setShowModal).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole('button', { name: 'Edit form' }));
    expect(onEdit).toHaveBeenCalledWith(form);
    expect(setShowModal).toHaveBeenCalledTimes(2);
  });

  it('closes after unpublishing and archiving a template-backed form', async () => {
    const setShowModal = jest.fn();
    unpublishTemplateFormMock.mockResolvedValue(undefined);
    archiveTemplateFormMock.mockResolvedValue(undefined);

    render(
      <FormInfo
        showModal
        setShowModal={setShowModal}
        activeForm={
          {
            _id: 'tpl-actions',
            templateId: 'tpl-actions',
            name: 'SOAP template',
            status: 'Published',
            schema: [],
            isTemplateBacked: true,
            templateSource: 'ORG_TEMPLATE',
          } as any
        }
        onEdit={jest.fn()}
        serviceOptions={[]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }));
    await waitFor(() => expect(unpublishTemplateFormMock).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(archiveTemplateFormMock).toHaveBeenCalled());
    expect(setShowModal).toHaveBeenCalledTimes(2);
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('keeps the form open and shows an error when a template action fails', async () => {
    const setShowModal = jest.fn();
    unpublishTemplateFormMock.mockRejectedValue(new Error('Unpublish failed'));
    archiveTemplateFormMock.mockRejectedValue(new Error('Archive failed'));

    render(
      <FormInfo
        showModal
        setShowModal={setShowModal}
        activeForm={
          {
            _id: 'tpl-actions',
            templateId: 'tpl-actions',
            name: 'SOAP template',
            status: 'Published',
            schema: [],
            isTemplateBacked: true,
            templateSource: 'ORG_TEMPLATE',
          } as any
        }
        onEdit={jest.fn()}
        serviceOptions={[]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }));
    await waitFor(() =>
      expect(mockShowErrorTost).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Unpublish failed' })
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    await waitFor(() =>
      expect(mockShowErrorTost).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Archive failed' })
      )
    );
    expect(setShowModal).not.toHaveBeenCalled();
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

  it('renders task templates with the task summary instead of the generic form preview', () => {
    render(
      <FormInfo
        showModal
        setShowModal={jest.fn()}
        activeForm={
          {
            _id: 'tpl-task',
            name: 'Task template',
            category: 'Task Template',
            status: 'Draft',
            schema: [
              {
                id: 'task_blocks',
                type: 'group',
                meta: { taskGroup: true },
                fields: [
                  {
                    id: 'task-1',
                    type: 'group',
                    label: 'Record vitals',
                    fields: [
                      {
                        id: 'task-1_name',
                        type: 'input',
                        label: 'Task title',
                        defaultValue: 'Record vitals',
                        meta: { taskBlockKey: 'name' },
                      },
                      {
                        id: 'task-1_category',
                        type: 'dropdown',
                        label: 'Category',
                        defaultValue: 'CARE',
                        meta: { taskBlockKey: 'category' },
                        options: [{ label: 'Care', value: 'CARE' }],
                      },
                      {
                        id: 'task-1_instructions',
                        type: 'textarea',
                        label: 'Instructions (optional)',
                        defaultValue: 'Watch appetite and hydration',
                        meta: { taskBlockKey: 'additionalNotes' },
                      },
                    ],
                  },
                ],
              },
            ],
          } as any
        }
        onEdit={jest.fn()}
        serviceOptions={[]}
      />
    );

    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.queryByText('Form preview')).not.toBeInTheDocument();
    expect(screen.getByText('Record vitals')).toBeInTheDocument();
    /* The block carries only a category - no recurrence, reminder or duration -
       so the caption is the category alone. It used to read "Care ·": the summary
       joined category and repeat unconditionally while guarding the other two, so
       a block authored without a recurrence field ended on a dangling middot.
       Asserted as an exact string, and for the absence of a trailing separator,
       because /Care ·/ passed happily on the broken output. */
    expect(screen.getByText('Care')).toBeInTheDocument();
    expect(screen.queryByText(/Care\s*·\s*$/)).not.toBeInTheDocument();
    expect(screen.getByText('Watch appetite and hydration')).toBeInTheDocument();
  });
});
