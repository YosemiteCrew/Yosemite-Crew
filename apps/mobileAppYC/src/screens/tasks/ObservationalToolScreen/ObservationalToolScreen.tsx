import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {useSelector} from 'react-redux';
import {SafeArea} from '@/components/common';
import {Header} from '@/components/common/Header/Header';
import {useTheme} from '@/hooks';
import {selectTaskById} from '@/features/tasks/selectors';
import type {RootState} from '@/app/store';
import type {TaskStackParamList} from '@/navigation/types';
import type {ObservationalToolTaskDetails} from '@/features/tasks/types';
import {resolveObservationalToolLabel} from '@/utils/taskLabels';

type Navigation = NativeStackNavigationProp<TaskStackParamList, 'ObservationalTool'>;
type Route = RouteProp<TaskStackParamList, 'ObservationalTool'>;

export const ObservationalToolScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {taskId} = route.params;
  const task = useSelector((state: RootState) => selectTaskById(taskId)(state));

  if (!task) {
    return (
      <SafeArea>
        <Header
          title="Observational Tool"
          showBackButton
          onBack={() => navigation.goBack()}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Task not found</Text>
        </View>
      </SafeArea>
    );
  }

  const details = task.details as ObservationalToolTaskDetails;

  return (
    <SafeArea>
      <Header
        title="Observational Tool"
        showBackButton
        onBack={() => navigation.goBack()}
      />

      <View style={styles.container}>
        <View style={styles.placeholderCard}>
          <Text style={styles.title}>Task ID</Text>
          <Text style={styles.value}>{taskId}</Text>

          <Text style={styles.title}>Tool Type</Text>
          <Text style={styles.value}>{resolveObservationalToolLabel(details.toolType)}</Text>

          {details.chronicConditionType && (
            <>
              <Text style={styles.title}>Condition</Text>
              <Text style={styles.value}>{details.chronicConditionType}</Text>
            </>
          )}

          <View style={styles.noteContainer}>
            <Text style={styles.noteText}>
              The specialized observational tool interface for pain assessment will be implemented
              in a future update. This screen will include interactive forms for recording
              observations based on the selected tool (Feline Grimace Scale, Canine Acute Pain
              Scale, or Equine Grimace Scale).
            </Text>
          </View>
        </View>
      </View>
    </SafeArea>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: theme.spacing[4],
    },
    placeholderCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      padding: theme.spacing[6],
      gap: theme.spacing[3],
    },
    title: {
      ...theme.typography.labelMedium,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing[2],
    },
    value: {
      ...theme.typography.bodyLarge,
      color: theme.colors.secondary,
      fontWeight: '500',
    },
    noteContainer: {
      backgroundColor: theme.colors.lightBlueBackground,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing[4],
      marginTop: theme.spacing[4],
    },
    noteText: {
      ...theme.typography.bodyMedium,
      color: theme.colors.primary,
      fontStyle: 'italic',
      lineHeight: 22,
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

export default ObservationalToolScreen;
