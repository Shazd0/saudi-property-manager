// Minimal WebAuthn server using @simplewebauthn/server
// Stores credentials in memory (or a JSON file) for demo purposes

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from '@simplewebauthn/server';

const app = express();
app.use(cors());
app.use(express.json());

const RP_NAME = 'Amlak Property Manager';
const RP_ID = 'localhost';
const ORIGIN = 'http://localhost:5173';

const DATA_FILE = path.join(process.cwd(), 'credentials.json');
let db = { users: {}, credentials: {} };
try { if (fs.existsSync(DATA_FILE)) db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')); } catch {}

function saveDb() { fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)); }

app.post('/webauthn/generate-registration-options', (req, res) => {
  const { userId, userName } = req.body;
  const options = generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: userName || userId,
    userID: userId,
    authenticatorSelection: {
      residentKey: 'required',
      requireResidentKey: true,
      userVerification: 'required',
    },
    attestationType: 'none',
  });
  db.users[userId] = { name: userName || userId };
  db.credentials[userId] = db.credentials[userId] || [];
  db.users[userId].currentChallenge = options.challenge;
  saveDb();
  res.json(options);
});

app.post('/webauthn/verify-registration', async (req, res) => {
  const { userId, clientDataJSON, attestationObject, id, type } = req.body;
  try {
    const verification = await verifyRegistrationResponse({
      response: {
        clientDataJSON: Buffer.from(clientDataJSON, 'base64'),
        attestationObject: Buffer.from(attestationObject, 'base64'),
      },
      expectedChallenge: db.users[userId]?.currentChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });
    if (verification.verified) {
      const { registrationInfo } = verification;
      db.credentials[userId].push({
        credentialID: registrationInfo?.credentialID.toString('base64url'),
        credentialPublicKey: registrationInfo?.credentialPublicKey.toString('base64'),
        counter: registrationInfo?.counter || 0,
      });
      saveDb();
      return res.json({ success: true });
    }
    return res.status(400).json({ success: false });
  } catch (e) {
    return res.status(400).json({ success: false, error: e?.message });
  }
});

app.post('/webauthn/generate-authentication-options', (req, res) => {
  const { userId } = req.body;
  const creds = (db.credentials[userId] || []).map(c => ({
    id: c.credentialID,
    type: 'public-key',
  }));
  const options = generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'required',
    allowCredentials: creds,
  });
  db.users[userId].currentChallenge = options.challenge;
  saveDb();
  res.json(options);
});

app.post('/webauthn/verify-authentication', async (req, res) => {
  const { userId, clientDataJSON, authenticatorData, signature, rawId } = req.body;
  const creds = db.credentials[userId] || [];
  if (!creds.length) return res.status(400).json({ success: false, error: 'No credentials registered' });
  const credential = creds[0];
  try {
    const verification = await verifyAuthenticationResponse({
      response: {
        clientDataJSON: Buffer.from(clientDataJSON, 'base64'),
        authenticatorData: Buffer.from(authenticatorData, 'base64'),
        signature: Buffer.from(signature, 'base64'),
        rawId: Buffer.from(rawId, 'base64'),
      },
      expectedChallenge: db.users[userId]?.currentChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      authenticator: {
        credentialPublicKey: Buffer.from(credential.credentialPublicKey, 'base64'),
        credentialID: Buffer.from(credential.credentialID, 'base64url'),
        counter: credential.counter,
      },
    });
    if (verification.verified) {
      credential.counter = verification.authenticationInfo?.newCounter || credential.counter;
      saveDb();
      return res.json({ success: true });
    }
    return res.status(400).json({ success: false });
  } catch (e) {
    return res.status(400).json({ success: false, error: e?.message });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`WebAuthn server running on http://localhost:${port}`));
