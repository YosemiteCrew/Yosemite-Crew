import React, {useMemo} from 'react';
import {ScrollView, StyleSheet, Text, View, Image, Switch} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {useSelector} from 'react-redux';
import {SafeArea, Input, TouchableInput} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {DocumentAttachmentsSection} from '@/features/documents/components/DocumentAttachmentsSection';
import {ViewField, ViewTouchField} from './components/ViewField';
import {ViewDateTimeRow} from './components/ViewDateTimeRow';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {createIconStyles} from '@/shared/utils/iconStyles';
import {createFormStyles} from '@/shared/utils/formStyles';
import {selectTaskById} from '@/features/tasks/selectors';
import {selectAuthUser} from '@/features/auth/selectors';
import type {TaskStackParamList} from '@/navigation/types';
import type {RootState} from '@/app/store';
import {
  resolveCategoryLabel,
  resolveMedicationTypeLabel,
  resolveMedicationFrequencyLabel,
  resolveTaskFrequencyLabel,
  resolveObservationalToolLabel,
  buildTaskTypeBreadcrumb,
} from '@/features/tasks/utils/taskLabels';
import {formatDateForDisplay} from '@/shared/components/common/SimpleDatePicker/SimpleDatePicker';
import type {MedicationTaskDetails, ObservationalToolTaskDetails} from '@/features/tasks/types';

type Navigation = NativeStackNavigationProp<TaskStackParamList, 'TaskView'>;
type Route = RouteProp<TaskStackParamList, 'TaskView'>;

