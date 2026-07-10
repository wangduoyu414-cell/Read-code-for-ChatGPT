import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { installAutostart, renderMacosLaunchAgentPlist, renderWindowsStartupScript, renderWindowsTaskXml, uninstallAutostart } from "../src/agent/autostart.js";
import { RestartBackoff, containsInlineCredential, defaultSupervisorConfig, mergeObservedStatusWithPersistedOwnership, resolveTunnelEnvironment, validateSupervisorConfig, type AgentStatus, type PersistedState } from "../src/agent/supervisor.js";

const config = {
  ...defaultSupervisorConfig("C:\\repo path"),
  node_path: "C:\\Program Files\\nodejs\\node.exe",
  agent_entry: "C:\\repo path\\dist\\agent.js",
  working_directory: "\\\\server\\share\\Read Code",
  mcp: { command: "C:\\Program Files\\nodejs\\node.exe", args: ["dist/startup.js"] },
  tunnel: { command: "C:\\Tools\\tunnel-client.exe", args: ["run", "--profile-file", "C:\\profile.yaml"] },
};

await describe("local agent startup artifacts", async () => {
  await it("renders a Windows logon task with restart policy and UNC-safe pushd", () => {
    const xml = renderWindowsTaskXml(config);
    assert.match(xml, /<LogonTrigger>/);
    assert.match(xml, /<RestartOnFailure>/);
    assert.match(xml, /pushd/);
    assert.match(xml, /\\\\server\\share/);
    assert.match(xml, /LeastPrivilege/);
    assert.match(xml, /InteractiveToken/);
  });

  await it("renders a macOS user LaunchAgent with RunAtLoad and KeepAlive", () => {
    const plist = renderMacosLaunchAgentPlist(config);
    assert.match(plist, /com\.read-code-chatgpt\.supervisor/);
    assert.match(plist, /<key>RunAtLoad<\/key><true\/>/);
    assert.match(plist, /<key>KeepAlive<\/key><true\/>/);
    assert.match(plist, /<key>ProgramArguments<\/key>/);
  });

  await it("renders a Windows current-user Startup fallback without a shell tool surface", () => {
    const script = renderWindowsStartupScript(config);
    assert.match(script, /^@echo off/m);
    assert.match(script, /:run/);
    assert.match(script, /if \"%exit_code%\"==\"0\" exit \/b 0/);
    assert.match(script, /timeout \/t 5/);
    assert.match(script, /goto run/);
    assert.doesNotMatch(script, /pushd/);
    assert.match(script, /configured working directory/);
    assert.match(script, /dist\\agent\.js/);
  });

  await it("rejects malformed persisted supervisor configuration", () => {
    assert.equal(validateSupervisorConfig({ version: 1 }), undefined);
    assert.deepEqual(validateSupervisorConfig(config), config);
  });

  await it("rejects inline credentials while allowing named tunnel environment mappings", () => {
    assert.equal(containsInlineCredential(["run", "--token", "not-safe"]), true);
    assert.equal(containsInlineCredential(["run", "--token=not-safe"]), true);
    assert.equal(containsInlineCredential(["run", "--token-env", "TUNNEL_TOKEN"]), false);
    assert.equal(validateSupervisorConfig({ ...config, tunnel: { ...config.tunnel, args: ["run", "--api-key", "not-safe"] } }), undefined);
    const configured = validateSupervisorConfig({ ...config, tunnel_env: { TUNNEL_TOKEN: "READ_CODE_TUNNEL_TOKEN" } });
    assert.deepEqual(configured?.tunnel_env, { TUNNEL_TOKEN: "READ_CODE_TUNNEL_TOKEN" });
  });

  await it("maps only named tunnel environment variables and reports missing sources without values", () => {
    assert.deepEqual(resolveTunnelEnvironment({ TUNNEL_TOKEN: "SOURCE_TOKEN" }, { SOURCE_TOKEN: "value" }), {
      ok: true,
      environment: { SOURCE_TOKEN: "value", TUNNEL_TOKEN: "value" },
    });
    assert.deepEqual(resolveTunnelEnvironment({ TUNNEL_TOKEN: "MISSING_TOKEN" }, {}), { ok: false, missing: ["MISSING_TOKEN"] });
  });

  await it("uses accumulating backoff until a managed process is stable", () => {
    const backoff = new RestartBackoff();
    assert.equal(backoff.recordFailure(1_000), 3_000);
    assert.equal(backoff.recordFailure(1_000), 5_000);
    assert.equal(backoff.failureCount, 2);
    backoff.recordHealthyObservation();
    assert.equal(backoff.failureCount, 2);
    backoff.recordHealthyObservation();
    assert.equal(backoff.failureCount, 0);
    assert.equal(backoff.recordFailure(1_000), 3_000);
  });

  await it("restores current managed ownership only from fresh live supervisor state", () => {
    const observed: AgentStatus = {
      configured: true,
      mcp: { state: "healthy_external", managed: false },
      tunnel: { state: "unavailable", managed: false },
      state_path: "state.json",
    };
    const persisted: PersistedState = {
      updated_at: "2026-07-10T12:00:00.000Z",
      supervisor_pid: 10,
      mcp: { state: "healthy_managed", managed: true, pid: 11 },
      tunnel: { state: "unhealthy_managed", managed: true, pid: 12 },
    };
    const merged = mergeObservedStatusWithPersistedOwnership(observed, persisted, 30_000, () => true, Date.parse("2026-07-10T12:00:30.000Z"));
    assert.deepEqual(merged.mcp, { state: "healthy_managed", managed: true, pid: 11 });
    assert.deepEqual(merged.tunnel, { state: "unhealthy_managed", managed: true, pid: 12, detail: "managed process is running but health check failed" });
    const stale = mergeObservedStatusWithPersistedOwnership(observed, persisted, 30_000, () => true, Date.parse("2026-07-10T12:02:00.000Z"));
    assert.deepEqual(stale, observed);
  });

  await it("does not attempt startup integration on unsupported platforms", () => {
    const install = installAutostart(config, "linux");
    const uninstall = uninstallAutostart("linux");
    assert.equal(install.installed, false);
    assert.match(install.message, /Windows and macOS/);
    assert.match(uninstall.message, /Windows and macOS/);
  });
});
