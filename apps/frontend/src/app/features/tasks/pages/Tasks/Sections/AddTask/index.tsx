import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import TaskFormFields from '@/app/features/tasks/components/TaskFormFields';
import Modal from '@/app/ui/overlays/Modal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import { useCompanionsForPrimaryOrg } from '@/app/hooks/useCompanion';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { useMemberMap } from '@/app/hooks/useMemberMap';
import { useTaskForm } from '@/app/hooks/useTaskForm';
import React, { useMemo } from 'react';
import { getPreferredTimeValue } from '@/app/lib/date';
import { getPreferredTimeZone } from '@/app/lib/timezone';
import { Task } from '@/app/features/tasks/types/task';

const TaskTypeOptions = [
  { value: 'EMPLOYEE_TASK', label: 'Employee Task' },
  { value: 'PARENT_TASK', label: 'Parent Task' },
];

type AddTaskProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  prefill?: Partial<Task> | null;
};

const AddTask = ({ showModal, setShowModal, prefill }: AddTaskProps) => {
  const teams = useTeamForPrimaryOrg();
  const companions = useCompanionsForPrimaryOrg();
  const { resolveMemberName } = useMemberMap();
  const {
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
  } = useTaskForm({
    isCompanionTask: false,
    onSuccess: () => setShowModal(false),
  });

  // Render-phase hydration: consume the prefill once per object when the
  // modal is open (the parent clears it when the modal closes).
  const [consumedPrefill, setConsumedPrefill] = React.useState<Partial<Task> | null>(null);
  if (showModal && prefill && prefill !== consumedPrefill) {
    setConsumedPrefill(prefill);
    const dueAtDate = prefill.dueAt ? new Date(prefill.dueAt) : new Date();
    setDue(dueAtDate);
    setDueTimeValue(getPreferredTimeValue(dueAtDate, '00:00'));
    setFormData((prev) => ({
      ...prev,
      ...prefill,
      _id: '',
      organisationId: undefined,
      appointmentId: undefined,
      createdAt: undefined,
      updatedAt: undefined,
      completedAt: undefined,
      completedBy: undefined,
      calendarEventId: undefined,
      status: 'PENDING',
      source: prefill.source || 'CUSTOM',
      audience: prefill.audience || prev.audience || 'EMPLOYEE_TASK',
      assignedTo: prefill.assignedTo || '',
      dueAt: dueAtDate,
      timezone: prefill.timezone || prev.timezone || getPreferredTimeZone(),
      recurrence: prefill.recurrence
        ? {
            ...prefill.recurrence,
            isMaster: false,
            masterTaskId: undefined,
          }
        : prev.recurrence,
    }));
  }

  const CompanionOptions = useMemo(() => {
    const byParent = new Map<string, { label: string; value: string }>();
    companions?.forEach((companion) => {
      if (!companion.parentId) return;
      const resolvedName = resolveMemberName(companion.parentId);
      byParent.set(companion.parentId, {
        label: resolvedName === '-' ? companion.name || companion.parentId : resolvedName,
        value: companion.parentId,
      });
    });
    return Array.from(byParent.values());
  }, [companions, resolveMemberName]);

  const TeamOptions = useMemo(
    () =>
      teams?.map((team) => ({
        label: team.name || team.practionerId || team._id,
        value: team.practionerId || team._id,
      })),
    [teams]
  );

  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="flex flex-col h-full gap-6">
        <ModalHeader title="New task" onClose={() => setShowModal(false)} />

        <div className="flex flex-col gap-6 w-full flex-1 justify-start overflow-y-auto scrollbar-hidden pt-1.5">
          <TaskFormFields
            formData={formData}
            setFormData={setFormData}
            formDataErrors={formDataErrors}
            templateOptions={templateOptions}
            due={due}
            setDue={setDue}
            dueTimeValue={dueTimeValue}
            setDueTimeValue={setDueTimeValue}
            onSelectTemplate={selectTemplate}
            showAudienceSelect
            audienceOptions={TaskTypeOptions}
            onAudienceSelect={(option) =>
              setFormData({
                ...formData,
                audience: option.value as any,
                assignedTo: '',
                companionId: undefined,
              })
            }
            showAssigneeSelect
            assigneeOptions={formData.audience === 'EMPLOYEE_TASK' ? TeamOptions : CompanionOptions}
            onAssigneeSelect={(option) => {
              if (formData.audience === 'EMPLOYEE_TASK') {
                setFormData({
                  ...formData,
                  assignedTo: option.value,
                });
                return;
              }
              const companion = companions?.find((c) => c.parentId === option.value);
              if (companion) {
                setFormData({
                  ...formData,
                  companionId: companion.id,
                  assignedTo: option.value,
                });
              }
            }}
          />
          <div className="flex flex-col items-center gap-3 w-full pb-3">
            {error && <div className="text-red-600 text-sm text-center">{error}</div>}
            <div className="flex w-full flex-wrap items-center justify-end gap-3">
              <Secondary
                href="#"
                text="Save as template"
                className="hidden"
                onClick={handleCreateTemplate}
              />
              <Secondary href="#" text="Cancel" onClick={() => setShowModal(false)} />
              <Primary
                href="#"
                text={isLoading ? 'Saving...' : 'Create task'}
                className="w-auto min-w-[140px]"
                onClick={handleCreate}
                isDisabled={isLoading}
              />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default AddTask;
