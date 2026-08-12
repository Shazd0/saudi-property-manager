import { createRemoteJWKSet, jwtVerify } from 'jose';

const denied = (message = 'Owner authentication failed') =>
  Object.assign(new Error(message), { status: 401, code: 'UNAUTHORIZED' });

export function createCloudflareAccessVerifier({
  teamDomain,
  issuer,
  audience,
  allowedEmails,
  now = () => Date.now(),
  jwtVerifyFn = jwtVerify,
  jwks,
} = {}) {
  const emails = new Set((allowedEmails || []).map((email) => String(email).trim().toLowerCase()).filter(Boolean));
  if (!teamDomain || !issuer || !audience || emails.size === 0) {
    return { available: false, async verify() { throw denied('Owner authentication is not configured'); } };
  }
  let domain;
  try {
    domain = new URL(teamDomain);
  } catch {
    return { available: false, async verify() { throw denied('Owner authentication is not configured'); } };
  }
  if (domain.origin !== teamDomain || domain.protocol !== 'https:' || issuer !== `${teamDomain}/`) {
    return { available: false, async verify() { throw denied('Owner authentication is not configured'); } };
  }
  const keySet = jwks || createRemoteJWKSet(new URL('/cdn-cgi/access/certs', teamDomain));
  return {
    available: true,
    async verify(token) {
      if (!token) throw denied();
      let payload;
      try {
        ({ payload } = await jwtVerifyFn(token, keySet, {
          issuer,
          audience,
          clockTolerance: 5,
          currentDate: new Date(now()),
        }));
      } catch {
        throw denied();
      }
      const email = String(payload.email || '').trim().toLowerCase();
      if (!email || !emails.has(email) || !Number.isFinite(payload.iat)) throw denied();
      return {
        actorType: 'owner',
        actorId: email,
        email,
        bookId: '*',
        accessIssuedAt: Number(payload.iat) * 1000,
      };
    },
  };
}
