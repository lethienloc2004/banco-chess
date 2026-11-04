import { describe, expect, it } from 'vitest';
import { b64url, signToken, verifyGoogleIdToken, verifyToken } from '../server/auth';
import { cleanName, elo } from '../src/shared/protocol';

const enc = new TextEncoder();

describe('session tokens', () => {
  it('round-trips and rejects tampering, other secrets and expiry', async () => {
    const tok = await signToken('u_abc', 'secret');
    expect(await verifyToken(tok, 'secret')).toBe('u_abc');
    expect(await verifyToken(tok, 'other')).toBeNull();
    expect(await verifyToken(tok.slice(0, -2) + 'xx', 'secret')).toBeNull();
    expect(await verifyToken(tok, 'secret', Date.now() + 400 * 86400_000)).toBeNull();
    expect(await verifyToken('garbage', 'secret')).toBeNull();
  });
});

describe('Google ID token verification', () => {
  it('accepts a correctly signed token and rejects wrong audience / expiry / signature', async () => {
    const keys = await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'],
    );
    const jwk = (await crypto.subtle.exportKey('jwk', keys.publicKey)) as { n: string; e: string };
    const getKeys = async () => [{ kid: 'k1', kty: 'RSA', n: jwk.n, e: jwk.e }];
    const make = async (claims: object, kid = 'k1') => {
      const head = b64url(enc.encode(JSON.stringify({ alg: 'RS256', kid })));
      const body = b64url(enc.encode(JSON.stringify(claims)));
      const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, enc.encode(`${head}.${body}`));
      return `${head}.${body}.${b64url(sig)}`;
    };
    const now = Date.now();
    const good = { sub: '123', email: 'a@b.c', email_verified: true, aud: 'client', iss: 'https://accounts.google.com', exp: now / 1000 + 600 };
    expect(await verifyGoogleIdToken(await make(good), 'client', getKeys)).toMatchObject({ sub: '123', email: 'a@b.c' });
    expect(await verifyGoogleIdToken(await make({ ...good, aud: 'other' }), 'client', getKeys)).toBeNull();
    expect(await verifyGoogleIdToken(await make({ ...good, exp: now / 1000 - 10 }), 'client', getKeys)).toBeNull();
    expect(await verifyGoogleIdToken(await make({ ...good, iss: 'evil' }), 'client', getKeys)).toBeNull();
    expect(await verifyGoogleIdToken(await make(good, 'k2'), 'client', getKeys)).toBeNull();
    const t = await make(good);
    expect(await verifyGoogleIdToken(t.slice(0, -4) + 'AAAA', 'client', getKeys)).toBeNull();
  });
});

describe('shared helpers', () => {
  it('cleans names and computes Elo', () => {
    expect(cleanName('  <Hùng>   Cờ  ')).toBe('Hùng Cờ');
    expect(cleanName('a')).toBeNull();
    expect(cleanName('x'.repeat(21))).toBeNull();
    expect(elo(1200, 1200, 1)).toEqual([1216, 1184]);
    expect(elo(1200, 1200, 0.5)).toEqual([1200, 1200]);
  });
});
