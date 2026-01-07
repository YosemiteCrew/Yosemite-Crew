import {Alert, Linking, Platform} from 'react-native';
import RNCalendarEvents from 'react-native-calendar-events';
import type {Task} from '@/features/tasks/types';

const buildIsoDate = (date: string, time?: string) => {
  if (date && time) {
    return new Date(`${date}T${time}`).toISOString();
  }
  if (date) {
    return new Date(`${date}T09:00:00`).toISOString();
  }
  return new Date().toISOString();
};

const ensureCalendarPermission = async (): Promise<boolean> => {
  const promptForSettings = () => {
    Alert.alert(
      'Calendar permission needed',
      'Enable calendar access to sync tasks with your calendar.',
      [
        {text: 'Not now', style: 'cancel'},
        {text: 'Open settings', onPress: () => { Linking.openSettings?.(); }},
      ],
    );
  };

  if (
    !RNCalendarEvents ||
    typeof RNCalendarEvents.checkPermissions !== 'function' ||
    typeof RNCalendarEvents.requestPermissions !== 'function'
  ) {
    console.warn('[Calendar] RNCalendarEvents is unavailable or not linked');
    promptForSettings();
    return false;
  }

  try {
    const status = await RNCalendarEvents.checkPermissions();
    if (status === 'authorized') return true;

    const requested = await RNCalendarEvents.requestPermissions();
    if (requested === 'authorized') return true;

    promptForSettings();
    return false;
  } catch (error) {
    console.warn('[Calendar] Permission check failed', error);
    promptForSettings();
    return false;
  }
};

const buildRecurrenceParams = (
  task: Task
): {recurrence?: 'daily' | 'weekly' | 'monthly' | 'yearly'; recurrenceRule?: any} => {
  const freq = (task.frequency || '').toString().toLowerCase();
  let recurrenceFreq: 'daily' | 'weekly' | 'monthly' | 'yearly' | undefined;

  if (freq === 'daily' || freq === 'every-day') {
    recurrenceFreq = 'daily';
  } else if (freq === 'weekly') {
    recurrenceFreq = 'weekly';
  } else if (freq === 'monthly') {
    recurrenceFreq = 'monthly';
  }

  if (!recurrenceFreq) {
    console.log('[Calendar] No valid recurrence frequency found');
    return {};
  }

  // Check for end date in medication task details
  const endDate =
    task.details && 'endDate' in task.details && task.details.endDate
      ? task.details.endDate
      : undefined;

  console.log('[Calendar] Recurrence params:', {
    frequency: recurrenceFreq,
    hasEndDate: !!endDate,
    endDate: endDate,
  });

  // If no end date, use simple recurrence string (more reliable)
  if (!endDate) {
    return {recurrence: recurrenceFreq};
  }

  // If end date exists, try to use recurrenceRule
  // Format for iOS: {frequency, interval, endDate}
  return {
    recurrence: recurrenceFreq, // Fallback
    recurrenceRule: {
      frequency: recurrenceFreq,
      interval: 1,
      endDate: endDate,
    },
  };
};

const parseDosageTime = (timeString: string): {hours: number; minutes: number} | null => {
  try {
    let hours: number, minutes: number;

    if (timeString.includes('T')) {
      // ISO format
      const date = new Date(timeString);
      hours = date.getHours();
      minutes = date.getMinutes();
    } else if (timeString.includes(':')) {
      // Time-only format (HH:mm or HH:mm:ss)
      const parts = timeString.split(':').map(Number);
      hours = parts[0];
      minutes = parts[1];
    } else {
      return null;
    }

    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return null;
    }

    return {hours, minutes};
  } catch {
    return null;
  }
};

const buildDosageEventNotes = (
  task: Task,
  dosageLabel: string,
  companionName?: string,
  assignedToName?: string
): string => {
  const parts: string[] = [];

  if (task.description) {
    parts.push(`📝 ${task.description}`, '');
  }

  if (task.additionalNote) {
    parts.push(`💡 Note: ${task.additionalNote}`, '');
  }

  if ('medicineName' in task.details && task.details.medicineName) {
    const medicationParts = [
      `💊 MEDICATION`,
      `   Medicine: ${task.details.medicineName}`,
    ];
    if ('medicineType' in task.details && task.details.medicineType) {
      medicationParts.push(`   Type: ${task.details.medicineType}`);
    }
    medicationParts.push(`   Dosage: ${dosageLabel}`, '');
    parts.push(...medicationParts);
  }

  if (companionName) {
    parts.push(`\n👤 Companion: ${companionName}`);
  }

  if (assignedToName) {
    parts.push(`👥 Assigned to: ${assignedToName}`);
  }

  parts.push('\n\nCreated with Yosemite Crew');

  return parts.join('\n');
};

