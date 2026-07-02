import axios from 'axios';
import {
  getActorSettings,
  followRemoteActor,
  unfollowRemoteActor,
  approveFollower,
  rejectFollower,
  listFollowers,
  listFollowing,
  sendReferral,
  listInboundReferrals,
  listOutboundReferrals,
  updateLicenseToken,
  sendNote,
  announceEmergency,
  respondToReferral,
  updateActorProfile,
} from '@/app/features/federation/services/federationService';
import { getData, postData, putData, patchData } from '@/app/services/axios';
import type {
  APActorSettings,
  APFollower,
  APFollowing,
  APReferral,
} from '@/app/features/federation/types/federation';

jest.mock('axios', () => ({
  create: jest.fn(() => ({
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  })),
  isAxiosError: jest.fn(),
}));

jest.mock('@/app/services/axios');

const mockGetData = getData as jest.Mock;
const mockPostData = postData as jest.Mock;
const mockPutData = putData as jest.Mock;
const mockPatchData = patchData as jest.Mock;

const mockActor: APActorSettings = {
  uri: 'https://example.com/ap/organizations/org1',
  preferredUsername: 'clinic-a',
  publicKeyId: 'https://example.com/ap/organizations/org1#main-key',
  inboxUri: 'https://example.com/ap/organizations/org1/inbox',
  outboxUri: 'https://example.com/ap/organizations/org1/outbox',
  followersUri: 'https://example.com/ap/organizations/org1/followers',
  followingUri: 'https://example.com/ap/organizations/org1/following',
  sharedInboxUri: 'https://example.com/ap/shared-inbox',
  summary: null,
  iconUrl: null,
  createdAt: '2026-06-30T00:00:00.000Z',
  licenseTokenStatus: 'valid',
};

const mockFollower: APFollower = {
  id: 'f1',
  remoteActorUri: 'https://remote.example/ap/organizations/r1',
  remoteInboxUri: 'https://remote.example/ap/organizations/r1/inbox',
  state: 'PENDING',
  approvedAt: null,
  createdAt: '2026-06-30T00:00:00.000Z',
};

const mockFollowing: APFollowing = {
  id: 'fw1',
  remoteActorUri: 'https://remote.example/ap/organizations/r2',
  state: 'ACCEPTED',
  createdAt: '2026-06-30T00:00:00.000Z',
};

const mockReferral: APReferral = {
  id: 'ref1',
  activityUri: 'https://example.com/ap/activities/ref1',
  fromActorUri: 'https://example.com/ap/organizations/org1',
  toActorUri: 'https://remote.example/ap/organizations/r1',
  fromOrgId: 'org1',
  toOrgId: null,
  patientSummary: { species: 'Canine', chiefComplaint: 'Limping' },
  clinicalContext: null,
  urgency: 'ROUTINE',
  state: 'PENDING',
  acceptedAt: null,
  declinedAt: null,
  createdAt: '2026-06-30T00:00:00.000Z',
};

beforeEach(() => {
  jest.resetAllMocks();
  (axios.isAxiosError as unknown as jest.Mock).mockReturnValue(false);
});

