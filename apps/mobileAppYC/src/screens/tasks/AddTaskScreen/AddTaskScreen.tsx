import React, {useState, useRef, useMemo, useEffect} from 'react';
import {ScrollView, StyleSheet, View, Text, Switch, Image, TouchableOpacity, Alert} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useDispatch, useSelector} from 'react-redux';
import {SafeArea, Input, TouchableInput} from '@/components/common';
import {Header} from '@/components/common/Header/Header';
import {CompanionSelector} from '@/components/common/CompanionSelector/CompanionSelector';
import LiquidGlassButton from '@/components/common/LiquidGlassButton/LiquidGlassButton';
import {formatDateForDisplay, SimpleDatePicker} from '@/components/common/SimpleDatePicker/SimpleDatePicker';
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
import {useTheme, useFormBottomSheets, useFileOperations} from '@/hooks';
import {Images} from '@/assets/images';
import {addTask} from '@/features/tasks';
import {setSelectedCompanion} from '@/features/companion';
import type {AppDispatch, RootState} from '@/app/store';
import type {TaskStackParamList} from '@/navigation/types';
import type {
  TaskFormData,
  TaskFormErrors,
  TaskTypeSelection,
  Task,
  TaskAttachment,
  ReminderOption,
} from '@/features/tasks/types';
import {getTaskTitle, buildTaskTypeBreadcrumb} from '@/utils/taskLabels';

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
  const styles = useMemo(() => createStyles(theme), [theme]);

  const companions = useSelector((state: RootState) => state.companion.companions);
  const selectedCompanionId = useSelector(
    (state: RootState) => state.companion.selectedCompanionId,
  );
  const loading = useSelector((state: RootState) => state.tasks.loading);

  const [taskTypeSelection, setTaskTypeSelection] = useState<TaskTypeSelection | null>(null);
  const [formData, setFormData] = useState<TaskFormData>({
    category: null,
    subcategory: null,
    parasitePreventionType: null,
    chronicConditionType: null,
    healthTaskType: null,
    hygieneTaskType: null,
    dietaryTaskType: null,
    title: '',
    date: new Date(), // Initialize to today
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
    startDate: new Date(), // Initialize to today
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
  const {
    uploadSheetRef,
    deleteSheetRef,
  } = refs;

  const taskTypeSheetRef = useRef<any>(null);
  const medicationTypeSheetRef = useRef<any>(null);
  const dosageSheetRef = useRef<any>(null);
  const medicationFrequencySheetRef = useRef<any>(null);
  const taskFrequencySheetRef = useRef<any>(null);
  const assignTaskSheetRef = useRef<any>(null);
  const calendarSyncSheetRef = useRef<any>(null);
  const observationalToolSheetRef = useRef<any>(null);
  const discardSheetRef = useRef<any>(null);

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

  const handleTaskTypeSelect = (selection: TaskTypeSelection) => {
    const isMedication = selection.category === 'health' && selection.taskType === 'give-medication';
    const isObservationalTool = selection.category === 'health' && selection.taskType === 'take-observational-tool';

    // Build the updated form data
    const updatedFormData: Partial<TaskFormData> = {
      category: selection.category,
      subcategory: selection.subcategory || null,
      parasitePreventionType: selection.parasitePreventionType || null,
      chronicConditionType: selection.chronicConditionType || null,

      // Reset all task type fields first
      healthTaskType: null,
      hygieneTaskType: null,
      dietaryTaskType: null,

      // Reset all form-specific fields
      medicineName: '',
      medicineType: null,
      dosages: [],
      medicationFrequency: null,
      startDate: new Date(),
      endDate: null,
      observationalTool: null,
      description: '',
      time: null,
      frequency: null,
    };

    // Set the appropriate task type field
    if (selection.category === 'health') {
      updatedFormData.healthTaskType = selection.taskType as any;
    } else if (selection.category === 'hygiene') {
      updatedFormData.hygieneTaskType = selection.taskType as any;
    } else if (selection.category === 'dietary') {
      updatedFormData.dietaryTaskType = selection.taskType as any;
    }

    // Auto-fill title
    const title = getTaskTitle(selection.category, selection.taskType);
    updatedFormData.title = title;

    // Apply all updates at once
    setFormData(prev => ({...prev, ...updatedFormData}));
    setTaskTypeSelection(selection);
    setHasUnsavedChanges(true);
    clearError('category');
  };

  const handleCompanionSelect = (companionId: string | null) => {
    if (companionId) {
      dispatch(setSelectedCompanion(companionId));
    }
  };

  const isBackdatedDate = (date: Date | null): boolean => {
    if (!date) return false;
    const now = new Date();
    // Reset time to midnight for fair date comparison
    now.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < now;
  };

  const validateForm = (): boolean => {
    const newErrors: TaskFormErrors = {};

    if (!taskTypeSelection) {
      newErrors.category = 'Please select a task type';
    }

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
      } else if (isBackdatedDate(formData.startDate)) {
        newErrors.startDate = 'Start date cannot be in the past';
      }
    } else if (isObservationalTool) {
      if (!formData.observationalTool) {
        newErrors.observationalTool = 'Please select an observational tool';
      }
      if (!formData.date) {
        newErrors.date = 'Date is required';
      } else if (isBackdatedDate(formData.date)) {
        newErrors.date = 'Date cannot be in the past';
      }
      if (!formData.frequency) {
        newErrors.frequency = 'Task frequency is required';
      }
    } else {
      if (!formData.date) {
        newErrors.date = 'Date is required';
      } else if (isBackdatedDate(formData.date)) {
        newErrors.date = 'Date cannot be in the past';
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
    // Return date in YYYY-MM-DD format (ISO 8601 date only, no time)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatTimeToISO = (date: Date | null): string | undefined => {
    if (!date) return undefined;
    // Return time in HH:mm:ss format
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const buildTaskFromForm = (): Omit<
    Task,
    'id' | 'createdAt' | 'updatedAt' | 'status' | 'completedAt'
  > => {
    const isMedication = formData.healthTaskType === 'give-medication';
    const isObservationalTool = formData.healthTaskType === 'take-observational-tool';

    let details: any = {};

    if (isMedication) {
      // Format dosages: convert time to ISO format (HH:mm:ss)
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
    const taskTime = formData.time?.toISOString();
    const formattedDate = formatDateToISODate(taskDate) || taskDate.toISOString().split('T')[0];
    const formattedTime = taskTime ? formatTimeToISO(new Date(taskTime)) : undefined;

    return {
      companionId: selectedCompanionId!,
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
    if (!selectedCompanionId) {
      Alert.alert('Error', 'Please select a companion');
      return;
    }

    try {
      const taskData = buildTaskFromForm();
      const result = await dispatch(addTask(taskData as any)).unwrap();

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

  const isMedicationForm = formData.healthTaskType === 'give-medication';
  const isObservationalToolForm = formData.healthTaskType === 'take-observational-tool';
  const isSimpleForm = !isMedicationForm && !isObservationalToolForm;

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
              <>
                {/* Task Name */}
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

                {/* Display Dosage Details */}
                {formData.dosages.length > 0 && (
                  <View style={styles.dosageDisplayContainer}>
                    {formData.dosages.map((dosage) => (
                      <View key={dosage.id} style={styles.dosageDisplayRow}>
                        <View style={styles.dosageDisplayField}>
                          <Input
                            label="Dosage"
                            value={dosage.label}
                            editable={false}
                          />
                        </View>
                        <View style={styles.dosageDisplayField}>
                          <Input
                            label="Time"
                            value={new Date(dosage.time).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true,
                            })}
                            editable={false}
                            icon={<Image source={Images.clockIcon} style={styles.calendarIcon} />}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                )}

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
                      placeholder="End Date"
                      onPress={() => setShowEndDatePicker(true)}
                      rightComponent={
                        <Image source={Images.calendarIcon} style={styles.calendarIcon} />
                      }
                      error={errors.endDate}
                    />
                  </View>
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

            {/* Observational Tool Task Form */}
            {isObservationalToolForm && (
              <>
                {/* Task Name */}
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
                    editable={taskTypeSelection.category === 'custom'}
                    placeholder={taskTypeSelection.category === 'custom' ? 'Enter task name' : undefined}
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
                  value={
                    formData.calendarProvider
                      ? formData.calendarProvider === 'google'
                        ? 'Google Calendar'
                        : 'iCloud Calendar'
                      : undefined
                  }
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

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      paddingHorizontal: theme.spacing[4],
      paddingBottom: theme.spacing[24],
      gap: theme.spacing[4],
    },
    companionSelector: {
      marginTop: theme.spacing[4],
      marginBottom: theme.spacing[2],
    },
    fieldGroup: {
      marginBottom: theme.spacing[4],
    },
    breadcrumbContainer: {
      paddingVertical: theme.spacing[3],
      paddingHorizontal: theme.spacing[3],
      backgroundColor: theme.colors.lightBlueBackground,
      borderRadius: 8,
      marginBottom: theme.spacing[2],
    },
    breadcrumbText: {
      ...theme.typography.bodyMedium,
      color: theme.colors.primary,
      fontWeight: '500',
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
    dosageDisplayContainer: {
      gap: theme.spacing[3],
      marginBottom: theme.spacing[4],
    },
    dosageDisplayRow: {
      flexDirection: 'row',
      gap: theme.spacing[3],
    },
    dosageDisplayField: {
      flex: 1,
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
  });

export default AddTaskScreen;
