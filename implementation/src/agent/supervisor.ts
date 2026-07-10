/** Local-only MCP/tunnel supervisor. It observes all processes but can stop
 * only ChildProcess instances started during the current supervisor run. */

import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createConnection } from "node:net";

export interface ManagedCommand {
  command: string;
  args: string[];
}

export type EnvironmentMapping = Record<string, string>;

export interface SupervisorConfig {
  version: 1;
  node_path: string;
  agent_entry: string;
  working_directory: string;
  mcp_working_directory: string;
  mcp: ManagedCommand;
  tunnel: ManagedCommand;
  tunnel_env: EnvironmentMapping;
  mcp_health_url: string;
  tunnel_health_url: string;
  tunnel_ready_url: string;
  health_interval_ms: number;
}

export interface PersistedState {
  updated_at: string;
  supervisor_pid: number;
  mcp: DependencyStatus;
  tunnel: DependencyStatus;
}

export interface DependencyStatus {
  state: "healthy_managed" | "healthy_external" | "starting" | "unhealthy_external" | "unhealthy_managed" | "unavailable" | "not_configured";
  managed: boolean;
  pid?: number;
  detail?: string;
}

export interface AgentStatus {
  configured: boolean;
  mcp: DependencyStatus;
  tunnel: DependencyStatus;
  state_path: string;
}

interface ManagedChild {
  child: ChildProcess;
  command: ManagedCommand;
  kind: "mcp" | "tunnel";
  next_restart_at: number;
}

const AGENT_DIR_NAME = ".read-code-chatgpt";
const CONFIG_FILE_NAME = "agent.json";
const STATE_FILE_NAME = "agent-state.json";
const LOG_FILE_NAME = "agent.log";
const LOCK_FILE_NAME = "agent.lock";
const MAX_LOG_BYTES = 1024 * 1024;
const MAX_RESTART_DELAY_MS = 60_000;
const STABLE_HEALTHY_OBSERVATIONS = 2;
const ENVIRONMENT_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const INLINE_CREDENTIAL_OPTION = /^(?:--(?:access-token|api-key|apikey|auth-token|bearer|client-secret|credential|password|secret|token)|-(?:k|p|t))$/i;
const INLINE_CREDENTIAL_ASSIGNMENT = /^(?:--(?:access-token|api-key|apikey|auth-token|bearer|client-secret|credential|password|secret|token)|(?:access[_-]?token|api[_-]?key|auth[_-]?token|client[_-]?secret|password|secret|token))=/i;
const RECOGNIZABLE_SECRET_VALUE = /^(?:sk-[A-Za-z0-9_-]{8,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|bearer\s+\S+)$/i;

export class RestartBackoff {
  private failures = 0;
  private healthyObservations = 0;

  recordFailure(now = Date.now()): number {
    this.failures += 1;
    this.healthyObservations = 0;
    return now + Math.min(MAX_RESTART_DELAY_MS, 1_000 * 2 ** Math.min(this.failures, 6));
  }

  recordHealthyObservation(): void {
    this.healthyObservations += 1;
    if (this.healthyObservations >= STABLE_HEALTHY_OBSERVATIONS) {
      this.failures = 0;
    }
  }

  recordUnhealthyObservation(): void {
    this.healthyObservations = 0;
  }

  get failureCount(): number {
    return this.failures;
  }
}

export function agentHomeDir(): string {
  return join(homedir(), AGENT_DIR_NAME);
}

export function agentConfigPath(): string {
  return join(agentHomeDir(), CONFIG_FILE_NAME);
}

export function agentStatePath(): string {
  return join(agentHomeDir(), STATE_FILE_NAME);
}

function agentLockPath(): string {
  return join(agentHomeDir(), LOCK_FILE_NAME);
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function logPath(): string {
  return join(agentHomeDir(), LOG_FILE_NAME);
}

function defaultAgentEntry(): string {
  return fileURLToPath(import.meta.url).replace(/[\\/]agent[\\/]supervisor\.js$/, `${process.platform === "win32" ? "\\" : "/"}agent.js`);
}

export function defaultSupervisorConfig(workingDirectory = process.cwd()): SupervisorConfig {
  const root = resolve(workingDirectory);
  return {
    version: 1,
    node_path: process.execPath,
    agent_entry: defaultAgentEntry(),
    working_directory: root,
    mcp_working_directory: root,
    mcp: { command: process.execPath, args: ["dist/startup.js", "--config", "server.config.json"] },
    tunnel: { command: "", args: [] },
    tunnel_env: {},
    mcp_health_url: "http://127.0.0.1:3100/connector-meta",
    tunnel_health_url: "http://127.0.0.1:18080/healthz",
    tunnel_ready_url: "http://127.0.0.1:18080/readyz",
    health_interval_ms: 30_000,
  };
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : undefined;
}

function asCommand(value: unknown): ManagedCommand | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const command = asString(record.command);
  const args = asStringArray(record.args);
  return command !== undefined && args !== undefined ? { command, args } : undefined;
}

function asEnvironmentMapping(value: unknown): EnvironmentMapping | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const entries = Object.entries(value);
  if (!entries.every(([target, source]) => ENVIRONMENT_NAME.test(target) && typeof source === "string" && ENVIRONMENT_NAME.test(source))) {
    return undefined;
  }
  return Object.fromEntries(entries);
}

