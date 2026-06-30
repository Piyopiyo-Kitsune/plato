export const USERS_TABLE = process.env.USERS_TABLE || 'plato-users';
export const INVITES_TABLE = process.env.INVITES_TABLE || 'plato-invites';
export const REFRESH_TOKENS_TABLE = process.env.REFRESH_TOKENS_TABLE || 'plato-refresh-tokens';
export const SYNC_DATA_TABLE = process.env.SYNC_DATA_TABLE || 'plato-sync-data';
export const AUDIT_LOG_TABLE = process.env.AUDIT_LOG_TABLE || 'plato-audit-log';
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
export const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL || '';
export const APP_URL = process.env.APP_URL || 'http://localhost:3000';
export const SKIP_EMAIL = process.env.SKIP_EMAIL === 'true';
export const USER_ID_PREFIX = 'usr_';
export const INVITE_TOKEN_PREFIX = 'inv_';
export const REFRESH_TOKEN_PREFIX = 'rt_';
export const ACCESS_TOKEN_EXPIRY = '15m';
export const REFRESH_TOKEN_TTL_DAYS = 30;
export const INVITE_TTL_DAYS = 7;
export const RESET_TOKEN_PREFIX = 'rst_';
export const RESET_TOKEN_TTL_HOURS = 1;
export const BCRYPT_ROUNDS = 10;
export const DB_BACKEND = process.env.DB_BACKEND || 'dynamodb';
export const SQLITE_PATH = process.env.SQLITE_PATH || './data/plato.db';

// WordPress companion-plugin bridge (see server/src/routes/bridge.js).
// Shared HMAC secret the WordPress plugin signs token-exchange requests with.
// When empty, the bridge endpoints are disabled (fail closed).
export const BRIDGE_SHARED_SECRET = process.env.BRIDGE_SHARED_SECRET || '';
// Optional comma-separated allowlist of WordPress siteIds permitted to use the
// bridge. Empty means "allow any signed request" (suitable for local dev).
export const BRIDGE_ALLOWED_SITES = process.env.BRIDGE_ALLOWED_SITES || '';
// Replay window (seconds) for signed bridge requests, and the lifetime of a
// one-time embed code returned by /v1/bridge/token.
export const BRIDGE_CLOCK_SKEW_SECONDS = Number(process.env.BRIDGE_CLOCK_SKEW_SECONDS || 300);
export const BRIDGE_CODE_TTL_SECONDS = Number(process.env.BRIDGE_CODE_TTL_SECONDS || 90);
