/**
 * Nafath (نفاذ) API Service
 *
 * All calls go through Firebase Cloud Functions (nafathRequest / nafathStatus)
 * deployed in me-central2 (Dammam, Saudi Arabia) to avoid CORS and to keep
 * credentials server-side.
 *
 * Verification Flow:
 *  1. Call initiateVerification(nationalId) → receives { transId, random, status:'WAITING' }
 *  2. Show random number (1–99) to user — they must match it in the Nafath mobile app
 *  3. Poll checkStatus(nationalId, transId, random) every 5 s
 *  4. Status transitions: WAITING → COMPLETED | REJECTED | EXPIRED (3-min window)
 */

const FUNCTIONS_BASE =
  'https://me-central2-saudi-property-manager.cloudfunctions.net';

export interface NafathRequestResult {
  /** Nafath transaction ID — used for polling */
  transId: string;
  /** Random number (1–99) the user must confirm in the Nafath app */
  random: number;
  /** Always 'WAITING' on a fresh request */
  status: string;
  /** Raw error message if the request fails */
  error?: string;
  /** Setup guide sent by the function when credentials are missing */
  guide?: string;
}

export type NafathStatusValue = 'WAITING' | 'COMPLETED' | 'REJECTED' | 'EXPIRED';

export interface NafathStatusResult {
  transId: string;
  nationalId: string;
  status: NafathStatusValue;
  error?: string;
}

/** Map Nafath status → our internal NafathVerification.status */
export const toInternalStatus = (
  nafathStatus: NafathStatusValue
): 'Pending' | 'Verified' | 'Rejected' | 'Expired' => {
  switch (nafathStatus) {
    case 'COMPLETED': return 'Verified';
    case 'REJECTED':  return 'Rejected';
    case 'EXPIRED':   return 'Expired';
    default:          return 'Pending';
  }
};

/**
 * Initiate a Nafath identity verification.
 * Throws on network error; returns the API response (may contain `.error` if
 * Nafath credentials are not configured or the national ID is invalid).
 */
export const initiateNafathVerification = async (
  nationalId: string,
  service: string = 'PersonalInfo'
): Promise<NafathRequestResult> => {
  const res = await fetch(`${FUNCTIONS_BASE}/nafathRequest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nationalId, service }),
  });

  const data: NafathRequestResult = await res.json().catch(() => ({
    transId: '',
    random: 0,
    status: 'ERROR',
    error: `HTTP ${res.status}`,
  }));

  if (!res.ok) {
    const err = new Error(data.error || `Nafath API error ${res.status}`) as any;
    err.guide = data.guide;
    err.statusCode = res.status;
    throw err;
  }

  return data;
};

/**
 * Poll the status of a previously initiated verification.
 * Returns the current status object.
 */
export const checkNafathStatus = async (
  nationalId: string,
  transId: string,
  random: number
): Promise<NafathStatusResult> => {
  const res = await fetch(`${FUNCTIONS_BASE}/nafathStatus`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nationalId, transId, random }),
  });

  const data: NafathStatusResult = await res.json().catch(() => ({
    transId,
    nationalId,
    status: 'EXPIRED' as NafathStatusValue,
    error: `HTTP ${res.status}`,
  }));

  if (!res.ok) {
    throw new Error(data.error || `Nafath status error ${res.status}`);
  }

  return data;
};

/** Save Nafath credentials (app-id / app-key) to Firestore settings */
export const saveNafathCredentials = async (
  appId: string,
  appKey: string
): Promise<void> => {
  const { db } = await import('../firebase');
  const { doc, setDoc } = await import('firebase/firestore');
  await setDoc(
    doc(db, 'settings', 'main'),
    { nafathAppId: appId, nafathAppKey: appKey },
    { merge: true }
  );
};

/** Retrieve saved Nafath credentials from Firestore settings (masked for display) */
export const getNafathCredentialsMasked = async (): Promise<{
  hasCredentials: boolean;
  maskedAppId: string;
}> => {
  try {
    const { db } = await import('../firebase');
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, 'settings', 'main'));
    if (snap.exists()) {
      const d = snap.data();
      if (d.nafathAppId) {
        const id: string = String(d.nafathAppId);
        return {
          hasCredentials: true,
          maskedAppId: id.slice(0, 4) + '****' + id.slice(-4),
        };
      }
    }
  } catch {
    /* ignore */
  }
  return { hasCredentials: false, maskedAppId: '' };
};
