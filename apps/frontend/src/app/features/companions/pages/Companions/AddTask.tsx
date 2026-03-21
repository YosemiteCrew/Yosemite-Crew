import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import TaskFormFields from '@/app/features/tasks/components/TaskFormFields';
import Modal from '@/app/ui/overlays/Modal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import { useTaskForm } from '@/app/hooks/useTaskForm';
import React, { useEffect } from 'react';
import { CompanionParent } from '@/app/features/companions/pages/Companions/types';

type AddTaskProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeCompanion: CompanionParent;
};

const AddTask = ({ showModal, setShowModal, activeCompanion }: AddTaskProps) => {
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
    resetForm,
  } = useTaskForm({
    isCompanionTask: true,
    onSuccess: () => setShowModal(false),
  });

  useEffect(() => {
    if (!showModal) return;
    setFormData((prev) => ({
      ...prev,
      companionId: activeCompanion.companion.id,
      assignedTo: activeCompanion.parent.id,
    }));
  }, [showModal, activeCompanion, setFormData]);

  useEffect(() => {
    if (!showModal) {
      resetForm();
    }
  }, [showModal, resetForm]);

  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="flex flex-col h-full gap-6">
        <ModalHeader title="Add task" onClose={() => setShowModal(false)} />

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
          />
        </div>
        <div className="flex justify-end items-end gap-3 w-full flex-col">
          {error && <div className="text-red-600 text-sm text-center">{error}</div>}
          <div className="flex gap-3 w-full">
            <Secondary
              href="#"
              text="Save as template"
              className="w-full hidden"
              onClick={handleCreateTemplate}
            />
            <Primary
              href="#"
              text={isLoading ? 'Saving...' : 'Save'}
              classname="w-full"
              onClick={handleCreate}
              isDisabled={isLoading}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default AddTask;
