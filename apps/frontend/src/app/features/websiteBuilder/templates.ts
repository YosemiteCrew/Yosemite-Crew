/**
 * The templates a practice can build its website from.
 *
 * The ids are the values the API stores and validates; the rest is how the
 * builder describes each one. `SiteTemplate` renders one layout per id.
 */
export type WebsiteTemplateId = 'alpine-clinic' | 'city-vets' | 'equine-estate';

export type WebsiteTemplate = {
  id: WebsiteTemplateId;
  name: string;
  description: string;
  icon: string;
};

export const WEBSITE_TEMPLATES: WebsiteTemplate[] = [
  {
    id: 'alpine-clinic',
    name: 'Alpine Clinic',
    description: 'Warm editorial layout with a hero booking pill and services grid.',
    icon: 'ion:home-outline',
  },
  {
    id: 'city-vets',
    name: 'City Vets',
    description: 'Compact single-page site tuned for urban multi-doctor practices.',
    icon: 'ion:business-outline',
  },
  {
    id: 'equine-estate',
    name: 'Equine Estate',
    description: 'Wide imagery layout for large-animal and mobile practices.',
    icon: 'ion:paw-outline',
  },
];

/** Copy limits, matching what the API accepts. */
export const WEBSITE_COPY_LIMITS = { headline: 120, tagline: 200, about: 2000 } as const;