export function containsInlineCredential(args: readonly string[]): boolean {
  return args.some((argument) => RECOGNIZABLE_SECRET_VALUE.test(argument) || INLINE_CREDENTIAL_ASSIGNMENT.test(argument))
    || args.some((argument) => INLINE_CREDENTIAL_OPTION.test(argument));
}

export function resolveTunnelEnvironment(
  mapping: EnvironmentMapping,
  sourceEnvironment: NodeJS.ProcessEnv = process.env,
): { ok: true; environment: NodeJS.ProcessEnv } | { ok: false; missing: string[] } {
  const missing = Object.values(mapping).filter((source) => sourceEnvironment[source] === undefined || sourceEnvironment[source] === "");
  if (missing.length > 0) return { ok: false, missing: Array.from(new Set(missing)).sort() };
  const environment: NodeJS.ProcessEnv = { ...sourceEnvironment };
  for (const [target, source] of Object.entries(mapping)) {
    environment[target] = sourceEnvironment[source];
  }
  return { ok: true, environment };
}

export function validateSupervisorConfig(value: unknown): SupervisorConfig | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const nodePath = asString(input.node_path);
  const agentEntry = asString(input.agent_entry);
  const workingDirectory = asString(input.working_directory);
  const mcpWorkingDirectory = asString(input.mcp_working_directory) ?? workingDirectory ?? "";
  const mcp = asCommand(input.mcp);
  const tunnel = asCommand(input.tunnel);
  const tunnelEnv = input.tunnel_env === undefined ? {} : asEnvironmentMapping(input.tunnel_env);
  const mcpHealthUrl = asString(input.mcp_health_url);
  const tunnelHealthUrl = asString(input.tunnel_health_url);
  const tunnelReadyUrl = asString(input.tunnel_ready_url);
  const interval = input.health_interval_ms;
  if (input.version !== 1 || !nodePath || !agentEntry || !workingDirectory || !mcp || !tunnel || !tunnelEnv || containsInlineCredential(mcp.args) || containsInlineCredential(tunnel.args) || !mcpHealthUrl || !tunnelHealthUrl || !tunnelReadyUrl || typeof interval !== "number" || !Number.isInteger(interval) || interval < 1_000) {
    return undefined;
  }
  return {
    version: 1,
    node_path: nodePath,
    agent_entry: agentEntry,
    working_directory: workingDirectory,
    mcp_working_directory: mcpWorkingDirectory,
    mcp,
    tunnel,
    tunnel_env: tunnelEnv,
    mcp_health_url: mcpHealthUrl,
    tunnel_health_url: tunnelHealthUrl,
    tunnel_ready_url: tunnelReadyUrl,
    health_interval_ms: interval,
  };
}

export function loadSupervisorConfig(): SupervisorConfig | undefined {
  try {
    return validateSupervisorConfig(JSON.parse(readFileSync(agentConfigPath(), "utf-8")));
  } catch {
    return undefined;
  }
}

export function saveSupervisorConfig(config: SupervisorConfig): void {
  mkdirSync(agentHomeDir(), { recursive: true });
  writeFileSync(agentConfigPath(), `${JSON.stringify(config, null, 2)}\n`, "utf-8");
}

function rotateLogIfNeeded(): void {
  try {
    if (statSync(logPath()).size <= MAX_LOG_BYTES) return;
    renameSync(logPath(), `${logPath()}.1`);
  } catch {
    // no existing log or rotation failure must not break recovery
  }
}

function appendLog(event: string, fields: Record<string, unknown> = {}): void {
  mkdirSync(agentHomeDir(), { recursive: true });
  rotateLogIfNeeded();
  appendFileSync(logPath(), `${JSON.stringify({ at: new Date().toISOString(), event, ...fields })}\n`, "utf-8");
}

