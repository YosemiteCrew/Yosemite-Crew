import { mapSelectionToVetBusiness } from '../../../../src/features/linkedBusinesses/utils/mapSelectionToVetBusiness';
import type { ResolvedBusinessSelection } from '../../../../src/features/linkedBusinesses/hooks/usePlacesBusinessSearch';

describe('mapSelectionToVetBusiness', () => {
  // FIX: Cast to 'any' to bypass strict Type check for missing properties in the mock object
  const baseSelection: ResolvedBusinessSelection = {
    id: 'base-id',
    name: 'Vet Clinic',
    address: '123 Main St',
    distance: 5.5,
    rating: 4.8,
    photo: 'http://photo.jpg',
    phone: '555-0123',
    website: 'http://vet.com',
    email: 'contact@vet.com',
    lat: 10,
    lng: 20,
    placeId: 'place-123',
    // Optional fields
    organisationId: undefined,
    businessId: undefined,
  } as any;

  it('maps standard fields correctly', () => {
    const result = mapSelectionToVetBusiness(baseSelection);

    expect(result).toEqual({
      id: 'base-id',
      name: 'Vet Clinic',
      category: 'hospital',
      address: '123 Main St',
      distanceMi: 5.5,
      rating: 4.8,
      photo: 'http://photo.jpg',
      phone: '555-0123',
      website: 'http://vet.com',
      lat: 10,
      lng: 20,
      googlePlacesId: 'place-123',
    });
  });

  describe('ID Resolution Priority', () => {
    it('prioritizes organisationId if present', () => {
      const selection = {
        ...baseSelection,
        id: 'base-id',
        businessId: 'biz-id',
        organisationId: 'org-id',
      };
      const result = mapSelectionToVetBusiness(selection);
      expect(result.id).toBe('org-id');
    });

    it('prioritizes businessId if organisationId is missing', () => {
      const selection = {
        ...baseSelection,
        id: 'base-id',
        businessId: 'biz-id',
        organisationId: undefined,
      };
      const result = mapSelectionToVetBusiness(selection);
      expect(result.id).toBe('biz-id');
    });

    it('falls back to id if neither organisationId nor businessId exist', () => {
      const selection = {
        ...baseSelection,
        id: 'base-id',
        businessId: undefined,
        organisationId: undefined,
      };
      const result = mapSelectionToVetBusiness(selection);
      expect(result.id).toBe('base-id');
    });
  });

  describe('Website Fallback Logic', () => {
    it('uses website if available', () => {
      const selection = {
        ...baseSelection,
        website: 'http://real-website.com',
        email: 'email@test.com',
      };
      const result = mapSelectionToVetBusiness(selection);
      expect(result.website).toBe('http://real-website.com');
    });

    it('falls back to email if website is missing', () => {
      const selection = {
        ...baseSelection,
        website: undefined,
        email: 'email@fallback.com',
      };
      const result = mapSelectionToVetBusiness(selection);
      expect(result.website).toBe('email@fallback.com');
    });

    it('returns undefined if neither website nor email are present', () => {
      const selection = {
        ...baseSelection,
        website: undefined,
        email: undefined,
      };
      const result = mapSelectionToVetBusiness(selection);
      expect(result.website).toBeUndefined();
    });
  });
});