describe('federationService', () => {
  describe('getActorSettings', () => {
    it('returns actor settings', async () => {
      mockGetData.mockResolvedValueOnce({ data: mockActor });
      const result = await getActorSettings();
      expect(result).toEqual(mockActor);
      expect(mockGetData).toHaveBeenCalledWith('/ap/manage/actor');
    });

    it('throws on error', async () => {
      mockGetData.mockRejectedValueOnce(new Error('Network error'));
      await expect(getActorSettings()).rejects.toThrow('Network error');
    });
  });

  describe('followRemoteActor', () => {
    it('calls postData with remoteActorUri', async () => {
      mockPostData.mockResolvedValueOnce({ data: {} });
      await followRemoteActor('https://remote.example/actor');
      expect(mockPostData).toHaveBeenCalledWith('/ap/manage/follow', {
        remoteActorUri: 'https://remote.example/actor',
      });
    });
  });

  describe('unfollowRemoteActor', () => {
    it('calls postData with remoteActorUri', async () => {
      mockPostData.mockResolvedValueOnce({ data: {} });
      await unfollowRemoteActor('https://remote.example/actor');
      expect(mockPostData).toHaveBeenCalledWith('/ap/manage/unfollow', {
        remoteActorUri: 'https://remote.example/actor',
      });
    });
  });

  describe('approveFollower', () => {
    it('calls postData with remoteActorUri', async () => {
      mockPostData.mockResolvedValueOnce({ data: {} });
      await approveFollower('https://remote.example/actor');
      expect(mockPostData).toHaveBeenCalledWith('/ap/manage/followers/approve', {
        remoteActorUri: 'https://remote.example/actor',
      });
    });
  });

  describe('rejectFollower', () => {
    it('calls postData with remoteActorUri', async () => {
      mockPostData.mockResolvedValueOnce({ data: {} });
      await rejectFollower('https://remote.example/actor');
      expect(mockPostData).toHaveBeenCalledWith('/ap/manage/followers/reject', {
        remoteActorUri: 'https://remote.example/actor',
      });
    });
  });

  describe('listFollowers', () => {
    it('returns follower list', async () => {
      mockGetData.mockResolvedValueOnce({ data: [mockFollower] });
      const result = await listFollowers();
      expect(result).toEqual([mockFollower]);
      expect(mockGetData).toHaveBeenCalledWith('/ap/manage/followers');
    });
  });

  describe('listFollowing', () => {
    it('returns following list', async () => {
      mockGetData.mockResolvedValueOnce({ data: [mockFollowing] });
      const result = await listFollowing();
      expect(result).toEqual([mockFollowing]);
      expect(mockGetData).toHaveBeenCalledWith('/ap/manage/following');
    });
  });

  describe('sendReferral', () => {
    it('calls postData with payload', async () => {
      mockPostData.mockResolvedValueOnce({ data: {} });
      const payload = {
        toActorUri: 'https://remote.example/actor',
        patientSummary: { species: 'Canine', chiefComplaint: 'Limping' },
        urgency: 'ROUTINE' as const,
      };
      await sendReferral(payload);
      expect(mockPostData).toHaveBeenCalledWith('/ap/manage/referrals', payload);
    });
  });

  describe('listInboundReferrals', () => {
    it('returns inbound referrals', async () => {
      mockGetData.mockResolvedValueOnce({ data: [mockReferral] });
      const result = await listInboundReferrals();
      expect(result).toEqual([mockReferral]);
    });
  });

  describe('listOutboundReferrals', () => {
    it('returns outbound referrals', async () => {
      mockGetData.mockResolvedValueOnce({ data: [mockReferral] });
      const result = await listOutboundReferrals();
      expect(result).toEqual([mockReferral]);
    });
  });

  describe('updateLicenseToken', () => {
    it('calls putData with token', async () => {
      mockPutData.mockResolvedValueOnce({ data: { ok: true } });
      await updateLicenseToken('eyJhbGci...');
      expect(mockPutData).toHaveBeenCalledWith('/ap/manage/license-token', {
        token: 'eyJhbGci...',
      });
    });

    it('throws when putData rejects', async () => {
      mockPutData.mockRejectedValueOnce(new Error('Token rejected'));
      await expect(updateLicenseToken('bad')).rejects.toThrow('Token rejected');
    });
  });

  describe('sendNote', () => {
    it('calls postData with note fields', async () => {
      mockPostData.mockResolvedValueOnce({ data: {} });
      await sendNote('https://remote.example/actor', 'Hello');
      expect(mockPostData).toHaveBeenCalledWith('/ap/manage/notes', {
        toActorUri: 'https://remote.example/actor',
        content: 'Hello',
        inReplyTo: undefined,
      });
    });
  });

  describe('announceEmergency', () => {
    it('calls postData with content and urgency', async () => {
      mockPostData.mockResolvedValueOnce({ data: {} });
      await announceEmergency('Emergency!', 'EMERGENCY');
      expect(mockPostData).toHaveBeenCalledWith('/ap/manage/announce', {
        content: 'Emergency!',
        urgency: 'EMERGENCY',
      });
    });
  });

  describe('respondToReferral', () => {
    it('calls patchData with referralId and action accept', async () => {
      mockPatchData.mockResolvedValueOnce({ data: { id: 'ref1', state: 'ACCEPTED' } });
      await respondToReferral('ref1', 'accept');
      expect(mockPatchData).toHaveBeenCalledWith('/ap/manage/referrals/ref1', { action: 'accept' });
    });

    it('calls patchData with referralId and action decline', async () => {
      mockPatchData.mockResolvedValueOnce({ data: { id: 'ref1', state: 'DECLINED' } });
      await respondToReferral('ref1', 'decline');
      expect(mockPatchData).toHaveBeenCalledWith('/ap/manage/referrals/ref1', {
        action: 'decline',
      });
    });

    it('throws when patchData rejects', async () => {
      mockPatchData.mockRejectedValueOnce(new Error('Not found'));
      await expect(respondToReferral('bad-id', 'accept')).rejects.toThrow('Not found');
    });
  });

  describe('updateActorProfile', () => {
    it('calls putData with summary and iconUrl', async () => {
      mockPutData.mockResolvedValueOnce({ data: { summary: 'A vet clinic', iconUrl: null } });
      await updateActorProfile({ summary: 'A vet clinic' });
      expect(mockPutData).toHaveBeenCalledWith('/ap/manage/actor', { summary: 'A vet clinic' });
    });

    it('throws when putData rejects', async () => {
      mockPutData.mockRejectedValueOnce(new Error('Unauthorized'));
      await expect(updateActorProfile({ iconUrl: 'bad-url' })).rejects.toThrow('Unauthorized');
    });
  });
});
