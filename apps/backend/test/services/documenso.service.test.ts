// Define mocks in global scope so they are stable across resetModules
const mockCreateV0 = jest.fn();
const mockDistribute = jest.fn();
const mockFetch = jest.fn();

// 1. Mock the SDK
jest.mock('@documenso/sdk-typescript', () => {
  return {
    Documenso: jest.fn().mockImplementation(() => ({
      documents: {
        createV0: mockCreateV0,
        distribute: mockDistribute,
      },
    })),
  };
});

// 2. Mock the Error class
jest.mock('@documenso/sdk-typescript/models/errors/index.js', () => {
  class MockDocumensoError extends Error {
    statusCode: number;
    body: any;
    constructor(message: string, options: { statusCode: number; body: any }) {
      super(message);
      this.name = 'DocumensoError';
      this.statusCode = options?.statusCode;
      this.body = options?.body;
    }
  }
  return {
    DocumensoError: MockDocumensoError,
  };
});

// 3. Mock dependencies
jest.mock('axios');
jest.mock('../../src/utils/logger');

// Setup global fetch
global.fetch = mockFetch;

describe('DocumensoService', () => {
  const ORIGINAL_ENV = process.env;

  // Dynamic variables for modules re-imported after reset
  let DocumensoService: any;
  let logger: any;
  let axios: any;
  let DocumensoSDK: any;
  let DocumensoError: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules(); // CLEAR CACHE

    // 1. Reset Env
    process.env = { ...ORIGINAL_ENV };
    process.env.DOCUMENSO_BASE_URL = 'https://documenso.example.com';
    process.env.DOCUMENSO_API_KEY = 'secret-key';

    // 2. Re-require EVERYTHING
    DocumensoService = require('../../src/services/documenso.service').DocumensoService;
    logger = require('../../src/utils/logger').default;
    axios = require('axios').default;
    DocumensoSDK = require('@documenso/sdk-typescript').Documenso;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const errors = require('@documenso/sdk-typescript/models/errors/index.js');
    DocumensoError = errors.DocumensoError;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('Configuration & Initialization', () => {
    it('should log error if DOCUMENSO_BASE_URL is missing', async () => {
      delete process.env.DOCUMENSO_BASE_URL;

      // Re-require service to trigger env check
      jest.resetModules();
      const Service = require('../../src/services/documenso.service').DocumensoService;
      const localLogger = require('../../src/utils/logger').default;

      await Service.distributeDocument({ documentId: 1 });

      expect(localLogger.error).toHaveBeenCalledWith(
        "An unexpected error occurred:",
        expect.objectContaining({ message: 'DOCUMENSO_BASE_URL is not set' })
      );
    });

    it('should log error if DOCUMENSO_BASE_URL is invalid', async () => {
      process.env.DOCUMENSO_BASE_URL = 'invalid-url';
      jest.resetModules();
      const Service = require('../../src/services/documenso.service').DocumensoService;
      const localLogger = require('../../src/utils/logger').default;

      await Service.distributeDocument({ documentId: 1 });

      expect(localLogger.error).toHaveBeenCalledWith(
        "An unexpected error occurred:",
        expect.objectContaining({ message: 'DOCUMENSO_BASE_URL is invalid' })
      );
    });

    it('should initialize client once and reuse it', async () => {
      // Import the SDK constructor mock to check calls
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Documenso } = require('@documenso/sdk-typescript');

      await DocumensoService.distributeDocument({ documentId: 1 });
      await DocumensoService.distributeDocument({ documentId: 1 });

      expect(Documenso).toHaveBeenCalledTimes(1);
    });
  });

  describe('createDocument', () => {
    const pdfBuffer = Buffer.from('fake-pdf');
    const mockInput = {
      pdf: pdfBuffer,
      signerEmail: 'signer@example.com',
      signerName: 'Signer Name',
    };

    it('should create document and upload PDF successfully', async () => {
      // Mock SDK success
      mockCreateV0.mockResolvedValue({
        document: { id: 123, title: 'Form Submission' },
        uploadUrl: 'https://upload.url',
      });

      // Mock Fetch success
      mockFetch.mockResolvedValue({ ok: true });

      const result = await DocumensoService.createDocument(mockInput);

      expect(mockCreateV0).toHaveBeenCalledWith(expect.objectContaining({
        recipients: expect.arrayContaining([
          expect.objectContaining({
            email: 'signer@example.com',
            name: 'Signer Name',
            role: 'SIGNER',
          })
        ])
      }));

      expect(mockFetch).toHaveBeenCalledWith('https://upload.url', expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          'Content-Length': pdfBuffer.length.toString(),
        })
      }));

      expect(result).toEqual({ id: 123, title: 'Form Submission' });
    });

    it('should use email as name if signerName is missing', async () => {
      mockCreateV0.mockResolvedValue({ document: {}, uploadUrl: 'url' });
      mockFetch.mockResolvedValue({ ok: true });

      await DocumensoService.createDocument({ pdf: pdfBuffer, signerEmail: 'email@test.com' });

      expect(mockCreateV0).toHaveBeenCalledWith(expect.objectContaining({
        recipients: expect.arrayContaining([
          expect.objectContaining({ name: 'email@test.com' })
        ])
      }));
    });

    it('should handle Upload failure (fetch not ok)', async () => {
      mockCreateV0.mockResolvedValue({ document: {}, uploadUrl: 'url' });
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      await DocumensoService.createDocument(mockInput);

      expect(logger.error).toHaveBeenCalledWith(
        "An unexpected error occurred:",
        expect.objectContaining({ message: "Upload failed: 500" })
      );
    });

    it('should handle Documenso API Error', async () => {
      // Use the dynamically imported Error class
      const apiError = new DocumensoError('API Fail', {
          statusCode: 400,
          body: 'Bad Request'
      });
      mockCreateV0.mockRejectedValue(apiError);

      await DocumensoService.createDocument(mockInput);

      expect(logger.error).toHaveBeenCalledWith("API error:", "API Fail");
      expect(logger.error).toHaveBeenCalledWith("Status code:", 400);
      expect(logger.error).toHaveBeenCalledWith("Body:", "Bad Request");
    });

    it('should handle Generic Error', async () => {
      const err = new Error('Random Crash');
      mockCreateV0.mockRejectedValue(err);

      await DocumensoService.createDocument(mockInput);

      expect(logger.error).toHaveBeenCalledWith("An unexpected error occurred:", err);
    });
  });

  describe('distributeDocument', () => {
    it('should distribute document successfully', async () => {
      mockDistribute.mockResolvedValue({ status: 'SENT' });

      const result = await DocumensoService.distributeDocument({ documentId: 123 });

      expect(mockDistribute).toHaveBeenCalledWith({ documentId: 123 });
      expect(result).toEqual({ status: 'SENT' });
    });

    it('should handle Documenso API Error', async () => {
      const apiError = new DocumensoError('Distribute Fail', {
          statusCode: 404,
          body: 'Not Found'
      });
      mockDistribute.mockRejectedValue(apiError);

      await DocumensoService.distributeDocument({ documentId: 123 });

      expect(logger.error).toHaveBeenCalledWith("API error:", "Distribute Fail");
    });

    it('should handle Generic Error', async () => {
      const err = new Error('Generic');
      mockDistribute.mockRejectedValue(err);

      await DocumensoService.distributeDocument({ documentId: 123 });

      expect(logger.error).toHaveBeenCalledWith("An unexpected error occurred:", err);
    });
  });

  describe('downloadSignedDocument', () => {
    it('should download document successfully via Axios', async () => {
      const mockResponseData = { downloadUrl: 'http://s3.com/file.pdf' };
      axios.get.mockResolvedValue({ data: mockResponseData });

      // FIX: Pass string '999' instead of number 999 to avoid undefined ID in service logic
      const result = await DocumensoService.downloadSignedDocument('999');
      expect(result).toEqual(mockResponseData);
    });

    it('should handle Download failure', async () => {
      const err = new Error('Network Error');
      axios.get.mockRejectedValue(err);

      await DocumensoService.downloadSignedDocument('999');

      expect(logger.error).toHaveBeenCalledWith("An unexpected error occurred:", err);
    });
  });
});