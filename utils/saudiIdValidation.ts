// saudiIdValidation.ts
// Utility for validating Saudi National ID and Iqama numbers

/**
 * Validates a Saudi National ID (starts with 1) or Iqama (starts with 2), 10 digits, Luhn checksum
 */
export function isValidSaudiIdOrIqama(id: string): boolean {
  if (!/^\d{10}$/.test(id)) return false;
  const first = id[0];
  if (first !== '1' && first !== '2') return false;
  // Luhn checksum
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let digit = parseInt(id[i], 10);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}
