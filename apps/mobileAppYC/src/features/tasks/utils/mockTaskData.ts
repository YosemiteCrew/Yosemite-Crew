// src/utils/mockTaskData.ts - Mock data for testing task module
import type {Task} from '@/features/tasks/types';

const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);

const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);

const formatTime = (hours: number, minutes: number = 0): string => {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const formatDateToISOString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const MOCK_TASKS: Task[] = [
  // Health - Medication Tasks
  {
    id: 'task-001',
    companionId: 'companion-1',
    category: 'health',
    subcategory: 'vaccination',
    title: 'Give Allergy Medication',
    date: formatDateToISOString(today),
    time: formatTime(9, 0),
    frequency: 'daily',
    status: 'pending',
    reminderEnabled: true,
    reminderOptions: '30-mins-prior',
    syncWithCalendar: false,
    attachDocuments: false,
    attachments: [],
    createdAt: yesterday.toISOString(),
    updatedAt: yesterday.toISOString(),
    details: {
      taskType: 'give-medication',
      medicineName: 'Allergy Relief Tablets',
      medicineType: 'tablets-pills',
      dosages: [
        {
          id: 'dose-001',
          label: 'Dose 1',
          time: formatTime(9, 0),
        },
      ],
      frequency: 'daily',
      startDate: today.toISOString(),
    },
  },
  {
    id: 'task-002',
    companionId: 'companion-1',
    category: 'health',
    subcategory: 'parasite-prevention',
    title: 'Flea and Tick Prevention',
    date: formatDateToISOString(today),
    time: formatTime(14, 0),
    frequency: 'weekly',
    status: 'pending',
    reminderEnabled: true,
    reminderOptions: '1-day-prior',
    syncWithCalendar: false,
    attachDocuments: false,
    attachments: [],
    createdAt: yesterday.toISOString(),
    updatedAt: yesterday.toISOString(),
    details: {
      taskType: 'give-medication',
      medicineName: 'Simparica Trio',
      medicineType: 'capsule',
      dosages: [
        {
          id: 'dose-002',
          label: 'Dose 1',
          time: formatTime(14, 0),
        },
      ],
      frequency: 'weekly',
      startDate: today.toISOString(),
    },
  },

  // Hygiene Tasks
  {
    id: 'task-003',
    companionId: 'companion-1',
    category: 'hygiene',
    title: 'Brush Teeth',
    date: formatDateToISOString(today),
    time: formatTime(20, 0),
    frequency: 'daily',
    status: 'pending',
    reminderEnabled: true,
    reminderOptions: '12-hours-prior',
    syncWithCalendar: false,
    attachDocuments: false,
    attachments: [],
    createdAt: yesterday.toISOString(),
    updatedAt: yesterday.toISOString(),
    details: {
      taskType: 'dental-care',
    },
  },
  {
    id: 'task-004',
    companionId: 'companion-1',
    category: 'hygiene',
    title: 'Take Bath',
    date: formatDateToISOString(tomorrow),
    time: formatTime(10, 0),
    frequency: 'weekly',
    status: 'pending',
    reminderEnabled: true,
    reminderOptions: '1-day-prior',
    syncWithCalendar: false,
    attachDocuments: false,
    attachments: [],
    createdAt: yesterday.toISOString(),
    updatedAt: yesterday.toISOString(),
    details: {
      taskType: 'give-bath',
    },
  },

  // Dietary Tasks
  {
    id: 'task-005',
    companionId: 'companion-1',
    category: 'dietary',
    title: 'Morning Meals',
    date: formatDateToISOString(today),
    time: formatTime(8, 0),
    frequency: 'daily',
    status: 'completed',
    completedAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 8, 15).toISOString(),
    reminderEnabled: true,
    reminderOptions: null,
    syncWithCalendar: false,
    attachDocuments: false,
    attachments: [],
    createdAt: yesterday.toISOString(),
    updatedAt: today.toISOString(),
    details: {
      taskType: 'meals',
    },
  },
  {
    id: 'task-006',
    companionId: 'companion-1',
    category: 'dietary',
    title: 'Evening Meals',
    date: formatDateToISOString(today),
    time: formatTime(18, 0),
    frequency: 'daily',
    status: 'pending',
    reminderEnabled: true,
    reminderOptions: '30-mins-prior',
    syncWithCalendar: false,
    attachDocuments: false,
    attachments: [],
    createdAt: yesterday.toISOString(),
    updatedAt: yesterday.toISOString(),
    details: {
      taskType: 'meals',
    },
  },

  // Custom Tasks
  {
    id: 'task-007',
    companionId: 'companion-1',
    category: 'custom',
    title: 'Vet Appointment Follow-up Call',
    additionalNote: 'Call vet clinic to check on test results',
    date: formatDateToISOString(tomorrow),
    time: formatTime(11, 0),
    frequency: 'once',
    status: 'pending',
    reminderEnabled: true,
    reminderOptions: '1-day-prior',
    syncWithCalendar: false,
    attachDocuments: false,
    attachments: [],
    createdAt: yesterday.toISOString(),
    updatedAt: yesterday.toISOString(),
    details: {},
  },
];

/**
 * Get mock tasks for a specific companion
 * @param companionId - The companion ID to get tasks for
 * @returns Array of mock tasks with companionId set
 */
export function getMockTasksForCompanion(companionId: string): Task[] {
  return MOCK_TASKS.map(task => ({
    ...task,
    companionId,
  }));
}
