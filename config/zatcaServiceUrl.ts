/**
 * ZATCA signing API base URL (no trailing slash).
 * Set VITE_ZATCA_SERVICE_URL in .env.local before `npm run build` / `npm run desktop:build`
 * so installed apps call your hosted ZATCA service (HTTPS) instead of localhost:3002.
 */
export const ZATCA_SERVICE_BASE_URL: string = (
  (import.meta as { env?: { VITE_ZATCA_SERVICE_URL?: string } }).env?.VITE_ZATCA_SERVICE_URL || 'http://localhost:3002'
).replace(/\/$/, '');

export function zatcaSignAndReportPath(): string {
  return `${ZATCA_SERVICE_BASE_URL}/zatca/sign-and-report`;
}
