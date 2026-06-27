/**
 * Single source of truth for password policy, applied consistently across
 * signup, password reset, and dashboard change-password flows.
 *
 * Policy: at least 8 characters, including one uppercase letter, one
 * lowercase letter, and one digit.
 */
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export const PASSWORD_REQUIREMENTS =
  "Password must be at least 8 characters and include uppercase, lowercase, and a number.";

/** Returns an error message when the password fails policy, otherwise null. */
export function validatePassword(password: string): string | null {
  return PASSWORD_REGEX.test(password) ? null : PASSWORD_REQUIREMENTS;
}
