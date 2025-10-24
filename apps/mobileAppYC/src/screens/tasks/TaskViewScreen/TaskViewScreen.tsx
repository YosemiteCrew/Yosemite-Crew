import React, {useMemo} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {useSelector} from 'react-redux';
import {SafeArea} from '@/components/common';
import {Header} from '@/components/common/Header/Header';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {selectTaskById} from '@/features/tasks/selectors';
import type {TaskStackParamList} from '@/navigation/types';
import type {RootState} from '@/app/store';
import {
  resolveCategoryLabel,
  resolveMedicationTypeLabel,
  resolveMedicationFrequencyLabel,
  resolveTaskFrequencyLabel,
  resolveObservationalToolLabel,
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
    if (!timeStr) return null;
    try {
      // Handle HH:mm:ss format (time string)
      if (timeStr.includes(':')) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) return null;

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
      if (isNaN(date.getTime())) return null;
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return null;
    }
  };

  const renderField = (label: string, value: string | undefined | null) => {
    if (!value) return null;

    return (
      <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
    );
  };

  const renderMedicationDetails = (details: MedicationTaskDetails) => (
    <>
      {renderField('Medicine name', details.medicineName)}
      {renderField('Medication type', resolveMedicationTypeLabel(details.medicineType))}
      {details.dosages.length > 0 && (
        <View style={styles.field}>
          <Text style={styles.label}>Dosage schedule</Text>
          {details.dosages.map(dosage => (
            <Text key={dosage.id} style={styles.value}>
              {dosage.label}: {formatTime(dosage.time)}
            </Text>
          ))}
        </View>
      )}
      {renderField('Frequency', resolveMedicationFrequencyLabel(details.frequency))}
      {renderField('Start date', formatDateForDisplay(new Date(details.startDate)))}
      {details.endDate &&
        renderField('End date', formatDateForDisplay(new Date(details.endDate)))}
    </>
  );

  const renderObservationalToolDetails = (details: ObservationalToolTaskDetails) => (
    <>
      {renderField('Observational tool', resolveObservationalToolLabel(details.toolType))}
      <View style={styles.noteCard}>
        <Text style={styles.noteText}>
          This task uses a specialized observational tool interface
        </Text>
      </View>
    </>
  );

  return (
    <SafeArea>
      <Header
        title="Task"
        showBackButton
        onBack={() => navigation.goBack()}
        rightIcon={!isCompleted ? Images.editIcon : undefined}
        onRightPress={!isCompleted ? handleEdit : undefined}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          {renderField('Companion', companion?.name)}
          {renderField('Category', resolveCategoryLabel(task.category))}
          {task.subcategory && renderField('Subcategory', task.subcategory)}
          {renderField('Task name', task.title)}

          {isMedication && renderMedicationDetails(task.details as MedicationTaskDetails)}
          {isObservationalTool &&
            renderObservationalToolDetails(task.details as ObservationalToolTaskDetails)}

          {!isMedication && !isObservationalTool && (
            <>
              {renderField('Date', formatDateForDisplay(new Date(task.date)))}
              {task.time && renderField('Time', formatTime(task.time))}
              {task.frequency &&
                renderField('Frequency', resolveTaskFrequencyLabel(task.frequency))}
            </>
          )}

          {task.additionalNote && renderField('Additional note', task.additionalNote)}

          {task.attachments.length > 0 && (
            <View style={styles.field}>
              <Text style={styles.label}>Attachments</Text>
              {task.attachments.map(attachment => (
                <Text key={attachment.id} style={styles.value}>
                  {attachment.name}
                </Text>
              ))}
            </View>
          )}

          {isCompleted && task.completedAt && (
            <View style={styles.completedBadge}>
              <Text style={styles.completedText}>
                Completed on {formatDateForDisplay(new Date(task.completedAt))}
              </Text>
            </View>
          )}
        </View>
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
      paddingBottom: theme.spacing[8],
    },
    section: {
      marginTop: theme.spacing[4],
    },
    field: {
      marginBottom: theme.spacing[4],
    },
    label: {
      ...theme.typography.labelMedium,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing[2],
    },
    value: {
      ...theme.typography.bodyMedium,
      color: theme.colors.secondary,
    },
    noteCard: {
      backgroundColor: theme.colors.lightBlueBackground,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing[4],
      marginTop: theme.spacing[2],
    },
    noteText: {
      ...theme.typography.bodyMedium,
      color: theme.colors.primary,
      fontStyle: 'italic',
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
