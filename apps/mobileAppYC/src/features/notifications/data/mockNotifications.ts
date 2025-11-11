import type {Notification} from '../types';

export const mockNotifications: Notification[] = [
  {
    id: 'notif_1',
    companionId: 'companion_1', // Kizie (Cat)
    title: 'Daily walk reminder',
    description: "Kizie hasn't had her daily walk yet. Let's get her moving!",
    category: 'health',
    icon: 'healthIcon',
    timestamp: new Date(Date.now() - 30 * 60000).toISOString(), // 30 mins ago
    status: 'unread',
    priority: 'medium',
    relatedType: 'task',
    relatedId: 'task_1',
  },
  {
    id: 'notif_2',
    companionId: 'companion_2', // Oscar (Dog)
    title: 'Message from your vet',
    description: 'New message from your vet regarding Oscar\'s recent check-up.',
    category: 'messages',
    icon: 'chatIcon',
    timestamp: new Date(Date.now() - 3 * 3600000).toISOString(), // 3 hours ago
    status: 'unread',
    priority: 'high',
    relatedType: 'message',
  },
  {
    id: 'notif_3',
    companionId: 'companion_2', // Oscar (Dog)
    title: 'Flea treatment due',
    description: "Oscar's flea treatment is due today. Keep her protected from pests.",
    category: 'health',
    icon: 'syringeIcon',
    timestamp: new Date(Date.now() - 12 * 3600000).toISOString(), // 12 hours ago
    status: 'unread',
    priority: 'urgent',
    relatedType: 'task',
    relatedId: 'task_2',
  },
  {
    id: 'notif_4',
    companionId: 'companion_2', // Oscar (Dog)
    title: 'Grooming appointment confirmed',
    description: "Oscar's grooming appointment is confirmed for tomorrow at 4:00 PM.",
    category: 'appointments',
    icon: 'calendarIconNotification',
    timestamp: new Date(Date.now() - 2 * 86400000).toISOString(), // 2 days ago
    status: 'read',
    priority: 'medium',
    relatedType: 'appointment',
    relatedId: 'apt_1',
  },
  {
    id: 'notif_5',
    companionId: 'companion_1', // Kizie (Cat)
    title: 'Vaccination due soon',
    description: "Kizie's next vaccination is due this week. Schedule an appointment to keep him protected.",
    category: 'health',
    icon: 'syringeIcon',
    timestamp: new Date(Date.now() - 1 * 86400000).toISOString(), // 1 day ago
    status: 'read',
    priority: 'high',
    relatedType: 'task',
    relatedId: 'task_3',
  },
  {
    id: 'notif_6',
    companionId: 'companion_1', // Kizie (Cat)
    title: 'Exercise reminder',
    description: "Time for Kizie's daily exercises. Let's keep her on track with her recovery.",
    category: 'health',
    icon: 'healthIcon',
    timestamp: new Date(Date.now() - 10 * 86400000).toISOString(), // 10 days ago
    status: 'read',
    priority: 'low',
    relatedType: 'task',
    relatedId: 'task_4',
  },
  {
    id: 'notif_7',
    companionId: 'companion_2', // Oscar (Dog)
    title: 'Invoice ready for download',
    description: 'Your invoice for the recent appointment is ready to download.',
    category: 'payment',
    icon: 'downloadInvoice',
    timestamp: new Date(Date.now() - 5 * 86400000).toISOString(), // 5 days ago
    status: 'read',
    priority: 'medium',
    relatedType: 'payment',
    relatedId: 'inv_1',
  },
  {
    id: 'notif_8',
    companionId: 'companion_1', // Kizie (Cat)
    title: 'Diet plan update',
    description: "Kizie's new dietary plan has been updated. Review the changes to ensure proper nutrition.",
    category: 'dietary',
    icon: 'dietryIcon',
    timestamp: new Date(Date.now() - 7 * 86400000).toISOString(), // 7 days ago
    status: 'read',
    priority: 'medium',
    relatedType: 'task',
    relatedId: 'task_5',
  },
  {
    id: 'notif_9',
    companionId: 'companion_2', // Oscar (Dog)
    title: 'Hygiene check-up',
    description: "Oscar's hygiene check-up is due. Schedule a grooming session to keep him fresh.",
    category: 'hygiene',
    icon: 'hygeineIcon',
    timestamp: new Date(Date.now() - 8 * 86400000).toISOString(), // 8 days ago
    status: 'read',
    priority: 'low',
    relatedType: 'task',
    relatedId: 'task_6',
  },
  {
    id: 'notif_10',
    companionId: 'companion_1', // Kizie (Cat)
    title: 'Document uploaded',
    description: 'Your vaccination certificate for Kizie has been uploaded and verified.',
    category: 'documents',
    icon: 'documentIcon',
    timestamp: new Date(Date.now() - 12 * 86400000).toISOString(), // 12 days ago
    status: 'read',
    priority: 'low',
    relatedType: 'document',
    relatedId: 'doc_1',
  },
  {
    id: 'notif_11',
    companionId: 'companion_2', // Oscar (Dog)
    title: 'Payment received',
    description: 'Your payment for the appointment has been successfully processed.',
    category: 'payment',
    icon: 'currencyIcon',
    timestamp: new Date(Date.now() - 3 * 86400000).toISOString(), // 3 days ago
    status: 'read',
    priority: 'medium',
    relatedType: 'payment',
    relatedId: 'pay_1',
  },
  {
    id: 'notif_12',
    companionId: 'companion_1', // Kizie (Cat)
    title: 'Co-parent request',
    description: 'Someone has sent you a co-parent request for Kizie. Review and respond.',
    category: 'messages',
    icon: 'chatIcon',
    timestamp: new Date(Date.now() - 15 * 86400000).toISOString(), // 15 days ago
    status: 'read',
    priority: 'high',
    relatedType: 'message',
  },
];