function writeState(state: PersistedState): void {
  mkdirSync(agentHomeDir(), { recursive: true });
  writeFileSync(agentStatePath(), `${JSON.stringify(state, null, 2)}\n`, "utf-8");
}

function isDependencyStatus(value: unknown): value is DependencyStatus {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const status = value as Record<string, unknown>;
  const states = new Set<DependencyStatus["state"]>(["healthy_managed", "healthy_external", "starting", "unhealthy_external", "unhealthy_managed", "unavailable", "not_configured"]);
  return typeof status.state === "string" && states.has(status.state as DependencyStatus["state"])
    && typeof status.managed === "boolean"
    && (status.pid === undefined || (typeof status.pid === "number" && Number.isInteger(status.pid) && status.pid > 0))
    && (status.detail === undefined || typeof status.detail === "string");
}

function loadPersistedState(): PersistedState | undefined {
  try {
    const parsed: unknown = JSON.parse(readFileSync(agentStatePath(), "utf-8"));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined;
    const value = parsed as Record<string, unknown>;
    if (typeof value.updated_at !== "string" || typeof value.supervisor_pid !== "number" || !Number.isInteger(value.supervisor_pid) || value.supervisor_pid <= 0 || !isDependencyStatus(value.mcp) || !isDependencyStatus(value.tunnel)) {
      return undefined;
    }
    return { updated_at: value.updated_at, supervisor_pid: value.supervisor_pid, mcp: value.mcp, tunnel: value.tunnel };
  } catch {
    return undefined;
  }
}

function unavailable(detail?: string): DependencyStatus {
  return detail === undefined ? { state: "unavailable", managed: false } : { state: "unavailable", managed: false, detail };
}

async function probeUrl(url: string, timeoutMs = 3_000): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return response.ok;
  } catch {
    return false;
  }
}

async function isPortOpen(urlText: string, timeoutMs = 1_000): Promise<boolean> {
  try {
    const url = new URL(urlText);
    const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));
    return await new Promise<boolean>((resolvePort) => {
      const socket = createConnection({ host: url.hostname, port });
      const finish = (open: boolean) => { socket.destroy(); resolvePort(open); };
      socket.once("connect", () => finish(true));
      socket.once("error", () => finish(false));
      socket.setTimeout(timeoutMs, () => finish(false));
    });
  } catch {
    return false;
  }
}

function configuredCommand(command: ManagedCommand): boolean {
  return command.command.length > 0;
}

function isFreshPersistedState(state: PersistedState, healthIntervalMs: number, now: number): boolean {
  const updatedAt = Date.parse(state.updated_at);
  return Number.isFinite(updatedAt) && updatedAt <= now && now - updatedAt <= Math.max(healthIntervalMs * 3, 60_000);
}

function mergePersistedDependencyStatus(
  observed: DependencyStatus,
  persisted: DependencyStatus,
  ownerIsAlive: boolean,
  childIsAlive: (pid: number) => boolean,
): DependencyStatus {
  if (!persisted.managed || persisted.pid === undefined || !ownerIsAlive || !childIsAlive(persisted.pid)) return observed;
  if (observed.state === "healthy_external") return { state: "healthy_managed", managed: true, pid: persisted.pid };
  if (observed.state === "unavailable") return { state: "unhealthy_managed", managed: true, pid: persisted.pid, detail: "managed process is running but health check failed" };
  return observed;
}

export function mergeObservedStatusWithPersistedOwnership(
  observed: AgentStatus,
  persisted: PersistedState | undefined,
  healthIntervalMs: number,
  isAlive: (pid: number) => boolean = processIsAlive,
  now = Date.now(),
): AgentStatus {
  if (!persisted || !isFreshPersistedState(persisted, healthIntervalMs, now)) return observed;
  const ownerIsAlive = isAlive(persisted.supervisor_pid);
  return {
    ...observed,
    mcp: mergePersistedDependencyStatus(observed.mcp, persisted.mcp, ownerIsAlive, isAlive),
    tunnel: mergePersistedDependencyStatus(observed.tunnel, persisted.tunnel, ownerIsAlive, isAlive),
  };
}

export class LocalSupervisor {
  private readonly children = new Map<"mcp" | "tunnel", ManagedChild>();
  private readonly backoff = new Map<"mcp" | "tunnel", RestartBackoff>();

  constructor(private readonly config: SupervisorConfig) {}

  private restartBackoff(kind: "mcp" | "tunnel"): RestartBackoff {
    let backoff = this.backoff.get(kind);
    if (!backoff) {
      backoff = new RestartBackoff();
      this.backoff.set(kind, backoff);
    }
    return backoff;
  }

