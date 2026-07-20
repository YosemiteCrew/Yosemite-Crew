import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AddForm from '@/app/features/forms/pages/Forms/Sections/AddForm';

let isDetailValid = true;
let isBuildValid = true;
let isMerckEnabled = true;

jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="modal">{children}</div>,
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: any) => <span data-testid="next-image" aria-label={alt} />,
}));

jest.mock('react-icons/io5', () => ({
  IoCreateOutline: () => <span data-testid="icon-create" />,
  IoEyeOutline: () => <span data-testid="icon-eye" />,
}));

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Close
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/features/forms/pages/Forms/Sections/AddForm/Details', () => ({
  __esModule: true,
  default: ({ ref, hideNext }: any) => {
    jest.requireActual<typeof import('react')>('react').useImperativeHandle(ref, () => ({
      validate: () => isDetailValid,
    }));
    return (
      <div>
        <div>Details Step</div>
        <div>hideNext:{String(hideNext)}</div>
      </div>
    );
  },
}));

jest.mock('@/app/features/forms/pages/Forms/Sections/AddForm/Build', () => ({
  __esModule: true,
  default: ({ ref }: any) => {
    jest.requireActual<typeof import('react')>('react').useImperativeHandle(ref, () => ({
      validate: () => isBuildValid,
    }));
    return <div>Build Step</div>;
  },
}));

jest.mock('@/app/features/forms/pages/Forms/Sections/AddForm/Review', () => ({
  __esModule: true,
  default: ({ onPublish, onSaveDraft }: any) => (
    <div>
      <div>Review Step</div>
      <button type="button" onClick={onPublish}>
        Publish
      </button>
      <button type="button" onClick={onSaveDraft}>
        Save Draft
      </button>
    </div>
  ),
}));

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/AppointmentMerckSearch',
  () => ({
    __esModule: true,
    default: () => <div>Search Manuals</div>,
  })
);

jest.mock('@/app/hooks/useMerckIntegration', () => ({
  useResolvedMerckIntegrationForPrimaryOrg: () => ({
    integration: {
      provider: 'MERCK_MANUALS',
      status: isMerckEnabled ? 'enabled' : 'disabled',
      source: 'backend',
    },
    isEnabled: isMerckEnabled,
    isLoading: false,
    refresh: jest.fn(),
  }),
}));

jest.mock('@/app/features/forms/services/formService', () => ({
  saveFormDraft: jest.fn(),
  publishForm: jest.fn(),
}));

jest.mock('@/app/features/forms/services/templateFormsService', () => ({
  saveTemplateFormDraft: jest.fn(),
  publishTemplateForm: jest.fn(),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: Object.assign(
    jest.fn((selector) =>
      selector({
        primaryOrgId: 'org-1',
        getPrimaryOrg: () => ({ type: 'HOSPITAL' }),
        orgsById: { 'org-1': { type: 'HOSPITAL' } },
      })
    ),
    {
      getState: jest.fn(() => ({
        primaryOrgId: 'org-1',
        getPrimaryOrg: () => ({ type: 'HOSPITAL' }),
        orgsById: { 'org-1': { type: 'HOSPITAL' } },
      })),
    }
  ),
}));

const formService = jest.requireMock('@/app/features/forms/services/formService');
const templateFormsService = jest.requireMock('@/app/features/forms/services/templateFormsService');

