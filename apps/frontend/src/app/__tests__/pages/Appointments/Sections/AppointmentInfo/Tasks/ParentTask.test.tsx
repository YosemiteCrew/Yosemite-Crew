import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

import ParentTask from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Tasks/ParentTask';
import { useTaskForm } from '@/app/hooks/useTaskForm';

const bodySpy = jest.fn();
const resetForm = jest.fn();

jest.mock('@/app/hooks/useTaskForm', () => ({
  useTaskForm: jest.fn(),
}));

jest.mock('@/app/features/tasks/components/TaskFormBody', () => ({
  __esModule: true,
  default: (props: any) => {
    bodySpy(props);
    return <div data-testid="task-form-body" />;
  },
}));

describe('Appointment ParentTask section', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useTaskForm as jest.Mock).mockReturnValue({
      resetForm,
      formState: { ok: true },
    });
  });

  it('initializes companion task form with companion parent assignee and resets on mount/update', () => {
    const appointmentOne: any = {
      companion: { id: 'comp-1', parent: { id: 'parent-1' } },
    };
    const appointmentTwo: any = {
      companion: { id: 'comp-2', parent: { id: 'parent-2' } },
    };

    const { rerender } = render(<ParentTask activeAppointment={appointmentOne} />);

    expect(useTaskForm).toHaveBeenCalledWith({
      isCompanionTask: true,
      initialTask: {
        companionId: 'comp-1',
        assignedTo: 'parent-1',
      },
    });
    expect(resetForm).toHaveBeenCalledTimes(1);

    rerender(<ParentTask activeAppointment={appointmentTwo} />);

    expect(resetForm).toHaveBeenCalledTimes(2);
    expect(bodySpy).toHaveBeenCalled();
  });
});
