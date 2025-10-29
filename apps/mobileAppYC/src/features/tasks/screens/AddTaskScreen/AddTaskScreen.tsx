import React, {useMemo} from 'react';
import {ScrollView} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useDispatch} from 'react-redux';
import {SafeArea} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {CompanionSelector} from '@/shared/components/common/CompanionSelector/CompanionSelector';
import {useTheme} from '@/hooks';
import {addTask} from '@/features/tasks';
import type {AppDispatch} from '@/app/store';
import type {TaskStackParamList} from '@/navigation/types';
import {buildTaskTypeBreadcrumb} from '@/features/tasks/utils/taskLabels';
import {useAddTaskScreen} from '@/features/tasks/hooks/useAddTaskScreen';
import {buildTaskFromForm} from './taskBuilder';
import {TaskFormContent, TaskFormFooter, TaskFormSheets} from '@/features/tasks/components/form';
import {createTaskFormStyles} from '@/features/tasks/screens/styles';
import {REMINDER_OPTIONS} from '@/features/tasks/constants';
import {createFileHandlers} from '@/features/tasks/utils/createFileHandlers';
import {getTaskFormSheetProps} from '@/features/tasks/utils/getTaskFormSheetProps';

type Navigation = NativeStackNavigationProp<TaskStackParamList, 'AddTask'>;

export const AddTaskScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const dispatch = useDispatch<AppDispatch>();
  const {theme} = useTheme();
  const styles = useMemo(() => createTaskFormStyles(theme), [theme]);

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
  } = hookData;

  const handleSave = async () => {
    if (!validateForm(formData, taskTypeSelection)) return;
    if (!selectedCompanionId) {
      showErrorAlert('Error', new Error('Please select a companion'));
      return;
    }

    try {
      const taskData = buildTaskFromForm(formData, selectedCompanionId);
      await dispatch(addTask(taskData)).unwrap();
      navigation.goBack();
    } catch (error) {
      showErrorAlert('Unable to add task', error);
    }
  };

  return (
    <SafeArea>
      <Header title="Add task" showBackButton onBack={handleBack} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}>
        <CompanionSelector
          companions={companions}
          selectedCompanionId={selectedCompanionId}
          onSelect={handleCompanionSelect}
          showAddButton={false}
          containerStyle={styles.companionSelector}
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
            onPress: () => taskTypeSheetRef.current?.open(),
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
        openSheet={openSheet}
        uploadSheetRef={uploadSheetRef}
        taskTypeSheetRef={taskTypeSheetRef}
        onDiscard={() => navigation.goBack()}
        taskTypeSheetProps={{
          selectedTaskType: taskTypeSelection,
          onSelect: handleTaskTypeSelect,
        }}
      />
    </SafeArea>
  );
};


export default AddTaskScreen;
