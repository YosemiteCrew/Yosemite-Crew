import {getAssignedUserName} from '@/features/tasks/utils/userHelpers';
import type {CoParent} from '@/features/coParent/types';
import type {User} from '@/features/auth/types';

describe('userHelpers', () => {
  describe('getAssignedUserName', () => {
    const mockCurrentUser: User = {
      id: 'user-1',
      parentId: 'parent-1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phoneNumber: null,
      profileImage: null,
      dateOfBirth: null,
      address: null,
      city: null,
      state: null,
      zipCode: null,
      country: null,
      verified: true,
      fcmTokens: [],
      googlePlacesId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockCoParents: CoParent[] = [
      {
        id: 'coparent-1',
        parentId: 'parent-2',
        userId: 'user-2',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phoneNumber: null,
        profileImage: null,
        relationship: 'partner',
        status: 'accepted',
        role: 'co-parent',
        permissions: [],
        invitedBy: 'parent-1',
        invitedAt: new Date().toISOString(),
        acceptedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'coparent-2',
        parentId: 'parent-3',
        userId: 'user-3',
        firstName: 'Bob',
        lastName: '',
        email: 'bob@example.com',
        phoneNumber: null,
        profileImage: null,
        relationship: 'friend',
        status: 'accepted',
        role: 'co-parent',
        permissions: [],
        invitedBy: 'parent-1',
        invitedAt: new Date().toISOString(),
        acceptedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'coparent-3',
        parentId: 'parent-4',
        userId: 'user-4',
        firstName: '',
        lastName: '',
        email: 'noname@example.com',
        phoneNumber: null,
        profileImage: null,
        relationship: 'other',
        status: 'accepted',
        role: 'co-parent',
        permissions: [],
        invitedBy: 'parent-1',
        invitedAt: new Date().toISOString(),
        acceptedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    it('should return undefined when userId is null', () => {
      const result = getAssignedUserName(null, mockCurrentUser, mockCoParents);
      expect(result).toBeUndefined();
    });

    it('should return undefined when userId is undefined', () => {
      const result = getAssignedUserName(undefined, mockCurrentUser, mockCoParents);
      expect(result).toBeUndefined();
    });

    it('should return undefined when userId is empty string', () => {
      const result = getAssignedUserName('', mockCurrentUser, mockCoParents);
      expect(result).toBeUndefined();
    });

    it('should return current user firstName when userId matches current user parentId', () => {
      const result = getAssignedUserName('parent-1', mockCurrentUser, mockCoParents);
      expect(result).toBe('John');
    });

    it('should return current user firstName when userId matches current user id and no parentId', () => {
      const userWithoutParentId = {...mockCurrentUser, parentId: undefined};
      const result = getAssignedUserName('user-1', userWithoutParentId, mockCoParents);
      expect(result).toBe('John');
    });

    it('should return current user email when firstName is not available', () => {
      const userWithoutFirstName = {...mockCurrentUser, firstName: ''};
      const result = getAssignedUserName('parent-1', userWithoutFirstName, mockCoParents);
      expect(result).toBe('john@example.com');
    });

    it('should return "You" when current user has no firstName or email', () => {
      const userWithoutName = {...mockCurrentUser, firstName: '', email: ''};
      const result = getAssignedUserName('parent-1', userWithoutName, mockCoParents);
      expect(result).toBe('You');
    });

    it('should return full name for co-parent with both first and last name', () => {
      const result = getAssignedUserName('parent-2', mockCurrentUser, mockCoParents);
      expect(result).toBe('Jane Smith');
    });

    it('should return first name only for co-parent without last name', () => {
      const result = getAssignedUserName('parent-3', mockCurrentUser, mockCoParents);
      expect(result).toBe('Bob');
    });

    it('should return email for co-parent without first or last name', () => {
      const result = getAssignedUserName('parent-4', mockCurrentUser, mockCoParents);
      expect(result).toBe('noname@example.com');
    });

    it('should find co-parent by userId field when parentId and id are not set', () => {
      const coParentWithUserId: CoParent = {
        id: null as any,
        parentId: null as any,
        userId: 'user-special',
        firstName: 'Special',
        lastName: 'User',
        email: 'special@example.com',
        phoneNumber: null,
        profileImage: null,
        relationship: 'partner',
        status: 'accepted',
        role: 'co-parent',
        permissions: [],
        invitedBy: 'parent-1',
        invitedAt: new Date().toISOString(),
        acceptedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const result = getAssignedUserName('user-special', mockCurrentUser, [coParentWithUserId]);
      expect(result).toBe('Special User');
    });

    it('should find co-parent by id field when parentId and userId are not present', () => {
      const coParentWithId: CoParent = {
        id: 'coparent-id-only',
        parentId: null as any,
        userId: null as any,
        firstName: 'ID',
        lastName: 'Only',
        email: 'idonly@example.com',
        phoneNumber: null,
        profileImage: null,
        relationship: 'partner',
        status: 'accepted',
        role: 'co-parent',
        permissions: [],
        invitedBy: 'parent-1',
        invitedAt: new Date().toISOString(),
        acceptedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const result = getAssignedUserName('coparent-id-only', mockCurrentUser, [coParentWithId]);
      expect(result).toBe('ID Only');
    });

    it('should return undefined when userId does not match any user', () => {
      const result = getAssignedUserName('unknown-user', mockCurrentUser, mockCoParents);
      expect(result).toBeUndefined();
    });

    it('should handle null current user', () => {
      const result = getAssignedUserName('parent-2', null, mockCoParents);
      expect(result).toBe('Jane Smith');
    });

    it('should handle empty co-parents array', () => {
      const result = getAssignedUserName('parent-2', mockCurrentUser, []);
      expect(result).toBeUndefined();
    });

    it('should return "Co-parent" as fallback when co-parent has no name or email', () => {
      const coParentWithoutInfo: CoParent = {
        id: 'coparent-5',
        parentId: 'parent-5',
        userId: 'user-5',
        firstName: '',
        lastName: '',
        email: '',
        phoneNumber: null,
        profileImage: null,
        relationship: 'other',
        status: 'accepted',
        role: 'co-parent',
        permissions: [],
        invitedBy: 'parent-1',
        invitedAt: new Date().toISOString(),
        acceptedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const result = getAssignedUserName('parent-5', mockCurrentUser, [coParentWithoutInfo]);
      expect(result).toBe('Co-parent');
    });

    it('should handle co-parent with only whitespace in names', () => {
      const coParentWithWhitespace: CoParent = {
        id: 'coparent-6',
        parentId: 'parent-6',
        userId: 'user-6',
        firstName: '  ',
        lastName: '  ',
        email: 'whitespace@example.com',
        phoneNumber: null,
        profileImage: null,
        relationship: 'other',
        status: 'accepted',
        role: 'co-parent',
        permissions: [],
        invitedBy: 'parent-1',
        invitedAt: new Date().toISOString(),
        acceptedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const result = getAssignedUserName('parent-6', mockCurrentUser, [coParentWithWhitespace]);
      expect(result).toBe('whitespace@example.com');
    });

    it('should handle current user with only parentId (no id)', () => {
      const userWithOnlyParentId = {
        ...mockCurrentUser,
        id: undefined as any,
      };
      const result = getAssignedUserName('parent-1', userWithOnlyParentId, mockCoParents);
      expect(result).toBe('John');
    });
  });
});
