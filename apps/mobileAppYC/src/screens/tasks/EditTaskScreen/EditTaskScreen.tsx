import React, {useMemo} from 'react';
import {ScrollView, View, Text} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {useDispatch} from 'react-redux';
import {SafeArea, Input} from '@/components/common';
import {Header} from '@/components/common/Header/Header';
import {DeleteDocumentBottomSheet} from '@/components/common/DeleteDocumentBottomSheet/DeleteDocumentBottomSheet';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {updateTask, deleteTask} from '@/features/tasks';
import type {AppDispatch} from '@/app/store';
import type {TaskStackParamList} from '@/navigation/types';
import {resolveCategoryLabel} from '@/utils/taskLabels';
import {buildTaskFromForm} from './taskBuilder';
import {TaskFormContent, TaskFormFooter, TaskFormSheets} from '@/screens/tasks/components';
import {createTaskFormStyles} from '@/screens/tasks/styles';
import {REMINDER_OPTIONS} from '@/screens/tasks/constants';
import {useEditTaskScreen} from '@/screens/tasks/hooks/useEditTaskScreen';
import {createFileHandlers} from '@/screens/tasks/utils/createFileHandlers';
import {getTaskFormSheetProps} from '@/screens/tasks/utils/getTaskFormSheetProps';

type Navigation = NativeStackNavigationProp<TaskStackParamList, 'EditTask'>;
type Route = RouteProp<TaskStackParamList, 'EditTask'>;

export const EditTaskScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const dispatch = useDispatch<AppDispatch>();
  const {theme} = useTheme();
  const styles = useMemo(() => createTaskFormStyles(theme), [theme]);

  const {taskId} = route.params;

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
    handleBack,
    handleDelete,
    sheetHandlers,
    validateForm,
    showErrorAlert,
    updateField,
    uploadSheetRef,
    handleRemoveFile,
    openSheet,
  } = hookData;

  const handleSave = async () => {
    if (!validateForm(formData)) return;
    if (!task) return;

    try {
      const taskData = buildTaskFromForm(formData, task.companionId);
      await dispatch(updateTask({taskId: task.id, updates: taskData})).unwrap();
      navigation.goBack();
    } catch (error) {
      showErrorAlert('Unable to update task', error);
    }
  };

  const confirmDeleteTask = async () => {
    if (!task) return;
    try {
      await dispatch(deleteTask({taskId: task.id, companionId: task.companionId})).unwrap();
      navigation.goBack();
    } catch (error) {
      showErrorAlert('Unable to delete task', error);
    }
  };

  if (!task) {
    return (
      <SafeArea>
        <Header title="Edit task" showBackButton onBack={() => navigation.goBack()} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Task not found</Text>
        </View>
      </SafeArea>
    );
  }

  return (
    <SafeArea>
      <Header title="Edit task" showBackButton onBack={handleBack} rightIcon={Images.deleteIconRed} onRightPress={handleDelete} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
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
        openSheet={openSheet}
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
    </SafeArea>
  );
};


export default EditTaskScreen;
