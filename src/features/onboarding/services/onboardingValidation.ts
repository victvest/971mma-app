export const MIN_MEMBER_AGE = 13;
export const MAX_MEMBER_AGE = 100;

export function validateOnboardingName(fullName: string): string | null {
  const trimmed = fullName.trim();
  if (!trimmed) return 'Enter your full name.';
  if (trimmed.length < 2) return 'Name must be at least 2 characters.';
  if (!/^[\p{L}\s'.-]+$/u.test(trimmed)) {
    return 'Use letters for your name.';
  }
  return null;
}

export function validateOnboardingAge(ageText: string): string | null {
  const trimmed = ageText.trim();
  if (!trimmed) return 'Enter your age.';
  if (!/^\d{1,3}$/.test(trimmed)) return 'Enter a valid age.';

  const age = Number(trimmed);
  if (age < MIN_MEMBER_AGE) return `You must be at least ${MIN_MEMBER_AGE} years old.`;
  if (age > MAX_MEMBER_AGE) return `Enter an age up to ${MAX_MEMBER_AGE}.`;
  return null;
}

export function ageToDateOfBirth(age: number): string {
  const now = new Date();
  const birthYear = now.getFullYear() - age;
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${birthYear}-${month}-${day}`;
}

export function dateOfBirthToAge(dateOfBirth: string): number | null {
  const dob = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const hasBirthdayPassed =
    now.getMonth() > dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());

  if (!hasBirthdayPassed) age -= 1;
  return age;
}

export function initialsFromName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}
