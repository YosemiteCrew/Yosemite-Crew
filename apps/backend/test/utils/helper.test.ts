import helpers from '../../src/utils/helper';
import axios from 'axios';

// Mock axios specifically for this test file
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Helper Utils', () => {

  // 1. calculateAge
  describe('calculateAge', () => {
    it('should correctly calculate age from a string date', () => {
      // Mock Date.now to ensure consistent results regardless of when test runs
      const mockNow = new Date('2023-10-01T00:00:00Z').getTime();
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      const dob = '1990-01-01';
      const age = helpers.calculateAge(dob);
      // 1990 to 2023 is 33 years
      expect(age).toBe(33);

      jest.restoreAllMocks();
    });

    it('should correctly calculate age from a Date object', () => {
      const mockNow = new Date('2023-10-01T00:00:00Z').getTime();
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      const dob = new Date('2000-01-01');
      const age = helpers.calculateAge(dob);
      expect(age).toBe(23);

      jest.restoreAllMocks();
    });
  });

  // 2. capitalizeFirstLetter
  describe('capitalizeFirstLetter', () => {
    it('should capitalize the first letter and lowercase the rest', () => {
      expect(helpers.capitalizeFirstLetter('hello')).toBe('Hello');
      expect(helpers.capitalizeFirstLetter('HELLO')).toBe('Hello');
      expect(helpers.capitalizeFirstLetter('hElLo')).toBe('Hello');
    });

    it('should handle single character strings', () => {
      expect(helpers.capitalizeFirstLetter('a')).toBe('A');
    });
  });

  // 3. operationOutcome
  describe('operationOutcome', () => {
    it('should return the correct OperationOutcome object structure', () => {
      const result = helpers.operationOutcome('error', 'fatal', '404', 'Not Found');

      expect(result).toEqual({
        resourceType: 'OperationOutcome',
        issue: [
          {
            status: 'error',
            severity: 'fatal',
            code: '404',
            diagnostics: 'Not Found',
          },
        ],
      });
    });
  });

  // 4. convertTo24Hour
  describe('convertTo24Hour', () => {
    it('should convert PM hours (other than 12) correctly', () => {
      // 02:30 PM -> 14:30
      expect(helpers.convertTo24Hour('02:30 PM')).toBe('14:30');
    });

    it('should handle 12 PM (Noon) correctly', () => {
      // 12:30 PM -> 12:30 (Should not add 12)
      expect(helpers.convertTo24Hour('12:30 PM')).toBe('12:30');
    });

    it('should handle 12 AM (Midnight) correctly', () => {
      // 12:30 AM -> 00:30
      expect(helpers.convertTo24Hour('12:30 AM')).toBe('00:30');
    });

    it('should convert AM hours (other than 12) correctly', () => {
      // 11:30 AM -> 11:30
      expect(helpers.convertTo24Hour('11:30 AM')).toBe('11:30');
    });
  });

  // 5. formatAppointmentDateTime
  describe('formatAppointmentDateTime', () => {
    it('should format date and time correctly using Asia/Kolkata timezone', () => {
      // Input date containing a specific offset or UTC
      const rawDate = '2023-10-25T14:30:00+05:30';

      const result = helpers.formatAppointmentDateTime(rawDate);

      // 1. Date part extracted from split
      expect(result.appointmentDate).toBe('2023-10-25');

      // 2. 12h format checks (Asia/Kolkata)
      // Note: precise string match depends on node environment locales,
      // but usually "2:30 PM"
      expect(result.appointmentTime).toMatch(/2:30 PM/);

      // 3. 24h format checks (Asia/Kolkata)
      expect(result.appointmentTime24).toBe('14:30');
    });
  });

  // 6. getGeoLocation
  describe('getGeoLocation', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv, GOOGLE_API_KEY: 'TEST_KEY' };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should return lat and lng when API call is successful', async () => {
      const mockResponse = {
        data: {
          results: [
            {
              geometry: {
                location: { lat: 40.7128, lng: -74.006 },
              },
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const result = await helpers.getGeoLocation('New York');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('https://maps.googleapis.com/maps/api/geocode/json?address=New%20York&key=TEST_KEY')
      );
      expect(result).toEqual({ lat: 40.7128, lng: -74.006 });
    });

    it('should throw "Location not found" if results array is empty', async () => {
      const mockResponse = {
        data: {
          results: [],
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      await expect(helpers.getGeoLocation('Unknown Place')).rejects.toThrow('Location not found');
    });

    it('should propagate axios errors if the request fails', async () => {
      const errorMessage = 'Network Error';
      mockedAxios.get.mockRejectedValueOnce(new Error(errorMessage));

      await expect(helpers.getGeoLocation('Error Place')).rejects.toThrow(errorMessage);
    });
  });
});