import {
  CategoryOptions,
  HealthCategoryOptions,
  HygieneCategoryOptions,
  emptyCompanionRecord,
  type Category,
  type Subcategory,
  type CompanionRecord,
  type Attachment,
  type SignedFile,
} from '@/app/features/documents/types/companionDocuments';

describe('companionDocuments types', () => {
  describe('CategoryOptions', () => {
    it('has Health option', () => {
      const health = CategoryOptions.find((o) => o.value === 'HEALTH');
      expect(health).toBeDefined();
      expect(health?.label).toBe('Health');
    });

    it('has Hygiene maintenance option', () => {
      const hygiene = CategoryOptions.find((o) => o.value === 'HYGIENE_MAINTENANCE');
      expect(hygiene).toBeDefined();
      expect(hygiene?.label).toBe('Hygiene maintenance');
    });

    it('has exactly 2 options', () => {
      expect(CategoryOptions).toHaveLength(2);
    });
  });

  describe('HealthCategoryOptions', () => {
    it('matches the approved health subcategory list', () => {
      expect(HealthCategoryOptions).toEqual([
        { label: 'Surgery/ Procedure', value: 'SURGERY_PROCEDURE' },
        { label: 'Prescription', value: 'PRESCRIPTION' },
        { label: 'Vaccination', value: 'VACCINATION' },
        { label: 'Discharge summary', value: 'DISCHARGE_SUMMARY' },
        { label: 'Lab test', value: 'LAB_TEST' },
        { label: 'Imaging/ Diagnostic', value: 'IMAGING_DIAGNOSTIC' },
        { label: 'Parasite prevention', value: 'PARASITE_PREVENTION' },
        { label: 'Medical condition', value: 'MEDICAL_CONDITION' },
        { label: 'Other', value: 'OTHER' },
      ]);
    });
  });

  describe('HygieneCategoryOptions', () => {
    it('matches the approved hygiene subcategory list', () => {
      expect(HygieneCategoryOptions).toEqual([
        { label: 'Bathing', value: 'BATHING' },
        { label: 'Nail trim', value: 'NAIL_TRIM' },
        { label: 'Grooming', value: 'GROOMING' },
        { label: 'Ear cleaning', value: 'EAR_CLEANING' },
        { label: 'Dental cleaning', value: 'DENTAL_CLEANING' },
        { label: 'Skin care', value: 'SKIN_CARE' },
        { label: 'Anal gland expression', value: 'ANAL_GLAND_EXPRESSION' },
        { label: 'Other', value: 'OTHER' },
      ]);
    });
  });

  describe('emptyCompanionRecord', () => {
    it('has empty title', () => {
      expect(emptyCompanionRecord.title).toBe('');
    });

    it('has HEALTH category by default', () => {
      expect(emptyCompanionRecord.category).toBe('HEALTH');
    });

    it('has SURGERY_PROCEDURE subcategory by default', () => {
      expect(emptyCompanionRecord.subcategory).toBe('SURGERY_PROCEDURE');
    });

    it('has empty attachments array', () => {
      expect(emptyCompanionRecord.attachments).toEqual([]);
    });

    it('has undefined appointmentId', () => {
      expect(emptyCompanionRecord.appointmentId).toBeUndefined();
    });

    it('has HOSPITAL visitType by default', () => {
      expect(emptyCompanionRecord.visitType).toBe('HOSPITAL');
    });

    it('has undefined issuingBusinessName', () => {
      expect(emptyCompanionRecord.issuingBusinessName).toBeUndefined();
    });

    it('has issueDate initialized', () => {
      expect(emptyCompanionRecord.issueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('type validation', () => {
    it('allows valid Category type', () => {
      const health: Category = 'HEALTH';
      const hygiene: Category = 'HYGIENE_MAINTENANCE';
      expect(health).toBe('HEALTH');
      expect(hygiene).toBe('HYGIENE_MAINTENANCE');
    });

    it('allows valid Subcategory types', () => {
      const surgeryProcedure: Subcategory = 'SURGERY_PROCEDURE';
      const bathing: Subcategory = 'BATHING';
      expect(surgeryProcedure).toBe('SURGERY_PROCEDURE');
      expect(bathing).toBe('BATHING');
    });

    it('allows valid CompanionRecord', () => {
      const record: CompanionRecord = {
        id: 'rec-123',
        title: 'Test Record',
        category: 'HEALTH',
        subcategory: 'LAB_TEST',
        attachments: [{ key: 'file-key', mimeType: 'application/pdf', size: 1024 }],
        appointmentId: 'appt-123',
        companionId: 'comp-123',
        visitType: 'HOSPITAL',
        issuingBusinessName: 'Test Clinic',
        issueDate: '2024-01-15',
      };
      expect(record.title).toBe('Test Record');
    });

    it('allows valid Attachment', () => {
      const attachment: Attachment = {
        key: 'file-key',
        mimeType: 'image/png',
        size: 2048,
      };
      expect(attachment.key).toBe('file-key');
    });

    it('allows Attachment with only required fields', () => {
      const attachment: Attachment = { key: 'minimal-key' };
      expect(attachment.key).toBe('minimal-key');
      expect(attachment.mimeType).toBeUndefined();
      expect(attachment.size).toBeUndefined();
    });

    it('allows valid SignedFile', () => {
      const signedFile: SignedFile = {
        url: 'https://example.com/file.pdf',
        mimeType: 'application/pdf',
        key: 'signed-file-key',
      };
      expect(signedFile.url).toBe('https://example.com/file.pdf');
    });
  });
});
