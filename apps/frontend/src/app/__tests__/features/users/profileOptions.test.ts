import { UserEmploymentTypeOptions, UserGenderOptions } from '@/app/features/users/types/profile';
import { GenderOptions as CompanionGenderOptions } from '@/app/features/companions/types/companion';
import { EmploymentTypes } from '@/app/features/organization/pages/Organization/types';

/**
 * The user-profile API validates these fields against a fixed enum and answers a
 * 400 for anything else, which the settings page can only surface as "Failed to
 * update user profile". These lists are the contract, so they are asserted
 * literally rather than derived.
 */
describe('user profile select options', () => {
  it('offers only the gender values the profile API accepts', () => {
    expect(UserGenderOptions.map((option) => option.value)).toEqual(['MALE', 'FEMALE', 'OTHER']);
  });

  it('offers only the employment types the profile API accepts', () => {
    expect(UserEmploymentTypeOptions.map((option) => option.value)).toEqual([
      'FULL_TIME',
      'PART_TIME',
      'CONTRACT',
    ]);
  });

  it('does not reuse the companion gender list, whose OTHERS value the profile API rejects', () => {
    expect(CompanionGenderOptions.map((option) => option.value)).toContain('OTHERS');
    expect(UserGenderOptions.map((option) => option.value)).not.toContain('OTHERS');
  });

  it('does not reuse the invite employment list, whose CONTRACTOR value the profile API rejects', () => {
    expect(EmploymentTypes.map((option) => option.value)).toContain('CONTRACTOR');
    expect(UserEmploymentTypeOptions.map((option) => option.value)).not.toContain('CONTRACTOR');
  });

  it('labels every option', () => {
    for (const option of [...UserGenderOptions, ...UserEmploymentTypeOptions]) {
      expect(option.label.trim()).not.toBe('');
    }
  });
});
