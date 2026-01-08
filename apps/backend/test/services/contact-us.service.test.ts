import { ContactService, ContactServiceError } from '../../src/services/contact-us.service';
import ContactRequestModel from '../../src/models/contect-us';

// --- Mocks ---
jest.mock('../../src/models/contect-us');

describe('ContactService', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. createRequest
  describe('createRequest', () => {
    const baseInput: any = {
      type: 'GENERAL_INQUIRY',
      source: 'MOBILE_APP',
      subject: 'Help',
      message: 'I need help',
    };

    it('should throw error if subject or message is missing', async () => {
      await expect(ContactService.createRequest({ ...baseInput, subject: '' }))
        .rejects.toThrow('subject and message are required');

      await expect(ContactService.createRequest({ ...baseInput, message: '' }))
        .rejects.toThrow('subject and message are required');
    });

    it('should successfully create a general request', async () => {
      (ContactRequestModel.create as jest.Mock).mockResolvedValue({ ...baseInput, status: 'OPEN', _id: '123' });

      const result = await ContactService.createRequest(baseInput);

      expect(ContactRequestModel.create).toHaveBeenCalledWith(expect.objectContaining({
        status: 'OPEN',
        subject: 'Help'
      }));
      expect(result).toEqual(expect.objectContaining({ _id: '123' }));
    });

    describe('DSAR Validations', () => {
        const dsarInput: any = {
            ...baseInput,
            type: 'DSAR',
            dsarDetails: {
                requesterType: 'DATA_SUBJECT',
                declarationAccepted: true
            }
        };

        it('should throw if dsarDetails.requesterType is missing', async () => {
            const invalidDsar = { ...dsarInput, dsarDetails: {} };
            await expect(ContactService.createRequest(invalidDsar))
                .rejects.toThrow('DSAR requests must include dsarDetails.requesterType');
        });

        it('should throw if declarationAccepted is false', async () => {
            const invalidDsar = { ...dsarInput, dsarDetails: { requesterType: 'DATA_SUBJECT', declarationAccepted: false } };
            await expect(ContactService.createRequest(invalidDsar))
                .rejects.toThrow('DSAR declaration must be accepted');
        });

        it('should auto-populate declarationAcceptedAt if missing', async () => {
            (ContactRequestModel.create as jest.Mock).mockResolvedValue({ ...dsarInput, status: 'OPEN' });

            await ContactService.createRequest(dsarInput);

            expect(ContactRequestModel.create).toHaveBeenCalledWith(expect.objectContaining({
                dsarDetails: expect.objectContaining({
                    declarationAcceptedAt: expect.any(Date)
                })
            }));
        });

        it('should respect provided declarationAcceptedAt', async () => {
            const date = new Date('2023-01-01');
            const input = {
                ...dsarInput,
                dsarDetails: { ...dsarInput.dsarDetails, declarationAcceptedAt: date }
            };
            (ContactRequestModel.create as jest.Mock).mockResolvedValue(input);

            await ContactService.createRequest(input);

            expect(ContactRequestModel.create).toHaveBeenCalledWith(expect.objectContaining({
                dsarDetails: expect.objectContaining({
                    declarationAcceptedAt: date
                })
            }));
        });
    });
  });

  // 2. listRequests
  describe('listRequests', () => {
    it('should build query based on filters', async () => {
      const mockChain = {
          sort: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue(['doc1', 'doc2'])
          })
      };
      (ContactRequestModel.find as jest.Mock).mockReturnValue(mockChain);

      const filter = { status: 'OPEN' as const, type: 'DSAR' as const, organisationId: 'org1' };
      const result = await ContactService.listRequests(filter);

      expect(ContactRequestModel.find).toHaveBeenCalledWith({
          status: 'OPEN',
          type: 'DSAR',
          organisationId: 'org1'
      });
      expect(result).toEqual(['doc1', 'doc2']);
    });

    it('should handle empty filters', async () => {
        const mockChain = {
            sort: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([])
            })
        };
        (ContactRequestModel.find as jest.Mock).mockReturnValue(mockChain);

        await ContactService.listRequests({});

        expect(ContactRequestModel.find).toHaveBeenCalledWith({});
    });
  });

  // 3. getById
  describe('getById', () => {
    it('should return document by ID', async () => {
      (ContactRequestModel.findById as jest.Mock).mockResolvedValue({ _id: '123' });
      const res = await ContactService.getById('123');
      expect(res).toEqual({ _id: '123' });
    });
  });

  // 4. updateStatus
  describe('updateStatus', () => {
    it('should update status and return new doc', async () => {
      (ContactRequestModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({ _id: '123', status: 'CLOSED' });

      const res = await ContactService.updateStatus('123', 'CLOSED');

      expect(ContactRequestModel.findByIdAndUpdate).toHaveBeenCalledWith(
          '123',
          { status: 'CLOSED' },
          { new: true }
      );
      expect(res).toEqual({ _id: '123', status: 'CLOSED' });
    });
  });

  // 5. Error Class
  describe('ContactServiceError', () => {
      it('should default status code to 400', () => {
          const err = new ContactServiceError('msg');
          expect(err.statusCode).toBe(400);
          expect(err.name).toBe('ContactServiceError');
      });
  });

});