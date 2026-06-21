import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CONNECTOR_METADATA,
  SECURITY_SCHEMES,
  WELL_KNOWN_PATHS,
  buildAuthChallenge,
  buildAuthorizationServerUnavailable,
  buildConnectorMeta,
  buildProtectedResourceMetadata,
} from "../src/auth/oauth-metadata.js";

await describe("Connector Auth Discovery", async () => {
  await it("has connector name and description", () => {
    assert.ok(CONNECTOR_METADATA.name);
    assert.ok(CONNECTOR_METADATA.description.includes("read-only"));
  });
  await it("has /mcp endpoint", () => {
    assert.equal(CONNECTOR_METADATA.mcp_endpoint, "/mcp");
  });
  await it("is in dev_local mode", () => {
    assert.equal(CONNECTOR_METADATA.mode, "dev_local");
  });
  await it("has dev local token scheme implemented", () => {
    const devScheme = SECURITY_SCHEMES.find((s) => s.type === "dev_local_token");
    assert.ok(devScheme);
    assert.equal(devScheme?.status, "implemented");
  });
  await it("has oauth2 blocked with reason", () => {
    const oa = SECURITY_SCHEMES.find((s) => s.type === "oauth2");
    assert.ok(oa);
    assert.equal(oa?.status, "blocked");
    assert.ok(oa?.blocked_reason);
  });
  await it("has mtls blocked with reason", () => {
    const mt = SECURITY_SCHEMES.find((s) => s.type === "mtls");
    assert.ok(mt);
    assert.equal(mt?.status, "blocked");
  });
  await it("buildAuthChallenge returns schemes", () => {
    const c = buildAuthChallenge();
    assert.ok(c["mcp/www_authenticate"]);
    assert.ok(c["mcp/www_authenticate"].schemes.length > 0);
  });
  await it("buildConnectorMeta includes production requirements", () => {
    const m = buildConnectorMeta();
    assert.ok(m.production_requirements.length > 0);
    assert.equal(m.mode, "dev_local");
  });
  await it("buildProtectedResourceMetadata advertises no dev OAuth server", () => {
    const m = buildProtectedResourceMetadata("https://example.test");
    assert.equal(m.resource, "https://example.test/mcp");
    assert.deepEqual(m.authorization_servers, []);
    assert.equal(m.oauth2_status, "blocked");
    assert.equal(m.dev_auth.production_safe, false);
  });
  await it("buildAuthorizationServerUnavailable is explicit", () => {
    const m = buildAuthorizationServerUnavailable();
    assert.equal(m.error, "oauth_authorization_server_unavailable");
    assert.equal(m.oauth2_status, "blocked");
    assert.ok(m.error_description.includes("Development mode"));
  });
  await it("well_known paths defined", () => {
    assert.ok(WELL_KNOWN_PATHS.oauth_protected_resource);
    assert.ok(WELL_KNOWN_PATHS.oauth_authorization_server);
    assert.ok(WELL_KNOWN_PATHS.oidc_discovery);
  });
});