  private recordHealth(kind: "mcp" | "tunnel", status: DependencyStatus): void {
    const backoff = this.restartBackoff(kind);
    if (status.state === "healthy_managed") backoff.recordHealthyObservation();
    else backoff.recordUnhealthyObservation();
  }

  private childStatus(kind: "mcp" | "tunnel", healthy: boolean): DependencyStatus | undefined {
    const child = this.children.get(kind);
    if (!child) return undefined;
    if (child.child.exitCode === null && !child.child.killed) {
      return healthy
        ? { state: "healthy_managed", managed: true, pid: child.child.pid }
        : { state: "unhealthy_managed", managed: true, pid: child.child.pid, detail: "managed process is running but health check failed" };
    }
    return undefined;
  }

  private start(kind: "mcp" | "tunnel", command: ManagedCommand): DependencyStatus {
    if (!configuredCommand(command)) return { state: "not_configured", managed: false };
    const existing = this.children.get(kind);
    if (existing && existing.child.exitCode === null && !existing.child.killed) {
      return { state: "starting", managed: true, pid: existing.child.pid };
    }
    if (existing && existing.next_restart_at > Date.now()) {
      return unavailable(`managed process restart is delayed for ${existing.next_restart_at - Date.now()}ms after a failure`);
    }
    if (existing) this.children.delete(kind);
    try {
      const cwd = kind === "mcp" ? this.config.mcp_working_directory : this.config.working_directory;
      const tunnelEnvironment = kind === "tunnel" ? resolveTunnelEnvironment(this.config.tunnel_env) : undefined;
      if (tunnelEnvironment && !tunnelEnvironment.ok) {
        const detail = `configured tunnel environment variables are missing: ${tunnelEnvironment.missing.join(", ")}`;
        appendLog("managed_child_start_blocked", { component: kind, missing_environment_variables: tunnelEnvironment.missing });
        return unavailable(detail);
      }
      const child = spawn(command.command, command.args, {
        cwd,
        detached: false,
        shell: false,
        stdio: "ignore",
        windowsHide: true,
        env: tunnelEnvironment?.environment,
      });
      const managed: ManagedChild = { child, command, kind, next_restart_at: 0 };
      this.children.set(kind, managed);
      let failureRecorded = false;
      const recordFailure = (event: "error" | "exit", fields: Record<string, unknown>): void => {
        if (failureRecorded) return;
        failureRecorded = true;
        this.restartBackoff(kind).recordUnhealthyObservation();
        managed.next_restart_at = this.restartBackoff(kind).recordFailure();
        appendLog(`managed_child_${event}`, { component: kind, ...fields, retry_after_ms: managed.next_restart_at - Date.now() });
      };
      child.once("error", () => recordFailure("error", {}));
      child.once("exit", (code, signal) => {
        recordFailure("exit", { code, signal });
      });
      appendLog("managed_child_started", { component: kind, pid: child.pid });
      return { state: "starting", managed: true, pid: child.pid };
    } catch {
      appendLog("managed_child_start_failed", { component: kind });
      return unavailable("failed to start configured managed process");
    }
  }

  private stopOwnedChild(kind: "mcp" | "tunnel"): void {
    const managed = this.children.get(kind);
    if (!managed || managed.child.exitCode !== null || managed.child.killed) return;
    managed.child.kill("SIGTERM");
    appendLog("managed_child_stop_requested", { component: kind, pid: managed.child.pid });
  }

  async status(): Promise<AgentStatus> {
    const [mcpHealthy, tunnelHealthy, tunnelReady] = await Promise.all([
      probeUrl(this.config.mcp_health_url),
      probeUrl(this.config.tunnel_health_url),
      probeUrl(this.config.tunnel_ready_url),
    ]);
    const mcp = this.childStatus("mcp", mcpHealthy) ?? (mcpHealthy ? { state: "healthy_external", managed: false } : unavailable());
    const tunnel = this.childStatus("tunnel", tunnelHealthy && tunnelReady) ?? (tunnelHealthy && tunnelReady ? { state: "healthy_external", managed: false } : unavailable());
    return { configured: true, mcp, tunnel, state_path: agentStatePath() };
  }

