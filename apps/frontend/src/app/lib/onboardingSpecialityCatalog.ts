import type { BusinessType } from '@/app/features/organization/types/org';
import { specialties } from '@/app/lib/specialities';
import type { Service } from '@yosemite-crew/types';

type CatalogEntry = {
  name: string;
  services: string[];
};

export type OnboardingServiceTemplate = Pick<
  Service,
  'cost' | 'description' | 'durationMinutes' | 'maxDiscount' | 'name' | 'serviceType'
>;

export type OnboardingSpecialityTemplate = {
  audience: string;
  name: string;
  services: OnboardingServiceTemplate[];
  summary: string;
};

type OrgTypeContent = {
  audience: string;
  recommended: string[];
  subtitle: string;
  title: string;
};

const specialtySummaryByName: Record<string, string> = {
  'Anesthesiology & Pain Management':
    'Sedation, anesthesia planning, and pain-control services for procedures and recovery.',
  'Behavior & Training':
    'Programs for anxiety, behavior change, socialization, and day-to-day handling support.',
  Cardiology:
    'Heart-focused assessments and follow-up care for murmurs, blood pressure, and chronic cases.',
  Dentistry:
    'Routine oral care, dental procedures, and treatment for companion dental health needs.',
  Dermatology: 'Skin, coat, parasite, and allergy services for ongoing dermatology support.',
  'Emergency & Critical Care':
    'Urgent triage, trauma support, and stabilization workflows for time-sensitive cases.',
  'General Practice':
    'Core consultations, wellness care, follow-ups, and routine day-to-day appointment services.',
  'Internal Medicine':
    'Diagnosis and longer-term management for complex medical and chronic health conditions.',
  'Nutrition & Dietetics':
    'Diet planning, weight management, and feeding guidance tailored to lifecycle and health needs.',
  'Observational tools':
    'Pain scales and structured assessments for monitoring condition changes over time.',
  Ophthalmology:
    'Eye exams and care pathways for irritation, injury, vision changes, and screening.',
  'Preventive / Wellness Medicine':
    'Preventive programs including vaccines, microchipping, certification, and routine screening.',
  'Radiology / Diagnostic Imaging':
    'Imaging-led diagnostics to support treatment planning and referrals when needed.',
  'Reproduction / Theriogenology':
    'Breeding, fertility, pregnancy, neonatal, and reproductive health support.',
  Surgery:
    'Surgical workflows for routine and advanced procedures with pre-op and recovery support.',
};

const orgTypeContent: Record<BusinessType, OrgTypeContent> = {
  BOARDER: {
    audience: 'Built for boarding teams that need health-focused intake and stay support.',
    recommended: [
      'General Practice',
      'Preventive / Wellness Medicine',
      'Behavior & Training',
      'Nutrition & Dietetics',
      'Dermatology',
      'Emergency & Critical Care',
    ],
    subtitle:
      'Start with stay-readiness, behavior, and wellness specialties. You can expand the library later.',
    title: 'Recommended for boarders',
  },
  BREEDER: {
    audience: 'Built for breeding programs, fertility care, neonatal support, and health planning.',
    recommended: [
      'Reproduction / Theriogenology',
      'General Practice',
      'Nutrition & Dietetics',
      'Internal Medicine',
      'Cardiology',
      'Behavior & Training',
    ],
    subtitle:
      'Set up fertility, pregnancy, neonatal, and follow-up specialties that fit breeder workflows.',
    title: 'Recommended for breeders',
  },
  GROOMER: {
    audience:
      'Built for grooming teams that manage skin, coat, hygiene, and wellness-related services.',
    recommended: [
      'Dermatology',
      'Behavior & Training',
      'Preventive / Wellness Medicine',
      'Nutrition & Dietetics',
      'Ophthalmology',
      'General Practice',
    ],
    subtitle:
      'Start with skin, behavior, and wellness-focused specialties, then add custom service lines as needed.',
    title: 'Recommended for groomers',
  },
  HOSPITAL: {
    audience: 'Built for veterinary hospitals, clinics, and multi-service medical teams.',
    recommended: [
      'General Practice',
      'Surgery',
      'Internal Medicine',
      'Dermatology',
      'Dentistry',
      'Radiology / Diagnostic Imaging',
      'Emergency & Critical Care',
      'Preventive / Wellness Medicine',
    ],
    subtitle:
      'Start with your core clinical specialties. Each one can ship with a starter service set.',
    title: 'Recommended for hospitals',
  },
};

const serviceDurationByKeyword: Array<[keyword: string, duration: number]> = [
  ['mri', 75],
  ['ct', 75],
  ['orthopedic', 90],
  ['soft tissue surgery', 75],
  ['surgery', 60],
  ['removal', 60],
  ['ultrasound', 45],
  ['scan', 30],
  ['x-ray', 30],
  ['dental cleaning', 60],
  ['extraction', 60],
  ['assessment', 30],
  ['evaluation', 30],
  ['consult', 30],
  ['consultation', 30],
  ['check', 20],
  ['vaccination', 20],
  ['booster', 20],
  ['microchipping', 20],
  ['training', 45],
];