export const TaskViewScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const iconStyles = useMemo(() => createIconStyles(theme), [theme]);

  const {taskId, source = 'tasks'} = route.params;
  const task = useSelector((state: RootState) => selectTaskById(taskId)(state));
  const companion = useSelector((state: RootState) =>
    state.companion.companions.find(c => c.id === task?.companionId),
  );
  const currentUser = useSelector(selectAuthUser);

  if (!task) {
    return (
      <SafeArea>
        <Header title="Task" showBackButton onBack={() => navigation.goBack()} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Task not found</Text>
        </View>
      </SafeArea>
    );
  }

  const isObservationalTool =
    task.details &&
    'taskType' in task.details &&
    task.details.taskType === 'take-observational-tool';

  const isMedication =
    task.details && 'taskType' in task.details && task.details.taskType === 'give-medication';

  const isCompleted = task.status === 'completed';

  const handleEdit = () => {
    if (!isCompleted) {
      // Pass source to EditTask so it knows where to go back
      navigation.navigate('EditTask', {taskId: task.id, source});
    }
  };

  const handleBack = () => {
    if (source === 'home') {
      // Reset tab stack and go back to HomeStack
      navigation.getParent()?.reset({
        index: 0,
        routes: [{name: 'HomeStack'}],
      });
    } else {
      // Default behavior - came from Tasks tab, reset to TasksMain
      navigation.reset({
        index: 0,
        routes: [{name: 'TasksMain'}],
      });
    }
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '';
    try {
      // Handle HH:mm:ss format (time string)
      if (timeStr.includes(':')) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        if (Number.isNaN(hours) || Number.isNaN(minutes)) return '';

        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        return date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
      }

      // Fallback for ISO date strings
      const date = new Date(timeStr);
      if (Number.isNaN(date.getTime())) return '';
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '';
    }
  };

  // Get task type breadcrumb
  const getTaskTypeBreadcrumb = () => {
    if (isMedication) {
      return buildTaskTypeBreadcrumb(
        task.category,
        task.subcategory === 'none' ? undefined : task.subcategory,
        undefined,
        undefined,
        'give-medication',
      );
    } else if (isObservationalTool) {
      const details = task.details as ObservationalToolTaskDetails;
      return buildTaskTypeBreadcrumb(
        task.category,
        task.subcategory === 'none' ? undefined : task.subcategory,
        undefined,
        details.chronicConditionType,
        'take-observational-tool',
      );
    } else {
      // For simple tasks, just show category
      return resolveCategoryLabel(task.category);
    }
  };

  const getReminderLabel = (reminderOption: string | null | undefined) => {
    if (!reminderOption) return '';
    return reminderOption;
  };

  const getCalendarProviderLabel = (provider: string | null | undefined) => {
    if (!provider) return '';
    return provider === 'google' ? 'Google Calendar' : 'iCloud Calendar';
  };

  const getAssignedToName = () => {
    if (!task.assignedTo) return '';
    // For now, only the current user can be assigned. In future, support co-users
    if (currentUser && task.assignedTo === currentUser.id) {
      return currentUser.firstName || currentUser.email || 'You';
    }
    return 'Unknown';
  };

  return (
    <SafeArea>
      <Header
        title="Task"
        showBackButton
        onBack={handleBack}
        rightIcon={isCompleted ? undefined : Images.editIcon}
        onRightPress={isCompleted ? undefined : handleEdit}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}>
        {/* Companion */}
        <ViewField
          label="Companion"
          value={companion?.name || ''}
          fieldGroupStyle={styles.fieldGroup}
        />

        {/* Task Type */}
        <ViewTouchField
          label="Task type"
          value={getTaskTypeBreadcrumb()}
          icon={Images.dropdownIcon}
          iconStyle={iconStyles.dropdownIcon}
          fieldGroupStyle={styles.fieldGroup}
        />

        {/* Medication Task Form */}
        {isMedication && (
          <>
            {/* Task Name */}
            <ViewField
              label="Task name"
              value={task.title}
              fieldGroupStyle={styles.fieldGroup}
            />

            {/* Medicine Name */}
            <ViewField
              label="Medicine name"
              value={(task.details as MedicationTaskDetails).medicineName}
              fieldGroupStyle={styles.fieldGroup}
            />

            {/* Medication Type */}
            <ViewTouchField
              label="Medication type"
              value={resolveMedicationTypeLabel(
                (task.details as MedicationTaskDetails).medicineType,
              )}
              icon={Images.dropdownIcon}
              iconStyle={iconStyles.dropdownIcon}
              fieldGroupStyle={styles.fieldGroup}
            />

            {/* Dosage */}
            <ViewTouchField
              label="Dosage"
              value={`${(task.details as MedicationTaskDetails).dosages.length} dosage${
                (task.details as MedicationTaskDetails).dosages.length > 1 ? 's' : ''
              }`}
              icon={Images.dropdownIcon}
              iconStyle={iconStyles.dropdownIcon}
              fieldGroupStyle={styles.fieldGroup}
            />

            {/* Display Dosage Details */}
            {(task.details as MedicationTaskDetails).dosages.length > 0 && (
              <View style={styles.dosageDisplayContainer}>
                {(task.details as MedicationTaskDetails).dosages.map(dosage => (
                  <View key={dosage.id} style={styles.dosageDisplayRow}>
                    <View style={styles.dosageDisplayField}>
                      <Input label="Dosage" value={dosage.label} editable={false} />
                    </View>
                    <View style={styles.dosageDisplayField}>
                      <Input
                        label="Time"
                        value={formatTime(dosage.time)}
                        editable={false}
                        icon={<Image source={Images.clockIcon} style={iconStyles.clockIcon} />}
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Medication Frequency */}
            <View style={styles.fieldGroup}>
              <TouchableInput
                label="Medication frequency"
                value={resolveMedicationFrequencyLabel(
                  (task.details as MedicationTaskDetails).frequency,
                )}
                onPress={() => {}} // View only
                rightComponent={<Image source={Images.dropdownIcon} style={iconStyles.dropdownIcon} />}
              />
            </View>

            {/* Start and End Date */}
            <View style={styles.dateTimeRow}>
              <View style={styles.dateTimeField}>
                <TouchableInput
                  label="Start Date"
                  value={formatDateForDisplay(
                    new Date((task.details as MedicationTaskDetails).startDate),
                  )}
                  onPress={() => {}} // View only
                  rightComponent={
                    <Image source={Images.calendarIcon} style={iconStyles.calendarIcon} />
                  }
                />
              </View>

              <View style={styles.dateTimeField}>
                <TouchableInput
                  label="End Date"
                  value={
                    (task.details as MedicationTaskDetails).endDate
                      ? formatDateForDisplay(
                          new Date((task.details as MedicationTaskDetails).endDate!),
                        )
                      : ''
                  }
                  onPress={() => {}} // View only
                  rightComponent={
                    <Image source={Images.calendarIcon} style={iconStyles.calendarIcon} />
                  }
                />
              </View>
            </View>

            {/* Assign Task */}
            <View style={styles.fieldGroup}>
              <Input
                label="Assign task"
                value={getAssignedToName()}
                editable={false}
              />
            </View>
          </>
        )}

        {/* Observational Tool Task Form */}
        {isObservationalTool && (
          <>
            {/* Task Name */}
            <ViewField
              label="Task name"
              value={task.title}
              fieldGroupStyle={styles.fieldGroup}
            />

            {/* Observational Tool */}
            <ViewTouchField
              label="Select observational tool"
              value={resolveObservationalToolLabel(
                (task.details as ObservationalToolTaskDetails).toolType,
              )}
              icon={Images.dropdownIcon}
              iconStyle={iconStyles.dropdownIcon}
              fieldGroupStyle={styles.fieldGroup}
            />

            {/* Date */}
            <ViewTouchField
              label="Date"
              value={formatDateForDisplay(new Date(task.date))}
              icon={Images.calendarIcon}
              iconStyle={iconStyles.calendarIcon}
              fieldGroupStyle={styles.fieldGroup}
            />

            {/* Time */}
            <ViewTouchField
              label="Time"
              value={formatTime(task.time)}
              icon={Images.clockIcon}
              iconStyle={iconStyles.clockIcon}
              fieldGroupStyle={styles.fieldGroup}
            />

            {/* Task Frequency */}
            <ViewTouchField
              label="Task frequency"
              value={resolveTaskFrequencyLabel(task.frequency)}
              icon={Images.dropdownIcon}
              iconStyle={iconStyles.dropdownIcon}
              fieldGroupStyle={styles.fieldGroup}
            />

            {/* Assign Task */}
            <ViewField
              label="Assign task"
              value={getAssignedToName()}
              fieldGroupStyle={styles.fieldGroup}
            />
          </>
        )}

        {/* Simple Task Form (Custom, Hygiene, Dietary) */}
        {!isMedication && !isObservationalTool && (
          <>
            {/* Task Name */}
            <ViewField
              label="Task name"
              value={task.title}
              fieldGroupStyle={styles.fieldGroup}
            />

            {/* Task Description */}
            {task.details && 'description' in task.details && task.details.description && (
              <ViewField
                label="Task description"
                value={task.details.description}
                multiline
                numberOfLines={3}
                textAreaStyle={styles.textArea}
                fieldGroupStyle={styles.fieldGroup}
              />
            )}

            {/* Date and Time */}
            <ViewDateTimeRow
              dateLabel="Date"
              dateValue={formatDateForDisplay(new Date(task.date))}
              timeLabel="Time"
              timeValue={formatTime(task.time)}
              dateTimeRowStyle={styles.dateTimeRow}
              dateTimeFieldStyle={styles.dateTimeField}
              calendarIconStyle={iconStyles.calendarIcon}
              clockIconStyle={iconStyles.clockIcon}
            />

            {/* Task Frequency */}
            <ViewTouchField
              label="Task frequency"
              value={resolveTaskFrequencyLabel(task.frequency)}
              icon={Images.dropdownIcon}
              iconStyle={iconStyles.dropdownIcon}
              fieldGroupStyle={styles.fieldGroup}
            />

            {/* Assign Task */}
            <ViewField
              label="Assign task"
              value={getAssignedToName()}
              fieldGroupStyle={styles.fieldGroup}
            />
          </>
        )}

        {/* Reminder Section */}
        <View style={styles.toggleSection}>
          <Text style={styles.toggleLabel}>Reminder</Text>
          <Switch
            value={task.reminderEnabled}
            onValueChange={() => {}} // View only
            trackColor={{false: theme.colors.borderMuted, true: theme.colors.primary}}
            thumbColor={theme.colors.white}
            disabled={true}
          />
        </View>

        {task.reminderEnabled && task.reminderOptions && (
          <View style={styles.reminderPillsContainer}>
            <View style={[styles.reminderPill, styles.reminderPillSelected]}>
              <Text style={[styles.reminderPillText, styles.reminderPillTextSelected]}>
                {getReminderLabel(task.reminderOptions)}
              </Text>
            </View>
          </View>
        )}

        {/* Calendar Sync */}
        <View style={styles.toggleSection}>
          <Text style={styles.toggleLabel}>Sync with Calendar</Text>
          <Switch
            value={task.syncWithCalendar}
            onValueChange={() => {}} // View only
            trackColor={{false: theme.colors.borderMuted, true: theme.colors.primary}}
            thumbColor={theme.colors.white}
            disabled={true}
          />
        </View>

        {task.syncWithCalendar && task.calendarProvider && (
          <View style={styles.fieldGroup}>
            <TouchableInput
              label="Calendar provider"
              value={getCalendarProviderLabel(task.calendarProvider)}
              onPress={() => {}} // View only
              rightComponent={<Image source={Images.dropdownIcon} style={iconStyles.dropdownIcon} />}
            />
          </View>
        )}

        {/* Attach Documents */}
        <View style={styles.toggleSection}>
          <Text style={styles.toggleLabel}>Attach document</Text>
          <Switch
            value={task.attachDocuments}
            onValueChange={() => {}} // View only
            trackColor={{false: theme.colors.borderMuted, true: theme.colors.primary}}
            thumbColor={theme.colors.white}
            disabled={true}
          />
        </View>

        {task.attachDocuments && task.attachments.length > 0 && (
          <View style={styles.fieldGroup}>
            <DocumentAttachmentsSection
              files={task.attachments as any}
              onAddPress={() => {}} // View only
              onRequestRemove={() => {}} // View only
              emptyTitle="No documents attached"
              emptySubtitle=""
              hideAddButton={true}
            />
          </View>
        )}

        {/* Additional Note */}
        {task.additionalNote && (
          <View style={styles.fieldGroup}>
            <Input
              label="Additional note"
              value={task.additionalNote}
              multiline
              numberOfLines={3}
              inputStyle={styles.textArea}
              editable={false}
            />
          </View>
        )}

        {/* Completed Badge */}
        {isCompleted && task.completedAt && (
          <View style={styles.completedBadge}>
            <Text style={styles.completedText}>
              Completed on {formatDateForDisplay(new Date(task.completedAt))}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeArea>
  );
};

const createStyles = (theme: any) => {
  const formStyles = createFormStyles(theme);

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      paddingHorizontal: theme.spacing[4],
      paddingBlock: theme.spacing[4],
    },
    ...formStyles,
    // Input and Label styles - matching DocumentForm
    input: {
      marginBottom: theme.spacing[4],
    },
    dropdownIcon: {
      width: 20,
      height: 20,
      resizeMode: 'contain',
      tintColor: theme.colors.textSecondary,
    },
    calendarIcon: {
      width: 18,
      height: 18,
      resizeMode: 'contain',
      tintColor: theme.colors.textSecondary,
    },
    label: {
      ...theme.typography.inputLabel,
      color: theme.colors.secondary,
    },
    // Error styles - matching DocumentForm
    errorText: {
      ...theme.typography.labelXsBold,
      color: theme.colors.error,
      marginTop: 3,
      marginBottom: theme.spacing[3],
      marginLeft: theme.spacing[1],
    },
    textArea: {
      minHeight: 100,
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
    completedBadge: {
      backgroundColor: 'rgba(0, 143, 93, 0.12)',
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing[3],
      marginTop: theme.spacing[4],
      alignItems: 'center',
    },
    completedText: {
      ...theme.typography.bodyMedium,
      color: theme.colors.success,
      fontWeight: '600',
    },
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing[4],
    },
    errorContainerText: {
      ...theme.typography.bodyMedium,
      color: theme.colors.error,
    },
  });
};

export default TaskViewScreen;
