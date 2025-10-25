import React, {useMemo, useEffect} from 'react';
import {ScrollView, View, Text, Switch, Image, Alert} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useDispatch, useSelector} from 'react-redux';
import {SafeArea, TouchableInput} from '@/components/common';
import {Header} from '@/components/common/Header/Header';
import {CompanionSelector} from '@/components/common/CompanionSelector/CompanionSelector';
import LiquidGlassButton from '@/components/common/LiquidGlassButton/LiquidGlassButton';
import {DocumentAttachmentsSection} from '@/components/documents/DocumentAttachmentsSection';
import {UploadDocumentBottomSheet} from '@/components/common/UploadDocumentBottomSheet/UploadDocumentBottomSheet';
import {DeleteDocumentBottomSheet} from '@/components/common/DeleteDocumentBottomSheet/DeleteDocumentBottomSheet';
import {DiscardChangesBottomSheet} from '@/components/common/DiscardChangesBottomSheet/DiscardChangesBottomSheet';
import {
  TaskTypeBottomSheet,
  MedicationTypeBottomSheet,
  DosageBottomSheet,
  MedicationFrequencyBottomSheet,
  TaskFrequencyBottomSheet,
  AssignTaskBottomSheet,
  CalendarSyncBottomSheet,
  ObservationalToolBottomSheet,
} from '@/components/tasks';
import {useTheme, useFormBottomSheets, useFileOperations, useTaskFormState, useTaskFormSheets} from '@/hooks';
import {Images} from '@/assets/images';
import {addTask} from '@/features/tasks';
import {setSelectedCompanion} from '@/features/companion';
import type {AppDispatch, RootState} from '@/app/store';
import type {TaskStackParamList} from '@/navigation/types';
import type {
  TaskTypeSelection,
  ReminderOption,
} from '@/features/tasks/types';
import {buildTaskTypeBreadcrumb} from '@/utils/taskLabels';
import {
  getUpdatedFormDataFromTaskType,
  getErrorFieldsToClear,
  isMedicationForm as checkIsMedicationForm,
  isObservationalToolForm as checkIsObservationalToolForm,
  isSimpleForm as checkIsSimpleForm,
} from '@/utils/taskFormHelpers';
import {validateTaskForm} from './validation';
import {buildTaskFromForm} from './taskBuilder';
import {
  MedicationFormSection,
  ObservationalToolFormSection,
  SimpleTaskFormSection,
  ReminderSection,
  CalendarSyncSection,
  CommonTaskFields,
} from './components';
import {TaskDatePickers} from '@/screens/tasks/components/TaskDatePickers';
import {createTaskFormStyles} from '@/screens/tasks/styles';

type Navigation = NativeStackNavigationProp<TaskStackParamList, 'AddTask'>;

const REMINDER_OPTIONS: ReminderOption[] = [
  '5-mins-prior',
  '30-mins-prior',
  '1-hour-prior',
  '12-hours-prior',
  '1-day-prior',
  '3-days-prior',
];

