import React, {useState, useRef, useMemo, useEffect} from 'react';
import {ScrollView, StyleSheet, View, Text, Switch, Alert} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {useDispatch, useSelector} from 'react-redux';
import {SafeArea, Input} from '@/components/common';
import {Header} from '@/components/common/Header/Header';
import LiquidGlassButton from '@/components/common/LiquidGlassButton/LiquidGlassButton';
import {SimpleDatePicker} from '@/components/common/SimpleDatePicker/SimpleDatePicker';
import {DocumentAttachmentsSection} from '@/components/documents/DocumentAttachmentsSection';
import {UploadDocumentBottomSheet} from '@/components/common/UploadDocumentBottomSheet/UploadDocumentBottomSheet';
import {DeleteDocumentBottomSheet} from '@/components/common/DeleteDocumentBottomSheet/DeleteDocumentBottomSheet';
import {DiscardChangesBottomSheet} from '@/components/common/DiscardChangesBottomSheet/DiscardChangesBottomSheet';
import {
  MedicationTypeBottomSheet,
  DosageBottomSheet,
  MedicationFrequencyBottomSheet,
  TaskFrequencyBottomSheet,
  AssignTaskBottomSheet,
  CalendarSyncBottomSheet,
  ObservationalToolBottomSheet,
} from '@/components/tasks';
import {useTheme, useFormBottomSheets, useFileOperations} from '@/hooks';
import {Images} from '@/assets/images';
import {updateTask, deleteTask} from '@/features/tasks';
import {selectTaskById} from '@/features/tasks/selectors';
import type {AppDispatch, RootState} from '@/app/store';
import type {TaskStackParamList} from '@/navigation/types';
import type {
  TaskFormData,
  TaskFormErrors,
  ReminderOption,
} from '@/features/tasks/types';
import {resolveCategoryLabel} from '@/utils/taskLabels';
import {initializeFormDataFromTask} from './initialization';
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

type Navigation = NativeStackNavigationProp<TaskStackParamList, 'EditTask'>;
type Route = RouteProp<TaskStackParamList, 'EditTask'>;

const REMINDER_OPTIONS: ReminderOption[] = [
  '5-mins-prior',
  '30-mins-prior',
  '1-hour-prior',
  '12-hours-prior',
  '1-day-prior',
  '3-days-prior',
];

