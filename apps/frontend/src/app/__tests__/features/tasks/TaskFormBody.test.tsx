import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TaskFormBody from '@/app/features/tasks/components/TaskFormBody';
import { Task } from '@/app/features/tasks/types/task';

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: any) => <div data-testid="permission-gate">{children}</div>,
}));

jest.mock('@/app/ui/overlays/Fallback', () => ({
  __esModule: true,
  default: () => <div data-testid="fallback" />,
}));

jest.mock('@/app/ui/primitives/Accordion/Accordion', () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div data-testid="accordion" data-title={title}>
      {children}
    </div>
  ),
}));

jest.mock('@/app/features/tasks/components/TaskFormFields', () => ({
  __esModule: true,
  default: ({ onSelectTemplate }: any) => (
    <button type="button" data-testid="task-form-fields" onClick={() => onSelectTemplate('tpl-1')}>
      fields
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" data-testid="primary-btn" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick }: any) => (
    <button type="button" data-testid="secondary-btn" onClick={onClick}>
      {text}
    </button>
  ),
}));

describe('TaskFormBody', () => {
  const baseProps = {
    formData: {} as Task,
    setFormData: jest.fn(),
    due: null,
    setDue: jest.fn(),
    dueTimeValue: '',
    setDueTimeValue: jest.fn(),
    formDataErrors: {},
    error: null,
    isLoading: false,
    templateOptions: [],
    selectTemplate: jest.fn(),
    handleCreate: jest.fn(),
    handleCreateTemplate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('gates the form behind the tasks:edit:any permission', () => {
    render(<TaskFormBody {...baseProps} />);
    expect(screen.getByTestId('permission-gate')).toBeInTheDocument();
  });

  it('renders the Task accordion and form fields', () => {
    render(<TaskFormBody {...baseProps} />);
    expect(screen.getByTestId('accordion')).toHaveAttribute('data-title', 'Task');
    expect(screen.getByTestId('task-form-fields')).toBeInTheDocument();
  });

  it('does not render an error message when error is null', () => {
    render(<TaskFormBody {...baseProps} />);
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('renders the error message when error is set', () => {
    render(<TaskFormBody {...baseProps} error="Something went wrong" />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('shows "Save" label and enabled button when not loading', () => {
    render(<TaskFormBody {...baseProps} />);
    const button = screen.getByTestId('primary-btn');
    expect(button).toHaveTextContent('Save');
    expect(button).not.toBeDisabled();
  });

  it('shows "Saving..." label and disables the primary button while loading', () => {
    render(<TaskFormBody {...baseProps} isLoading />);
    const button = screen.getByTestId('primary-btn');
    expect(button).toHaveTextContent('Saving...');
    expect(button).toBeDisabled();
  });

  it('calls handleCreate when the primary button is clicked', () => {
    render(<TaskFormBody {...baseProps} />);
    fireEvent.click(screen.getByTestId('primary-btn'));
    expect(baseProps.handleCreate).toHaveBeenCalledTimes(1);
  });

  it('calls handleCreateTemplate when the secondary button is clicked', () => {
    render(<TaskFormBody {...baseProps} />);
    fireEvent.click(screen.getByTestId('secondary-btn'));
    expect(baseProps.handleCreateTemplate).toHaveBeenCalledTimes(1);
  });

  it('calls selectTemplate wrapped through onSelectTemplate when a template is chosen', () => {
    render(<TaskFormBody {...baseProps} />);
    fireEvent.click(screen.getByTestId('task-form-fields'));
    expect(baseProps.selectTemplate).toHaveBeenCalledWith('tpl-1');
  });
});
