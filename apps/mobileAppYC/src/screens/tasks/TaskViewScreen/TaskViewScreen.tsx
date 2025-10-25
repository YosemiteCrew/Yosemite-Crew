import React, {useMemo} from 'react';
import {ScrollView, StyleSheet, Text, View, Image, Switch} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {useSelector} from 'react-redux';
import {SafeArea, Input, TouchableInput} from '@/components/common';
import {Header} from '@/components/common/Header/Header';
import {DocumentAttachmentsSection} from '@/components/documents/DocumentAttachmentsSection';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
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
} from '@/utils/taskLabels';
import {formatDateForDisplay} from '@/components/common/SimpleDatePicker/SimpleDatePicker';
import type {MedicationTaskDetails, ObservationalToolTaskDetails} from '@/features/tasks/types';

type Navigation = NativeStackNavigationProp<TaskStackParamList, 'TaskView'>;
type Route = RouteProp<TaskStackParamList, 'TaskView'>;

export const TaskViewScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {taskId} = route.params;
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
      navigation.navigate('EditTask', {taskId: task.id});
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
        onBack={() => navigation.goBack()}
        rightIcon={isCompleted ? undefined : Images.editIcon}
        onRightPress={isCompleted ? undefined : handleEdit}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}>
        {/* Companion */}
        <View style={styles.fieldGroup}>
          <Input
            label="Companion"
            value={companion?.name || ''}
            editable={false}
          />
        </View>

        {/* Task Type */}
        <View style={styles.fieldGroup}>
          <TouchableInput
            label="Task type"
            value={getTaskTypeBreadcrumb()}
            onPress={() => {}} // View only - no action
            rightComponent={<Image source={Images.dropdownIcon} style={styles.dropdownIcon} />}
          />
        </View>

        {/* Medication Task Form */}
        {isMedication && (
          <>
            {/* Task Name */}
            <View style={styles.fieldGroup}>
              <Input label="Task name" value={task.title} editable={false} />
            </View>

            {/* Medicine Name */}
            <View style={styles.fieldGroup}>
              <Input
                label="Medicine name"
                value={(task.details as MedicationTaskDetails).medicineName}
                editable={false}
              />
            </View>

            {/* Medication Type */}
            <View style={styles.fieldGroup}>
              <TouchableInput
                label="Medication type"
                value={resolveMedicationTypeLabel(
                  (task.details as MedicationTaskDetails).medicineType,
                )}
                onPress={() => {}} // View only
                rightComponent={<Image source={Images.dropdownIcon} style={styles.dropdownIcon} />}
              />
            </View>

            {/* Dosage */}
            <View style={styles.fieldGroup}>
              <TouchableInput
                label="Dosage"
                value={`${(task.details as MedicationTaskDetails).dosages.length} dosage${
                  (task.details as MedicationTaskDetails).dosages.length > 1 ? 's' : ''
                }`}
                onPress={() => {}} // View only
                rightComponent={<Image source={Images.dropdownIcon} style={styles.dropdownIcon} />}
              />
            </View>

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
                        icon={<Image source={Images.clockIcon} style={styles.calendarIcon} />}
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
                rightComponent={<Image source={Images.dropdownIcon} style={styles.dropdownIcon} />}
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
                    <Image source={Images.calendarIcon} style={styles.calendarIcon} />
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
                    <Image source={Images.calendarIcon} style={styles.calendarIcon} />
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
            <View style={styles.fieldGroup}>
              <Input label="Task name" value={task.title} editable={false} />
            </View>

            {/* Observational Tool */}
            <View style={styles.fieldGroup}>
              <TouchableInput
                label="Select observational tool"
                value={resolveObservationalToolLabel(
                  (task.details as ObservationalToolTaskDetails).toolType,
                )}
                onPress={() => {}} // View only
                rightComponent={<Image source={Images.dropdownIcon} style={styles.dropdownIcon} />}
              />
            </View>

            {/* Date */}
            <View style={styles.fieldGroup}>
              <TouchableInput
                label="Date"
                value={formatDateForDisplay(new Date(task.date))}
                onPress={() => {}} // View only
                rightComponent={<Image source={Images.calendarIcon} style={styles.calendarIcon} />}
              />
            </View>

            {/* Time */}
            <View style={styles.fieldGroup}>
              <TouchableInput
                label="Time"
                value={formatTime(task.time)}
                onPress={() => {}} // View only
                rightComponent={<Image source={Images.clockIcon} style={styles.calendarIcon} />}
              />
            </View>

            {/* Task Frequency */}
            <View style={styles.fieldGroup}>
              <TouchableInput
                label="Task frequency"
                value={resolveTaskFrequencyLabel(task.frequency)}
                onPress={() => {}} // View only
                rightComponent={<Image source={Images.dropdownIcon} style={styles.dropdownIcon} />}
              />
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

        {/* Simple Task Form (Custom, Hygiene, Dietary) */}
        {!isMedication && !isObservationalTool && (
          <>
            {/* Task Name */}
            <View style={styles.fieldGroup}>
              <Input label="Task name" value={task.title} editable={false} />
            </View>

            {/* Task Description */}
            {task.details && 'description' in task.details && task.details.description && (
              <View style={styles.fieldGroup}>
                <Input
                  label="Task description"
                  value={task.details.description}
                  multiline
                  numberOfLines={3}
                  inputStyle={styles.textArea}
                  editable={false}
                />
              </View>
            )}

            {/* Date and Time */}
            <View style={styles.dateTimeRow}>
              <View style={styles.dateTimeField}>
                <TouchableInput
                  label="Date"
                  value={formatDateForDisplay(new Date(task.date))}
                  onPress={() => {}} // View only
                  rightComponent={
                    <Image source={Images.calendarIcon} style={styles.calendarIcon} />
                  }
                />
              </View>

              <View style={styles.dateTimeField}>
                <TouchableInput
                  label="Time"
                  value={formatTime(task.time)}
                  onPress={() => {}} // View only
                  rightComponent={<Image source={Images.clockIcon} style={styles.calendarIcon} />}
                />
              </View>
            </View>

            {/* Task Frequency */}
            <View style={styles.fieldGroup}>
              <TouchableInput
                label="Task frequency"
                value={resolveTaskFrequencyLabel(task.frequency)}
                onPress={() => {}} // View only
                rightComponent={<Image source={Images.dropdownIcon} style={styles.dropdownIcon} />}
              />
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
              rightComponent={<Image source={Images.dropdownIcon} style={styles.dropdownIcon} />}
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

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      paddingHorizontal: theme.spacing[4],
      paddingBlock: theme.spacing[4],
    },
    fieldGroup: {
      marginBottom: theme.spacing[4],
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
      marginBottom: theme.spacing[4],
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
      borderRadius: 28,
      borderWidth: 0.5,
      borderColor: '#312943',
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
    errorText: {
      ...theme.typography.bodyMedium,
      color: theme.colors.error,
    },
  });

export default TaskViewScreen;
