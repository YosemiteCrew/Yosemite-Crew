import { GuideVideo } from '@/app/features/guides/types/guides';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';

export const guidesData: GuideVideo[] = [
  {
    id: 'invite-team',
    title: 'Invite your team',
    description: 'Add staff members, assign roles, and keep everyone aligned in minutes.',
    duration: '2:45',
    category: 'Getting started',
    tags: ['team', 'roles', 'access'],
    videoUrl: MEDIA_SOURCES.guides.addTeamVideo,
    thumbnailUrl: MEDIA_SOURCES.guides.thumb1,
    featured: true,
  },
  {
    id: 'add-companion',
    title: 'Add companions',
    description: 'Create companion profiles and attach key details for better care.',
    duration: '3:10',
    category: 'Companions',
    tags: ['companions', 'profiles', 'pets'],
    videoUrl: MEDIA_SOURCES.guides.addCompanionVideo,
    thumbnailUrl: MEDIA_SOURCES.guides.thumb2,
  },
  {
    id: 'forms-module',
    title: 'Build and share forms',
    description: 'Create reusable forms, link them to services, and collect signatures.',
    duration: '4:05',
    category: 'Forms',
    tags: ['forms', 'templates', 'signatures'],
    videoUrl: MEDIA_SOURCES.guides.formsVideo,
    thumbnailUrl: MEDIA_SOURCES.guides.thumb3,
  },
];
