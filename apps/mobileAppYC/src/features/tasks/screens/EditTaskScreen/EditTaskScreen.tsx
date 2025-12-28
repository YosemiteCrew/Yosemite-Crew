import React, {useMemo} from 'react';
import {ScrollView, View, Text} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {useDispatch, useSelector} from 'react-redux';
import {Input} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {DeleteDocumentBottomSheet} from '@/shared/components/common/DeleteDocumentBottomSheet/DeleteDocumentBottomSheet';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {updateTask, deleteTask, setTaskCalendarEventId} from '@/features/tasks';
import type {AppDispatch} from '@/app/store';
import type {TaskStackParamList} from '@/navigation/types';
import {resolveCategoryLabel} from '@/features/tasks/utils/taskLabels';
import {selectAuthUser} from '@/features/auth/selectors';
import {selectAcceptedCoParents} from '@/features/coParent/selectors';
import {TaskFormContent, TaskFormFooter, TaskFormSheets} from '@/features/tasks/components/form';
import {createTaskFormStyles} from '@/features/tasks/screens/styles';
import {REMINDER_OPTIONS} from '@/features/tasks/constants';
import {useEditTaskScreen} from '@/features/tasks/hooks/useEditTaskScreen';
import {createFileHandlers} from '@/features/tasks/utils/createFileHandlers';
import {getTaskFormSheetProps} from '@/features/tasks/utils/getTaskFormSheetProps';
import {buildTaskDraftFromForm} from '@/features/tasks/services/taskService';
import {uploadDocumentFiles} from '@/features/documents/documentSlice';
import {createCalendarEventForTask, removeCalendarEvents} from '@/features/tasks/services/calendarSyncService';

type Navigation = NativeStackNavigationProp<TaskStackParamList, 'EditTask'>;
type Route = RouteProp<TaskStackParamList, 'EditTask'>;

