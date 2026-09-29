import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useHasPermission } from '@/app/hooks/usePermissions';
import PracticeProfileFields from '@/app/features/companions/components/PracticeProfileFields';
import {
  createPracticeProfileField,
  deactivatePracticeProfileField,
  getPracticeProfileFields,
  savePracticeProfileFieldValues,
} from '@/app/features/companions/services/practiceProfileFieldsService';

jest.mock('@/app/features/companions/services/practiceProfileFieldsService', () => ({
  createPracticeProfileField: jest.fn(),
  deactivatePracticeProfileField: jest.fn(),
  getPracticeProfileFields: jest.fn(),
  savePracticeProfileFieldValues: jest.fn(),
}));
jest.mock('@/app/hooks/usePermissions', () => ({ useHasPermission: jest.fn(() => true) }));

jest.mock('@/app/ui/primitives/Accordion/EditableAccordion', () => ({
  __esModule: true,
  default: ({ title, fields, data, onSave, rightElement }: any) => (
    <div>
      <div>{title}</div>
      <div data-testid="profile-values">{JSON.stringify(data)}</div>
      <div data-testid="profile-fields">{fields.map((field: any) => field.label).join(',')}</div>
      {rightElement}
      <button
        type="button"
        onClick={() => onSave({ color: 'blue', weight: '2.5', insured: 'true' })}
      >
        Save practice values
      </button>
      <button type="button" onClick={() => onSave({ color: '', weight: '', insured: 'false' })}>
        Clear practice values
      </button>
    </div>
  ),
}));

const getFieldsMock = jest.mocked(getPracticeProfileFields);
const canEditMock = jest.mocked(useHasPermission);
const createFieldMock = jest.mocked(createPracticeProfileField);
const deactivateFieldMock = jest.mocked(deactivatePracticeProfileField);
const saveValuesMock = jest.mocked(savePracticeProfileFieldValues);

