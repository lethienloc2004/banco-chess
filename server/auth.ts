/** Session tokens (HMAC-signed) and Google ID token verification. */

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(pad);
  return Uint8Array.from(bin, c => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

const TOKEN_DAYS = 365;

export async function signToken(uid: string, secret: string, now = Date.now()): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({ uid, exp: now + TOKEN_DAYS * 86400_000 })));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(payload));
  return `${payload}.${b64url(sig)}`;
}

export async function verifyToken(token: string | null | undefined, secret: string, now = Date.now()): Promise<string | null> {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromB64url(sig), enc.encode(payload));
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as { uid: string; exp: number };
    return data.exp > now && typeof data.uid === 'string' ? data.uid : null;
  } catch {
    return null;
  }
}

export function randomId(prefix = '', bytes = 9): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return prefix + b64url(a);
}

/** Short, unambiguous room id (letters and digits only). */
export function roomId(len = 7): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return Array.from(a, b => alphabet[b % alphabet.length]).join('');
}

export interface GoogleClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

interface Jwk { kid: string; n: string; e: string; kty: string; alg?: string }
type JwksFetcher = () => Promise<Jwk[]>;

let jwksCache: { keys: Jwk[]; at: number } | null = null;
const defaultJwks: JwksFetcher = async () => {
  if (jwksCache && Date.now() - jwksCache.at < 3600_000) return jwksCache.keys;
  const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  const { keys } = (await res.json()) as { keys: Jwk[] };
  jwksCache = { keys, at: Date.now() };
  return keys;
};

/** Verify a Google Identity Services ID token (RS256) and return its claims. */
export async function verifyGoogleIdToken(
  idToken: string, clientId: string, getKeys: JwksFetcher = defaultJwks, now = Date.now(),
): Promise<GoogleClaims | null> {
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(new TextDecoder().decode(fromB64url(parts[0]))) as { kid: string; alg: string };
    if (header.alg !== 'RS256') return null;
    const jwk = (await getKeys()).find(k => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey(
      'jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'],
    );
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, fromB64url(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));
    if (!ok) return null;
    const c = JSON.parse(new TextDecoder().decode(fromB64url(parts[1]))) as GoogleClaims & { aud: string; iss: string; exp: number };
    if (c.aud !== clientId) return null;
    if (c.iss !== 'https://accounts.google.com' && c.iss !== 'accounts.google.com') return null;
    if (c.exp * 1000 < now) return null;
    return { sub: c.sub, email: c.email, email_verified: c.email_verified, name: c.name };
  } catch {
    return null;
  }
}

export { b64url, fromB64url };
