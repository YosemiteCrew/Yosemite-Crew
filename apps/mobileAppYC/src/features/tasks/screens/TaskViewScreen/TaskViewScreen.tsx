import React, {useEffect, useMemo, useState} from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
  Switch,
  Platform,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp, NavigationProp} from '@react-navigation/native';
import {useSelector, useDispatch} from 'react-redux';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type {AppDispatch, RootState} from '@/app/store';
import {Input, TouchableInput} from '@/shared/components/common';
import {Badge} from '@/shared/components/common/Badge/Badge';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import DocumentAttachmentViewer from '@/features/documents/components/DocumentAttachmentViewer';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {ViewField, ViewTouchField} from './components/ViewField';
import {ViewDateTimeRow} from './components/ViewDateTimeRow';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {createIconStyles} from '@/shared/utils/iconStyles';
import {createFormStyles} from '@/shared/utils/formStyles';
import {selectTaskById} from '@/features/tasks/selectors';
import {selectAuthUser} from '@/features/auth/selectors';
import {markTaskStatus} from '@/features/tasks/thunks';
import type {TaskStackParamList, TabParamList} from '@/navigation/types';
import {
  resolveCategoryLabel,
  resolveMedicationTypeLabel,
  resolveMedicationFrequencyLabel,
  resolveTaskFrequencyLabel,
  resolveObservationalToolLabel,
  buildTaskTypeBreadcrumb,
} from '@/features/tasks/utils/taskLabels';
import {formatDateForDisplay} from '@/shared/components/common/SimpleDatePicker/dateTimeFormat';
import type {
  MedicationTaskDetails,
  ObservationalToolTaskDetails,
} from '@/features/tasks/types';
import {openCalendarEvent} from '@/features/tasks/services/calendarSyncService';
import {buildCdnUrlFromKey} from '@/shared/utils/cdnHelpers';
import {normalizeImageUri} from '@/shared/utils/imageUri';
import {observationToolApi} from '@/features/observationalTools/services/observationToolService';
import {fetchBusinesses} from '@/features/appointments/businessesSlice';
import type {VetService} from '@/features/appointments/types';

import i18next from 'i18next';
type Navigation = NativeStackNavigationProp<TaskStackParamList, 'TaskView'>;
type Route = RouteProp<TaskStackParamList, 'TaskView'>;

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

const getReminderLabel = (reminderOption: string | null | undefined) => {
  if (!reminderOption) return '';
  return reminderOption;
};

const getCalendarProviderLabel = (provider: string | null | undefined) => {
  if (!provider) return '';
  return provider === 'google' ? 'Google Calendar' : 'iCloud Calendar';
};

