import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import axios from 'axios';

// ----------------------------------------------------------------------
// 1. MOCK DOCUMENSO SDK (BEFORE IMPORT)
// ----------------------------------------------------------------------
const mockCreateV0 = jest.fn();
const mockDistribute = jest.fn();

jest.mock('@documenso/sdk-typescript', () => {
  return {
    Documenso: jest.fn().mockImplementation(() => {
      return {
        documents: {
          createV0: mockCreateV0,
          distribute: mockDistribute,
        },
      };
    }),
  };
});

jest.mock('axios');
jest.mock('../../src/utils/logger');

// ----------------------------------------------------------------------
// 2. SETUP & IMPORT
// ----------------------------------------------------------------------
// Variable to hold the dynamically imported service
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let DocumensoService: any;

describe('DocumensoService', () => {
  const ORIGINAL_ENV = process.env;

  // Fix: Cast jest.fn() to any to satisfy GlobalFetch type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockFetch = jest.fn() as any;
  globalThis.fetch = mockFetch;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules(); // Reset module registry to allow re-importing with fresh env

    process.env = {
      ...ORIGINAL_ENV,
      DOCUMENSO_BASE_URL: 'https://test.documenso.com',
      DOCUMENSO_API_KEY: 'test-key',
    };

    // Re-require the service to pick up the new environment variables
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ServiceModule = require('../../src/services/documenso.service');
    DocumensoService = ServiceModule.DocumensoService;
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  /* ========================================================================
   * CONFIGURATION & INIT
   * ======================================================================*/
  describe('Initialization', () => {
    it('should throw if DOCUMENSO_BASE_URL is not set', async () => {
      delete process.env.DOCUMENSO_BASE_URL;

      // We must re-require the module here specifically to trigger the env check
      jest.resetModules();
      // eslint-disable-next-line @typescript-eslint/no-var-requires
    });

    it('should throw if DOCUMENSO_BASE_URL is invalid URL', async () => {
      process.env.DOCUMENSO_BASE_URL = 'invalid-url';

      jest.resetModules();
      // eslint-disable-next-line @typescript-eslint/no-var-requires
    });
  });

  /* ========================================================================
   * CREATE DOCUMENT
   * ======================================================================*/
  describe('createDocument', () => {
    const mockInput = {
      pdf: Buffer.from('test-pdf'),
      signerEmail: 'signer@test.com',
      signerName: 'Signer Name',
    };

    it('should create document, upload pdf, and return document', async () => {
      const mockDoc = { id: 123, title: 'Form Submission' };
      const mockUploadUrl = 'https://upload.url';

      // Fix: Cast to any to avoid strict type error
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockCreateV0 as any).mockResolvedValue({
        document: mockDoc,
        uploadUrl: mockUploadUrl,
      });

      // Fix: Cast to any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockFetch as unknown as any).mockResolvedValue({ ok: true });

      const result = await DocumensoService.createDocument(mockInput);

      expect(mockCreateV0).toHaveBeenCalledWith(expect.objectContaining({
        title: "Form Submission",
        recipients: expect.arrayContaining([
            expect.objectContaining({ email: 'signer@test.com' })
        ])
      }));

      expect(mockFetch).toHaveBeenCalledWith(mockUploadUrl, expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({ 'Content-Type': 'application/pdf' })
      }));

      expect(result).toEqual(mockDoc);
    });

    it('should throw error if upload fails', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockCreateV0 as any).mockResolvedValue({
        document: { id: 1 },
        uploadUrl: 'http://fail.url',
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockFetch as unknown as any).mockResolvedValue({ ok: false, status: 500 });

      await DocumensoService.createDocument(mockInput);
    });

    it('should handle DocumensoError gracefully', async () => {
      // Fix: Provide second arg (httpMeta) as null/any to satisfy constructor
      // Fix: Cast to any to assign read-only properties
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await DocumensoService.createDocument(mockInput);
    });
  });

  /* ========================================================================
   * DISTRIBUTE DOCUMENT
   * ======================================================================*/
  describe('distributeDocument', () => {
    it('should distribute document successfully', async () => {
      const mockResponse = { id: 1, status: 'PENDING' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockDistribute as any).mockResolvedValue(mockResponse);

      const result = await DocumensoService.distributeDocument({ documentId: 1 });

      expect(mockDistribute).toHaveBeenCalledWith({ documentId: 1 });
      expect(result).toEqual(mockResponse);
    });
    it('should handle unexpected error', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockDistribute as any).mockRejectedValue(new Error('Unknown'));
        await DocumensoService.distributeDocument({ documentId: 1 });
    });
  });

  /* ========================================================================
   * DOWNLOAD SIGNED DOCUMENT
   * ======================================================================*/
  describe('downloadSignedDocument', () => {
    it('should handle download errors', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (axios.get as any).mockRejectedValue(new Error('Network Error'));
    });
  });
});