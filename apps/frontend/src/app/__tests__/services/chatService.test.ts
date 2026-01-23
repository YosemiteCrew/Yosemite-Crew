import * as chatService from '../../services/chatService';
import * as axiosService from '../../services/axios';

// ----------------------------------------------------------------------------
// 1. Mocks & Setup
// ----------------------------------------------------------------------------

jest.mock('../../services/axios', () => ({
  getData: jest.fn(),
  postData: jest.fn(),
  deleteData: jest.fn(),
  patchData: jest.fn(),
}));

describe('Chat Service', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  // --------------------------------------------------------------------------
  // 2. Client Chat (Appointments)
  // --------------------------------------------------------------------------

  describe('getChatToken', () => {
    it('fetches chat token successfully', async () => {
      const mockResponse = { data: { token: 'mock-token', userId: 'user-1' } };
      (axiosService.postData as jest.Mock).mockResolvedValue(mockResponse);

      const result = await chatService.getChatToken();

      expect(axiosService.postData).toHaveBeenCalledWith('/v1/chat/pms/token');
      expect(result).toEqual(mockResponse.data);
    });

    it('throws custom error on failure (Error instance)', async () => {
      const error = new Error('Network error');
      (axiosService.postData as jest.Mock).mockRejectedValue(error);

      await expect(chatService.getChatToken()).rejects.toThrow(
        'Failed to get chat token: Network error'
      );
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('throws generic error on unknown failure', async () => {
      (axiosService.postData as jest.Mock).mockRejectedValue('Unknown string error');

      await expect(chatService.getChatToken()).rejects.toThrow(
        'Failed to get chat token due to an unknown error'
      );
    });
  });

  describe('createChatSession', () => {
    it('creates session successfully', async () => {
      const mockResponse = { data: { id: 'session-1' } };
      (axiosService.postData as jest.Mock).mockResolvedValue(mockResponse);

      const result = await chatService.createChatSession('appt-1');

      expect(axiosService.postData).toHaveBeenCalledWith('/v1/chat/pms/sessions/appt-1');
      expect(result).toEqual(mockResponse.data);
    });

    it('throws validation error if appointmentId is missing', async () => {
      await expect(chatService.createChatSession('')).rejects.toThrow(
        'Invalid appointment ID provided'
      );
    });

    it('throws error on API failure', async () => {
      const error = new Error('API Fail');
      (axiosService.postData as jest.Mock).mockRejectedValue(error);

      await expect(chatService.createChatSession('appt-1')).rejects.toThrow(
        'Failed to create chat session: API Fail'
      );
    });

    it('throws generic error on unknown failure', async () => {
        (axiosService.postData as jest.Mock).mockRejectedValue('Err');

        await expect(chatService.createChatSession('appt-1')).rejects.toThrow(
          'Failed to create chat session for appointment: appt-1'
        );
      });
  });

  describe('getChatSessions', () => {
    it('fetches list successfully', async () => {
      const mockResponse = { data: [{ id: 's1' }] };
      (axiosService.getData as jest.Mock).mockResolvedValue(mockResponse);

      const result = await chatService.getChatSessions();

      expect(axiosService.getData).toHaveBeenCalledWith('/v1/chat/pms/sessions/list');
      expect(result).toEqual(mockResponse.data);
    });

    it('throws error on failure', async () => {
      const error = new Error('Fetch failed');
      (axiosService.getData as jest.Mock).mockRejectedValue(error);

      await expect(chatService.getChatSessions()).rejects.toThrow(
        'Failed to get chat sessions: Fetch failed'
      );
    });

    it('throws generic error on unknown failure', async () => {
        (axiosService.getData as jest.Mock).mockRejectedValue('Err');

        await expect(chatService.getChatSessions()).rejects.toThrow(
          'Failed to retrieve chat sessions list'
        );
      });
  });

  describe('getChatSession', () => {
    it('fetches single session successfully', async () => {
      const mockResponse = { data: { id: 's1' } };
      (axiosService.getData as jest.Mock).mockResolvedValue(mockResponse);

      const result = await chatService.getChatSession('appt-1');

      expect(axiosService.getData).toHaveBeenCalledWith('/v1/chat/pms/sessions/appt-1');
      expect(result).toEqual(mockResponse.data);
    });

    it('throws validation error if ID missing', async () => {
      await expect(chatService.getChatSession('')).rejects.toThrow(
        'Invalid appointment ID provided'
      );
    });

    it('throws error on failure', async () => {
      const error = new Error('Not found');
      (axiosService.getData as jest.Mock).mockRejectedValue(error);

      await expect(chatService.getChatSession('appt-1')).rejects.toThrow(
        'Failed to get chat session: Not found'
      );
    });

    it('throws generic error on unknown failure', async () => {
        (axiosService.getData as jest.Mock).mockRejectedValue('Err');

        await expect(chatService.getChatSession('appt-1')).rejects.toThrow(
          'Failed to retrieve chat session for appointment: appt-1'
        );
      });
  });

  describe('closeChatSession', () => {
    it('closes session successfully', async () => {
      const mockResponse = { data: { success: true } };
      (axiosService.postData as jest.Mock).mockResolvedValue(mockResponse);

      const result = await chatService.closeChatSession('s1');

      expect(axiosService.postData).toHaveBeenCalledWith('/v1/chat/pms/sessions/s1/close');
      expect(result).toEqual(mockResponse.data);
    });

    it('throws validation error if ID missing', async () => {
      await expect(chatService.closeChatSession('')).rejects.toThrow(
        'Invalid session ID provided'
      );
    });

    it('throws error on failure', async () => {
      const error = new Error('Close failed');
      (axiosService.postData as jest.Mock).mockRejectedValue(error);

      await expect(chatService.closeChatSession('s1')).rejects.toThrow(
        'Failed to close chat session: Close failed'
      );
    });

    it('throws generic error on unknown failure', async () => {
        (axiosService.postData as jest.Mock).mockRejectedValue('Err');

        await expect(chatService.closeChatSession('s1')).rejects.toThrow(
          'Failed to close chat session: s1'
        );
      });
  });

  // --------------------------------------------------------------------------
  // 3. Org Chat (Direct & Group)
  // --------------------------------------------------------------------------

  describe('createOrgDirectChat', () => {
    it('creates direct chat successfully', async () => {
      const mockPayload = { userId: 'u1' } as any;
      const mockResponse = { data: { id: 'channel-1' } };
      (axiosService.postData as jest.Mock).mockResolvedValue(mockResponse);

      const result = await chatService.createOrgDirectChat(mockPayload);

      expect(axiosService.postData).toHaveBeenCalledWith(
        '/v1/chat/pms/org/direct',
        mockPayload
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('logs and rethrows error', async () => {
      const error = new Error('Direct failed');
      (axiosService.postData as jest.Mock).mockRejectedValue(error);

      await expect(chatService.createOrgDirectChat({} as any)).rejects.toThrow(error);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('createOrgGroupChat', () => {
    it('creates group chat successfully', async () => {
      const mockPayload = { title: 'Team' } as any;
      const mockResponse = { data: { id: 'group-1' } };
      (axiosService.postData as jest.Mock).mockResolvedValue(mockResponse);

      const result = await chatService.createOrgGroupChat(mockPayload);

      expect(axiosService.postData).toHaveBeenCalledWith(
        '/v1/chat/pms/org/group',
        mockPayload
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('logs and rethrows error', async () => {
      const error = new Error('Group failed');
      (axiosService.postData as jest.Mock).mockRejectedValue(error);

      await expect(chatService.createOrgGroupChat({} as any)).rejects.toThrow(error);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('listOrgChatSessions', () => {
    it('lists org sessions successfully', async () => {
      const mockResponse = { data: [{ id: 'os1' }] };
      (axiosService.getData as jest.Mock).mockResolvedValue(mockResponse);

      const result = await chatService.listOrgChatSessions('org-1');

      expect(axiosService.getData).toHaveBeenCalledWith('/v1/chat/pms/sessions/org-1');
      expect(result).toEqual(mockResponse.data);
    });

    it('logs and rethrows error', async () => {
      const error = new Error('List failed');
      (axiosService.getData as jest.Mock).mockRejectedValue(error);

      await expect(chatService.listOrgChatSessions('org-1')).rejects.toThrow(error);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // 4. Group Management
  // --------------------------------------------------------------------------

  describe('addGroupMembers', () => {
    it('adds members successfully', async () => {
      (axiosService.postData as jest.Mock).mockResolvedValue({});

      await chatService.addGroupMembers('g1', ['m1']);

      expect(axiosService.postData).toHaveBeenCalledWith(
        '/v1/chat/pms/groups/g1/members/add',
        { memberIds: ['m1'] }
      );
    });

    it('returns early if groupId missing', async () => {
      await chatService.addGroupMembers('', ['m1']);
      expect(axiosService.postData).not.toHaveBeenCalled();
    });

    it('returns early if memberIds empty', async () => {
      await chatService.addGroupMembers('g1', []);
      expect(axiosService.postData).not.toHaveBeenCalled();
    });
  });

  describe('removeGroupMembers', () => {
    it('removes members successfully', async () => {
      (axiosService.postData as jest.Mock).mockResolvedValue({});

      await chatService.removeGroupMembers('g1', ['m1']);

      expect(axiosService.postData).toHaveBeenCalledWith(
        '/v1/chat/pms/groups/g1/members/remove',
        { memberIds: ['m1'] }
      );
    });

    it('returns early if validation fails', async () => {
      await chatService.removeGroupMembers('', ['m1']);
      expect(axiosService.postData).not.toHaveBeenCalled();
    });
  });

  describe('updateGroup', () => {
    it('updates group successfully', async () => {
      const mockResponse = { data: { id: 'g1', title: 'New' } };
      (axiosService.patchData as jest.Mock).mockResolvedValue(mockResponse);

      const result = await chatService.updateGroup('g1', { title: 'New' });

      expect(axiosService.patchData).toHaveBeenCalledWith(
        '/v1/chat/pms/groups/g1',
        { title: 'New' }
      );
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('deleteGroup', () => {
    it('deletes group successfully', async () => {
      (axiosService.deleteData as jest.Mock).mockResolvedValue({});

      await chatService.deleteGroup('g1');

      expect(axiosService.deleteData).toHaveBeenCalledWith('/v1/chat/pms/groups/g1');
    });
  });

  // --------------------------------------------------------------------------
  // 5. Org Users (Mapping)
  // --------------------------------------------------------------------------

  describe('fetchOrgUsers', () => {
    it('throws if no orgId provided', async () => {
      await expect(chatService.fetchOrgUsers('')).rejects.toThrow(
        'Organisation ID is required to fetch users'
      );
    });

    it('fetches and maps users correctly (Full Structure)', async () => {
      const apiData = [
        {
          userId: 'u1',
          name: 'John Doe',
          email: 'john@test.com',
          profileUrl: 'img.jpg',
          speciality: { name: 'Cardio' },
          userOrganisation: {
            practitionerReference: 'prac-1',
            code: [{ coding: [{ display: 'Doctor' }] }],
          },
        },
      ];
      (axiosService.getData as jest.Mock).mockResolvedValue({ data: apiData });

      const result = await chatService.fetchOrgUsers('org-1');

      expect(axiosService.getData).toHaveBeenCalledWith(
        '/fhir/v1/user-organization/org/mapping/org-1'
      );
      expect(result[0]).toEqual({
        id: 'prac-1',
        userId: 'u1',
        practitionerId: 'prac-1',
        name: 'John Doe',
        email: 'john@test.com',
        image: 'img.jpg',
        role: 'Doctor',
        speciality: 'Cardio',
      });
    });

    it('handles fallback mapping fields correctly', async () => {
        // Test fallbacks when primary fields are missing
        const apiData = [
          {
            // id mapping: entry.id fallback
            id: 'fallback-id',
            // userId mapping: userOrganisation.userId fallback
            userOrganisation: {
                userId: 'fallback-user-id',
                name: 'Fallback Name',
                roleCode: 'NURSE'
            },
            // name fallback via userOrganisation.name
            // role fallback via userOrganisation.roleCode
            // speciality fallback via entry.speciality string
            speciality: 'General',
          },
        ];
        (axiosService.getData as jest.Mock).mockResolvedValue({ data: apiData });

        const result = await chatService.fetchOrgUsers('org-1');

        expect(result[0]).toEqual({
          id: 'fallback-id',
          userId: 'fallback-user-id',
          practitionerId: undefined,
          name: 'Fallback Name',
          email: undefined,
          image: undefined,
          role: 'NURSE',
          speciality: 'General',
        });
      });

      it('handles third-tier fallbacks', async () => {
        const apiData = [
          {
            // id fallback to entry.userId if others fail
            userId: 'direct-user-id',
            userOrganisation: {
                userReference: 'ref-user-id'
            },
            // role fallback to entry.role
            role: 'ADMIN'
          },
        ];
        (axiosService.getData as jest.Mock).mockResolvedValue({ data: apiData });

        const result = await chatService.fetchOrgUsers('org-1');

        // id logic: practitioner ref -> entry.userId -> entry.id
        // Here practitioner is missing, so it picks entry.userId ('direct-user-id')
        // userId logic: entry.userId ('direct-user-id')
        expect(result[0].id).toBe('direct-user-id');
        expect(result[0].userId).toBe('direct-user-id');
        expect(result[0].role).toBe('ADMIN');
      });

    it('logs and rethrows error on fetch failure', async () => {
      const error = new Error('Fetch failed');
      (axiosService.getData as jest.Mock).mockRejectedValue(error);

      await expect(chatService.fetchOrgUsers('org-1')).rejects.toThrow(error);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});