const serviceCostByKeyword: Array<[keyword: string, cost: number]> = [
  ['mri', 350],
  ['ct', 325],
  ['orthopedic', 280],
  ['surgery', 240],
  ['extraction', 180],
  ['ultrasound', 120],
  ['x-ray', 95],
  ['scan', 90],
  ['cleaning', 160],
  ['consult', 75],
  ['consultation', 75],
  ['evaluation', 70],
  ['assessment', 70],
  ['training', 85],
  ['vaccination', 45],
  ['microchipping', 35],
];

const findMatchValue = (
  value: string,
  rules: ReadonlyArray<[keyword: string, resolvedValue: number]>,
  fallback: number
) => {
  const normalized = value.toLowerCase();
  const match = rules.find(([keyword]) => normalized.includes(keyword));
  return match ? match[1] : fallback;
};

const resolveServiceType = (specialityName: string, serviceName: string): Service['serviceType'] =>
  specialityName === 'Observational tools' || serviceName.toLowerCase().includes('scale')
    ? 'OBSERVATION_TOOL'
    : 'CONSULTATION';

const buildServiceDescription = (
  serviceName: string,
  specialityName: string,
  businessType: BusinessType
) => {
  const orgLabel = businessType.toLowerCase();
  return `${serviceName} for ${specialityName.toLowerCase()} workflows in your ${orgLabel} organization.`;
};

const buildServiceTemplate = (
  serviceName: string,
  specialityName: string,
  businessType: BusinessType
): OnboardingServiceTemplate => ({
  cost: findMatchValue(serviceName, serviceCostByKeyword, 60),
  description: buildServiceDescription(serviceName, specialityName, businessType),
  durationMinutes: findMatchValue(serviceName, serviceDurationByKeyword, 30),
  maxDiscount: 10,
  name: serviceName,
  serviceType: resolveServiceType(specialityName, serviceName),
});

const buildCatalogEntry = (
  entry: CatalogEntry,
  businessType: BusinessType
): OnboardingSpecialityTemplate => ({
  audience: orgTypeContent[businessType].audience,
  name: entry.name,
  services: entry.services.map((serviceName) =>
    buildServiceTemplate(serviceName, entry.name, businessType)
  ),
  summary:
    specialtySummaryByName[entry.name] ??
    `A configurable specialty space for ${entry.name.toLowerCase()} services in your organization.`,
});

const allCatalogEntries = specialties as CatalogEntry[];

export const getResolvedBusinessType = (orgType?: string): BusinessType => {
  switch (orgType) {
    case 'BREEDER':
    case 'BOARDER':
    case 'GROOMER':
      return orgType;
    default:
      return 'HOSPITAL';
  }
};

export const getOrgTypeSpecialityContent = (businessType: BusinessType): OrgTypeContent =>
  orgTypeContent[businessType] ?? orgTypeContent.HOSPITAL;

export const getOnboardingSpecialityCatalog = (
  businessType: BusinessType
): OnboardingSpecialityTemplate[] =>
  allCatalogEntries.map((entry) => buildCatalogEntry(entry, businessType));

export const getRecommendedOnboardingSpecialities = (
  businessType: BusinessType
): OnboardingSpecialityTemplate[] => {
  const catalog = getOnboardingSpecialityCatalog(businessType);
  const recommendedNames = new Set(getOrgTypeSpecialityContent(businessType).recommended);
  return catalog.filter((item) => recommendedNames.has(item.name));
};

export const findOnboardingSpecialityTemplate = (
  businessType: BusinessType,
  name: string
): OnboardingSpecialityTemplate | undefined =>
  getOnboardingSpecialityCatalog(businessType).find(
    (entry) => entry.name.toLowerCase() === name.trim().toLowerCase()
  );

export const buildCustomOnboardingServiceTemplate = (
  specialityName: string,
  serviceName: string,
  businessType: BusinessType
): OnboardingServiceTemplate =>
  buildServiceTemplate(serviceName.trim(), specialityName, businessType);

export const buildStarterServicesForSpeciality = (
  specialityName: string,
  businessType: BusinessType
): OnboardingServiceTemplate[] =>
  findOnboardingSpecialityTemplate(businessType, specialityName)?.services ?? [];

export const buildOnboardingServiceDraft = (
  serviceTemplate: OnboardingServiceTemplate,
  organisationId: string,
  specialityId?: string
): Service =>
  ({
    ...serviceTemplate,
    id: '',
    isActive: true,
    organisationId,
    specialityId,
  }) as Service;

export const buildOnboardingServiceDrafts = (
  specialityName: string,
  serviceNames: string[],
  businessType: BusinessType,
  organisationId: string
): Service[] =>
  serviceNames.map((serviceName) => {
    const resolvedTemplate =
      findOnboardingSpecialityTemplate(businessType, specialityName)?.services.find(
        (service) => service.name.toLowerCase() === serviceName.trim().toLowerCase()
      ) ?? buildCustomOnboardingServiceTemplate(specialityName, serviceName, businessType);

    return buildOnboardingServiceDraft(resolvedTemplate, organisationId);
  });
