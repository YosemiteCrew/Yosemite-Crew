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

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Close
    </button>
  ),
}));

jest.mock('@/app/features/forms/pages/Forms/Sections/AddForm/Details', () => ({
  __esModule: true,
  default: ({ onNext, registerValidator }: any) => {
    registerValidator(() => isDetailValid);
    return (
      <div>
        <div>Details Step</div>
        <button type="button" onClick={onNext}>
          Next Details
        </button>
      </div>
    );
  },
}));

jest.mock('@/app/features/forms/pages/Forms/Sections/AddForm/Build', () => ({
  __esModule: true,
  default: ({ onNext, registerValidator }: any) => {
    registerValidator(() => isBuildValid);
    return (
      <div>
        <div>Build Step</div>
        <button type="button" onClick={onNext}>
          Next Build
        </button>
      </div>
    );
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

describe('AddForm modal', () => {
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

  it('navigates through steps and publishes', async () => {
    render(<AddForm showModal setShowModal={jest.fn()} serviceOptions={serviceOptions} />);

    expect(screen.getByText('Details Step')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Next Details'));
    expect(screen.getByText('Build Step')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Next Build'));
    expect(screen.getByText('Review Step')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(formService.saveFormDraft).toHaveBeenCalled();
      expect(formService.publishForm).toHaveBeenCalledWith('form-1');
    });
  });

  it('saves a draft from review', async () => {
    render(<AddForm showModal setShowModal={jest.fn()} serviceOptions={serviceOptions} />);

    fireEvent.click(screen.getByText('Next Details'));
    fireEvent.click(screen.getByText('Next Build'));
    fireEvent.click(screen.getByText('Save Draft'));

    await waitFor(() => {
      expect(formService.saveFormDraft).toHaveBeenCalled();
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

    fireEvent.click(screen.getByText('Next Details'));
    fireEvent.click(screen.getByText('Next Build'));
    fireEvent.click(screen.getByText('Publish'));

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

  it('allows opening merck any time but blocks build/review when details is invalid', () => {
    isDetailValid = false;
    render(<AddForm showModal setShowModal={jest.fn()} serviceOptions={serviceOptions} />);

    fireEvent.click(screen.getByRole('tab', { name: 'MSD Veterinary Manual' }));
    expect(screen.getByText('Search Manuals')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Build form' }));
    expect(screen.getByText('Search Manuals')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Review' }));
    expect(screen.getByText('Search Manuals')).toBeInTheDocument();
  });

  it('blocks review when build validator fails', () => {
    isBuildValid = false;
    render(<AddForm showModal setShowModal={jest.fn()} serviceOptions={serviceOptions} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Build form' }));
    expect(screen.getByText('Build Step')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Review' }));
    expect(screen.getByText('Build Step')).toBeInTheDocument();
  });

  it('hides merck tab when merck integration is disabled', () => {
    isMerckEnabled = false;
    render(<AddForm showModal setShowModal={jest.fn()} serviceOptions={serviceOptions} />);

    expect(screen.queryByRole('tab', { name: 'MSD Veterinary Manual' })).not.toBeInTheDocument();
  });
});
