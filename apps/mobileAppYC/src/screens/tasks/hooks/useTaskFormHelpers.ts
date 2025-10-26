import {useMemo} from 'react';
import {useSelector} from 'react-redux';
import type {RootState} from '@/app/store';
import {
  isMedicationForm as checkIsMedicationForm,
  isObservationalToolForm as checkIsObservationalToolForm,
  isSimpleForm as checkIsSimpleForm,
} from '@/utils/taskFormHelpers';
import type {TaskFormData} from '@/features/tasks/types';

export const useTaskFormHelpers = (formData: TaskFormData) => {
  const companions = useSelector((state: RootState) => state.companion.companions);

  const isMedicationForm = useMemo(
    () => checkIsMedicationForm(formData.healthTaskType),
    [formData.healthTaskType]
  );

  const isObservationalToolForm = useMemo(
    () => checkIsObservationalToolForm(formData.healthTaskType),
    [formData.healthTaskType]
  );

  const isSimpleForm = useMemo(
    () => checkIsSimpleForm(formData.healthTaskType),
    [formData.healthTaskType]
  );

  return {
    isMedicationForm,
    isObservationalToolForm,
    isSimpleForm,
    companions,
  };
};
