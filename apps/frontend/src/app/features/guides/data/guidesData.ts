import { GuideVideo } from '@/app/features/guides/types/guides';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';

/**
 * Static content library for the Guides screen. There is no video backend — the
 * player surface is presentational — so the copy, durations, chapters and
 * categories below are seed content describing the bundled videos.
 *
 * Deliberately absent: per-viewer state. Entries used to carry
 * `status: 'watched'`, `progressPercent: 60` and `currentTime: '3:07'`, which
 * are claims about the person reading the page, not about the video. Because
 * they were module literals, every user of every clinic was told they had
 * already watched "Your first day in the PIMS" and were 60% through "Run a visit
 * end to end". Nothing records viewing progress — there is no watch-state model
 * and no route — so these must stay out until something does.
 */
export const guidesData: GuideVideo[] = [
  {
    id: 'first-day',
    persona: 'Everyone',
    title: 'Your first day in the PIMS',
    description: 'The shell, ⌘K, and where everything lives — from check-in to checkout.',
    duration: '3:42',
    category: 'Getting started',
    tags: ['shell', 'navigation', 'basics'],
    videoUrl: MEDIA_SOURCES.guides.addTeamVideo,
    thumbnailUrl: MEDIA_SOURCES.guides.thumb1,
    featured: true,
    chapters: [
      { label: 'the shell', time: '0:00' },
      { label: '⌘K search', time: '1:04' },
      { label: 'check-in to checkout', time: '2:20', highlight: true },
    ],
  },
  {
    id: 'run-a-visit',
    persona: 'Veterinarian',
    title: 'Run a visit end to end',
    description: 'SOAP, diagnostics, treatment and collecting payment in one flow.',
    duration: '5:18',
    category: 'Appointments',
    tags: ['visit', 'soap', 'diagnostics', 'payment'],
    videoUrl: MEDIA_SOURCES.guides.addCompanionVideo,
    thumbnailUrl: MEDIA_SOURCES.guides.thumb2,
    chapters: [
      { label: 'check-in', time: '0:00' },
      { label: 'SOAP', time: '0:48' },
      { label: 'diagnostics', time: '1:56' },
      { label: 'treatment', time: '3:04' },
      { label: 'invoice & payment', time: '4:12', highlight: true },
    ],
  },
  {
    id: 'invoices-payouts',
    persona: 'Practice manager',
    title: 'Invoices, deposits and payouts',
    description: 'How money moves: Stripe, reminders, and the payout schedule.',
    duration: '2:56',
    category: 'Finance',
    tags: ['invoices', 'stripe', 'payouts', 'deposits'],
    videoUrl: MEDIA_SOURCES.guides.formsVideo,
    thumbnailUrl: MEDIA_SOURCES.guides.thumb3,
    status: 'new',
    chapters: [
      { label: 'invoices', time: '0:00' },
      { label: 'deposits', time: '1:10' },
      { label: 'payout schedule', time: '2:02', highlight: true },
    ],
  },
  {
    id: 'stock-counts-itself',
    persona: 'Nurse or technician',
    title: 'Stock that counts itself',
    description: 'Reorder points, batches and expiry — and the barcode scanner.',
    duration: '4:07',
    category: 'Inventory',
    tags: ['inventory', 'reorder', 'batches', 'barcode'],
    videoUrl: MEDIA_SOURCES.guides.addTeamVideo,
    thumbnailUrl: MEDIA_SOURCES.guides.thumb1,
    chapters: [
      { label: 'reorder points', time: '0:00' },
      { label: 'batches & expiry', time: '1:32' },
      { label: 'barcode scanner', time: '3:10', highlight: true },
    ],
  },
  {
    id: 'connect-idexx',
    persona: 'Practice manager',
    title: 'Connect IDEXX in 5 minutes',
    description: 'Link your analyzers and pull results straight into the visit.',
    duration: '3:11',
    category: 'Integrations',
    tags: ['idexx', 'integrations', 'diagnostics', 'analyzers'],
    videoUrl: MEDIA_SOURCES.guides.addCompanionVideo,
    thumbnailUrl: MEDIA_SOURCES.guides.thumb2,
    chapters: [
      { label: 'connect', time: '0:00' },
      { label: 'link analyzers', time: '1:20' },
      { label: 'results in the visit', time: '2:28', highlight: true },
    ],
  },
  {
    id: 'invite-team-roles',
    persona: 'Clinic owner',
    title: 'Invite your team, set roles',
    description: 'Practitioners, front desk and managers — permissions that fit.',
    duration: '6:02',
    category: 'Getting started',
    tags: ['team', 'roles', 'permissions', 'access'],
    videoUrl: MEDIA_SOURCES.guides.formsVideo,
    thumbnailUrl: MEDIA_SOURCES.guides.thumb3,
    chapters: [
      { label: 'invite people', time: '0:00' },
      { label: 'roles', time: '2:14' },
      { label: 'permissions', time: '4:30', highlight: true },
    ],
  },
];
