/**
 * Strip all non-digit characters from a phone string.
 * Also drops a leading country code "1" if the result is 11 digits.
 */
export function stripPhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

/**
 * Format a phone string as (xxx) xxx-xxxx.
 * Works on partial input — formats progressively as digits accumulate.
 */
export function formatPhone(input: string): string {
  const digits = stripPhone(input);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

/**
 * Returns true if the input contains exactly 10 digits after stripping.
 */
export function isValidPhone(input: string): boolean {
  return stripPhone(input).length === 10;
}
