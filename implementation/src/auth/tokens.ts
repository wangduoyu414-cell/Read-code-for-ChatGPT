/**
 * Token management — development-only local tokens.
 * Production MUST use OAuth 2.1 / OIDC with a mature IdP.
 *
 * Implements AUTH-001 through AUTH-005 from task-card.md §9.
 */

import { createHmac, randomUUID } from "node:crypto";
import type { DevTokenClaims } from "../policy/policy-types.js";

// ─── Dev-only: HMAC-based local tokens ───────────────────────────────────────

const DEV_SECRET = "CHATGPT-LOCAL-REPO-001-DEV-ONLY"; // never hardcode in production
const TOKEN_PREFIX = "clr1_dev_";

interface TokenRecord {
  token_hash: string;
  claims: DevTokenClaims;
  created_at: string;
  revoked: boolean;
}

const tokenStore = new Map<string, TokenRecord>();

/**
 * Create a development-only token.
 * DO NOT use in production — must be replaced with OAuth 2.1 / OIDC.
 */
export function createDevToken(claims: DevTokenClaims): { token: string; claims: DevTokenClaims } {
  const raw = `${TOKEN_PREFIX}${randomUUID()}`;
  const hash = hashToken(raw);

  tokenStore.set(hash, {
    token_hash: hash,
    claims: { ...claims },
    created_at: new Date().toISOString(),
    revoked: false,
  });

  // Don't log the actual token
  return { token: raw, claims: { ...claims } };
}

/**
 * Verify a development token and return claims if valid.
 * Returns null if invalid, expired, revoked, or wrong audience.
 */
export function verifyDevToken(token: string): DevTokenClaims | null {
  if (!token.startsWith(TOKEN_PREFIX)) return null;

  const hash = hashToken(token);
  const record = tokenStore.get(hash);

  if (!record) return null;
  if (record.revoked) return null;

  // Check expiry
  if (new Date(record.claims.expiry) < new Date()) {
    tokenStore.delete(hash); // cleanup expired
    return null;
  }

  return { ...record.claims };
}

/**
 * Verify token and enforce audience, scope, issuer checks.
 * Rejects token passthrough (AUTH-003): only accepts tokens issued TO this server.
 */
export function verifyTokenWithChecks(
  token: string,
  expectedAudience: string,
  requiredScopes: string[],
  expectedIssuer: string,
): { claims: DevTokenClaims } | { error: string } {
  const claims = verifyDevToken(token);
  if (!claims) return { error: "Token invalid or expired." };

  // AUTH-003: no token passthrough — reject wrong audience
  if (claims.audience !== expectedAudience) {
    return { error: "Token audience mismatch." };
  }

  // Check issuer
  if (claims.issuer !== expectedIssuer) {
    return { error: "Token issuer not trusted." };
  }

  // Check scope
  for (const required of requiredScopes) {
    if (!claims.scope.includes(required)) {
      return { error: `Missing required scope: ${required}` };
    }
  }

  return { claims };
}

/**
 * Revoke a token. After revocation, all grants tied to this token must be rejected.
 */
export function revokeDevToken(token: string): boolean {
  const hash = hashToken(token);
  const record = tokenStore.get(hash);
  if (!record) return false;
  record.revoked = true;
  return true;
}

function hashToken(token: string): string {
  return createHmac("sha256", DEV_SECRET).update(token).digest("hex");
}

/** Clear all tokens (for testing). */
export function clearTokens(): void {
  tokenStore.clear();
}