describe('PracticeProfileFields', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    canEditMock.mockReturnValue(true);
    getFieldsMock.mockResolvedValue([]);
  });

  it('keeps editing controls hidden from view-only users', async () => {
    canEditMock.mockReturnValue(false);
    render(<PracticeProfileFields entityType="PATIENT" entityId="patient-1" />);

    await screen.findByText('Practice fields');
    expect(screen.queryByRole('button', { name: 'Add field' })).not.toBeInTheDocument();
  });

  it('loads practice fields, converts typed values, and deactivates a field', async () => {
    getFieldsMock.mockResolvedValue([
      {
        id: 'field-color',
        fieldKey: 'color',
        label: 'Coat color',
        type: 'TEXT',
        options: [],
        value: 'Blue',
      },
      {
        id: 'field-weight',
        fieldKey: 'weight',
        label: 'Preferred weight',
        type: 'NUMBER',
        options: [],
        value: 2,
      },
      {
        id: 'field-insured',
        fieldKey: 'insured',
        label: 'Insured',
        type: 'BOOLEAN',
        options: [],
        value: false,
      },
    ]);
    const user = userEvent.setup();
    render(<PracticeProfileFields entityType="PATIENT" entityId="patient-1" />);

    await screen.findByText('Practice fields');
    expect(screen.getByTestId('profile-values')).toHaveTextContent(
      JSON.stringify({ color: 'Blue', weight: 2, insured: false })
    );
    expect(getFieldsMock).toHaveBeenCalledWith('PATIENT', 'patient-1');

    await user.click(screen.getByRole('button', { name: 'Save practice values' }));
    await waitFor(() =>
      expect(saveValuesMock).toHaveBeenCalledWith('PATIENT', 'patient-1', [
        { fieldId: 'field-color', value: 'blue' },
        { fieldId: 'field-weight', value: 2.5 },
        { fieldId: 'field-insured', value: true },
      ])
    );
    await user.click(screen.getByRole('button', { name: 'Clear practice values' }));
    await waitFor(() =>
      expect(saveValuesMock).toHaveBeenLastCalledWith('PATIENT', 'patient-1', [
        { fieldId: 'field-color', value: null },
        { fieldId: 'field-weight', value: null },
        { fieldId: 'field-insured', value: false },
      ])
    );

    await user.click(screen.getByRole('button', { name: 'Add field' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Add field' }));
    const reopenedDialog = screen.getByRole('dialog');
    await user.click(within(reopenedDialog).getByRole('button', { name: 'Remove Coat color' }));
    await waitFor(() => expect(deactivateFieldMock).toHaveBeenCalledWith('field-color'));
    expect(screen.getByTestId('profile-fields')).not.toHaveTextContent('Coat color');
  });

  it('creates a choice field with one choice per line', async () => {
    const user = userEvent.setup();
    createFieldMock.mockResolvedValue({
      id: 'field-contact',
      fieldKey: 'contact-time',
      label: 'Contact time',
      type: 'SELECT',
      options: ['Morning', 'Evening'],
      value: null,
    });
    render(<PracticeProfileFields entityType="CLIENT" entityId="client-1" />);

    await user.click(await screen.findByRole('button', { name: 'Add field' }));
    let dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Add field' }));
    dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Field name'), 'Contact time');
    await user.click(within(dialog).getByRole('button', { name: /choose a type/i }));
    await user.click(screen.getByRole('option', { name: 'Choice list' }));
    await user.type(within(dialog).getByLabelText('Choices, one per line'), 'Morning\nEvening');
    await user.click(within(dialog).getByRole('button', { name: 'Add field' }));

    await waitFor(() =>
      expect(createFieldMock).toHaveBeenCalledWith('CLIENT', {
        label: 'Contact time',
        type: 'SELECT',
        options: ['Morning', 'Evening'],
      })
    );
    expect(await screen.findByTestId('profile-fields')).toHaveTextContent('Contact time');
  });

  it('leaves an unanswered yes/no question unanswered instead of answering it for the user', async () => {
    getFieldsMock.mockResolvedValue([
      {
        id: 'field-insured',
        fieldKey: 'insured',
        label: 'Insured',
        type: 'BOOLEAN',
        options: [],
        value: null,
      },
    ]);
    const user = userEvent.setup();
    render(<PracticeProfileFields entityType="PATIENT" entityId="patient-1" />);

    await screen.findByText('Practice fields');
    await user.click(screen.getByRole('button', { name: 'Clear practice values' }));

    expect(saveValuesMock).not.toHaveBeenCalled();
  });

  it('does not show one profile values under another profile when the load fails', async () => {
    getFieldsMock.mockResolvedValueOnce([
      {
        id: 'field-color',
        fieldKey: 'color',
        label: 'Coat color',
        type: 'TEXT',
        options: [],
        value: 'Blue',
      },
    ]);
    getFieldsMock.mockRejectedValueOnce(new Error('load failed'));
    const { rerender } = render(
      <PracticeProfileFields entityType="PATIENT" entityId="patient-1" />
    );

    expect(await screen.findByTestId('profile-values')).toHaveTextContent('Blue');
    rerender(<PracticeProfileFields entityType="PATIENT" entityId="patient-2" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Practice fields could not be loaded.'
    );
    // Nothing from the profile that loaded first is left on screen.
    expect(screen.getByTestId('profile-values')).toHaveTextContent('{}');
    expect(screen.getByTestId('profile-fields')).toHaveTextContent('');
  });

  it('shows load, create, and deactivate errors', async () => {
    getFieldsMock.mockRejectedValueOnce(new Error('load failed'));
    const first = render(<PracticeProfileFields entityType="PATIENT" entityId="patient-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Practice fields could not be loaded.'
    );
    await waitFor(() =>
      expect(screen.queryByText('Loading practice fields…')).not.toBeInTheDocument()
    );
    first.unmount();

    getFieldsMock.mockResolvedValueOnce([
      {
        id: 'field-color',
        fieldKey: 'color',
        label: 'Coat color',
        type: 'TEXT',
        options: [],
        value: 'Blue',
      },
    ]);
    deactivateFieldMock.mockRejectedValueOnce(new Error('deactivate failed'));
    const user = userEvent.setup();
    render(<PracticeProfileFields entityType="PATIENT" entityId="patient-2" />);

    await user.click(await screen.findByRole('button', { name: 'Add field' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Remove Coat color' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This field could not be removed');

    createFieldMock.mockRejectedValueOnce(new Error('create failed'));
    await user.type(within(dialog).getByLabelText('Field name'), 'New field');
    await user.click(within(dialog).getByRole('button', { name: 'Add field' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This field could not be added');
  });

  it('does not render without a profile id', () => {
    render(<PracticeProfileFields entityType="PATIENT" entityId="" />);
    expect(screen.queryByText('Practice fields')).not.toBeInTheDocument();
    expect(getFieldsMock).not.toHaveBeenCalled();
  });
});
