import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createDevToken, verifyDevToken, verifyTokenWithChecks, revokeDevToken, clearTokens } from "../src/auth/tokens.js";
import { createGrant, recordConsent, getGrant, revokeGrant, isGrantActive, requiresReConsent, clearGrants, defaultGrantBudget } from "../src/auth/grants.js";
import { authorizeToolCall, authDeniedResponse } from "../src/policy/policy-engine.js";
import type { ConsentRecord } from "../src/auth/grants.js";

const U = "user-1";
const C = "client-1";
const R = "repo-1";
const S = "snap-1";

function mkConsent(o: Partial<ConsentRecord> = {}): ConsentRecord {
  return {
    consent_id: `c-${Date.now()}`,
    consent_actor: U, consent_at: new Date().toISOString(), consent_surface: "api",
    approved_repo_id: R, approved_snapshot_id: S,
    approved_paths: ["src/"], approved_tools: ["repo_search", "repo_files", "repo_fetch", "repo_tree", "repo_symbols"],
    approved_budget: defaultGrantBudget(),
    expires_at: new Date(Date.now() + 36e5).toISOString(), ...o,
  };
}

function mkToken(o: Record<string, unknown> = {}) {
  return createDevToken({
    user_id: U, client_id: C, audience: "chatgpt-local-repo-001", scope: ["read:snapshot"],
    issuer: "chatgpt-local-repo-001-dev", issued_at: new Date().toISOString(),
    expiry: new Date(Date.now() + 36e5).toISOString(), ...o,
  });
}

beforeEach(() => { clearTokens(); clearGrants(); });

await describe("Dev Tokens", async () => {
  await it("create and verify", () => {
    const { token } = mkToken();
    assert.ok(verifyDevToken(token));
  });
  await it("reject wrong audience", () => {
    const { token } = mkToken({ audience: "evil" });
    const r = verifyTokenWithChecks(token, "chatgpt-local-repo-001", ["read:snapshot"], "chatgpt-local-repo-001-dev");
    assert.ok("error" in r);
  });
  await it("reject missing scope", () => {
    const { token } = mkToken({ scope: ["write"] });
    const r = verifyTokenWithChecks(token, "chatgpt-local-repo-001", ["read:snapshot"], "chatgpt-local-repo-001-dev");
    assert.ok("error" in r);
  });
  await it("reject wrong issuer", () => {
    const { token } = mkToken({ issuer: "evil" });
    const r = verifyTokenWithChecks(token, "chatgpt-local-repo-001", ["read:snapshot"], "chatgpt-local-repo-001-dev");
    assert.ok("error" in r);
  });
  await it("revoked token rejected", () => {
    const { token } = mkToken();
    revokeDevToken(token);
    assert.equal(verifyDevToken(token), null);
  });
});

await describe("Grants", async () => {
  await it("create with consent", () => {
    const c = mkConsent(); recordConsent(c);
    const g = createGrant({ user_id: U, client_id: C, repo_id: R, snapshot_id: S, allowed_tools: ["repo_search"], allowed_paths: ["src/"], data_budget: defaultGrantBudget(), expiry: new Date(Date.now() + 36e5).toISOString(), revoked_at: null }, c);
    assert.ok("grant_id" in g);
  });
  await it("reject without matching consent", () => {
    const c = mkConsent({ approved_repo_id: "other" }); recordConsent(c);
    const g = createGrant({ user_id: U, client_id: C, repo_id: R, snapshot_id: S, allowed_tools: ["repo_search"], allowed_paths: ["src/"], data_budget: defaultGrantBudget(), expiry: new Date(Date.now() + 36e5).toISOString(), revoked_at: null }, c);
    assert.ok("error" in g);
  });
  await it("revoke -> inactive", () => {
    const c = mkConsent(); recordConsent(c);
    const g = createGrant({ user_id: U, client_id: C, repo_id: R, snapshot_id: S, allowed_tools: ["repo_search"], allowed_paths: ["src/"], data_budget: defaultGrantBudget(), expiry: new Date(Date.now() + 36e5).toISOString(), revoked_at: null }, c);
    const grant = getGrant((g as { grant_id: string }).grant_id)!;
    assert.equal(isGrantActive(grant), true);
    revokeGrant((g as { grant_id: string }).grant_id);
    assert.equal(isGrantActive(grant), false);
  });
  await it("re-consent for path expansion", () => {
    const c = mkConsent({ approved_paths: ["src/ui/"] }); recordConsent(c);
    const g = createGrant({ user_id: U, client_id: C, repo_id: R, snapshot_id: S, allowed_tools: ["repo_search"], allowed_paths: ["src/ui/"], data_budget: defaultGrantBudget(), expiry: new Date(Date.now() + 36e5).toISOString(), revoked_at: null }, c);
    const grant = getGrant((g as { grant_id: string }).grant_id)!;
    assert.equal(requiresReConsent(grant, "repo_search", "src/utils/x.ts").required, true);
  });
});

