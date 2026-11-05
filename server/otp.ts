/** Email sign-in codes: generation, storage as keyed hashes, rate limits and sending through Brevo. */
import type { Env } from './env';

export const OTP_TTL_MS = 10 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_MS = 60_000;
const HOUR = 3600_000;
export const LIMITS = { perEmail: 5, perIp: 20 };

const enc = new TextEncoder();

/** Lower-cased email if it looks valid, else null. */
export function normalizeEmail(raw: unknown): string | null {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) return null;
  return s;
}

/** Six random digits, uniformly distributed. */
export function newCode(): string {
  const a = new Uint32Array(1);
  do crypto.getRandomValues(a); while (a[0] >= 4_294_000_000); // drop the biased tail
  return String(a[0] % 1_000_000).padStart(6, '0');
}

/** HMAC of email + code with the server secret, so a database leak does not reveal codes. */
export async function hashCode(email: string, code: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`otp:${email}:${code}`)));
  return Array.from(sig, b => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time comparison of two hex strings. */
export function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** Count one hit for `key`; false when more than `limit` hits fall in the current hour. */
export async function rateHit(db: D1Database, key: string, limit: number, now = Date.now()): Promise<boolean> {
  const row = await db.prepare(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN window_start <= ? THEN 1 ELSE count + 1 END,
       window_start = CASE WHEN window_start <= ? THEN excluded.window_start ELSE window_start END
     RETURNING count`,
  ).bind(key, now, now - HOUR, now - HOUR).first<{ count: number }>();
  return (row?.count ?? 1) <= limit;
}

export function emailLoginEnabled(env: Env): boolean {
  return !!(env.BREVO_API_KEY && env.MAIL_FROM) || env.DEV === '1';
}

/** Send the code. Without Brevo in local development the code is printed instead. */
export async function sendCode(env: Env, email: string, code: string, lang: string): Promise<'sent' | 'logged' | 'failed'> {
  const vi = lang !== 'en';
  if (!env.BREVO_API_KEY || !env.MAIL_FROM) {
    if (env.DEV !== '1') return 'failed';
    console.log(`[dev] Mã đăng nhập cho ${email}: ${code}`);
    return 'logged';
  }
  const subject = vi ? `Mã đăng nhập Bàn Cờ: ${code}` : `Your Bàn Cờ sign-in code: ${code}`;
  const text = vi
    ? `Mã đăng nhập Bàn Cờ của bạn là ${code}. Mã có hiệu lực trong 10 phút.\nNếu bạn không yêu cầu mã này, hãy bỏ qua thư.`
    : `Your Bàn Cờ sign-in code is ${code}. It is valid for 10 minutes.\nIf you did not ask for it, ignore this email.`;
  const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:460px;margin:auto;padding:24px;color:#2b2118">
    <h2 style="margin:0 0 12px">♟ Bàn Cờ</h2>
    <p>${vi ? 'Mã đăng nhập của bạn:' : 'Your sign-in code:'}</p>
    <p style="font-size:34px;font-weight:800;letter-spacing:8px;margin:12px 0">${code}</p>
    <p style="color:#6b5a4b">${vi ? 'Mã có hiệu lực trong 10 phút. Nếu bạn không yêu cầu mã này, hãy bỏ qua thư.' : 'Valid for 10 minutes. If you did not ask for it, ignore this email.'}</p>
  </div>`;
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: env.MAIL_NAME || 'Bàn Cờ', email: env.MAIL_FROM },
        to: [{ email }], subject, textContent: text, htmlContent: html,
      }),
    });
    if (!res.ok) console.error('Brevo', res.status, await res.text().catch(() => ''));
    return res.ok ? 'sent' : 'failed';
  } catch (err) {
    console.error('Brevo', err);
    return 'failed';
  }
}
