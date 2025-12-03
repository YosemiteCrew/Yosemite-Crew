/**
 * Shared utility for resolving business coordinates with fallbacks
 */

export interface BusinessCoordinates {
  lat: number | null;
  lng: number | null;
}

/**
 * Get business coordinates from business map or appointment fallback data
 */
export const getBusinessCoordinates = (
  appointment: any,
  businessMap: Map<string, any>,
): BusinessCoordinates => {
  const biz = businessMap.get(appointment.businessId);
  return {
    lat: biz?.lat ?? appointment.businessLat ?? null,
    lng: biz?.lng ?? appointment.businessLng ?? null,
  };
};

/**
 * Extract key business data needed for display/actions
 */
export const extractBusinessData = (
  appointment: any,
  businessMap: Map<string, any>,
) => {
  const biz = businessMap.get(appointment.businessId);
  const googlePlacesId = biz?.googlePlacesId ?? appointment.businessGooglePlacesId ?? null;
  const businessName = biz?.name || appointment.organisationName || '';
  const businessAddress = biz?.address || appointment.organisationAddress || '';

  return {
    googlePlacesId,
    businessName,
    businessAddress,
    biz,
  };
};
