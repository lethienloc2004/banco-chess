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
}
