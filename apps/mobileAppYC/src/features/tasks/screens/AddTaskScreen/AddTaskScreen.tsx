import React, {useMemo, useEffect, useRef} from 'react';
import {ScrollView} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {useDispatch, useSelector} from 'react-redux';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {CompanionSelector} from '@/shared/components/common/CompanionSelector/CompanionSelector';
import {useTheme} from '@/hooks';
import {addTask, setTaskCalendarEventId, updateTask} from '@/features/tasks';
import type {AppDispatch, RootState} from '@/app/store';
import type {TaskStackParamList} from '@/navigation/types';
import {selectTaskById} from '@/features/tasks/selectors';
import {setSelectedCompanion} from '@/features/companion';
import {selectAuthUser} from '@/features/auth/selectors';
import {selectAcceptedCoParents} from '@/features/coParent/selectors';
import {buildTaskTypeBreadcrumb} from '@/features/tasks/utils/taskLabels';
import {useAddTaskScreen} from '@/features/tasks/hooks/useAddTaskScreen';
import {TaskFormContent, TaskFormFooter, TaskFormSheets} from '@/features/tasks/components/form';
import {createTaskFormStyles} from '@/features/tasks/screens/styles';
import {REMINDER_OPTIONS} from '@/features/tasks/constants';
import {createFileHandlers} from '@/features/tasks/utils/createFileHandlers';
import {getTaskFormSheetProps} from '@/features/tasks/utils/getTaskFormSheetProps';
import {buildTaskDraftFromForm} from '@/features/tasks/services/taskService';
import {uploadDocumentFiles} from '@/features/documents/documentSlice';
import {createCalendarEventForTask} from '@/features/tasks/services/calendarSyncService';
import {getAssignedUserName} from '@/features/tasks/utils/userHelpers';

type Navigation = NativeStackNavigationProp<TaskStackParamList, 'AddTask'>;
type Route = RouteProp<TaskStackParamList, 'AddTask'>;

const prefillBasicFields = (reuseTask: any, updateField: (field: any, value: any) => void) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  updateField('date', tomorrow);
  updateField('title', reuseTask.title);
  updateField('frequency', reuseTask.frequency);
  updateField('additionalNote', reuseTask.additionalNote || '');
  updateField('assignedTo', reuseTask.assignedTo ?? null);

  if (reuseTask.time) {
    const [hours, minutes] = reuseTask.time.split(':').map(Number);
    const timeDate = new Date();
    timeDate.setHours(hours, minutes, 0);
    updateField('time', timeDate);
  }

  if (reuseTask.attachments && reuseTask.attachments.length > 0) {
    updateField('attachments', [...reuseTask.attachments]);
    updateField('attachDocuments', true);
  }
};

const prefillMedicationFields = (reuseTask: any, updateField: (field: any, value: any) => void) => {
  if (!reuseTask.details || !('medicineName' in reuseTask.details)) return;

  updateField('medicineName', reuseTask.details.medicineName || '');
  updateField('medicineType', reuseTask.details.medicineType || null);
  updateField('medicationFrequency', reuseTask.frequency);

  if ('dosages' in reuseTask.details && reuseTask.details.dosages) {
    updateField('dosages', reuseTask.details.dosages);
  }

  if ('description' in reuseTask.details && typeof reuseTask.details.description === 'string') {
    updateField('description', reuseTask.details.description);
  }
};

const prefillFormFromTask = (
  reuseTask: any,
  updateField: (field: any, value: any) => void,
  handleTaskTypeSelect: (taskType: any) => void,
  dispatch: AppDispatch
) => {
  if (reuseTask.companionId) {
    dispatch(setSelectedCompanion(reuseTask.companionId));
  }

  const taskTypeFromTask: any = {
    category: reuseTask.category,
    subcategory: reuseTask.subcategory === 'none' ? null : reuseTask.subcategory,
  };

  if (reuseTask.details && 'taskType' in reuseTask.details) {
    taskTypeFromTask.taskType = reuseTask.details.taskType;
    if ('chronicConditionType' in reuseTask.details) {
      taskTypeFromTask.chronicConditionType = reuseTask.details.chronicConditionType;
    }
  }

  handleTaskTypeSelect(taskTypeFromTask);
  prefillBasicFields(reuseTask, updateField);
  prefillMedicationFields(reuseTask, updateField);

  if (reuseTask.observationToolId) {
    updateField('observationalTool', reuseTask.observationToolId);
  }

  if (reuseTask.details && 'description' in reuseTask.details && typeof reuseTask.details.description === 'string') {
    updateField('description', reuseTask.details.description);
  }
};

