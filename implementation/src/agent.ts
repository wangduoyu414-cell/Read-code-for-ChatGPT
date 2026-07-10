/** Command entry for user-level local supervision. It is intentionally outside
 * the MCP registry and cannot be invoked by a connected model. */

import { installAutostart, uninstallAutostart } from "./agent/autostart.js";
import { LocalSupervisor, collectAgentStatus, defaultSupervisorConfig, doctor, loadSupervisorConfig, saveSupervisorConfig, validateSupervisorConfig, type SupervisorConfig } from "./agent/supervisor.js";

function parseOptions(values: string[]): Map<string, string> {
  const options = new Map<string, string>();
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index]!;
    if (!key.startsWith("--")) continue;
    const value = values[index + 1];
    if (value !== undefined && !value.startsWith("--")) { options.set(key.slice(2), value); index += 1; }
    else { options.set(key.slice(2), "true"); }
  }
  return options;
}

function requireConfig(): SupervisorConfig {
  const config = loadSupervisorConfig();
  if (!config) throw new Error("Agent configuration is missing. Run: agent configure --working-directory <implementation-directory> --tunnel-command <path> --tunnel-args-json <json-array>");
  return config;
}

function parseJsonStringArray(value: string, optionName: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
      throw new Error("invalid array");
    }
    return parsed;
  } catch {
    throw new Error(`${optionName} must be a JSON string array.`);
  }
}

function parseJsonEnvironmentMapping(value: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("invalid mapping");
    }
    return parsed as Record<string, string>;
  } catch {
    throw new Error("--tunnel-env-json must be a JSON object of environment variable names.");
  }
}

function configure(options: Map<string, string>): SupervisorConfig {
  const base = defaultSupervisorConfig(options.get("working-directory"));
  const tunnelArgs = options.get("tunnel-args-json");
  const mcpArgs = options.get("mcp-args-json");
  const tunnelEnv = options.get("tunnel-env-json");
  const proposed: SupervisorConfig = {
    ...base,
    node_path: options.get("node-path") ?? base.node_path,
    working_directory: options.get("working-directory") ?? base.working_directory,
    mcp_working_directory: options.get("mcp-working-directory") ?? options.get("working-directory") ?? base.mcp_working_directory,
    mcp: {
      command: options.get("mcp-command") ?? base.mcp.command,
      args: mcpArgs === undefined ? base.mcp.args : parseJsonStringArray(mcpArgs, "--mcp-args-json"),
    },
    tunnel: {
      command: options.get("tunnel-command") ?? base.tunnel.command,
      args: tunnelArgs === undefined ? base.tunnel.args : parseJsonStringArray(tunnelArgs, "--tunnel-args-json"),
    },
    tunnel_env: tunnelEnv === undefined ? base.tunnel_env : parseJsonEnvironmentMapping(tunnelEnv),
    mcp_health_url: options.get("mcp-health-url") ?? base.mcp_health_url,
    tunnel_health_url: options.get("tunnel-health-url") ?? base.tunnel_health_url,
    tunnel_ready_url: options.get("tunnel-ready-url") ?? base.tunnel_ready_url,
    health_interval_ms: Number(options.get("health-interval-ms") ?? base.health_interval_ms),
  };
  const valid = validateSupervisorConfig(proposed);
  if (!valid) throw new Error("Invalid agent configuration. Command arguments must not contain inline credentials, environment mappings must contain only variable names, and health interval must be at least 1000ms.");
  saveSupervisorConfig(valid);
  return valid;
}

async function main(): Promise<void> {
  const [command = "status", ...rest] = process.argv.slice(2);
  const options = parseOptions(rest);
  switch (command) {
    case "configure":
      console.log(JSON.stringify({ configured: true, config: configure(options) }, null, 2));
      return;
    case "status":
      console.log(JSON.stringify(await collectAgentStatus(), null, 2));
      return;
    case "doctor":
      console.log(JSON.stringify(await doctor(), null, 2));
      return;
    case "install": {
      const result = installAutostart(requireConfig());
      console.log(JSON.stringify(result, null, 2));
      if (!result.installed) process.exitCode = 1;
      return;
    }
    case "uninstall": {
      const result = uninstallAutostart();
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case "run":
      await new LocalSupervisor(requireConfig()).runUntilStopped();
      return;
    default:
      throw new Error("Usage: agent configure|run|status|doctor|install|uninstall. Use --tunnel-env-json '{\"TARGET_VAR\":\"SOURCE_VAR\"}' to pass tunnel credentials only by environment-variable name.");
  }
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
});