describe('AddForm single-screen builder', () => {
  const serviceOptions = [{ label: 'Checkup', value: 'serv-1' }];

  beforeEach(() => {
    jest.clearAllMocks();
    isDetailValid = true;
    isBuildValid = true;
    isMerckEnabled = true;
    formService.saveFormDraft.mockResolvedValue({ _id: 'form-1' });
    formService.publishForm.mockResolvedValue(undefined);
    templateFormsService.saveTemplateFormDraft.mockResolvedValue({
      _id: 'tpl-1',
      templateId: 'tpl-1',
      isTemplateBacked: true,
    });
    templateFormsService.publishTemplateForm.mockResolvedValue({
      _id: 'tpl-1',
      templateId: 'tpl-1',
      isTemplateBacked: true,
      status: 'Published',
    });
  });

  it('renders the builder view with palette/canvas Build and the details fold by default', () => {
    render(<AddForm showModal setShowModal={jest.fn()} serviceOptions={serviceOptions} />);

    expect(screen.getByText('Add template')).toBeInTheDocument();
    expect(screen.getByText('Build Step')).toBeInTheDocument();
    // Details is always mounted (hidden) so its validator is registered; it is passed hideNext.
    expect(screen.getByText('Details Step')).toBeInTheDocument();
    expect(screen.getByText('hideNext:true')).toBeInTheDocument();
    // Header publish cta + footer draft action.
    expect(screen.getByText('Save template')).toBeInTheDocument();
    expect(screen.getByText('Save as draft')).toBeInTheDocument();
  });

  it('publishes from the header cta once details and schema validate', async () => {
    render(<AddForm showModal setShowModal={jest.fn()} serviceOptions={serviceOptions} />);

    fireEvent.click(screen.getByText('Save template'));

    // New forms default to YC-default (template-backed), so publishing routes through the
    // template API rather than the legacy FHIR form service.
    await waitFor(() => {
      expect(templateFormsService.saveTemplateFormDraft).toHaveBeenCalled();
      expect(templateFormsService.publishTemplateForm).toHaveBeenCalled();
    });
  });

  it('saves a draft from the footer', async () => {
    render(<AddForm showModal setShowModal={jest.fn()} serviceOptions={serviceOptions} />);

    fireEvent.click(screen.getByText('Save as draft'));

    await waitFor(() => {
      expect(templateFormsService.saveTemplateFormDraft).toHaveBeenCalled();
    });
  });

  it('routes template categories through the template API', async () => {
    render(
      <AddForm
        showModal
        setShowModal={jest.fn()}
        serviceOptions={serviceOptions}
        initialForm={
          {
            name: 'SOAP template',
            category: 'SOAP',
            usage: 'Internal',
            updatedBy: '',
            lastUpdated: '',
            schema: [],
          } as any
        }
      />
    );

    fireEvent.click(screen.getByText('Save template'));

    await waitFor(() => {
      expect(templateFormsService.saveTemplateFormDraft).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'SOAP' }),
        'org-1'
      );
      expect(templateFormsService.publishTemplateForm).toHaveBeenCalledWith(
        expect.objectContaining({ templateId: 'tpl-1' }),
        'org-1'
      );
    });
    expect(formService.saveFormDraft).not.toHaveBeenCalled();
    expect(formService.publishForm).not.toHaveBeenCalled();
  });

  it('blocks publishing and reveals details when the details validator fails', () => {
    isDetailValid = false;
    render(<AddForm showModal setShowModal={jest.fn()} serviceOptions={serviceOptions} />);

    fireEvent.click(screen.getByText('Save template'));

    expect(templateFormsService.saveTemplateFormDraft).not.toHaveBeenCalled();
    // The details fold is revealed so inline errors become visible.
    expect(screen.getByText('Hide details')).toBeInTheDocument();
  });

  it('blocks publishing when the build validator fails', () => {
    isBuildValid = false;
    render(<AddForm showModal setShowModal={jest.fn()} serviceOptions={serviceOptions} />);

    fireEvent.click(screen.getByText('Save template'));

    expect(templateFormsService.saveTemplateFormDraft).not.toHaveBeenCalled();
  });

  it('toggles the preview (reusing the Review renderer) and back to the builder', () => {
    render(<AddForm showModal setShowModal={jest.fn()} serviceOptions={serviceOptions} />);

    fireEvent.click(screen.getByText('Preview as parent'));
    expect(screen.getByText('Review Step')).toBeInTheDocument();
    // Header cta + footer are hidden in preview; Review supplies its own actions.
    expect(screen.queryByText('Save template')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Back to builder'));
    expect(screen.getByText('Build Step')).toBeInTheDocument();
  });

  it('publishes from the Review preview action', async () => {
    render(<AddForm showModal setShowModal={jest.fn()} serviceOptions={serviceOptions} />);

    fireEvent.click(screen.getByText('Preview as parent'));
    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(templateFormsService.saveTemplateFormDraft).toHaveBeenCalled();
    });
  });

  it('opens the MSD Veterinary Manual and hides it when the integration is disabled', () => {
    const { rerender } = render(
      <AddForm showModal setShowModal={jest.fn()} serviceOptions={serviceOptions} />
    );

    fireEvent.click(screen.getByText('MSD Veterinary Manual'));
    expect(screen.getByText('Search Manuals')).toBeInTheDocument();

    isMerckEnabled = false;
    rerender(<AddForm showModal setShowModal={jest.fn()} serviceOptions={serviceOptions} />);
    expect(screen.queryByText('MSD Veterinary Manual')).not.toBeInTheDocument();
  });

  it('expands and collapses the template details fold', () => {
    render(<AddForm showModal setShowModal={jest.fn()} serviceOptions={serviceOptions} />);

    fireEvent.click(screen.getByText('Edit details'));
    expect(screen.getByText('Hide details')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Hide details'));
    expect(screen.getByText('Edit details')).toBeInTheDocument();
  });

  it('shows the edit-template header when editing an existing template', () => {
    render(
      <AddForm
        showModal
        setShowModal={jest.fn()}
        serviceOptions={serviceOptions}
        initialForm={
          {
            _id: 'tpl-9',
            name: 'Existing template',
            category: 'SOAP',
            usage: 'Internal',
            updatedBy: '',
            lastUpdated: '',
            schema: [],
          } as any
        }
      />
    );

    expect(screen.getByText(/Edit template/)).toBeInTheDocument();
    expect(screen.getByText('Update & publish')).toBeInTheDocument();
  });

  it('closes the modal from the header close button', () => {
    const setShowModal = jest.fn();
    render(<AddForm showModal setShowModal={setShowModal} serviceOptions={serviceOptions} />);

    fireEvent.click(screen.getByText('Close'));
    expect(setShowModal).toHaveBeenCalledWith(false);
  });
});
