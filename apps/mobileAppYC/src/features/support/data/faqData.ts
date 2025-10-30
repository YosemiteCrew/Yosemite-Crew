export interface FAQCategory {
  id: string;
  label: string;
}

export interface FAQEntry {
  id: string;
  question: string;
  answer: string;
  categoryIds: string[];
  relatedIds?: string[];
}

export const FAQ_CATEGORIES: FAQCategory[] = [
  {id: 'all', label: 'All'},
  {id: 'appointments', label: 'Appointments'},
  {id: 'using-app', label: 'Using the App'},
  {id: 'documents', label: 'Documents'},
  {id: 'vaccinations', label: 'Vaccinations'},
  {id: 'privacy', label: 'Privacy'},
];

export const FAQ_ENTRIES: FAQEntry[] = [
  {
    id: 'schedule-appointments',
    question: 'How do I schedule a vet appointment for my pet?',
    answer:
      "Navigate to the 'Appointments' section, select your preferred vet, and choose an available time slot.",
    categoryIds: ['appointments', 'using-app'],
    relatedIds: [
      'remote-consultation',
      'share-profile',
      'update-health-records',
    ],
  },
  {
    id: 'track-vaccinations',
    question: "Can I track my pet's vaccination history in the app?",
    answer:
      'Yes. Upload vaccination records under Documents → Vaccinations to keep everything organised.',
    categoryIds: ['vaccinations', 'documents'],
    relatedIds: ['share-profile', 'document-sharing'],
  },
  {
    id: 'remote-consultation',
    question:
      'How do I connect with a veterinarian for a remote consultation?',
    answer:
      'Book a virtual visit from the Appointments tab and select “Remote Consultation” as the appointment type.',
    categoryIds: ['appointments'],
    relatedIds: ['schedule-appointments'],
  },
  {
    id: 'update-health-records',
    question:
      "What should I do if I forget to update my pet's health records?",
    answer:
      'Head to Documents → Health and upload the missing files. You can add notes to highlight what changed.',
    categoryIds: ['documents'],
    relatedIds: ['document-sharing'],
  },
  {
    id: 'share-profile',
    question: "How do I share my pet's profile with another caregiver?",
    answer:
      "Open the pet profile, tap 'Share Profile', and invite the caregiver using their email address.",
    categoryIds: ['using-app', 'documents'],
    relatedIds: ['schedule-appointments'],
  },
  {
    id: 'document-sharing',
    question: 'Can veterinarians view documents I upload?',
    answer:
      'Documents shared with a veterinarian remain visible to them as long as the appointment thread stays active.',
    categoryIds: ['documents', 'privacy'],
    relatedIds: ['update-health-records'],
  },
];
