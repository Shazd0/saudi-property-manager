// Client-side WebAuthn biometric service
// Uses platform authenticators (Face ID / Touch ID / Windows Hello) — NO server required
// Credentials are stored in localStorage and verified locally on the device

const RP_NAME = 'Amlak Property Manager';

function getOriginRP(): { rpId: string; origin: string } {
  const hostname = window.location.hostname;
  return {
    rpId: hostname,
    origin: window.location.origin,
  };
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBuffer(base64url: string): ArrayBuffer {
  if (!base64url || typeof base64url !== 'string') throw new Error('Invalid base64url');
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function randomBuffer(len: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(len));
}

function getStoredCredentialId(userId: string): string | null {
  return localStorage.getItem(`webauthn_credId_${userId}`);
}

function storeCredentialId(userId: string, credId: string) {
  localStorage.setItem(`webauthn_credId_${userId}`, credId);
}

function removeCredentialId(userId: string) {
  localStorage.removeItem(`webauthn_credId_${userId}`);
}

/** Check if WebAuthn + platform authenticator is available on this device */
export async function isBiometricAvailable(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Register a passkey for the user using the device's biometric sensor.
 * This creates a credential stored on the device and saves its ID locally.
 */
export async function registerPasskey(userId: string, userName: string): Promise<boolean> {
  const { rpId } = getOriginRP();

  const challenge = randomBuffer(32);
  const userIdBytes = new TextEncoder().encode(userId);

  const credential = await navigator.credentials.create({
    publicKey: {
      rp: { name: RP_NAME, id: rpId },
      user: { id: userIdBytes, name: userName || userId, displayName: userName || userId },
      challenge,
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },   // ES256
        { type: 'public-key', alg: -257 },  // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Face ID / Touch ID / Windows Hello only
        residentKey: 'preferred',
        userVerification: 'required',
      },
      timeout: 60000,
      attestation: 'none',
    },
  });

  if (!credential) return false;

  // Store the credential ID so we can request it during authentication
  const credId = bufferToBase64Url((credential as PublicKeyCredential).rawId);
  storeCredentialId(userId, credId);
  setBiometricEnabled(userId, true);
  return true;
}

/**
 * Authenticate using the device's biometric sensor (Face ID / Touch ID).
 * We present the stored credential and ask the device to verify the user.
 * If the authenticator responds successfully, the user passed biometric verification.
 */
export async function authenticatePasskey(userId: string): Promise<boolean> {
  const { rpId } = getOriginRP();
  const storedCredId = getStoredCredentialId(userId);

  const challenge = randomBuffer(32);

  const requestOptions: PublicKeyCredentialRequestOptions = {
    challenge,
    rpId,
    userVerification: 'required',
    timeout: 60000,
    ...(storedCredId ? {
      allowCredentials: [{
        type: 'public-key',
        id: base64UrlToBuffer(storedCredId),
      }],
    } : {}),
  };

  try {
    const assertion = await navigator.credentials.get({ publicKey: requestOptions });
    // If we got here without throwing, the user passed biometric verification
    return !!assertion;
  } catch {
    return false;
  }
}

export function isBiometricEnabled(userId: string): boolean {
  return localStorage.getItem(`biometricEnabled_${userId}`) === 'true';
}

export function setBiometricEnabled(userId: string, enabled: boolean) {
  if (!enabled) {
    removeCredentialId(userId);
    removeBiometricUserData();
  }
  localStorage.setItem(`biometricEnabled_${userId}`, enabled ? 'true' : 'false');
}

/**
 * Store the user object alongside biometric registration so we can
 * auto-login on the next visit without requiring a password.
 */
export function storeBiometricUserData(user: any) {
  localStorage.setItem('biometric_user_data', JSON.stringify({
    id: user.id || user.uid,
    uid: user.uid || user.id,
    name: user.name,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    buildingId: user.buildingId,
    buildingIds: user.buildingIds,
    emailVerified: user.emailVerified,
    status: user.status,
  }));
}

/**
 * Retrieve the stored biometric user data (returns null if none registered).
 */
export function getBiometricUserData(): any | null {
  const raw = localStorage.getItem('biometric_user_data');
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    // verify that biometric is actually still enabled for this user
    if (data && (data.id || data.uid) && isBiometricEnabled(data.id || data.uid)) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Remove stored biometric user data (called on disable).
 */
export function removeBiometricUserData() {
  localStorage.removeItem('biometric_user_data');
}