export const TaskViewScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const dispatch = useDispatch<AppDispatch>();
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const iconStyles = useMemo(() => createIconStyles(theme), [theme]);
  const [isPdfInteracting, setIsPdfInteracting] = React.useState(false);

  const {taskId, source = 'tasks'} = route.params;
  const task = useSelector((state: RootState) => selectTaskById(taskId)(state));
  const companion = useSelector((state: RootState) =>
    state.companion.companions.find(c => c.id === task?.companionId),
  );
  const businesses = useSelector(
    (state: RootState) => state.businesses.businesses,
  );
  const services = useSelector((state: RootState) => state.businesses.services);
  const currentUser = useSelector(selectAuthUser);
  const preparedAttachments = useMemo(() => {
    const guessMimeFromName = (
      fileName?: string | null,
    ): string | undefined => {
      if (!fileName) return undefined;
      const lower = fileName.toLowerCase();
      if (lower.endsWith('.jpg') || lower.endsWith('.jpeg'))
        return 'image/jpeg';
      if (lower.endsWith('.png')) return 'image/png';
      if (lower.endsWith('.webp')) return 'image/webp';
      if (lower.endsWith('.pdf')) return 'application/pdf';
      if (lower.endsWith('.doc')) return 'application/msword';
      if (lower.endsWith('.docx'))
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      return undefined;
    };

    return (task?.attachments ?? []).map(att => {
      const attSource =
        normalizeImageUri(att.viewUrl ?? att.downloadUrl ?? att.uri) ??
        normalizeImageUri(buildCdnUrlFromKey(att.key ?? att.id));

      return {
        ...att,
        type: att.type ?? guessMimeFromName(att.name),
        uri: attSource ?? att.uri,
        viewUrl: attSource ?? att.viewUrl ?? null,
        downloadUrl: att.downloadUrl ?? attSource ?? null,
      };
    });
  }, [task?.attachments]);

  const taskDescription = useMemo(() => {
    if (
      task?.details &&
      'description' in task.details &&
      task.details.description
    ) {
      return task.details.description;
    }
    return task?.description || '';
  }, [task?.details, task?.description]);

  const isObservationalTool = !!(
    task?.details &&
    'taskType' in task.details &&
    task.details.taskType === 'take-observational-tool'
  );

  const isMedication = !!(
    task?.details &&
    'taskType' in task.details &&
    task.details.taskType === 'give-medication'
  );
  const medicationFrequency = isMedication
    ? (task.details as MedicationTaskDetails).frequency
    : null;
  let medicationFrequencyType: string | null | undefined;
  if (typeof medicationFrequency === 'string') {
    medicationFrequencyType = medicationFrequency;
  } else if (medicationFrequency && typeof medicationFrequency === 'object') {
    medicationFrequencyType = (medicationFrequency as {type?: string}).type;
  } else {
    medicationFrequencyType = null;
  }
  const shouldShowMedicationEndDate =
    String(medicationFrequencyType ?? '')
      .trim()
      .toLowerCase() !== 'once';

  const isCompleted = task
    ? String(task.status).toUpperCase() === 'COMPLETED'
    : false;
  const isCancelled = task
    ? String(task.status).toUpperCase() === 'CANCELLED'
    : false;
  const isPending = task
    ? String(task.status).toUpperCase() === 'PENDING'
    : false;
  const hasLinkedAppointment = Boolean(task?.appointmentId);

  const [otLabel, setOtLabel] = useState<string>(() => {
    if (!isObservationalTool || !task) return '';
    const raw =
      task.observationToolId ??
      (task.details as ObservationalToolTaskDetails).toolType;
    const resolved = resolveObservationalToolLabel(raw as any);
    const looksLikeId = /^[a-f0-9]{24}$/i.test(resolved ?? '');
    return looksLikeId ? 'Observational tool' : resolved;
  });

  useEffect(() => {
    if (isObservationalTool) {
      const otId =
        task.observationToolId ??
        (task.details as ObservationalToolTaskDetails).toolType ??
        null;
      if (otId) {
        observationToolApi
          .get(otId)
          .then(def => {
            if (def?.name) {
              setOtLabel(def.name);
            }
          })
          .catch(() => {});
      }
    }
  }, [isObservationalTool, task?.details, task?.observationToolId]);

  useEffect(() => {
    if (!isObservationalTool) return;
    if (!businesses.length || !services.length) {
      dispatch(fetchBusinesses());
    }
  }, [businesses.length, dispatch, isObservationalTool, services.length]);

  const tabNavigation = navigation.getParent<NavigationProp<TabParamList>>();

  const resolveOtServices = useMemo(() => {
    if (!isObservationalTool) {
      return [] as VetService[];
    }
    const normalizedName = (otLabel ?? '').toLowerCase();
    const speciesToken = (companion?.category ?? '').toLowerCase();
    return services.filter(service => {
      const specialtyMatch = (service.specialty ?? '')
        .toLowerCase()
        .includes('observation');
      const nameMatch = normalizedName
        ? service.name.toLowerCase().includes(normalizedName)
        : false;
      const speciesMatch = speciesToken
        ? service.name.toLowerCase().includes(speciesToken)
        : true;
      return specialtyMatch && (nameMatch || speciesMatch || !normalizedName);
    });
  }, [companion?.category, isObservationalTool, otLabel, services]);

  if (!task) {
    return (
      <LiquidGlassHeaderScreen
        header={
          <Header
            title="Task"
            showBackButton
            onBack={() => navigation.goBack()}
            glass={false}
          />
        }
        contentPadding={theme.spacing['3']}>
        {() => (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Task not found</Text>
          </View>
        )}
      </LiquidGlassHeaderScreen>
    );
  }

  const handleEdit = () => {
    if (!isCompleted && !isCancelled) {
      // Pass source to EditTask so it knows where to go back
      navigation.navigate('EditTask', {taskId: task.id, source});
    }
  };

  const handleReuse = () => {
    // Navigate to AddTask with pre-filled data from current task
    navigation.navigate('AddTask', {
      reuseTaskId: task.id,
      prefillDate: task.date,
    });
  };

  const handleCompleteTask = () => {
    dispatch(markTaskStatus({taskId: task.id, status: 'completed'}));
  };

  const handleOpenOtPreview = () => {
    navigation.navigate('ObservationalToolPreview', {
      taskId: task.id,
      submissionId: task.otSubmissionId ?? undefined,
      toolId:
        task.observationToolId ??
        (task.details as ObservationalToolTaskDetails).toolType,
    });
  };

  const handleBookAppointment = async () => {
    if (!task) {
      return;
    }
    if (hasLinkedAppointment) {
      tabNavigation?.navigate('Appointments', {
        screen: 'ViewAppointment',
        params: {appointmentId: task.appointmentId as string},
      });
      return;
    }
    let submissionId = task.otSubmissionId ?? null;
    if (!submissionId) {
      try {
        const preview = await observationToolApi.previewTaskSubmission(task.id);
        submissionId = preview.id || null;
      } catch {
        Alert.alert(
          i18next.t('alerts.tasks.submissionRequired'),
          i18next.t('alerts.tasks.submissionRequiredBody'),
        );
        return;
      }
    }
    if (!submissionId) {
      Alert.alert(
        i18next.t('alerts.tasks.submissionRequired'),
        i18next.t('alerts.tasks.submissionRequiredBody'),
      );
      return;
    }
    const service = resolveOtServices[0];
    if (!service) {
      Alert.alert(
        i18next.t('alerts.tasks.noProvidersAvailable'),
        i18next.t('alerts.tasks.noProvidersAvailableBody'),
      );
      return;
    }
    const business = businesses.find(biz => biz.id === service.businessId);
    if (!business) {
      Alert.alert(
        i18next.t('alerts.tasks.noProvidersAvailable'),
        i18next.t('alerts.tasks.noProvidersAvailableBody'),
      );
      return;
    }
    const toolType = (task.details as ObservationalToolTaskDetails).toolType;
    tabNavigation?.navigate('Appointments', {
      screen: 'BookingForm',
      params: {
        businessId: business.id,
        serviceId: service.id,
        serviceName: service.name,
        serviceSpecialty: service.specialty ?? 'Observational Tool',
        serviceSpecialtyId: service.specialityId ?? undefined,
        employeeId: undefined,
        appointmentType: 'Observational Tool',
        otContext: {
          toolId: task.observationToolId ?? toolType,
          responses: {},
          submissionId,
        },
      },
    });
  };

  const handleBack = () => {
    // Prefer a simple back to avoid reloading stacks
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    const tabNav = navigation.getParent<NavigationProp<TabParamList>>();
    if (source === 'home') {
      tabNav?.navigate('HomeStack', {screen: 'Home'});
      return;
    }
    tabNav?.navigate('Tasks', {screen: 'TasksMain'});
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

  const getAssignedToName = () => {
    if (!task.assignedTo) return '';
    const selfId = currentUser?.parentId ?? currentUser?.id;
    if (selfId && task.assignedTo === selfId && currentUser) {
      return currentUser.firstName || currentUser.email || 'You';
    }
    return 'Unknown';
  };

  const heroVisual = (() => {
    if (isMedication) {
      return {
        bg: theme.colors.avatarAmberBg,
        ink: theme.colors.avatarAmberInk,
        icon: 'medkit-outline',
      };
    }
    if (isObservationalTool) {
      return {
        bg: theme.colors.avatarVioletBg,
        ink: theme.colors.avatarVioletInk,
        icon: 'pulse-outline',
      };
    }
    return {
      bg: theme.colors.avatarGreenBg,
      ink: theme.colors.avatarGreenInk,
      icon: 'checkbox-outline',
    };
  })();

  const heroSubtitle = [getTaskTypeBreadcrumb(), companion?.name]
    .filter(Boolean)
    .join('  ·  ');

  let badgeStatus: 'completed' | 'cancelled' | 'pending' = 'pending';
  if (isCompleted) {
    badgeStatus = 'completed';
  } else if (isCancelled) {
    badgeStatus = 'cancelled';
  }
  const badgeLabel = String(task.status ?? '').toUpperCase();

  return (
    <LiquidGlassHeaderScreen
      header={
        <Header
          title="Task"
          showBackButton
          onBack={handleBack}
          rightIcon={isCompleted || isCancelled ? undefined : Images.editIcon}
          onRightPress={isCompleted || isCancelled ? undefined : handleEdit}
          glass={false}
        />
      }
      contentPadding={theme.spacing['4']}
      showBottomFade={false}>
      {contentPaddingStyle => (
        <ScrollView
          style={styles.container}
          nestedScrollEnabled
          scrollEnabled={!isPdfInteracting}
          contentContainerStyle={[
            styles.contentContainer,
            contentPaddingStyle,
            {
              paddingTop:
                (typeof contentPaddingStyle?.paddingTop === 'number'
                  ? contentPaddingStyle.paddingTop
                  : theme.spacing['14']) + theme.spacing['4'],
              paddingBottom: theme.spacing['24'],
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {/* Hero */}
          <View style={styles.hero}>
            <View style={[styles.heroTile, {backgroundColor: heroVisual.bg}]}>
              <Ionicons
                name={heroVisual.icon}
                size={25}
                color={heroVisual.ink}
              />
            </View>
            <View style={styles.heroText}>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {task.title}
              </Text>
              {heroSubtitle ? (
                <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>
              ) : null}
            </View>
          </View>

          {/* Status */}
          {badgeLabel ? (
            <Badge
              status={badgeStatus}
              label={badgeLabel}
              size="sm"
              style={styles.statusBadge}
            />
          ) : null}

          {isObservationalTool && !isCancelled && (
            <LiquidGlassCard
              glassEffect="clear"
              padding="4"
              shadow="sm"
              style={styles.otCtaContainer}
              fallbackStyle={styles.otCtaFallback}>
              <Text style={styles.otCtaTitle}>
                {isCompleted
                  ? 'Observational tool completed'
                  : 'Time for an observational tool !'}
              </Text>
              {!isCompleted && (
                <Text style={styles.otCtaSubtitle}>
                  Complete the observational tool to log the latest insights of
                  your companion.
                </Text>
              )}
              {!isCompleted && (
                <View style={styles.otCtaButtonWrapper}>
                  <LiquidGlassButton
                    title="Start Now"
                    onPress={() =>
                      navigation.navigate('ObservationalTool', {
                        taskId: task.id,
                      })
                    }
                    glassEffect="clear"
                    borderRadius="lg"
                    tintColor={theme.colors.secondary}
                    style={styles.otCtaButton}
                    textStyle={styles.otCtaButtonText}
                  />
                </View>
              )}
              {(isCompleted || task.otSubmissionId) && (
                <>
                  <View style={styles.otCtaButtonWrapper}>
                    <LiquidGlassButton
                      title="OT submission"
                      onPress={handleOpenOtPreview}
                      glassEffect="clear"
                      borderRadius="lg"
                      tintColor={theme.colors.secondary}
                      style={styles.otCtaButton}
                      textStyle={styles.otCtaButtonText}
                    />
                  </View>
                  <View style={styles.otCtaButtonWrapper}>
                    <LiquidGlassButton
                      title={
                        hasLinkedAppointment
                          ? 'Show appointment'
                          : 'Book appointment'
                      }
                      onPress={handleBookAppointment}
                      glassEffect="clear"
                      borderRadius="lg"
                      tintColor={theme.colors.secondary}
                      style={styles.otCtaButton}
                      textStyle={styles.otCtaButtonText}
                    />
                  </View>
                </>
              )}
            </LiquidGlassCard>
          )}

          {/* Overview */}
          <View style={styles.detailCard}>
            <ViewField label="Companion" value={companion?.name || ''} first />
            <ViewTouchField label="Task type" value={getTaskTypeBreadcrumb()} />
          </View>

          {/* Medication Task Form */}
          {isMedication && (
            <>
              <View style={styles.detailCard}>
                {/* Task Name */}
                <ViewField label="Task name" value={task.title} first />

                {taskDescription ? (
                  <ViewField
                    label="Task description"
                    value={taskDescription}
                    multiline
                  />
                ) : null}

                {/* Medicine Name */}
                <ViewField
                  label="Medicine name"
                  value={(task.details as MedicationTaskDetails).medicineName}
                />

                {/* Medication Type */}
                <ViewTouchField
                  label="Medication type"
                  value={resolveMedicationTypeLabel(
                    (task.details as MedicationTaskDetails).medicineType,
                  )}
                />

                {/* Dosage */}
                <ViewTouchField
                  label="Dosage"
                  value={`${(task.details as MedicationTaskDetails).dosages.length} dosage${
                    (task.details as MedicationTaskDetails).dosages.length > 1
                      ? 's'
                      : ''
                  }`}
                />

                {/* Medication Frequency */}
                <ViewTouchField
                  label="Medication frequency"
                  value={resolveMedicationFrequencyLabel(
                    (task.details as MedicationTaskDetails).frequency,
                  )}
                />
              </View>

              {/* Dose schedule */}
              {(task.details as MedicationTaskDetails).dosages.length > 0 && (
                <View style={styles.doseSection}>
                  <Text style={styles.doseHeading}>Doses</Text>
                  {(task.details as MedicationTaskDetails).dosages.map(
                    (dosage, index) => (
                      <View
                        key={dosage.id}
                        style={styles.doseRow}
                        testID={`dose-row-${index}`}>
                        <View
                          style={
                            isCompleted
                              ? styles.doseCheckDone
                              : styles.doseCheckEmpty
                          }>
                          {isCompleted ? (
                            <Ionicons
                              name="checkmark"
                              size={14}
                              color={theme.colors.white}
                            />
                          ) : null}
                        </View>
                        <Text style={styles.doseLabel}>{dosage.label}</Text>
                        <Text style={styles.doseMeta}>
                          {formatTime(dosage.time)}
                        </Text>
                      </View>
                    ),
                  )}
                </View>
              )}

              {/* Start and End Date */}
              <View style={styles.dateTimeRow}>
                <View style={styles.dateTimeField}>
                  <TouchableInput
                    label="Start Date"
                    value={formatDateForDisplay(
                      new Date(
                        (task.details as MedicationTaskDetails).startDate,
                      ),
                    )}
                    onPress={() => {}} // View only
                    rightComponent={
                      <Image
                        source={Images.calendarIcon}
                        style={iconStyles.calendarIcon}
                      />
                    }
                  />
                </View>

                {shouldShowMedicationEndDate ? (
                  <View style={styles.dateTimeField}>
                    <TouchableInput
                      label="End Date"
                      value={
                        (task.details as MedicationTaskDetails).endDate
                          ? formatDateForDisplay(
                              new Date(
                                (task.details as MedicationTaskDetails)
                                  .endDate!,
                              ),
                            )
                          : ''
                      }
                      onPress={() => {}} // View only
                      rightComponent={
                        <Image
                          source={Images.calendarIcon}
                          style={iconStyles.calendarIcon}
                        />
                      }
                    />
                  </View>
                ) : null}
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
            <View style={styles.detailCard}>
              {/* Task Name */}
              <ViewField label="Task name" value={task.title} first />

              {taskDescription ? (
                <ViewField
                  label="Task description"
                  value={taskDescription}
                  multiline
                />
              ) : null}

              {/* Observational Tool */}
              <ViewTouchField
                label="Select observational tool"
                value={otLabel}
              />

              {/* Date */}
              <ViewTouchField
                label="Date"
                value={formatDateForDisplay(new Date(task.date))}
              />

              {/* Time */}
              <ViewTouchField label="Time" value={formatTime(task.time)} />

              {/* Task Frequency */}
              <ViewTouchField
                label="Task frequency"
                value={resolveTaskFrequencyLabel(task.frequency)}
              />

              {/* Assign Task */}
              <ViewField label="Assign task" value={getAssignedToName()} />
            </View>
          )}

          {/* Simple Task Form (Custom, Hygiene, Dietary) */}
          {!isMedication && !isObservationalTool && (
            <View style={styles.detailCard}>
              {/* Task Name */}
              <ViewField label="Task name" value={task.title} first />

              {/* Task Description */}
              {taskDescription ? (
                <ViewField
                  label="Task description"
                  value={taskDescription}
                  multiline
                />
              ) : null}

              {/* Date and Time */}
              <ViewDateTimeRow
                dateLabel="Date"
                dateValue={formatDateForDisplay(new Date(task.date))}
                timeLabel="Time"
                timeValue={formatTime(task.time)}
              />

              {/* Task Frequency */}
              <ViewTouchField
                label="Task frequency"
                value={resolveTaskFrequencyLabel(task.frequency)}
              />

              {/* Assign Task */}
              <ViewField label="Assign task" value={getAssignedToName()} />
            </View>
          )}

          {/* Reminder Section */}
          <View style={styles.toggleSection}>
            <Text style={styles.toggleLabel}>Reminder</Text>
            <Switch
              value={task.reminderEnabled}
              onValueChange={() => {}} // View only
              trackColor={{
                false: theme.colors.borderMuted,
                true: theme.colors.primary,
              }}
              thumbColor={theme.colors.white}
              disabled={true}
            />
          </View>

          {task.reminderEnabled && task.reminderOptions && (
            <View style={styles.reminderPillsContainer}>
              <View style={[styles.reminderPill, styles.reminderPillSelected]}>
                <Text
                  style={[
                    styles.reminderPillText,
                    styles.reminderPillTextSelected,
                  ]}>
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
              trackColor={{
                false: theme.colors.borderMuted,
                true: theme.colors.primary,
              }}
              thumbColor={theme.colors.white}
              disabled={true}
            />
          </View>

          {task.syncWithCalendar && task.calendarProvider && (
            <View style={styles.fieldGroup}>
              <TouchableInput
                label="Calendar provider"
                value={getCalendarProviderLabel(task.calendarProvider)}
                onPress={() => {
                  if (task.calendarEventId) {
                    openCalendarEvent(
                      task.calendarEventId,
                      task.dueAt ?? task.date,
                    );
                  }
                }}
                rightComponent={
                  <Image
                    source={Images.dropdownIcon}
                    style={iconStyles.dropdownIcon}
                  />
                }
              />
            </View>
          )}

          {/* Attach Documents */}
          <View style={styles.toggleSection}>
            <Text style={styles.toggleLabel}>Attach document</Text>
            <Switch
              value={task.attachDocuments}
              onValueChange={() => {}} // View only
              trackColor={{
                false: theme.colors.borderMuted,
                true: theme.colors.primary,
              }}
              thumbColor={theme.colors.white}
              disabled={true}
            />
          </View>

          {task.attachDocuments && preparedAttachments.length > 0 && (
            <View style={styles.fieldGroup}>
              <DocumentAttachmentViewer
                attachments={preparedAttachments as any}
                documentTitle={task.title}
                companionName={companion?.name}
                onPdfTouchStart={() => setIsPdfInteracting(true)}
                onPdfTouchEnd={() => setIsPdfInteracting(false)}
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

          {/* Complete Button for non-observational tool tasks */}
          {!isObservationalTool && isPending && !isCancelled && (
            <View style={styles.completeButtonContainer}>
              <LiquidGlassButton
                title="Mark complete"
                onPress={handleCompleteTask}
                glassEffect="clear"
                borderRadius="button"
                tintColor={theme.colors.cta}
                leftIcon={
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={theme.colors.ctaText}
                  />
                }
                style={styles.completeButton}
                textStyle={styles.completeButtonText}
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

          {/* Cancelled Badge */}
          {isCancelled && task.statusUpdatedAt && (
            <View style={styles.cancelledBadge}>
              <Text style={styles.cancelledText}>
                Cancelled on{' '}
                {formatDateForDisplay(new Date(task.statusUpdatedAt))}
              </Text>
            </View>
          )}

          {/* Reuse Button for Completed Tasks */}
          {isCompleted && (
            <View style={styles.reuseButtonContainer}>
              <LiquidGlassButton
                title="Reuse"
                onPress={handleReuse}
                glassEffect="clear"
                borderRadius="lg"
                tintColor={theme.colors.secondary}
                style={styles.reuseButton}
                textStyle={styles.reuseButtonText}
              />
            </View>
          )}
        </ScrollView>
      )}
    </LiquidGlassHeaderScreen>
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
      paddingHorizontal: theme.spacing['4'],
      paddingBlock: theme.spacing['4'],
    },
    otCtaContainer: {
      marginBottom: theme.spacing['6'],
      gap: theme.spacing['3'],
      backgroundColor: theme.colors.cardBackground,
    },
    otCtaFallback: {
      backgroundColor: theme.colors.cardBackground,
      borderWidth: Platform.OS === 'android' ? 1 : 0,
      borderColor: theme.colors.borderMuted,
      boxShadow: `0px 1px 6px ${theme.colors.neutralShadow}`,
    },
    otCtaTitle: {
      ...theme.typography.titleMedium,
      color: theme.colors.secondary,
    },
    otCtaSubtitle: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
    },
    otCtaButtonWrapper: {
      alignSelf: 'flex-start',
    },
    otCtaButton: {
      alignSelf: 'flex-start',
    },
    otCtaButtonText: {
      ...theme.typography.buttonH6Clash19,
      color: theme.colors.ctaText,
      textAlign: 'center',
    },
    ...formStyles,
    // Hero
    hero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3.5'],
      marginBottom: theme.spacing['4'],
    },
    heroTile: {
      width: 56,
      height: 56,
      borderRadius: theme.borderRadius.cardSmall,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroText: {
      flex: 1,
    },
    heroTitle: {
      ...theme.typography.emptyStateTitle,
      color: theme.colors.ink,
    },
    heroSubtitle: {
      ...theme.typography.body13,
      color: theme.colors.inkFaint,
      marginTop: theme.spacing['1'],
    },
    statusBadge: {
      marginBottom: theme.spacing['5'],
    },
    // Detail group card (hairline-divided label/value rows)
    detailCard: {
      backgroundColor: theme.colors.screen2,
      borderRadius: theme.borderRadius.cardSmall,
      paddingHorizontal: theme.spacing['4'],
      marginBottom: theme.spacing['4'],
    },
    // Dose schedule
    doseSection: {
      marginBottom: theme.spacing['4'],
    },
    doseHeading: {
      ...theme.typography.labelMdBold,
      color: theme.colors.ink,
      marginBottom: theme.spacing['3'],
    },
    doseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3'],
      backgroundColor: theme.colors.screen,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      borderRadius: theme.borderRadius.field,
      paddingVertical: theme.spacing['3'],
      paddingHorizontal: theme.spacing['3.5'],
      marginBottom: theme.spacing['2'],
    },
    doseCheckDone: {
      width: 24,
      height: 24,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.success,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doseCheckEmpty: {
      width: 24,
      height: 24,
      borderRadius: theme.borderRadius.full,
      borderWidth: 2,
      borderColor: theme.colors.divider,
    },
    doseLabel: {
      ...theme.typography.labelSmall,
      color: theme.colors.inkBody,
      flex: 1,
    },
    doseMeta: {
      ...theme.typography.body13,
      color: theme.colors.inkFaint,
      fontVariant: ['tabular-nums'],
    },
    // Toggle rows (warm-bone overrides of the shared form styles)
    toggleSection: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing['2'],
      marginBottom: theme.spacing['2'],
    },
    toggleLabel: {
      ...theme.typography.label,
      color: theme.colors.inkBody,
    },
    reminderPillSelected: {
      backgroundColor: theme.colors.blueSoft,
      borderColor: theme.colors.blue,
    },
    reminderPillTextSelected: {
      color: theme.colors.navActive,
      fontWeight: '700',
    },
    // Input and Label styles - matching DocumentForm
    input: {
      marginBottom: theme.spacing['4'],
    },
    dropdownIcon: {
      width: theme.spacing['5'],
      height: theme.spacing['5'],
      resizeMode: 'contain',
      tintColor: theme.colors.textSecondary,
    },
    calendarIcon: {
      width: theme.spacing['4.5'],
      height: theme.spacing['4.5'],
      resizeMode: 'contain',
      tintColor: theme.colors.textSecondary,
    },
    label: {
      ...theme.typography.inputLabel,
      color: theme.colors.secondary,
    },
    // Error styles - matching DocumentForm
    errorText: {
      ...theme.typography.labelXxsBold,
      color: theme.colors.error,
      marginTop: theme.spacing['1'],
      marginBottom: theme.spacing['3'],
      marginLeft: theme.spacing['1'],
    },
    textArea: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    completedBadge: {
      backgroundColor: theme.colors.successSurface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing['3'],
      marginTop: theme.spacing['4'],
      alignItems: 'center',
    },
    completedText: {
      ...theme.typography.bodyMedium,
      color: theme.colors.success,
    },
    cancelledBadge: {
      backgroundColor: theme.colors.errorSurface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing['3'],
      marginTop: theme.spacing['4'],
      alignItems: 'center',
    },
    cancelledText: {
      ...theme.typography.bodyMedium,
      color: theme.colors.error,
      fontWeight: '600',
    },
    completeButtonContainer: {
      marginTop: theme.spacing['6'],
      marginBottom: theme.spacing['4'],
    },
    completeButton: {
      width: '100%',
      height: 56,
    },
    completeButtonText: {
      ...theme.typography.buttonH6Clash19,
      color: theme.colors.ctaText,
      textAlign: 'center',
    },
    reuseButtonContainer: {
      marginTop: theme.spacing['6'],
      marginBottom: theme.spacing['4'],
    },
    reuseButton: {
      width: '100%',
      height: 56,
    },
    reuseButtonText: {
      ...theme.typography.buttonH6Clash19,
      color: theme.colors.ctaText,
      textAlign: 'center',
    },
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing['4'],
    },
    errorContainerText: {
      ...theme.typography.bodyMedium,
      color: theme.colors.error,
    },
  });
};

export default TaskViewScreen;