export const EditTaskScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const dispatch = useDispatch<AppDispatch>();
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {taskId} = route.params;
  const task = useSelector((state: RootState) => selectTaskById(taskId)(state));
  const loading = useSelector((state: RootState) => state.tasks.loading);
  const companions = useSelector((state: RootState) => state.companion.companions);

  const [formData, setFormData] = useState<TaskFormData>({
    category: null,
    subcategory: null,
    parasitePreventionType: null,
    chronicConditionType: null,
    healthTaskType: null,
    hygieneTaskType: null,
    dietaryTaskType: null,
    title: '',
    date: new Date(),
    time: null,
    frequency: null,
    assignedTo: null,
    reminderEnabled: false,
    reminderOptions: null,
    syncWithCalendar: false,
    calendarProvider: null,
    attachDocuments: false,
    attachments: [],
    additionalNote: '',
    medicineName: '',
    medicineType: null,
    dosages: [],
    medicationFrequency: null,
    startDate: new Date(),
    endDate: null,
    observationalTool: null,
    description: '',
  });

  const [errors, setErrors] = useState<TaskFormErrors>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  const {refs, openSheet, closeSheet} = useFormBottomSheets();
  const {uploadSheetRef} = refs;

  const medicationTypeSheetRef = useRef<any>(null);
  const dosageSheetRef = useRef<any>(null);
  const medicationFrequencySheetRef = useRef<any>(null);
  const taskFrequencySheetRef = useRef<any>(null);
  const assignTaskSheetRef = useRef<any>(null);
  const calendarSyncSheetRef = useRef<any>(null);
  const observationalToolSheetRef = useRef<any>(null);
  const discardSheetRef = useRef<any>(null);
  const deleteSheetRef = useRef<any>(null);

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
    deleteSheetRef: deleteSheetRef,
  });

  // Initialize form with task data
  useEffect(() => {
    if (task) {
      const initialFormData = initializeFormDataFromTask(task);
      setFormData(initialFormData);
    }
  }, [task]);

  const updateField = <K extends keyof TaskFormData>(
    field: K,
    value: TaskFormData[K],
  ) => {
    setFormData(prev => ({...prev, [field]: value}));
    setHasUnsavedChanges(true);
    clearError(field as keyof TaskFormErrors);
  };

  const clearError = (field: keyof TaskFormErrors) => {
    setErrors(prev => {
      const newErrors = {...prev};
      delete newErrors[field];
      return newErrors;
    });
  };

  const validateForm = (): boolean => {
    const newErrors = validateTaskForm(formData);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    if (!task) return;

    try {
      const taskData = buildTaskFromForm(formData, task.companionId);
      const result = await dispatch(updateTask({taskId: task.id, updates: taskData})).unwrap();

      if (result) {
        Alert.alert('Success', 'Task updated successfully', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      }
    } catch (error) {
      Alert.alert(
        'Unable to update task',
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

  const handleDelete = () => {
    deleteSheetRef.current?.open();
  };

  const confirmDeleteTask = async () => {
    if (!task) return;
    try {
      await dispatch(deleteTask({taskId: task.id, companionId: task.companionId})).unwrap();
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        'Unable to delete task',
        error instanceof Error ? error.message : 'Please try again.',
      );
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

  const isMedicationForm = formData.healthTaskType === 'give-medication';
  const isObservationalToolForm = formData.healthTaskType === 'take-observational-tool';
  const isSimpleForm = !isMedicationForm && !isObservationalToolForm;

  const companion = companions?.find(c => c.id === task.companionId);
  const companionType = companion?.category || 'dog';

  return (
    <SafeArea>
      <Header title="Edit task" showBackButton onBack={handleBack} rightIcon={Images.deleteIconRed} onRightPress={handleDelete} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.contentContainer, {paddingTop: theme.spacing[6]}]}
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
            updateField={updateField}
            onOpenDatePicker={() => setShowDatePicker(true)}
            onOpenTimePicker={() => setShowTimePicker(true)}
            onOpenTaskFrequencySheet={() => taskFrequencySheetRef.current?.open()}
            theme={theme}
          />
        )}

        {/* Common Task Fields */}
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
      </ScrollView>

      <View style={styles.footer}>
        <LiquidGlassButton
          title={loading ? 'Saving...' : 'Save'}
          onPress={handleSave}
          loading={loading}
          disabled={loading}
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
      <SimpleDatePicker
        show={showDatePicker}
        value={formData.date}
        mode="date"
        minimumDate={new Date()}
        onDateChange={(selectedDate) => {
          updateField('date', selectedDate);
        }}
        onDismiss={() => setShowDatePicker(false)}
      />

      <SimpleDatePicker
        show={showStartDatePicker}
        value={formData.startDate}
        mode="date"
        minimumDate={new Date()}
        onDateChange={(selectedDate) => {
          updateField('startDate', selectedDate);
        }}
        onDismiss={() => setShowStartDatePicker(false)}
      />

      <SimpleDatePicker
        show={showEndDatePicker}
        value={formData.endDate}
        mode="date"
        minimumDate={new Date()}
        onDateChange={(selectedDate) => {
          updateField('endDate', selectedDate);
        }}
        onDismiss={() => setShowEndDatePicker(false)}
      />

      <SimpleDatePicker
        show={showTimePicker}
        value={formData.time}
        mode="time"
        onDateChange={(selectedTime) => {
          updateField('time', selectedTime);
        }}
        onDismiss={() => setShowTimePicker(false)}
      />

      {/* Bottom Sheets */}
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

      <DeleteDocumentBottomSheet
        ref={deleteSheetRef}
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

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      paddingHorizontal: theme.spacing[4],
      paddingTop: theme.spacing[4],
      paddingBottom: theme.spacing[24],
    },
    fieldGroup: {
      marginBottom: theme.spacing[6],
    },
    toggleSection: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing[4],
      marginBottom: theme.spacing[2],
    },
    toggleLabel: {
      ...theme.typography.bodyMedium,
      color: theme.colors.secondary,
      fontWeight: '500',
    },
    footer: {
      paddingHorizontal: theme.spacing[4],
      paddingBottom: theme.spacing[6],
      paddingTop: theme.spacing[2],
      backgroundColor: theme.colors.background,
    },
    saveButton: {
      width: '100%',
      marginTop: theme.spacing[4],
    },
    saveButtonText: {
      ...theme.typography.paragraphBold,
      color: theme.colors.white,
    },
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing[4],
    },
    errorText: {
      ...theme.typography.bodyMedium,
      color: theme.colors.error,
    },
  });

export default EditTaskScreen;
