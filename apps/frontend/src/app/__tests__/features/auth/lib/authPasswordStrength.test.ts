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

  it('gives one point per satisfied criterion', () => {
    expect(scorePassword('short')).toBe(1); // lowercase only, under 8 chars
    expect(scorePassword('plain words')).toBe(2); // 8+ chars, lowercase
    expect(scorePassword('Plain words')).toBe(3); // + uppercase
    expect(scorePassword('Plain words 1')).toBe(4); // + digit
  });

  it('reaches the max score only once every criterion is met', () => {
    expect(scorePassword('Okay now 1!')).toBe(PASSWORD_STRENGTH_MAX_SCORE);
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
    expect(isStrongPassword('Okay now 1!')).toBe(true);
    expect(isStrongPassword('okay now 1!')).toBe(false); // no uppercase
    expect(isStrongPassword('OKAY NOW 1!')).toBe(false); // no lowercase
    expect(isStrongPassword('Okay now!')).toBe(false); // no digit
    expect(isStrongPassword('Okay now 1')).toBe(false); // no special char
    const underEightChars = 'Nope 1!';
    expect(isStrongPassword(underEightChars)).toBe(false); // under 8 chars
  });
});
