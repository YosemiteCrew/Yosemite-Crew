/**
 * Shared utility for deriving appointment card display data
 * Eliminates duplication between MyAppointmentsScreen and HomeScreen
 */

import {resolveCurrencySymbol} from '@/shared/utils/currency';

export interface AppointmentCardData {
  cardTitle: string;
  cardSubtitle: string;
  businessName: string;
  businessAddress: string;
  petName?: string;
  avatarSource: any;
  fallbackPhoto: string | null;
  googlePlacesId: string | null;
  assignmentNote?: string;
  needsPayment: boolean;
  isRequested: boolean;
  statusAllowsActions: boolean;
  isCheckedIn: boolean;
  hasAssignedVet: boolean;
  servicePriceText: string | null;
}

/**
 * Transform raw appointment data into display-ready card data
 */
export const transformAppointmentCardData = (
  appointment: any,
  businessMap: Map<string, any>,
  employeeMap: Map<string, any>,
  serviceMap: Map<string, any>,
  companions: any[],
  businessFallbacks: Record<string, {photo?: string | null}>,
  Images: any,
): AppointmentCardData => {
  const emp = employeeMap.get(appointment.employeeId ?? '');
  const service = serviceMap.get(appointment.serviceId ?? '');
  const biz = businessMap.get(appointment.businessId);
  const hasAssignedVet = Boolean(emp || appointment.employeeName);
  const companionAvatar = companions.find(c => c.id === appointment.companionId)?.profileImage ?? null;
  const googlePlacesId = biz?.googlePlacesId ?? appointment.businessGooglePlacesId ?? null;
  const businessPhoto = biz?.photo ?? appointment.businessPhoto ?? null;
  const fallbackPhoto = businessFallbacks[appointment.businessId]?.photo ?? null;
  const providerAvatar =
    hasAssignedVet && appointment.employeeAvatar ? {uri: appointment.employeeAvatar} : null;
  const avatarSource =
    providerAvatar ||
    businessPhoto ||
    fallbackPhoto ||
    (companionAvatar ? {uri: companionAvatar} : Images.cat);

  const cardTitle = hasAssignedVet
    ? emp?.name ?? appointment.employeeName ?? 'Assigned vet'
    : service?.name ?? appointment.serviceName ?? 'Service request';

  const servicePriceText = service?.basePrice ? `${resolveCurrencySymbol(service?.currency ?? 'USD')}${service.basePrice}` : null;
  const serviceSubtitle = [
    service?.specialty ?? appointment.type ?? 'Awaiting vet assignment',
    servicePriceText,
  ]
    .filter(Boolean)
    .join(' • ');

  const providerDesignation =
    emp?.specialization ?? appointment.employeeTitle ?? service?.specialty ?? appointment.type ?? '';
  const cardSubtitle = hasAssignedVet ? providerDesignation : serviceSubtitle;
  const petName = companions.find(c => c.id === appointment.companionId)?.name;
  const businessName = biz?.name || appointment.organisationName || '';
  const businessAddress = biz?.address || appointment.organisationAddress || '';

  let assignmentNote: string | undefined;
  if (!hasAssignedVet) {
    assignmentNote = 'Your request is pending review. The business will assign a provider once it\'s approved.';
  } else if (
    appointment.status === 'PAID' ||
    appointment.status === 'UPCOMING' ||
    appointment.status === 'CHECKED_IN'
  ) {
    assignmentNote = 'Check-in unlocks when you are within ~200m of the clinic and 5 minutes before start time.';
  }

  const needsPayment =
    appointment.status === 'NO_PAYMENT' ||
    appointment.status === 'AWAITING_PAYMENT' ||
    appointment.status === 'PAYMENT_FAILED';
  const isRequested = appointment.status === 'REQUESTED';
  const isCheckedIn = appointment.status === 'CHECKED_IN';
  const statusAllowsActions =
    (appointment.status === 'UPCOMING' || isCheckedIn) && !needsPayment;

  return {
    cardTitle,
    cardSubtitle,
    businessName,
    businessAddress,
    petName,
    avatarSource,
    fallbackPhoto,
    googlePlacesId,
    assignmentNote,
    needsPayment,
    isRequested,
    statusAllowsActions,
    isCheckedIn,
    hasAssignedVet,
    servicePriceText,
  };
};
