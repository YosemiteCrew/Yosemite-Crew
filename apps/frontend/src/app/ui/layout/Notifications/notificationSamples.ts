import type { NotificationItem } from './notificationTypes';

/**
 * Illustrative rows matching the design spec (§1). These are for Storybook and
 * tests ONLY — never import them into shipping wiring. The live panel is driven
 * by useNotifications, which reports an empty feed until a real source exists.
 */
export const SAMPLE_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'lab-poppy',
    tone: 'blue',
    icon: 'lab',
    title: 'Lab results ready',
    detail: ' · Chem 17 + CBC for Poppy need acknowledgement',
    meta: '2 min ago · IDEXX',
    read: false,
    dotTone: 'blue',
  },
  {
    id: 'chat-lena',
    tone: 'pink',
    icon: 'chat',
    title: 'Lena Hartmann',
    detail: ' replied: “How do I give the ear drops?”',
    meta: '9 min ago · Chat',
    read: false,
    dotTone: 'pink',
  },
  {
    id: 'stock-carprofen',
    tone: 'danger',
    icon: 'inventory',
    title: 'Low stock',
    detail: ' · Carprofen 100 mg below reorder point (12 left)',
    meta: '31 min ago · Inventory',
    read: false,
    dotTone: 'blue',
  },
  {
    id: 'booking-bruno',
    tone: 'blue',
    icon: 'appointment',
    title: 'New booking request',
    detail: ' · Bruno · Sat 10:15, lameness recheck',
    meta: 'Yesterday · Appointments',
    read: true,
  },
  {
    id: 'payout-stripe',
    tone: 'blue',
    icon: 'payout',
    title: 'Payout sent',
    detail: ' · €4,820.00 on the way to your bank',
    meta: 'Yesterday · Stripe',
    read: true,
  },
];

export default SAMPLE_NOTIFICATIONS;