await describe("Policy Engine", async () => {
  let token: string, gid: string;
  beforeEach(() => {
    clearTokens(); clearGrants();
    const c = mkConsent(); recordConsent(c);
    token = mkToken().token;
    const g = createGrant({ user_id: U, client_id: C, repo_id: R, snapshot_id: S, allowed_tools: ["repo_search","repo_files","repo_fetch","repo_tree","repo_symbols"], allowed_paths: ["src/"], data_budget: defaultGrantBudget(), expiry: new Date(Date.now()+36e5).toISOString(), revoked_at: null }, c);
    gid = (g as { grant_id: string }).grant_id;
  });

  await it("authorize valid call", () => {
    assert.equal(authorizeToolCall(token, gid, "repo_search", R, S, "src/a.ts").allowed, true);
  });
  await it("authorize repo_files for an allowed prefix", () => {
    assert.equal(authorizeToolCall(token, gid, "repo_files", R, S, "src").allowed, true);
  });
  await it("deny wrong repo", () => {
    assert.equal(authorizeToolCall(token, gid, "repo_search", "bad", S, "src/a.ts").allowed, false);
  });
  await it("deny wrong snapshot", () => {
    assert.equal(authorizeToolCall(token, gid, "repo_search", R, "bad", "src/a.ts").allowed, false);
  });
  await it("deny revoked grant", () => {
    revokeGrant(gid);
    assert.equal(authorizeToolCall(token, gid, "repo_search", R, S, "src/a.ts").allowed, false);
  });
  await it("deny unapproved tool", () => {
    const c = mkConsent({ approved_tools: ["repo_search"] }); recordConsent(c);
    const g2 = createGrant({ user_id: U, client_id: C, repo_id: R, snapshot_id: S, allowed_tools: ["repo_search"], allowed_paths: ["src/"], data_budget: defaultGrantBudget(), expiry: new Date(Date.now()+36e5).toISOString(), revoked_at: null }, c);
    const ngid = (g2 as { grant_id: string }).grant_id;
    assert.equal(authorizeToolCall(token, ngid, "repo_fetch", R, S, "src/a.ts").allowed, false);
  });
  await it("deny path outside allowed", () => {
    assert.equal(authorizeToolCall(token, gid, "repo_search", R, S, "tests/x.ts").allowed, false);
  });
  await it("deny wrong user", () => {
    const t2 = mkToken({ user_id: "evil" });
    assert.equal(authorizeToolCall(t2.token, gid, "repo_search", R, S, "src/a.ts").allowed, false);
  });
  await it("authDeniedResponse returns structured error", () => {
    const r = authorizeToolCall("bad", gid, "repo_search", R, S, "src/a.ts");
    const e = authDeniedResponse(r);
    assert.equal(e.isError, true);
    assert.ok(e.audit_id);
  });
});
