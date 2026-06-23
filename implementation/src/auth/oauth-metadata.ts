/**
 * OAuth metadata and connector discovery — EXEC-005.
 * Defines security schemes, well-known discovery paths, and www-authenticate challenge.
 *
 * DEV MODE: Local tokens only. No real IdP integration.
 * PRODUCTION: MUST use OAuth 2.1 / OIDC with a mature IdP.
 */

import { CONFIG } from "../config.js";

// ─── Connector metadata (§18.3) ──────────────────────────────────────────────

export const CONNECTOR_METADATA = {
  name: CONFIG.server.name,
  description:
    "Read-only MCP bridge that lets ChatGPT inspect authorized local repository snapshots through file maps, search, symbols, bounded fetch, and refresh. All tools are read-only; repository content is untrusted data and full-repo export is blocked by cumulative byte budgets.",
  mcp_endpoint: "/mcp",
  version: CONFIG.server.version,
  mode: "dev_local" as const, // dev_local | production
};

// ─── Security schemes (§18.2) ────────────────────────────────────────────────

export interface SecurityScheme {
  type: "oauth2" | "mtls" | "bearer" | "dev_local_token";
  description: string;
  applicable: "dev" | "production" | "both";
  status: "implemented" | "blocked" | "planned";
  blocked_reason?: string;
}

export const SECURITY_SCHEMES: SecurityScheme[] = [
  {
    type: "dev_local_token",
    description: "HMAC-based local dev tokens. NOT for production. Tokens must have valid audience, issuer, scope, and expiry.",
    applicable: "dev",
    status: "implemented",
  },
  {
    type: "oauth2",
    description: "OAuth 2.1 with OIDC discovery. Required for production. Must include PKCE, proper audience restriction, and short-lived access tokens.",
    applicable: "production",
    status: "blocked",
    blocked_reason: "No production IdP selected. Must be configured before production deployment.",
  },
  {
    type: "mtls",
    description: "Mutual TLS for transport-layer client authentication. Supplementary to OAuth 2.1; does not replace user authorization.",
    applicable: "production",
    status: "blocked",
    blocked_reason: "Requires certificate infrastructure. Production dependency on Secure MCP Tunnel or equivalent.",
  },
];

// ─── Well-known discovery paths (§18.2) ──────────────────────────────────────

export const WELL_KNOWN_PATHS = {
  oauth_protected_resource: "/.well-known/oauth-protected-resource",
  oauth_authorization_server: "/.well-known/oauth-authorization-server",
  oidc_discovery: "/.well-known/openid-configuration",
};

const productionRequirements = [
  "OAuth 2.1 / OIDC with a mature IdP",
  "mTLS for transport-layer binding",
  "Short-lived access tokens with PKCE",
  "Audience-restricted tokens (no passthrough)",
  "Secure MCP Tunnel or equivalent private channel",
];

// ─── WWW-Authenticate challenge (§18.2) ──────────────────────────────────────

export interface WwwAuthenticateChallenge {
  [key: string]: unknown;
  "mcp/www_authenticate": {
    schemes: string[];
    dev_note?: string;
  };
}

/**
 * Generate the _meta challenge for unauthorized requests.
 * In dev mode, indicates local token is required.
 * In production, would return OAuth 2.1 challenge metadata.
 */
export function buildAuthChallenge(): WwwAuthenticateChallenge {
  const scheme = SECURITY_SCHEMES.find((s) => s.status === "implemented");
  return {
    "mcp/www_authenticate": {
      schemes: scheme ? [scheme.type] : ["dev_local_token"],
      dev_note:
        "Development mode: use a local dev token. Production requires OAuth 2.1/OIDC. mTLS is supplementary only.",
    },
  };
}

/**
 * Generate _meta for connector discovery response.
 */
export function buildConnectorMeta() {
  return {
    name: CONNECTOR_METADATA.name,
    description: CONNECTOR_METADATA.description,
    version: CONNECTOR_METADATA.version,
    mode: CONNECTOR_METADATA.mode,
    securitySchemes: SECURITY_SCHEMES.map((s) => ({
      type: s.type,
      applicable: s.applicable,
      status: s.status,
    })),
    well_known: WELL_KNOWN_PATHS,
    production_requirements: productionRequirements,
  };
}

/**
 * Protected resource metadata for ChatGPT OAuth discovery.
 * Dev mode intentionally advertises no authorization server.
 */
export function buildProtectedResourceMetadata(resourceOrigin: string) {
  return {
    resource: `${resourceOrigin}${CONNECTOR_METADATA.mcp_endpoint}`,
    authorization_servers: [],
    mode: CONNECTOR_METADATA.mode,
    oauth2_status: "blocked" as const,
    blocked_reason: "Development mode has no production OAuth 2.1 / OIDC IdP configured.",
    dev_auth: {
      type: "dev_local_token" as const,
      status: "implemented" as const,
      production_safe: false,
    },
    well_known: WELL_KNOWN_PATHS,
    production_requirements: productionRequirements,
  };
}

export function buildAuthorizationServerUnavailable() {
  return {
    error: "oauth_authorization_server_unavailable",
    error_description:
      "Development mode does not expose OAuth authorization-server or OpenID Connect metadata. Configure a production OAuth 2.1/OIDC IdP before selecting OAuth in ChatGPT.",
    mode: CONNECTOR_METADATA.mode,
    oauth2_status: "blocked" as const,
    blocked_reason: "No production IdP selected. Must be configured before production deployment.",
    well_known: WELL_KNOWN_PATHS,
    production_requirements: productionRequirements,
  };
}