  async reconcile(): Promise<AgentStatus> {
    const mcpHealthy = await probeUrl(this.config.mcp_health_url);
    let mcp = this.childStatus("mcp", mcpHealthy);
    if (!mcp) {
      if (mcpHealthy) {
        mcp = { state: "healthy_external", managed: false };
      } else if (await isPortOpen(this.config.mcp_health_url)) {
        mcp = { state: "unhealthy_external", managed: false, detail: "MCP port is occupied by an unhealthy external process; it was not terminated." };
      } else {
        mcp = this.start("mcp", this.config.mcp);
      }
    } else if (mcp.state === "unhealthy_managed") {
      this.stopOwnedChild("mcp");
      mcp = this.start("mcp", this.config.mcp);
      this.stopOwnedChild("tunnel");
    }

    const tunnelHealthy = await probeUrl(this.config.tunnel_health_url) && await probeUrl(this.config.tunnel_ready_url);
    let tunnel = this.childStatus("tunnel", tunnelHealthy);
    if (!tunnel) {
      if (tunnelHealthy) {
        tunnel = { state: "healthy_external", managed: false };
      } else if (await isPortOpen(this.config.tunnel_health_url)) {
        tunnel = { state: "unhealthy_external", managed: false, detail: "Tunnel port is occupied by an unhealthy external process; it was not terminated." };
      } else if (mcp.state === "healthy_managed" || mcp.state === "healthy_external") {
        tunnel = this.start("tunnel", this.config.tunnel);
      } else {
        tunnel = { state: "unavailable", managed: false, detail: "Tunnel start waits for MCP health." };
      }
    } else if (tunnel.state === "unhealthy_managed") {
      this.stopOwnedChild("tunnel");
      tunnel = this.start("tunnel", this.config.tunnel);
    }

    const result = { configured: true, mcp, tunnel, state_path: agentStatePath() };
    this.recordHealth("mcp", mcp);
    this.recordHealth("tunnel", tunnel);
    writeState({ updated_at: new Date().toISOString(), supervisor_pid: process.pid, mcp, tunnel });
    appendLog("supervisor_reconciled", { mcp: mcp.state, tunnel: tunnel.state });
    return result;
  }

  async runUntilStopped(): Promise<void> {
    mkdirSync(agentHomeDir(), { recursive: true });
    let lockFd: number | undefined;
    try {
      lockFd = openSync(agentLockPath(), "wx");
      writeFileSync(lockFd, String(process.pid));
    } catch {
      const previousPid = Number(readFileSync(agentLockPath(), "utf-8").trim());
      if (Number.isInteger(previousPid) && previousPid > 0 && processIsAlive(previousPid)) {
        throw new Error("Another local agent supervisor is already running. Use agent status instead of starting a duplicate loop.");
      }
      rmSync(agentLockPath(), { force: true });
      lockFd = openSync(agentLockPath(), "wx");
      writeFileSync(lockFd, String(process.pid));
    }
    let stopped = false;
    const stop = () => { stopped = true; this.stopOwnedChild("tunnel"); this.stopOwnedChild("mcp"); };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    try {
      while (!stopped) {
        await this.reconcile();
        await new Promise<void>((resolveTimer) => setTimeout(resolveTimer, this.config.health_interval_ms));
      }
    } finally {
      if (lockFd !== undefined) closeSync(lockFd);
      rmSync(agentLockPath(), { force: true });
    }
  }
}

export async function collectAgentStatus(config = loadSupervisorConfig()): Promise<AgentStatus> {
  if (!config) {
    return { configured: false, mcp: { state: "not_configured", managed: false }, tunnel: { state: "not_configured", managed: false }, state_path: agentStatePath() };
  }
  const observed = await new LocalSupervisor(config).status();
  return mergeObservedStatusWithPersistedOwnership(observed, loadPersistedState(), config.health_interval_ms);
}

export async function doctor(config = loadSupervisorConfig()): Promise<Record<string, unknown>> {
  const status = await collectAgentStatus(config);
  if (!config) return { ...status, ok: false, issues: ["Agent configuration is missing. Run agent configure first."] };
  const issues: string[] = [];
  if (!existsSync(config.working_directory)) issues.push("Configured working directory is missing.");
  if (!existsSync(config.mcp_working_directory)) issues.push("Configured MCP working directory is missing.");
  if (!existsSync(config.mcp.command)) issues.push("Configured MCP command is missing.");
  if (config.tunnel.command.length > 0 && !existsSync(config.tunnel.command)) issues.push("Configured tunnel command is missing.");
  const missingTunnelEnvironment = resolveTunnelEnvironment(config.tunnel_env);
  if (!missingTunnelEnvironment.ok) {
    issues.push(`Configured tunnel environment variables are missing: ${missingTunnelEnvironment.missing.join(", ")}`);
  }
  return { ...status, ok: issues.length === 0, issues };
}