const createSingleDosageEvent = async (
  task: Task,
  dosage: {id: string; label: string; time: string},
  alarms: Array<{date: number}> | undefined,
  recurrenceParams: ReturnType<typeof buildRecurrenceParams>,
  companionName?: string,
  assignedToName?: string
): Promise<string | null> => {
  const timeInfo = parseDosageTime(dosage.time);
  if (!timeInfo) {
    console.warn('[Calendar] Invalid dosage time:', dosage.time);
    return null;
  }

  const eventDate = new Date(task.date || new Date());
  eventDate.setHours(timeInfo.hours, timeInfo.minutes, 0, 0);
  const eventEnd = new Date(eventDate.getTime() + 30 * 60 * 1000);

  const eventTitle = `${task.title} - ${dosage.label}`;
  const eventNotes = buildDosageEventNotes(task, dosage.label, companionName, assignedToName);

  console.log('[Calendar] Creating dosage event:', {
    dosageLabel: dosage.label,
    time: dosage.time,
    startDate: eventDate.toISOString(),
    endDate: eventEnd.toISOString(),
    recurrence: recurrenceParams.recurrence,
    recurrenceRule: recurrenceParams.recurrenceRule,
  });

  const eventId = await RNCalendarEvents.saveEvent(eventTitle, {
    startDate: eventDate.toISOString(),
    endDate: eventEnd.toISOString(),
    notes: eventNotes,
    allDay: false,
    alarms,
    ...(recurrenceParams.recurrence ? {recurrence: recurrenceParams.recurrence} : {}),
    ...(recurrenceParams.recurrenceRule ? {recurrenceRule: recurrenceParams.recurrenceRule} : {}),
    calendarId: task.calendarProvider,
  });

  if (eventId) {
    console.log('[Calendar] Dosage event created:', eventId);
  }
  return eventId;
};

const createDosageCalendarEvents = async (
  task: Task,
  companionName?: string,
  assignedToName?: string
): Promise<string | null> => {
  if (!task.details || !('dosages' in task.details) || !Array.isArray(task.details.dosages)) {
    return null;
  }

  const dosages = task.details.dosages as Array<{id: string; label: string; time: string}>;
  const eventIds: string[] = [];

  const recurrenceParams = buildRecurrenceParams(task);
  let alarms: Array<{date: number}> | undefined;
  if (task.reminderOffsetMinutes == null) {
    alarms = task.reminderOptions ? [{date: -15}] : undefined;
  } else {
    alarms = [{date: -Math.abs(task.reminderOffsetMinutes)}];
  }

  try {
    for (const dosage of dosages) {
      const eventId = await createSingleDosageEvent(
        task,
        dosage,
        alarms,
        recurrenceParams,
        companionName,
        assignedToName
      );

      if (eventId) {
        eventIds.push(eventId);
      }
    }

    if (eventIds.length === 0) {
      console.warn('[Calendar] No dosage events created');
      return null;
    }

    const joinedIds = eventIds.join(',');
    console.log('[Calendar] All dosage events created:', {count: eventIds.length, ids: joinedIds});
    return joinedIds;
  } catch (error) {
    console.error('[Calendar] Failed to create dosage events:', error);
    Alert.alert('Calendar', 'Unable to add medication dosages to your calendar.');
    return null;
  }
};