export const EditTaskScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const dispatch = useDispatch<AppDispatch>();
  const {theme} = useTheme();
  const styles = useMemo(() => createTaskFormStyles(theme), [theme]);

  const {taskId, source = 'tasks'} = route.params;

  const currentUser = useSelector(selectAuthUser);
  const coParents = useSelector(selectAcceptedCoParents);

  const hookData = useEditTaskScreen(taskId, navigation);
  const {
    task,
    loading,
    companionType,
    formData,
    errors,
    isMedicationForm,
    isObservationalToolForm,
    isSimpleForm,
    handleDelete,
    sheetHandlers,
    validateForm,
    showErrorAlert,
    updateField,
    uploadSheetRef,
    handleRemoveFile,
    openSheet,
    companions,
  } = hookData;

  // Helper to get assigned user name
  const getAssignedUserName = (userId: string | null | undefined): string | undefined => {
    if (!userId) return undefined;

    // Check current user
    const currentUserId = currentUser?.parentId ?? currentUser?.id;
    if (userId === currentUserId) {
      return currentUser?.firstName || currentUser?.email || 'You';
    }

    // Check co-parents
    const coParent = coParents.find(cp => {
      const cpId = cp.parentId || cp.id || cp.userId;
      return cpId === userId;
    });

    if (coParent) {
      return [coParent.firstName, coParent.lastName].filter(Boolean).join(' ').trim() ||
        coParent.email ||
        'Co-parent';
    }

    return undefined;
  };

  // Smart back handler that navigates back without resetting the stack
  const handleSmartBack = React.useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else if (source === 'home') {
      navigation.navigate('HomeStack' as any);
    } else {
      navigation.navigate('TasksMain' as any);
    }
  }, [navigation, source]);

  const handleSave = async () => {
    if (!validateForm(formData)) return;
    if (!task) return;

    try {
      let preparedAttachments = formData.attachments;
      if (preparedAttachments.length > 0) {
        preparedAttachments = await dispatch(
          uploadDocumentFiles({files: preparedAttachments as any, companionId: task.companionId}),
        ).unwrap();
      }

      const taskData = buildTaskDraftFromForm({
        formData: {...formData, attachments: preparedAttachments},
        companionId: task.companionId,
        observationToolId: task.observationToolId ?? formData.observationalTool,
      });
      const updated = await dispatch(updateTask({taskId: task.id, updates: taskData})).unwrap();

      if (formData.syncWithCalendar) {
        // Remove old calendar events before creating new ones to avoid duplicates
        if (task.calendarEventId) {
          console.log('[EditTask] Removing old calendar events:', task.calendarEventId);
          await removeCalendarEvents(task.calendarEventId);
        }

        // Get companion name
        const companion = companions.find(c => c.id === task.companionId);
        const companionName = companion?.name || 'Companion';

        // Get assigned user name
        const assignedToName = getAssignedUserName(formData.assignedTo);

        // WORKAROUND: Backend doesn't return calendarProvider, so use formData value
        const taskWithCalendar = {
          ...updated,
          calendarProvider: formData.calendarProvider || undefined,
        };

        console.log('[EditTask] Creating new calendar events');
        const eventId = await createCalendarEventForTask(taskWithCalendar, companionName, assignedToName);
        if (eventId) {
          dispatch(setTaskCalendarEventId({taskId: updated.id, eventId}));
          dispatch(updateTask({taskId: updated.id, updates: {calendarEventId: eventId}}));
        }
      } else if (task.calendarEventId) {
        // Calendar sync was disabled - remove existing calendar events
        console.log('[EditTask] Calendar sync disabled, removing events:', task.calendarEventId);
        await removeCalendarEvents(task.calendarEventId);
        dispatch(setTaskCalendarEventId({taskId: updated.id, eventId: null}));
      }

      handleSmartBack();
    } catch (error) {
      showErrorAlert('Unable to update task', error);
    }
  };

  const confirmDeleteTask = async () => {
    if (!task) return;
    try {
      // Remove calendar events if they exist
      if (task.calendarEventId) {
        console.log('[EditTask] Deleting task, removing calendar events:', task.calendarEventId);
        await removeCalendarEvents(task.calendarEventId);
      }

      await dispatch(deleteTask({taskId: task.id, companionId: task.companionId})).unwrap();
      handleSmartBack();
    } catch (error) {
      showErrorAlert('Unable to delete task', error);
    }
  };

  if (!task) {
    return (
      <LiquidGlassHeaderScreen
        header={<Header title="Edit task" showBackButton onBack={() => navigation.goBack()} glass={false} />}
        contentPadding={theme.spacing['3']}>
        {() => (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Task not found</Text>
          </View>
        )}
      </LiquidGlassHeaderScreen>
    );
  }

  return (
    <>
      <LiquidGlassHeaderScreen
        header={
          <Header
            title="Edit task"
            showBackButton
            onBack={handleSmartBack}
            rightIcon={Images.deleteIconRed}
            onRightPress={handleDelete}
            glass={false}
          />
        }
        contentPadding={theme.spacing['4']}>
        {contentPaddingStyle => (
          <ScrollView
            style={styles.container}
            contentContainerStyle={[
              styles.contentContainer,
              {
                ...(contentPaddingStyle || {}),
                paddingTop: (contentPaddingStyle?.paddingTop ?? theme.spacing['14']) + theme.spacing['4'],
              },
              {paddingBottom: theme.spacing['18']},
            ]}
            showsVerticalScrollIndicator={false}>
            {/* Category (LOCKED) */}
            <View style={styles.fieldGroup}>
              <Input
                label="Task type"
                value={resolveCategoryLabel(formData.category!)}
                onChangeText={() => {}}
                editable={false}
              />
            </View>

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
              sheetHandlers={sheetHandlers}
              fileHandlers={createFileHandlers(openSheet, uploadSheetRef, handleRemoveFile)}
              fileError={errors.attachments}
            />
          </ScrollView>
        )}
      </LiquidGlassHeaderScreen>

      <TaskFormFooter
        loading={loading}
        disabled={loading}
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
    onDiscard={() => navigation.goBack()}
  />

      <DeleteDocumentBottomSheet
        ref={hookData.deleteSheetRef}
        documentTitle={task?.title ?? 'this task'}
        title="Delete task"
        message={
          task
            ? `Are you sure you want to delete the task "${task.title}"?`
            : 'Are you sure you want to delete this task?'
        }
        primaryLabel="Delete"
        secondaryLabel="Cancel"
        onDelete={confirmDeleteTask}
      />
    </>
  );
};


export default EditTaskScreen;