export const AddTaskScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const dispatch = useDispatch<AppDispatch>();
  const {theme} = useTheme();
  const styles = useMemo(() => createTaskFormStyles(theme), [theme]);

  const reuseTaskId = route.params?.reuseTaskId;
  const reuseTask = useSelector((state: RootState) =>
    reuseTaskId ? selectTaskById(reuseTaskId)(state) : null
  );
  const hasPrefilledRef = useRef(false);

  const currentUser = useSelector(selectAuthUser);
  const coParents = useSelector(selectAcceptedCoParents);

  const hookData = useAddTaskScreen(navigation);
  const {
    companions,
    selectedCompanionId,
    loading,
    companionType,
    formData,
    errors,
    taskTypeSelection,
    isMedicationForm,
    isObservationalToolForm,
    isSimpleForm,
    handleTaskTypeSelect,
    handleCompanionSelect,
    handleBack,
    sheetHandlers,
    validateForm,
    showErrorAlert,
    updateField,
    taskTypeSheetRef,
    uploadSheetRef,
    handleRemoveFile,
    openSheet,
    openTaskSheet,
  } = hookData;

  // Pre-fill form when reusing a task (only once)
  useEffect(() => {
    if (reuseTask && reuseTaskId && !hasPrefilledRef.current) {
      hasPrefilledRef.current = true;
      prefillFormFromTask(reuseTask, updateField, handleTaskTypeSelect, dispatch);
    }
  }, [reuseTask, reuseTaskId, dispatch, handleTaskTypeSelect, updateField]);

  const handleSave = async () => {
    if (!validateForm(formData, taskTypeSelection)) return;
    if (!selectedCompanionId) {
      showErrorAlert('Error', new Error('Please select a companion'));
      return;
    }

    try {
      let preparedAttachments = formData.attachments;
      if (preparedAttachments.length > 0) {
        preparedAttachments = await dispatch(
          uploadDocumentFiles({files: preparedAttachments as any, companionId: selectedCompanionId}),
        ).unwrap();
      }

      const taskData = buildTaskDraftFromForm({
        formData: {...formData, attachments: preparedAttachments},
        companionId: selectedCompanionId,
        observationToolId: formData.observationalTool,
      });
      console.log('[AddTask] FormData calendar info:', {
        syncWithCalendar: formData.syncWithCalendar,
        calendarProvider: formData.calendarProvider,
        calendarProviderName: formData.calendarProviderName,
      });
      console.log('[AddTask] TaskData payload calendar info:', {
        syncWithCalendar: taskData.syncWithCalendar,
        calendarProvider: taskData.calendarProvider,
      });
      const created = await dispatch(addTask(taskData)).unwrap();
      console.log('[AddTask] Task created:', {
        id: created.id,
        syncWithCalendar: created.syncWithCalendar,
        calendarProvider: created.calendarProvider,
      });

      if (formData.syncWithCalendar) {
        console.log('[AddTask] Attempting to create calendar event');

        // Get companion name
        const companion = companions.find(c => c.id === selectedCompanionId);
        const companionName = companion?.name || 'Companion';

        // Get assigned user name
        const assignedToName = getAssignedUserName(formData.assignedTo, currentUser, coParents);

        // WORKAROUND: Backend doesn't return calendarProvider, so use formData value
        const taskWithCalendar = {
          ...created,
          calendarProvider: formData.calendarProvider || undefined,
        };

        const eventId = await createCalendarEventForTask(taskWithCalendar, companionName, assignedToName);
        console.log('[AddTask] Calendar event result:', eventId);
        if (eventId) {
          dispatch(setTaskCalendarEventId({taskId: created.id, eventId}));
          // persist event id to backend
          await dispatch(updateTask({taskId: created.id, updates: {calendarEventId: eventId}}));
          console.log('[AddTask] Calendar event ID persisted to backend');
        } else {
          console.warn('[AddTask] Calendar event creation failed - no eventId returned');
        }
      }

      navigation.goBack();
    } catch (error) {
      showErrorAlert('Unable to add task', error);
    }
  };

  return (
    <>
      <LiquidGlassHeaderScreen
        header={<Header title={reuseTaskId ? "Reuse task" : "Add task"} showBackButton onBack={handleBack} glass={false} />}
        contentPadding={theme.spacing['4']}
        showBottomFade={false}>
        {contentPaddingStyle => {
          const resolvedContentPadding =
            contentPaddingStyle ?? {paddingTop: theme.spacing['12']};

          return (
            <ScrollView
              style={styles.container}
              contentContainerStyle={[styles.contentContainer, resolvedContentPadding]}
              showsVerticalScrollIndicator={false}>
              <CompanionSelector
                companions={companions}
                selectedCompanionId={selectedCompanionId}
                onSelect={handleCompanionSelect}
                showAddButton={false}
                containerStyle={styles.companionSelector}
                requiredPermission="tasks"
                permissionLabel="tasks"
              />

              <TaskFormContent
                formData={formData}
                errors={errors}
                theme={theme}
                updateField={updateField}
                isMedicationForm={isMedicationForm}
                isObservationalToolForm={isObservationalToolForm}
                isSimpleForm={isSimpleForm}
                reminderOptions={REMINDER_OPTIONS}
                styles={styles}
                taskTypeSelection={taskTypeSelection}
                showTaskTypeSelector
                taskTypeSelectorProps={{
                  onPress: () => {
                    openTaskSheet('task-type');
                    taskTypeSheetRef.current?.open();
                  },
                  value: taskTypeSelection
                    ? buildTaskTypeBreadcrumb(
                        taskTypeSelection.category,
                        taskTypeSelection.subcategory,
                        taskTypeSelection.parasitePreventionType,
                        taskTypeSelection.chronicConditionType,
                        taskTypeSelection.taskType,
                      )
                    : undefined,
                  error: errors.category,
                }}
                sheetHandlers={sheetHandlers}
                fileHandlers={createFileHandlers(openSheet, uploadSheetRef, handleRemoveFile)}
                fileError={errors.attachments}
              />
            </ScrollView>
          );
        }}
      </LiquidGlassHeaderScreen>

      <TaskFormFooter
        loading={loading}
        disabled={loading || !taskTypeSelection}
        onSave={handleSave}
        styles={styles}
        theme={theme}
      />

      {/* Date Pickers & Bottom Sheets */}
      <TaskFormSheets
        {...getTaskFormSheetProps(hookData)}
        formData={formData}
        updateField={updateField}
        companionType={companionType}
        uploadSheetRef={uploadSheetRef}
        taskTypeSheetRef={taskTypeSheetRef}
        onDiscard={() => navigation.goBack()}
        taskTypeSheetProps={{
          selectedTaskType: taskTypeSelection,
          onSelect: handleTaskTypeSelect,
        }}
      />
    </>
  );
};


export default AddTaskScreen;
