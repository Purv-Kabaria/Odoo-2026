/**
 * Shared session cookie name. Kept dependency-free (no Node APIs, no
 * server-only imports) so it can be safely imported from both `lib/auth.ts`
 * (Node runtime) and `middleware.ts` (Edge runtime) without pulling
 * Node-only crypto into the Edge bundle.
 */
export const SESSION_COOKIE_NAME = "odoo_session";
