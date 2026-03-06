import {
  getBusinessCoordinates,
  extractBusinessData,
} from '@/features/appointments/utils/businessCoordinates';

describe('businessCoordinates utils', () => {
  describe('getBusinessCoordinates', () => {
    it('should return coordinates from business map', () => {
      const appointment = {
        businessId: 'biz-1',
      };
      const businessMap = new Map([
        ['biz-1', {id: 'biz-1', lat: 40.7128, lng: -74.006}],
      ]);

      const result = getBusinessCoordinates(appointment, businessMap);

      expect(result).toEqual({lat: 40.7128, lng: -74.006});
    });

    it('should fallback to appointment coordinates when business not in map', () => {
      const appointment = {
        businessId: 'biz-1',
        businessLat: 34.0522,
        businessLng: -118.2437,
      };
      const businessMap = new Map();

      const result = getBusinessCoordinates(appointment, businessMap);

      expect(result).toEqual({lat: 34.0522, lng: -118.2437});
    });

    it('should return null coordinates when neither source has them', () => {
      const appointment = {
        businessId: 'biz-1',
      };
      const businessMap = new Map([['biz-1', {id: 'biz-1'}]]);

      const result = getBusinessCoordinates(appointment, businessMap);

      expect(result).toEqual({lat: null, lng: null});
    });

    it('should prefer business map coordinates over appointment fallback', () => {
      const appointment = {
        businessId: 'biz-1',
        businessLat: 34.0522,
        businessLng: -118.2437,
      };
      const businessMap = new Map([
        ['biz-1', {id: 'biz-1', lat: 40.7128, lng: -74.006}],
      ]);

      const result = getBusinessCoordinates(appointment, businessMap);

      expect(result).toEqual({lat: 40.7128, lng: -74.006});
    });

    it('should handle null business lat/lng in map', () => {
      const appointment = {
        businessId: 'biz-1',
        businessLat: 34.0522,
        businessLng: -118.2437,
      };
      const businessMap = new Map([
        ['biz-1', {id: 'biz-1', lat: null, lng: null}],
      ]);

      const result = getBusinessCoordinates(appointment, businessMap);

      expect(result).toEqual({lat: 34.0522, lng: -118.2437});
    });
  });

  describe('extractBusinessData', () => {
    it('should extract data from business map', () => {
      const appointment = {
        businessId: 'biz-1',
      };
      const business = {
        id: 'biz-1',
        name: 'Vet Clinic',
        address: '123 Main St',
        googlePlacesId: 'place-123',
      };
      const businessMap = new Map([['biz-1', business]]);

      const result = extractBusinessData(appointment, businessMap);

      expect(result).toEqual({
        googlePlacesId: 'place-123',
        businessName: 'Vet Clinic',
        businessAddress: '123 Main St',
        biz: business,
      });
    });

    it('should fallback to appointment data when business not in map', () => {
      const appointment = {
        businessId: 'biz-1',
        organisationName: 'Appointment Clinic',
        organisationAddress: '456 Oak Ave',
        businessGooglePlacesId: 'place-456',
      };
      const businessMap = new Map();

      const result = extractBusinessData(appointment, businessMap);

      expect(result).toEqual({
        googlePlacesId: 'place-456',
        businessName: 'Appointment Clinic',
        businessAddress: '456 Oak Ave',
        biz: undefined,
      });
    });

    it('should prefer business map data over appointment fallback', () => {
      const appointment = {
        businessId: 'biz-1',
        organisationName: 'Appointment Clinic',
        organisationAddress: '456 Oak Ave',
        businessGooglePlacesId: 'place-456',
      };
      const business = {
        id: 'biz-1',
        name: 'Map Clinic',
        address: '789 Elm St',
        googlePlacesId: 'place-789',
      };
      const businessMap = new Map([['biz-1', business]]);

      const result = extractBusinessData(appointment, businessMap);

      expect(result).toEqual({
        googlePlacesId: 'place-789',
        businessName: 'Map Clinic',
        businessAddress: '789 Elm St',
        biz: business,
      });
    });

    it('should handle missing data gracefully', () => {
      const appointment = {
        businessId: 'biz-1',
      };
      const businessMap = new Map();

      const result = extractBusinessData(appointment, businessMap);

      expect(result).toEqual({
        googlePlacesId: null,
        businessName: '',
        businessAddress: '',
        biz: undefined,
      });
    });

    it('should handle empty strings in appointment data', () => {
      const appointment = {
        businessId: 'biz-1',
        organisationName: '',
        organisationAddress: '',
      };
      const businessMap = new Map([['biz-1', {id: 'biz-1'}]]);

      const result = extractBusinessData(appointment, businessMap);

      expect(result).toEqual({
        googlePlacesId: null,
        businessName: '',
        businessAddress: '',
        biz: businessMap.get('biz-1'),
      });
    });
  });
});
