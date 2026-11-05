export interface Env {
  DB: D1Database;
  ROOMS: DurableObjectNamespace;
  LOBBY: DurableObjectNamespace;
  ASSETS: Fetcher;
  /** Secret used to sign session tokens (wrangler secret put AUTH_SECRET). */
  AUTH_SECRET: string;
  /** OAuth client id for "Sign in with Google" (optional). */
  GOOGLE_CLIENT_ID?: string;
  /** Comma-separated Google emails that become admins on login. */
  ADMIN_EMAILS?: string;
  /** "1" only in local development: enables the dev admin login. */
  DEV?: string;
  /** Brevo API key for sending sign-in codes (wrangler secret put BREVO_API_KEY). */
  BREVO_API_KEY?: string;
  /** Sender address verified in Brevo, e.g. your Gmail address. */
  MAIL_FROM?: string;
  /** Sender name shown in the mailbox (default "Bàn Cờ"). */
  MAIL_NAME?: string;
}
