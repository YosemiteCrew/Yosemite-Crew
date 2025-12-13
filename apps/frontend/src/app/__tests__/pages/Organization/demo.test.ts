import {
  demoSpecialities,
  getAllServiceNames,
  getAllServices,
  getAllServiceOptions,
  flatServices,
  serviceOptions,
  allServices,
  DemoTeam,
  demoRooms,
  demoDocuments,
} from '@/app/pages/Organization/demo';
import { Speciality } from '@/app/types/org';

describe('Organization Demo Data and Utility Functions', () => {

  // --- 1. Constant Coverage ---

  it('should ensure demoSpecialities constants are correctly defined and typed', () => {
    expect(Array.isArray(demoSpecialities)).toBe(true);
    expect(demoSpecialities.length).toBe(5);

    // Check structure for a sample speciality
    const generalPractice = demoSpecialities.find(s => s.name === 'General Practice');
    expect(generalPractice).toBeDefined();
  });

  it('should ensure DemoTeam, demoRooms, and demoDocuments constants are correctly defined', () => {
    // DemoTeam (AvailabilityProps[])
    expect(Array.isArray(DemoTeam)).toBe(true);
    expect(DemoTeam.length).toBe(5);
    expect(DemoTeam[0].name).toBe('Dr. Emily Johnson');
    expect(DemoTeam[4].status).toBe('Available');

    // demoRooms (Room[])
    expect(Array.isArray(demoRooms)).toBe(true);
    expect(demoRooms.length).toBe(5);
    expect(demoRooms[1].type).toBe('Procedure');

    // demoDocuments (Document[])
    expect(Array.isArray(demoDocuments)).toBe(true);
    expect(demoDocuments.length).toBe(5);
    expect(demoDocuments[0].title).toBe('Cardiology Department Guidelines');
  });

  // --- 2. Utility Function Coverage ---

  // Test getAllServiceNames (L221)
  describe('getAllServiceNames', () => {
    it('should correctly flatten all service names from specialities', () => {
      const names = getAllServiceNames(demoSpecialities);

      // Expected total number of unique services (6 + 7 + 7 + 6 + 6) = 32, but names are repeated.
      // Total services listed: 6 + 7 + 7 + 6 + 6 = 32
      expect(names.length).toBe(32);
      expect(names).toContain('Dental Cleaning & Scaling');
      expect(names).toContain('Foreign Body Removal');
      expect(names).toContain('General Consult'); // Repeated name ensures flatMap logic is correct
    });

    // Test edge case for null/empty services (L222 branch: s.services || [])
    it('should handle specialities with null or empty services array', () => {
        const customSpecialities: Speciality[] = [
            { name: 'S1', head: 'H1', staff: [], services: [] }, // Empty array
            { name: 'S2', head: 'H2', staff: [], services: [{ name: 'Test', description: 'desc', duration: 10, charge: 100, maxDiscount: 0 }] },
            { name: 'S3', head: 'H3', staff: [], services: null as any }, // Null services (TypeScript won't allow null if strictly typed, but tests implementation safety)
        ];

        // Ensure the implementation handles services being null or empty
        const names = getAllServiceNames(customSpecialities);
        expect(names).toEqual(['Test']);
    });
  });

  // Test getAllServices (L228)
  describe('getAllServices', () => {
    it('should correctly return all services as ServiceWeb objects', () => {
      const services = getAllServices(demoSpecialities);

      // Expected total: 32 services
      expect(services.length).toBe(32);

      const sampleService = services.find(s => s.name === 'Senior Pet Wellness Exam');
      expect(sampleService).toBeDefined();
      expect(sampleService?.duration).toBe(35);
      expect(sampleService?.charge).toBe(1500);
    });

    // Test for coverage of loop and type assertion (L230 branch: s.services || [])
    it('should handle specialities with null services and iterate correctly', () => {
        const customSpecialities: Speciality[] = [
            { name: 'S1', head: 'H1', staff: [], services: [{ name: 'ServiceA', description: '', duration: 1, charge: 1, maxDiscount: 0 }] },
            { name: 'S2', head: 'H2', staff: [], services: null as any }, // Simulate null services
        ];

        const services = getAllServices(customSpecialities);
        expect(services.length).toBe(1);
        expect(services[0].name).toBe('ServiceA');
    });
  });

  // Test getAllServiceOptions (L238)
  describe('getAllServiceOptions', () => {
    it('should correctly return all services mapped to {value, key} options', () => {
      const options = getAllServiceOptions(demoSpecialities);

      // Expected total: 32 services
      expect(options.length).toBe(32);

      const sampleOption = options.find(o => o.value === 'Wound or Abscess Treatment');
      expect(sampleOption).toEqual({ value: 'Wound or Abscess Treatment', key: 'Wound or Abscess Treatment' });
    });

    // Test edge case for null/empty services (L239 branch: s.services || [])
    it('should handle specialities with null services gracefully', () => {
        const customSpecialities: Speciality[] = [
            { name: 'S1', head: 'H1', staff: [], services: [] },
            { name: 'S2', head: 'H2', staff: [], services: [{ name: 'OptA', description: 'd', duration: 1, charge: 100, maxDiscount: 0 }] },
            { name: 'S3', head: 'H3', staff: [], services: null as any },
        ];

        const options = getAllServiceOptions(customSpecialities);
        expect(options).toEqual([{ value: 'OptA', key: 'OptA' }]);
    });
  });

  // --- 3. Derived Constants Coverage ---

  it('should verify derived constant flatServices is correct', () => {
    expect(flatServices.length).toBe(32);
    expect(flatServices[0]).toBe('General Consult');
  });

  it('should verify derived constant serviceOptions is correct', () => {
    expect(serviceOptions.length).toBe(32);
    expect(serviceOptions[0].key).toBe('General Consult');
  });

  it('should verify derived constant allServices is correct', () => {
    expect(allServices.length).toBe(32);
    expect(allServices[0].name).toBe('General Consult');
  });
});