export const createCalendarEventForTask = async (
  task: Task,
  companionName?: string,
  assignedToName?: string
): Promise<string | null> => {
  const safeCalendarId =
    typeof task.calendarProvider === 'string' &&
    ['google', 'icloud', 'loading'].includes(task.calendarProvider.toLowerCase())
      ? undefined
      : task.calendarProvider;
  const taskWithCalendar: Task = {...task, calendarProvider: safeCalendarId};

  console.log('[Calendar] Creating event for task:', {
    taskId: taskWithCalendar.id,
    title: taskWithCalendar.title,
    syncWithCalendar: taskWithCalendar.syncWithCalendar,
    calendarProvider: taskWithCalendar.calendarProvider,
    companionName,
    assignedToName,
  });

  const hasPermission = await ensureCalendarPermission();
  if (!hasPermission) {
    console.warn('[Calendar] Permission denied');
    return null;
  }

  console.log('[Calendar] Permission granted');

  // Check if this is a medication task with multiple dosages
  const isMedicationWithDosages =
    taskWithCalendar.details &&
    'medicineName' in taskWithCalendar.details &&
    'dosages' in taskWithCalendar.details &&
    Array.isArray(taskWithCalendar.details.dosages) &&
    taskWithCalendar.details.dosages.length > 0;

  if (isMedicationWithDosages) {
    console.log('[Calendar] Creating multiple events for medication dosages');
    return createDosageCalendarEvents(taskWithCalendar, companionName, assignedToName);
  }

  try {
    const startDate = taskWithCalendar.dueAt ?? buildIsoDate(taskWithCalendar.date, taskWithCalendar.time);
    const start = new Date(startDate);
    const end = new Date(start.getTime() + 30 * 60 * 1000);

    let alarms: Array<{date: number}> | undefined;
    if (taskWithCalendar.reminderOffsetMinutes == null) {
      alarms = taskWithCalendar.reminderOptions ? [{date: -15}] : undefined;
    } else {
      alarms = [{date: -Math.abs(taskWithCalendar.reminderOffsetMinutes)}];
    }

    const recurrenceParams = buildRecurrenceParams(taskWithCalendar);

    // Build comprehensive event description
    const buildEventNotes = (): string => {
      const parts: string[] = [];

      // Add task description
      if (taskWithCalendar.description) {
        parts.push(`📝 ${taskWithCalendar.description}`, '');
      }

      // Add additional notes
      if (taskWithCalendar.additionalNote) {
        parts.push(`💡 Note: ${taskWithCalendar.additionalNote}`, '');
      }

      // Add medication details
      if (taskWithCalendar.details && 'medicineName' in taskWithCalendar.details && taskWithCalendar.details.medicineName) {
        const medicationParts = [
          `💊 MEDICATION`,
          `   Medicine: ${taskWithCalendar.details.medicineName}`,
        ];
        if ('medicineType' in taskWithCalendar.details && taskWithCalendar.details.medicineType) {
          medicationParts.push(`   Type: ${taskWithCalendar.details.medicineType}`);
        }
        if ('dosages' in taskWithCalendar.details && taskWithCalendar.details.dosages && taskWithCalendar.details.dosages.length > 0) {
          medicationParts.push(`   Dosage Schedule:`);
          taskWithCalendar.details.dosages.forEach((d: any) => {
            medicationParts.push(`      • ${d.label} at ${d.time}`);
          });
        }
        medicationParts.push('');
        parts.push(...medicationParts);
      }

      // Add observational tool info
      if (taskWithCalendar.details && 'toolType' in taskWithCalendar.details && taskWithCalendar.details.toolType) {
        parts.push(`📋 Observational Tool: ${taskWithCalendar.details.toolType}`, '');
      }

      // Add companion info
      if (companionName) {
        parts.push(`\n👤 Companion: ${companionName}`);
      }

      // Add assigned info
      if (assignedToName) {
        parts.push(`👥 Assigned to: ${assignedToName}`);
      }

      // Add Yosemite Crew branding
      parts.push('\n\nCreated with Yosemite Crew');

      return parts.join('\n');
    };

    const eventTitle = taskWithCalendar.title || 'Yosemite Crew Task';
    const eventNotes = buildEventNotes();

    console.log('[Calendar] Saving event with:', {
      title: eventTitle,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      calendarId: taskWithCalendar.calendarProvider,
      hasAlarms: !!alarms,
      recurrence: recurrenceParams.recurrence,
      recurrenceRule: recurrenceParams.recurrenceRule,
      notesPreview: eventNotes.substring(0, 100) + '...',
    });

    const eventId = await RNCalendarEvents.saveEvent(eventTitle, {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      notes: eventNotes,
      allDay: false,
      alarms,
      ...(recurrenceParams.recurrence ? {recurrence: recurrenceParams.recurrence} : {}),
      ...(recurrenceParams.recurrenceRule ? {recurrenceRule: recurrenceParams.recurrenceRule} : {}),
      calendarId: taskWithCalendar.calendarProvider,
    });

    console.log('[Calendar] Event created successfully:', eventId);
    return eventId ?? null;
  } catch (error) {
    console.error('[Calendar] Failed to create event:', error);
    Alert.alert('Calendar', 'Unable to add this task to your calendar.');
    return null;
  }
};

export const removeCalendarEvents = async (eventIdString: string | null | undefined): Promise<void> => {
  if (!eventIdString) {
    console.log('[Calendar] No event IDs to remove');
    return;
  }

  const hasPermission = await ensureCalendarPermission();
  if (!hasPermission) {
    console.warn('[Calendar] Permission denied for removing events');
    return;
  }

  // Handle comma-separated event IDs (for medication tasks with multiple dosages)
  const eventIds = eventIdString.split(',').map(id => id.trim()).filter(Boolean);

  console.log('[Calendar] Removing calendar events:', {count: eventIds.length, ids: eventIds});

  try {
    for (const eventId of eventIds) {
      try {
        await RNCalendarEvents.removeEvent(eventId);
        console.log('[Calendar] Removed event:', eventId);
      } catch (error) {
        console.warn('[Calendar] Failed to remove event:', eventId, error);
        // Continue removing other events even if one fails
      }
    }
  } catch (error) {
    console.error('[Calendar] Failed to remove calendar events:', error);
  }
};

export const openCalendarEvent = async (eventId: string, fallbackDate?: string | Date) => {
  const hasPermission = await ensureCalendarPermission();
  if (!hasPermission) {
    return;
  }

  try {
    const event = await RNCalendarEvents.findEventById(eventId);
    if (event?.calendar) {
      // Library does not provide a native "open" UI; fallback to opening calendar app near event time
    }
    let targetDate: Date;
    if (event?.startDate) {
      targetDate = new Date(event.startDate);
    } else if (fallbackDate) {
      targetDate = new Date(fallbackDate);
    } else {
      targetDate = new Date();
    }

    const url =
      Platform.OS === 'ios'
        ? `calshow:${Math.floor(targetDate.getTime() / 1000)}`
        : `content://com.android.calendar/time/${targetDate.getTime()}`;

    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Calendar', 'Event saved. Please open your calendar app to view it.');
    }
  } catch (error) {
    console.warn('[Calendar] Failed to open event', error);
    Alert.alert('Calendar', 'Event saved. Please open your calendar app to view it.');
  }
};