export const AddTaskScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const dispatch = useDispatch<AppDispatch>();
  const {theme} = useTheme();
  const styles = useMemo(() => createTaskFormStyles(theme), [theme]);

  const companions = useSelector((state: RootState) => state.companion.companions);
  const selectedCompanionId = useSelector(
    (state: RootState) => state.companion.selectedCompanionId,
  );
  const loading = useSelector((state: RootState) => state.tasks.loading);

  const {
    formData,
    errors,
    hasUnsavedChanges,
    showDatePicker,
    setShowDatePicker,
    showTimePicker,
    setShowTimePicker,
    showStartDatePicker,
    setShowStartDatePicker,
    showEndDatePicker,
    setShowEndDatePicker,
    updateField,
    clearError,
    setErrors,
    setHasUnsavedChanges,
  } = useTaskFormState();

  const [taskTypeSelection, setTaskTypeSelection] = React.useState<TaskTypeSelection | null>(null);

  const {refs, openSheet, closeSheet} = useFormBottomSheets();
  const {
    uploadSheetRef,
    deleteSheetRef,
  } = refs;

  const {
    taskTypeSheetRef,
    medicationTypeSheetRef,
    dosageSheetRef,
    medicationFrequencySheetRef,
    taskFrequencySheetRef,
    assignTaskSheetRef,
    calendarSyncSheetRef,
    observationalToolSheetRef,
    discardSheetRef,
  } = useTaskFormSheets();

  const {
    fileToDelete,
    handleTakePhoto,
    handleChooseFromGallery,
    handleUploadFromDrive,
    handleRemoveFile,
    confirmDeleteFile,
  } = useFileOperations({
    files: formData.attachments as any,
    setFiles: files => updateField('attachments', files),
    clearError: () => clearError('attachments'),
    openSheet,
    closeSheet,
    deleteSheetRef,
  });

  useEffect(() => {
    if (!selectedCompanionId && companions.length > 0) {
      dispatch(setSelectedCompanion(companions[0].id));
    }
  }, [companions, selectedCompanionId, dispatch]);

  const handleTaskTypeSelect = (selection: TaskTypeSelection) => {
    // Get updated form data using helper
    const updatedFormData = getUpdatedFormDataFromTaskType(selection, formData);

    // Apply all updates at once
    for (const [key, value] of Object.entries(updatedFormData)) {
      updateField(key as keyof typeof formData, value);
    }
    setTaskTypeSelection(selection);
    setHasUnsavedChanges(true);

    // Clear relevant errors
    const fieldsToClear = getErrorFieldsToClear(selection);
    for (const field of fieldsToClear) {
      clearError(field);
    }
  };

  const handleCompanionSelect = (companionId: string | null) => {
    if (companionId) {
      dispatch(setSelectedCompanion(companionId));
    }
  };

  const validateForm = (): boolean => {
    const newErrors = validateTaskForm(formData, taskTypeSelection);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    if (!selectedCompanionId) {
      Alert.alert('Error', 'Please select a companion');
      return;
    }

    try {
      const taskData = buildTaskFromForm(formData, selectedCompanionId);
      const result = await dispatch(addTask(taskData)).unwrap();

      if (result) {
        Alert.alert('Success', 'Task added successfully', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      }
    } catch (error) {
      Alert.alert(
        'Unable to add task',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };

  const handleBack = () => {
    if (hasUnsavedChanges) {
      discardSheetRef.current?.open();
    } else {
      navigation.goBack();
    }
  };

  const isMedicationForm = checkIsMedicationForm(formData.healthTaskType);
  const isObservationalToolForm = checkIsObservationalToolForm(formData.healthTaskType);
  const isSimpleForm = checkIsSimpleForm(formData.healthTaskType);

  const selectedCompanion = companions.find(c => c.id === selectedCompanionId);
  const companionType = selectedCompanion?.category || 'dog';

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

        <View style={styles.fieldGroup}>
          <TouchableInput
            label={taskTypeSelection ? 'Task type' : undefined}
            placeholder='Task Type'
            value={
              taskTypeSelection
                ? buildTaskTypeBreadcrumb(
                    taskTypeSelection.category,
                    taskTypeSelection.subcategory,
                    taskTypeSelection.parasitePreventionType,
                    taskTypeSelection.chronicConditionType,
                    taskTypeSelection.taskType,
                  )
                : undefined
            }
            onPress={() => taskTypeSheetRef.current?.open()}
            rightComponent={<Image source={Images.dropdownIcon} style={styles.dropdownIcon} />}
            error={errors.category}
          />
        </View>

        {taskTypeSelection && (
          <>
            {/* Medication Task Form */}
            {isMedicationForm && (
              <MedicationFormSection
                formData={formData}
                errors={errors}
                updateField={updateField}
                onOpenMedicationTypeSheet={() => medicationTypeSheetRef.current?.open()}
                onOpenDosageSheet={() => dosageSheetRef.current?.open()}
                onOpenMedicationFrequencySheet={() => medicationFrequencySheetRef.current?.open()}
                onOpenStartDatePicker={() => setShowStartDatePicker(true)}
                onOpenEndDatePicker={() => setShowEndDatePicker(true)}
                theme={theme}
              />
            )}

            {/* Observational Tool Task Form */}
            {isObservationalToolForm && (
              <ObservationalToolFormSection
                formData={formData}
                errors={errors}
                updateField={updateField}
                onOpenObservationalToolSheet={() => observationalToolSheetRef.current?.open()}
                onOpenDatePicker={() => setShowDatePicker(true)}
                onOpenTimePicker={() => setShowTimePicker(true)}
                onOpenTaskFrequencySheet={() => taskFrequencySheetRef.current?.open()}
                theme={theme}
              />
            )}

            {/* Custom & Hygiene & Dietary Task Form */}
            {isSimpleForm && (
              <SimpleTaskFormSection
                formData={formData}
                errors={errors}
                taskTypeSelection={taskTypeSelection}
                updateField={updateField}
                onOpenDatePicker={() => setShowDatePicker(true)}
                onOpenTimePicker={() => setShowTimePicker(true)}
                onOpenTaskFrequencySheet={() => taskFrequencySheetRef.current?.open()}
                theme={theme}
              />
            )}

            {/* Common Assign Task Field */}
            <CommonTaskFields
              formData={formData}
              errors={errors}
              updateField={updateField}
              onOpenAssignTaskSheet={() => assignTaskSheetRef.current?.open()}
              theme={theme}
            />

            {/* Reminder Section */}
            <ReminderSection
              formData={formData}
              updateField={updateField}
              reminderOptions={REMINDER_OPTIONS}
              theme={theme}
            />

            {/* Calendar Sync */}
            <CalendarSyncSection
              formData={formData}
              updateField={updateField}
              onOpenCalendarSyncSheet={() => calendarSyncSheetRef.current?.open()}
              theme={theme}
            />

            {/* Attach Documents */}
            <View style={styles.toggleSection}>
              <Text style={styles.toggleLabel}>Attach document</Text>
              <Switch
                value={formData.attachDocuments}
                onValueChange={value => updateField('attachDocuments', value)}
                trackColor={{false: theme.colors.borderMuted, true: theme.colors.primary}}
                thumbColor={theme.colors.white}
              />
            </View>

            {formData.attachDocuments && (
              <View style={styles.fieldGroup}>
                <DocumentAttachmentsSection
                  files={formData.attachments as any}
                  onAddPress={() => {
                    openSheet('upload');
                    uploadSheetRef.current?.open();
                  }}
                  onRequestRemove={file => handleRemoveFile(file.id)}
                  error={errors.attachments}
                  emptyTitle="Upload documents"
                  emptySubtitle="Only DOC, PDF, PNG, JPEG formats with max size 5 MB"
                />
              </View>
            )}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <LiquidGlassButton
          title={loading ? 'Saving...' : 'Save'}
          onPress={handleSave}
          loading={loading}
          disabled={loading || !taskTypeSelection}
          style={styles.saveButton}
          textStyle={styles.saveButtonText}
          tintColor={theme.colors.secondary}
          forceBorder
          borderColor={theme.colors.borderMuted}
          shadowIntensity="medium"
          height={56}
          borderRadius={16}
        />
      </View>

      {/* Date & Time Pickers */}
      <TaskDatePickers
        showDatePicker={showDatePicker}
        setShowDatePicker={setShowDatePicker}
        showTimePicker={showTimePicker}
        setShowTimePicker={setShowTimePicker}
        showStartDatePicker={showStartDatePicker}
        setShowStartDatePicker={setShowStartDatePicker}
        showEndDatePicker={showEndDatePicker}
        setShowEndDatePicker={setShowEndDatePicker}
        formData={formData}
        updateField={updateField}
      />

      {/* Bottom Sheets */}
      <TaskTypeBottomSheet
        ref={taskTypeSheetRef}
        selectedTaskType={taskTypeSelection}
        onSelect={handleTaskTypeSelect}
        companionType={companionType as any}
      />

      <MedicationTypeBottomSheet
        ref={medicationTypeSheetRef}
        selectedType={formData.medicineType}
        onSelect={type => updateField('medicineType', type)}
      />

      <DosageBottomSheet
        ref={dosageSheetRef}
        dosages={formData.dosages}
        onSave={dosages => updateField('dosages', dosages)}
      />

      <MedicationFrequencyBottomSheet
        ref={medicationFrequencySheetRef}
        selectedFrequency={formData.medicationFrequency}
        onSelect={frequency => updateField('medicationFrequency', frequency)}
      />

      <TaskFrequencyBottomSheet
        ref={taskFrequencySheetRef}
        selectedFrequency={formData.frequency}
        onSelect={frequency => updateField('frequency', frequency)}
      />

      <AssignTaskBottomSheet
        ref={assignTaskSheetRef}
        selectedUserId={formData.assignedTo}
        onSelect={userId => updateField('assignedTo', userId)}
      />

      <CalendarSyncBottomSheet
        ref={calendarSyncSheetRef}
        selectedProvider={formData.calendarProvider}
        onSelect={provider => updateField('calendarProvider', provider)}
      />

      <ObservationalToolBottomSheet
        ref={observationalToolSheetRef}
        selectedTool={formData.observationalTool}
        onSelect={tool => updateField('observationalTool', tool)}
        companionType={companionType as any}
      />

      <UploadDocumentBottomSheet
        ref={uploadSheetRef}
        onTakePhoto={() => {
          handleTakePhoto();
          closeSheet();
        }}
        onChooseGallery={() => {
          handleChooseFromGallery();
          closeSheet();
        }}
        onUploadDrive={() => {
          handleUploadFromDrive();
          closeSheet();
        }}
      />

      <DeleteDocumentBottomSheet
        ref={deleteSheetRef}
        documentTitle={
          fileToDelete
            ? formData.attachments.find(f => f.id === fileToDelete)?.name
            : 'this file'
        }
        onDelete={confirmDeleteFile}
      />

      <DiscardChangesBottomSheet
        ref={discardSheetRef}
        onDiscard={() => navigation.goBack()}
      />
    </SafeArea>
  );
};


export default AddTaskScreen;
