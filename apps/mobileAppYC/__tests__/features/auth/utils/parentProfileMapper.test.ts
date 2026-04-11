// FIXED IMPORTS: Go up 4 levels to root, then into src
import {mergeUserWithParentProfile} from '../../../../src/features/auth/utils/parentProfileMapper';
import type {User} from '../../../../src/features/auth/types';
import type {ParentProfileSummary} from '../../../../src/features/account/services/profileService';

describe('parentProfileMapper', () => {
  const mockBaseUser: User = {
    id: 'u1',
    email: 'test@test.com',
    firstName: 'OldFirst',
    lastName: 'OldLast',
    phone: '111',
    dateOfBirth: '1990-01-01',
    profilePicture: 'http://old.jpg',
    profileToken: 'old-token',
    profileCompleted: false,
    address: {
      addressLine: 'Old St',
      city: 'Old City',
      stateProvince: 'Old State',
      postalCode: '00000',
      country: 'Old Country',
    },
  };

  const mockParent: ParentProfileSummary = {
    id: 'p1',
    firstName: 'NewFirst',
    lastName: 'NewLast',
    phoneNumber: '222',
    birthDate: '2000-01-01',
    profileImageUrl: 'http://new.jpg',
    isComplete: true,
    address: {
      addressLine: 'New St',
      city: 'New City',
      state: 'New State',
      postalCode: '11111',
      country: 'New Country',
    },
  };

  // --- 1. Basic Merging Logic ---
  it('merges parent profile data into the user object correctly', () => {
    const result = mergeUserWithParentProfile(mockBaseUser, mockParent);

    expect(result).toEqual({
      ...mockBaseUser,
      parentId: 'p1',
      firstName: 'NewFirst',
      lastName: 'NewLast',
      phone: '222',
      dateOfBirth: '2000-01-01',
      profilePicture: 'http://new.jpg',
      profileToken: 'http://new.jpg', // Logic maps image URL to token as well
      profileCompleted: true,
      address: {
        addressLine: 'New St',
        city: 'New City',
        stateProvince: 'New State', // Note property name change
        postalCode: '11111',
        country: 'New Country',
      },
    });
  });

  // --- 2. Fallback Logic (Parent missing / undefined) ---
  it('returns the base user unmodified if parent profile is undefined', () => {
    const result = mergeUserWithParentProfile(mockBaseUser, undefined);
    expect(result).toBe(mockBaseUser);
  });

  // --- 3. Field-Level Fallbacks (Partial Parent Data) ---
  it('falls back to base user data when specific parent fields are missing', () => {
    const partialParent: ParentProfileSummary = {
      id: 'p2',
      // firstName missing
      // lastName missing
      // address missing
    } as any;

    const result = mergeUserWithParentProfile(mockBaseUser, partialParent);

    expect(result.firstName).toBe('OldFirst'); // Fallback
    expect(result.lastName).toBe('OldLast');   // Fallback
    expect(result.address).toEqual(mockBaseUser.address); // Fallback
    expect(result.parentId).toBe('p2'); // New data
  });

  // --- 4. Address Mapping Logic (Branch Coverage) ---
  describe('Address Mapping (Internal Logic)', () => {

    it('returns undefined address if parent address is missing completely', () => {
        // We pass a parent with NO address property
        const parentNoAddress = { ...mockParent, address: undefined };
        const result = mergeUserWithParentProfile(mockBaseUser, parentNoAddress);

        // Should fallback to base user address
        expect(result.address).toEqual(mockBaseUser.address);
    });

    it('returns undefined address if parent address exists but is empty object', () => {
        // We pass an empty address object. The check inside mapAddress looks for truthy fields.
        const parentEmptyAddress = { ...mockParent, address: {} } as any;
        // Since mapAddress returns undefined, we fallback to base.
        // To verify mapAddress returned undefined, we can pass a base with NO address.
        const userNoAddr = { ...mockBaseUser, address: undefined };
        const result2 = mergeUserWithParentProfile(userNoAddr, parentEmptyAddress);

        expect(result2.address).toBeUndefined();
    });

    it('maps address correctly if at least one field exists', () => {
        const parentPartialAddr = {
            ...mockParent,
            address: { city: 'Just City' } as any
        };
        const result = mergeUserWithParentProfile(mockBaseUser, parentPartialAddr);

        expect(result.address).toEqual({
            city: 'Just City',
            addressLine: undefined,
            stateProvince: undefined,
            postalCode: undefined,
            country: undefined,
        });
    });
  });

  // --- 5. Profile Image Logic ---
  it('handles profile image logic: falls back to base picture if parent image missing', () => {
      const parentNoImg = { ...mockParent, profileImageUrl: undefined };
      const result = mergeUserWithParentProfile(mockBaseUser, parentNoImg);

      expect(result.profilePicture).toBe('http://old.jpg');
      expect(result.profileToken).toBe('http://old.jpg'); // Logic uses the resolved image
  });
});