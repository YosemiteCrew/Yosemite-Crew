/**
 * Scores a password against the same five checks SignUp/ResetPassword already
 * enforce on submit (length, lower, upper, digit, special char), so the score
 * hitting its max is exactly "will pass validation" - not a second, unrelated
 * notion of strength the user has to reconcile against the submit error.
 */

const CRITERIA: ReadonlyArray<(password: string) => boolean> = [
  (password) => password.length >= 8,
  (password) => /[a-z]/.test(password),
  (password) => /[A-Z]/.test(password),
  (password) => /\d/.test(password),
  (password) => /[^\w\s]/.test(password),
];

export const PASSWORD_STRENGTH_MAX_SCORE = CRITERIA.length;

export const scorePassword = (password: string): number =>
  CRITERIA.filter((meets) => meets(password)).length;

export type PasswordStrengthLabel = 'Too weak' | 'Weak' | 'Fair' | 'Strong';

export const passwordStrengthLabel = (score: number): PasswordStrengthLabel => {
  if (score <= 2) return 'Too weak';
  if (score === 3) return 'Weak';
  if (score === 4) return 'Fair';
  return 'Strong';
};

export const isStrongPassword = (password: string): boolean =>
  scorePassword(password) === PASSWORD_STRENGTH_MAX_SCORE;
