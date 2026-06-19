import type { Extension, RelatedPerson } from '@yosemite-crew/fhir';
import { Address, toFHIRAddress } from './address.model';
import { fromAddressRequestDTO } from './dto/address.dto';

export interface AlertSummary {
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export const PARENT_ALERTS_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/parent-alerts';

export interface Parent {
  id?: string;
  firstName: string;
  lastName?: string;
  birthDate?: Date;
  email: string;
  phoneNumber?: string;
  address: Address;
  currency?: string;
  timezone?: string;
  linkedUserId?: string | null;
  createdFrom: 'pms' | 'mobile' | 'invited';
  profileImageUrl?: string;
  alerts?: AlertSummary[];
  isProfileComplete?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export const PARENT_PROFILE_COMPLETION_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/parent-profile-completed';
export const PARENT_TIMEZONE_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/parent-timezone';

export function toFHIRRelatedPerson(parent: Parent): RelatedPerson {
  const id = parent.id ? String(parent.id) : undefined;

  const nameText = [parent.firstName, parent.lastName].filter(Boolean).join(' ').trim();
  const name = nameText
    ? [
        {
          use: 'official' as const,
          text: nameText,
          given: parent.firstName ? [parent.firstName] : undefined,
          family: parent.lastName || undefined,
        },
      ]
    : undefined;

  const telecom = parent.phoneNumber
    ? [
        {
          system: 'phone' as const,
          value: parent.phoneNumber,
        },
        {
          system: 'email' as const,
          value: parent.email,
        },
      ]
    : undefined;

  const fhirAddress = parent.address ? toFHIRAddress(parent.address) : undefined;
  const address =
    fhirAddress && Object.values(fhirAddress).some(Boolean) ? [fhirAddress] : undefined;

  const photo = parent.profileImageUrl
    ? [
        {
          url: parent.profileImageUrl,
        },
      ]
    : undefined;

  const extensions: Extension[] = [];

  if (typeof parent.isProfileComplete === 'boolean') {
    extensions.push({
      url: PARENT_PROFILE_COMPLETION_EXTENSION_URL,
      valueBoolean: parent.isProfileComplete,
    });
  }
  if (parent.timezone) {
    extensions.push({
      url: PARENT_TIMEZONE_EXTENSION_URL,
      valueString: parent.timezone,
    });
  }

  if (parent.alerts?.length) {
    extensions.push({
      url: PARENT_ALERTS_EXTENSION_URL,
      extension: parent.alerts.map((alert) => ({
        url: 'alert',
        extension: [
          {
            url: 'title',
            valueString: alert.title,
          },
          {
            url: 'severity',
            valueString: alert.severity,
          },
        ],
      })),
    });
  }

  const birthDate = parent.birthDate ? parent.birthDate.toISOString().split('T')[0] : undefined;

  return {
    resourceType: 'RelatedPerson',
    id,
    name,
    telecom,
    address,
    photo,
    birthDate,
    extension: extensions.length ? extensions : undefined,
  } as RelatedPerson;
}

export function fromFHIRRelatedPerson(resource: RelatedPerson): Parent {
  const rp = resource;

  const officialName = rp.name?.find((n) => n.use === 'official') ?? rp.name?.[0];
  const firstName = officialName?.given?.[0] || '';
  const lastName = officialName?.family;

  let email: string = '';
  let phoneNumber: string | undefined = undefined;

  rp.telecom?.forEach((t) => {
    if (t.system === 'email' && t.value) email = t.value;
    if (t.system === 'phone' && t.value) phoneNumber = t.value;
  });

  const address = rp.address?.[0] ? fromAddressRequestDTO(rp.address[0]) : {};

  const profileImageUrl = rp.photo?.[0]?.url;

  let isProfileComplete: boolean | undefined = undefined;
  let timezone: string | undefined = undefined;
  const alerts: AlertSummary[] = [];

  rp.extension?.forEach((ext) => {
    if (
      ext.url === PARENT_PROFILE_COMPLETION_EXTENSION_URL &&
      typeof ext.valueBoolean === 'boolean'
    ) {
      isProfileComplete = ext.valueBoolean;
    }
    if (ext.url === PARENT_TIMEZONE_EXTENSION_URL && typeof ext.valueString === 'string') {
      timezone = ext.valueString;
    }
  });

  const alertExtension = rp.extension?.find((ext) => ext.url === PARENT_ALERTS_EXTENSION_URL);
  alertExtension?.extension?.forEach((item) => {
    if (item.url !== 'alert') {
      return;
    }
    const title = item.extension?.find((ext) => ext.url === 'title')?.valueString;
    const severity = item.extension?.find((ext) => ext.url === 'severity')?.valueString;
    if (
      title &&
      (severity === 'critical' ||
        severity === 'high' ||
        severity === 'medium' ||
        severity === 'low')
    ) {
      alerts.push({ title, severity });
    }
  });

  const birthDate = rp.birthDate ? new Date(rp.birthDate) : undefined;

  const parent: Parent = {
    id: rp.id,
    firstName,
    lastName,
    email,
    phoneNumber,
    birthDate,
    address,
    profileImageUrl,
    timezone,
    alerts: alerts.length ? alerts : undefined,
    createdFrom: 'pms',
  };

  return parent;
}
