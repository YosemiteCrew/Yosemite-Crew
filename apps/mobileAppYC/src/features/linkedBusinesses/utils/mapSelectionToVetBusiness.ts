import type {VetBusiness} from '@/features/appointments/types';
import type {ResolvedBusinessSelection} from '../hooks/usePlacesBusinessSearch';

export const mapSelectionToVetBusiness = (
  selection: ResolvedBusinessSelection,
): VetBusiness => ({
  id: selection.organisationId || selection.businessId || selection.id,
  name: selection.name,
  category: 'hospital',
  address: selection.address,
  distanceMi: selection.distance,
  rating: selection.rating,
  photo: selection.photo,
  phone: selection.phone,
  website: selection.website || selection.email,
  lat: selection.lat,
  lng: selection.lng,
  googlePlacesId: selection.placeId,
});
