// validators.ts
// Centralized strict validators for mobile, email, VAT, and CR numbers (Saudi Arabia)

/**
 * Validates Saudi mobile numbers (05XXXXXXXX or 5XXXXXXXX, 9 or 10 digits, starts with 5 or 05)
 */
export function isValidSaudiMobile(mobile: string): boolean {
  // Accepts 05XXXXXXXX or 5XXXXXXXX (with or without leading 0)
  return /^(05\d{8}|5\d{8})$/.test(mobile);
}

/**
 * Validates email address (strict RFC 5322 simplified)
 */
export function isValidEmail(email: string): boolean {
  // Basic strict email regex
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email);
}

/**
 * Validates Saudi VAT number (15 digits, starts with 3)
 */
export function isValidSaudiVAT(vat: string): boolean {
  return /^3\d{14}$/.test(vat);
}

/**
 * Validates Saudi CR number (10 digits, starts with 1, 2, or 7)
 * Note: Relaxed to 5-15 digits to allow Unified Numbers and general entries.
 */
export function isValidSaudiCR(cr: string): boolean {
  return /^\d{5,15}$/.test(cr);
}
