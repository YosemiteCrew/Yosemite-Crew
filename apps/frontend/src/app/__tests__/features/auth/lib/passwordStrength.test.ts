import {
  PASSWORD_STRENGTH_MAX_SCORE,
  isStrongPassword,
  passwordStrengthLabel,
  scorePassword,
} from '@/app/features/auth/lib/passwordStrength';

describe('scorePassword', () => {
  it('scores an empty password at zero', () => {
    expect(scorePassword('')).toBe(0);
  });

  it('gives one point per missing criterion', () => {
    expect(scorePassword('short')).toBe(1); // lowercase only, under 8 chars
    expect(scorePassword('longenough')).toBe(2); // 8+ chars, lowercase
    expect(scorePassword('Longenough')).toBe(3); // + uppercase
    expect(scorePassword('Longenough1')).toBe(4); // + digit
  });

  it('reaches the max score only once every criterion is met', () => {
    expect(scorePassword('Longenough1!')).toBe(PASSWORD_STRENGTH_MAX_SCORE);
  });
});

describe('passwordStrengthLabel', () => {
  it('labels each score band', () => {
    expect(passwordStrengthLabel(0)).toBe('Too weak');
    expect(passwordStrengthLabel(2)).toBe('Too weak');
    expect(passwordStrengthLabel(3)).toBe('Weak');
    expect(passwordStrengthLabel(4)).toBe('Fair');
    expect(passwordStrengthLabel(5)).toBe('Strong');
  });
});

describe('isStrongPassword', () => {
  it('matches the same requirement SignUp/ResetPassword show in their error copy', () => {
    // "at least 8 characters long, include uppercase, lowercase, number, and special character"
    expect(isStrongPassword('Longenough1!')).toBe(true);
    expect(isStrongPassword('longenough1!')).toBe(false); // no uppercase
    expect(isStrongPassword('LONGENOUGH1!')).toBe(false); // no lowercase
    expect(isStrongPassword('Longenough!')).toBe(false); // no digit
    expect(isStrongPassword('Longenough1')).toBe(false); // no special char
    expect(isStrongPassword('Nope 1!')).toBe(false); // under 8 chars
  });
});
