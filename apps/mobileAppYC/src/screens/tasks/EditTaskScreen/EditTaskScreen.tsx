import React, {useState, useRef, useMemo, useEffect} from 'react';
import {ScrollView, StyleSheet, View, Text, Switch, Image, TouchableOpacity, Alert} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {useDispatch, useSelector} from 'react-redux';
import {SafeArea, Input, TouchableInput} from '@/components/common';
import {Header} from '@/components/common/Header/Header';
import LiquidGlassButton from '@/components/common/LiquidGlassButton/LiquidGlassButton';
import {formatDateForDisplay, SimpleDatePicker} from '@/components/common/SimpleDatePicker/SimpleDatePicker';
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
  Task,
  TaskAttachment,
  MedicationTaskDetails,
  ObservationalToolTaskDetails,
  ReminderOption,
} from '@/features/tasks/types';
import {resolveCategoryLabel} from '@/utils/taskLabels';

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
      const parseDate = (dateStr: string | null | undefined): Date | null => {
        if (!dateStr) return null;
        const [year, month, day] = dateStr.split('-').map(Number);
        if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
        return new Date(year, month - 1, day);
      };

      const parseTime = (timeStr: string | null | undefined): Date | null => {
        if (!timeStr) return null;
        const [hours, minutes, seconds] = timeStr.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) return null;
        const now = new Date();
        now.setHours(hours, minutes, seconds || 0, 0);
        return now;
      };

      const isMedication = task.details && 'taskType' in task.details && task.details.taskType === 'give-medication';
      const isObservationalTool = task.details && 'taskType' in task.details && task.details.taskType === 'take-observational-tool';

      const medicationDetails = isMedication && task.details ? (task.details as MedicationTaskDetails) : null;
      const observationalDetails = isObservationalTool && task.details ? (task.details as ObservationalToolTaskDetails) : null;

      setFormData({
        category: task.category,
        subcategory: task.subcategory as any,
        parasitePreventionType: null,
        chronicConditionType: observationalDetails?.chronicConditionType || null,
        healthTaskType: isMedication || isObservationalTool ? (task.details as any).taskType : null,
        hygieneTaskType: task.category === 'hygiene' ? (task.details as any)?.taskType : null,
        dietaryTaskType: task.category === 'dietary' ? (task.details as any)?.taskType : null,
        title: task.title,
        date: parseDate(task.date) || new Date(),
        time: parseTime(task.time),
        frequency: task.frequency as any,
        assignedTo: task.assignedTo || null,
        reminderEnabled: task.reminderEnabled,
        reminderOptions: task.reminderOptions || null,
        syncWithCalendar: task.syncWithCalendar,
        calendarProvider: task.calendarProvider || null,
        attachDocuments: task.attachDocuments,
        attachments: task.attachments || [],
        additionalNote: task.additionalNote || '',
        medicineName: medicationDetails?.medicineName || '',
        medicineType: medicationDetails?.medicineType || null,
        dosages: medicationDetails?.dosages || [],
        medicationFrequency: medicationDetails?.frequency || null,
        startDate: parseDate(medicationDetails?.startDate || null),
        endDate: parseDate(medicationDetails?.endDate || null),
        observationalTool: observationalDetails?.toolType || null,
        description: (task.details && 'description' in task.details ? task.details.description : '') || '',
      });
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
    const newErrors: TaskFormErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Task name is required';
    }

    if (!formData.assignedTo) {
      newErrors.assignedTo = 'Assigned to is required';
    }

    const isMedication = formData.healthTaskType === 'give-medication';
    const isObservationalTool = formData.healthTaskType === 'take-observational-tool';

    if (isMedication) {
      if (!formData.medicineName.trim()) {
        newErrors.medicineName = 'Medicine name is required';
      }
      if (!formData.medicineType) {
        newErrors.medicineType = 'Medication type is required';
      }
      if (formData.dosages.length === 0) {
        newErrors.dosages = 'At least one dosage is required';
      }
      if (!formData.medicationFrequency) {
        newErrors.medicationFrequency = 'Medication frequency is required';
      }
      if (!formData.startDate) {
        newErrors.startDate = 'Start date is required';
      }
    } else if (isObservationalTool) {
      if (!formData.observationalTool) {
        newErrors.observationalTool = 'Please select an observational tool';
      }
      if (!formData.date) {
        newErrors.date = 'Date is required';
      }
      if (!formData.frequency) {
        newErrors.frequency = 'Task frequency is required';
      }
    } else {
      if (!formData.date) {
        newErrors.date = 'Date is required';
      }
      if (!formData.frequency) {
        newErrors.frequency = 'Task frequency is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const formatDateToISODate = (date: Date | null): string | null => {
    if (!date) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatTimeToISO = (date: Date | null): string | undefined => {
    if (!date) return undefined;
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const buildTaskFromForm = (): Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'completedAt'> => {
    const isMedication = formData.healthTaskType === 'give-medication';
    const isObservationalTool = formData.healthTaskType === 'take-observational-tool';

    let details: any = {};

    if (isMedication) {
      const formattedDosages = formData.dosages.map(dosage => ({
        id: dosage.id,
        label: dosage.label,
        time: formatTimeToISO(new Date(dosage.time)) || '00:00:00',
      }));

      details = {
        taskType: 'give-medication',
        medicineName: formData.medicineName,
        medicineType: formData.medicineType!,
        dosages: formattedDosages,
        frequency: formData.medicationFrequency!,
        startDate: formatDateToISODate(formData.startDate) || new Date().toISOString().split('T')[0],
        endDate: formatDateToISODate(formData.endDate) || undefined,
      };
    } else if (isObservationalTool) {
      details = {
        taskType: 'take-observational-tool',
        toolType: formData.observationalTool!,
        chronicConditionType: formData.chronicConditionType,
      };
    } else if (formData.category === 'hygiene') {
      details = {
        taskType: formData.hygieneTaskType!,
        description: formData.description,
      };
    } else if (formData.category === 'dietary') {
      details = {
        taskType: formData.dietaryTaskType!,
        description: formData.description,
      };
    } else {
      details = {
        description: formData.description,
      };
    }

    const taskDate = formData.date || formData.startDate || new Date();
    const formattedDate = formatDateToISODate(taskDate) || taskDate.toISOString().split('T')[0];
    const formattedTime = formData.time ? formatTimeToISO(formData.time) : undefined;

    return {
      companionId: task!.companionId,
      category: formData.category!,
      subcategory: formData.subcategory || undefined,
      title: formData.title,
      date: formattedDate,
      time: formattedTime,
      frequency: formData.frequency || formData.medicationFrequency || 'once',
      assignedTo: formData.assignedTo || undefined,
      reminderEnabled: formData.reminderEnabled,
      reminderOptions: formData.reminderOptions,
      syncWithCalendar: formData.syncWithCalendar,
      calendarProvider: formData.calendarProvider || undefined,
      attachDocuments: formData.attachDocuments,
      attachments: formData.attachments as TaskAttachment[],
      additionalNote: formData.additionalNote || undefined,
      details,
    };
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    if (!task) return;

    try {
      const taskData = buildTaskFromForm();
      const result = await dispatch(updateTask({taskId: task.id, updates: taskData as any})).unwrap();

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

  const companion = companions && companions.find(c => c.id === task.companionId);
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
          <>
            {/* Task Name (LOCKED) */}
            <View style={styles.fieldGroup}>
              <Input
                label="Task name"
                value={formData.title}
                onChangeText={text => updateField('title', text)}
                error={errors.title}
                editable={false}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Input
                label="Medicine name"
                value={formData.medicineName}
                onChangeText={text => updateField('medicineName', text)}
                error={errors.medicineName}
                placeholder="Medicinal name"
              />
            </View>

            <View style={styles.fieldGroup}>
              <TouchableInput
                label={formData.medicineType ? 'Medication type' : undefined}
                value={formData.medicineType ? formData.medicineType : undefined}
                placeholder="Medication type"
                onPress={() => medicationTypeSheetRef.current?.open()}
                rightComponent={
                  <Image source={Images.dropdownIcon} style={styles.dropdownIcon} />
                }
                error={errors.medicineType}
              />
            </View>

            <View style={styles.fieldGroup}>
              <TouchableInput
                label="Dosage"
                value={
                  formData.dosages.length > 0
                    ? `${formData.dosages.length} dosage${formData.dosages.length > 1 ? 's' : ''}`
                    : undefined
                }
                placeholder="Dosage"
                onPress={() => dosageSheetRef.current?.open()}
                rightComponent={
                  <Image source={Images.dropdownIcon} style={styles.dropdownIcon} />
                }
                error={errors.dosages}
              />
            </View>

            <View style={styles.fieldGroup}>
              <TouchableInput
                label={formData.medicationFrequency ? 'Medication frequency' : undefined}
                value={formData.medicationFrequency ? formData.medicationFrequency : undefined}
                placeholder="Medication frequency"
                onPress={() => medicationFrequencySheetRef.current?.open()}
                rightComponent={
                  <Image source={Images.dropdownIcon} style={styles.dropdownIcon} />
                }
                error={errors.medicationFrequency}
              />
            </View>

            <View style={styles.dateTimeRow}>
              <View style={styles.dateTimeField}>
                <TouchableInput
                  label={formData.startDate ? 'Start Date' : undefined}
                  value={formData.startDate ? formatDateForDisplay(formData.startDate) : undefined}
                  placeholder="Start Date"
                  onPress={() => setShowStartDatePicker(true)}
                  rightComponent={
                    <Image source={Images.calendarIcon} style={styles.calendarIcon} />
                  }
                  error={errors.startDate}
                />
              </View>

              <View style={styles.dateTimeField}>
                <TouchableInput
                  label={formData.endDate ? 'End Date' : undefined}
                  value={formData.endDate ? formatDateForDisplay(formData.endDate) : undefined}
                  placeholder="End Date (optional)"
                  onPress={() => setShowEndDatePicker(true)}
                  rightComponent={
                    <Image source={Images.calendarIcon} style={styles.calendarIcon} />
                  }
                  error={errors.endDate}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <TouchableInput
                label={formData.assignedTo ? 'Assign task' : undefined}
                value={formData.assignedTo ? 'Assigned' : undefined}
                placeholder="Assign task"
                onPress={() => assignTaskSheetRef.current?.open()}
                rightComponent={<Image source={Images.dropdownIcon} style={styles.dropdownIcon} />}
              />
            </View>
          </>
        )}

        {/* Observational Tool Task Form */}
        {isObservationalToolForm && (
          <>
            {/* Task Name (LOCKED) */}
            <View style={styles.fieldGroup}>
              <Input
                label="Task name"
                value={formData.title}
                onChangeText={text => updateField('title', text)}
                error={errors.title}
                editable={false}
              />
            </View>

            <View style={styles.fieldGroup}>
              <TouchableInput
                label={formData.observationalTool ? 'Select observational tool' : undefined}
                value={formData.observationalTool ? formData.observationalTool : undefined}
                placeholder="Select observational tool"
                onPress={() => observationalToolSheetRef.current?.open()}
                rightComponent={
                  <Image source={Images.dropdownIcon} style={styles.dropdownIcon} />
                }
                error={errors.observationalTool}
              />
            </View>

            <View style={styles.fieldGroup}>
              <TouchableInput
                label={formData.date ? 'Date' : undefined}
                value={formData.date ? formatDateForDisplay(formData.date) : undefined}
                placeholder="Date"
                onPress={() => setShowDatePicker(true)}
                rightComponent={
                  <Image source={Images.calendarIcon} style={styles.calendarIcon} />
                }
                error={errors.date}
              />
            </View>

            <View style={styles.fieldGroup}>
              <TouchableInput
                label={formData.time ? 'Time' : undefined}
                value={
                  formData.time
                    ? formData.time.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      })
                    : undefined
                }
                placeholder="Time"
                onPress={() => setShowTimePicker(true)}
                rightComponent={<Image source={Images.clockIcon} style={styles.calendarIcon} />}
                error={errors.time}
              />
            </View>

            <View style={styles.fieldGroup}>
              <TouchableInput
                label={formData.frequency ? 'Task frequency' : undefined}
                value={formData.frequency ? formData.frequency : undefined}
                placeholder="Task frequency"
                onPress={() => taskFrequencySheetRef.current?.open()}
                rightComponent={
                  <Image source={Images.dropdownIcon} style={styles.dropdownIcon} />
                }
                error={errors.frequency}
              />
            </View>

            <View style={styles.fieldGroup}>
              <TouchableInput
                label={formData.assignedTo ? 'Assign task' : undefined}
                value={formData.assignedTo ? 'Assigned' : undefined}
                placeholder="Assign task"
                onPress={() => assignTaskSheetRef.current?.open()}
                rightComponent={<Image source={Images.dropdownIcon} style={styles.dropdownIcon} />}
              />
            </View>
          </>
        )}

        {/* Custom & Hygiene & Dietary Task Form */}
        {isSimpleForm && (
          <>
            {/* Task Name */}
            <View style={styles.fieldGroup}>
              <Input
                label="Task name"
                value={formData.title}
                onChangeText={text => updateField('title', text)}
                error={errors.title}
                placeholder="Enter task name"
              />
            </View>

            {/* Task Description */}
            <View style={styles.fieldGroup}>
              <Input
                label="Task description (optional)"
                value={formData.description}
                onChangeText={text => updateField('description', text)}
                multiline
                numberOfLines={3}
                inputStyle={styles.textArea}
              />
            </View>

            {/* Date and Time in Single Row */}
            <View style={styles.dateTimeRow}>
              <View style={styles.dateTimeField}>
                <TouchableInput
                  label={formData.date ? 'Date' : undefined}
                  value={formData.date ? formatDateForDisplay(formData.date) : undefined}
                  placeholder="Date"
                  onPress={() => setShowDatePicker(true)}
                  rightComponent={
                    <Image source={Images.calendarIcon} style={styles.calendarIcon} />
                  }
                  error={errors.date}
                />
              </View>

              <View style={styles.dateTimeField}>
                <TouchableInput
                  label={formData.time ? 'Time' : undefined}
                  value={
                    formData.time
                      ? formData.time.toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                        })
                      : undefined
                  }
                  placeholder="Time"
                  onPress={() => setShowTimePicker(true)}
                  rightComponent={<Image source={Images.clockIcon} style={styles.calendarIcon} />}
                  error={errors.time}
                />
              </View>
            </View>

            {/* Task Frequency */}
            <View style={styles.fieldGroup}>
              <TouchableInput
                label={formData.frequency ? 'Task frequency' : undefined}
                value={formData.frequency ? formData.frequency : undefined}
                placeholder="Task frequency"
                onPress={() => taskFrequencySheetRef.current?.open()}
                rightComponent={
                  <Image source={Images.dropdownIcon} style={styles.dropdownIcon} />
                }
                error={errors.frequency}
              />
            </View>

            {/* Assign Task */}
            <View style={styles.fieldGroup}>
              <TouchableInput
                label={formData.assignedTo ? 'Assign task' : undefined}
                value={formData.assignedTo ? 'Assigned' : undefined}
                placeholder="Assign task"
                onPress={() => assignTaskSheetRef.current?.open()}
                rightComponent={<Image source={Images.dropdownIcon} style={styles.dropdownIcon} />}
              />
            </View>
          </>
        )}

        {/* Reminder Section */}
        <View style={styles.toggleSection}>
          <Text style={styles.toggleLabel}>Reminder</Text>
          <Switch
            value={formData.reminderEnabled}
            onValueChange={value => updateField('reminderEnabled', value)}
            trackColor={{false: theme.colors.borderMuted, true: theme.colors.primary}}
            thumbColor={theme.colors.white}
          />
        </View>

        {formData.reminderEnabled && (
          <View style={styles.reminderPillsContainer}>
            {REMINDER_OPTIONS.map(option => {
              const isSelected = formData.reminderOptions === option;
              return (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.reminderPill,
                    isSelected && styles.reminderPillSelected,
                  ]}
                  onPress={() => {
                    if (isSelected) {
                      updateField('reminderOptions', null);
                    } else {
                      updateField('reminderOptions', option);
                    }
                  }}>
                  <Text
                    style={[
                      styles.reminderPillText,
                      isSelected && styles.reminderPillTextSelected,
                    ]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Calendar Sync */}
        <View style={styles.toggleSection}>
          <Text style={styles.toggleLabel}>Sync with Calendar</Text>
          <Switch
            value={formData.syncWithCalendar}
            onValueChange={value => updateField('syncWithCalendar', value)}
            trackColor={{false: theme.colors.borderMuted, true: theme.colors.primary}}
            thumbColor={theme.colors.white}
          />
        </View>

        {formData.syncWithCalendar && (
          <View style={styles.fieldGroup}>
            <TouchableInput
              label={formData.calendarProvider ? 'Calendar provider' : undefined}
              value={formData.calendarProvider ? formData.calendarProvider : undefined}
              placeholder="Select calendar provider"
              onPress={() => calendarSyncSheetRef.current?.open()}
              rightComponent={
                <Image source={Images.dropdownIcon} style={styles.dropdownIcon} />
              }
            />
          </View>
        )}

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

        {/* Additional Note */}
        <View style={styles.fieldGroup}>
          <Input
            label="Additional note (optional)"
            value={formData.additionalNote}
            onChangeText={text => updateField('additionalNote', text)}
            multiline
            numberOfLines={3}
            inputStyle={styles.textArea}
          />
        </View>
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
      gap: theme.spacing[4],
    },
    fieldGroup: {
      marginBottom: theme.spacing[4],
    },
    lockedLabel: {
      ...theme.typography.labelMedium,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing[2],
    },
    lockedField: {
      paddingVertical: theme.spacing[3],
      paddingHorizontal: theme.spacing[4],
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
    },
    lockedValue: {
      ...theme.typography.bodyMedium,
      color: theme.colors.secondary,
      opacity: 0.6,
    },
    dateTimeRow: {
      flexDirection: 'row',
      gap: theme.spacing[3],
      marginBottom: theme.spacing[4],
    },
    dateTimeField: {
      flex: 1,
    },
    dropdownIcon: {
      width: 16,
      height: 16,
      resizeMode: 'contain',
    },
    calendarIcon: {
      width: 18,
      height: 18,
      resizeMode: 'contain',
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
    reminderPillsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing[2],
      marginBottom: theme.spacing[4],
    },
    reminderPill: {
      paddingVertical: theme.spacing[2],
      paddingHorizontal: theme.spacing[3],
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
    },
    reminderPillSelected: {
      backgroundColor: theme.colors.lightBlueBackground,
      borderColor: theme.colors.primary,
    },
    reminderPillText: {
      ...theme.typography.bodySmall,
      color: theme.colors.secondary,
      fontWeight: '500',
    },
    reminderPillTextSelected: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: 'top',
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
