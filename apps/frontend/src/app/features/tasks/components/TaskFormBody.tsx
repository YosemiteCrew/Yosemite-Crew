import React from 'react';
import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import Fallback from '@/app/ui/overlays/Fallback';
import TaskFormFields from '@/app/features/tasks/components/TaskFormFields';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import { Task } from '@/app/features/tasks/types/task';
import { TaskFormErrors } from '@/app/lib/taskForm';
import { Option } from '@/app/features/companions/types/companion';

type TaskFormBodyProps = {
  formData: Task;
  setFormData: React.Dispatch<React.SetStateAction<Task>>;
  due: Date | null;
  setDue: React.Dispatch<React.SetStateAction<Date | null>>;
  dueTimeValue: string;
  setDueTimeValue: React.Dispatch<React.SetStateAction<string>>;
  formDataErrors: TaskFormErrors;
  error: string | null;
  isLoading: boolean;
  templateOptions: Option[];
  selectTemplate: (templateId: string) => void;
  handleCreate: () => void;
  handleCreateTemplate: () => void;
  showAssigneeSelect?: boolean;
  assigneeOptions?: Option[];
  onAssigneeSelect?: (option: Option) => void;
};

const TaskFormBody = ({
  formData,
  setFormData,
  due,
  setDue,
  dueTimeValue,
  setDueTimeValue,
  formDataErrors,
  error,
  isLoading,
  templateOptions,
  selectTemplate,
  handleCreate,
  handleCreateTemplate,
  showAssigneeSelect,
  assigneeOptions,
  onAssigneeSelect,
}: TaskFormBodyProps) => (
  <PermissionGate allOf={[PERMISSIONS.TASKS_EDIT_ANY]} fallback={<Fallback />}>
    <div className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto scrollbar-hidden">
      <Accordion title="Task" defaultOpen showEditIcon={false} isEditing={true}>
        <TaskFormFields
          formData={formData}
          setFormData={setFormData}
          formDataErrors={formDataErrors}
          templateOptions={templateOptions}
          due={due}
          setDue={setDue}
          dueTimeValue={dueTimeValue}
          setDueTimeValue={setDueTimeValue}
          onSelectTemplate={(templateId: string) => selectTemplate(templateId)}
          showAssigneeSelect={showAssigneeSelect}
          assigneeOptions={assigneeOptions}
          onAssigneeSelect={onAssigneeSelect}
        />
      </Accordion>
      <div className="flex justify-end items-center gap-3 w-full flex-col pb-3">
        {error && <div className="text-red-600 text-sm text-center">{error}</div>}
        <div className="flex gap-3 justify-center w-full flex-wrap">
          <Secondary
            href="#"
            text="Save as template"
            className="hidden"
            onClick={handleCreateTemplate}
          />
          <Primary
            href="#"
            text={isLoading ? 'Saving...' : 'Save'}
            classname="w-auto min-w-[140px]"
            onClick={handleCreate}
            isDisabled={isLoading}
          />
        </div>
      </div>
    </div>
  </PermissionGate>
);

export default TaskFormBody;
