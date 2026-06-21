/**
 * Startup script — initializes the full runtime and starts the MCP server as a persistent daemon.
 *
 * Usage:
 *   node dist/startup.js                    # uses server.config.json
 *   node dist/startup.js --port 3101        # override port
 *   node dist/startup.js --repo ./my-repo   # override repo path
 *
 * The server stays running until terminated (Ctrl+C / SIGTERM).
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { startServer, initRuntime } from "./server.js";
import { registerRepo, bindRepo } from "./repo/repo-catalog.js";
import { requestSnapshot, transitionState, attachManifest, clearRegistry } from "./snapshot/snapshot-registry.js";
import { ingestDirectory } from "./snapshot/snapshot-ingest.js";
import { runIndexer } from "./indexer/indexer.js";
import { clearTextIndex } from "./indexer/text-index.js";
import { clearSymbolIndex } from "./indexer/symbol-index.js";

// ─── Config ──────────────────────────────────────────────────────────────────

interface StartupConfig {
  server: { port: number; host: string };
  repo: { path: string; description?: string };
  snapshot: { autoCreate: boolean; expireHours: number };
}

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i]!;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = process.argv[i + 1];
      if (val && !val.startsWith("--")) { args[key] = val; i++; }
      else { args[key] = "true"; }
    }
  }
  return args;
}

function loadConfig(cliArgs: Record<string, string>): StartupConfig {
  const configPath = resolve(cliArgs["config"] ?? "server.config.json");
  const defaults: StartupConfig = {
    server: { port: 3100, host: "127.0.0.1" },
    repo: { path: "./fixtures/safe-repo" },
    snapshot: { autoCreate: true, expireHours: 24 },
  };

  if (existsSync(configPath)) {
    try {
      const file = JSON.parse(readFileSync(configPath, "utf-8"));
      return {
        server: { ...defaults.server, ...file.server },
        repo: { ...defaults.repo, ...file.repo },
        snapshot: { ...defaults.snapshot, ...file.snapshot },
      };
    } catch (e) {
      console.error(JSON.stringify({ event: "config_parse_error", path: configPath, error: String(e) }));
    }
  }

  return defaults;
}

// ─── Runtime initialization ──────────────────────────────────────────────────

function initRepoAndSnapshot(config: StartupConfig): { manifest: unknown; rootDir: string; snapshotId: string } | null {
  const rootDir = resolve(config.repo.path);

  if (!existsSync(rootDir)) {
    console.error(JSON.stringify({ event: "repo_not_found", path: rootDir }));
    return null;
  }

  // Clear previous state
  clearRegistry();
  clearTextIndex();
  clearSymbolIndex();

  // Repo binding
  const repo = registerRepo(rootDir, config.repo.description);
  bindRepo(repo.repo_id);
  console.log(JSON.stringify({ event: "repo_bound", repo_id: repo.repo_id, path: rootDir }));

  // Snapshot lifecycle
  const snapId = `snap-${Date.now()}`;
  requestSnapshot(snapId, repo.repo_id);
  transitionState(snapId, "manifest_building");
  transitionState(snapId, "filtering");

  const { manifest, warnings } = ingestDirectory(rootDir, repo.repo_id, snapId);
  if (warnings.length > 0) {
    console.log(JSON.stringify({ event: "snapshot_warnings", count: warnings.length, warnings: warnings.slice(0, 10) }));
  }

  attachManifest(snapId, manifest);
  console.log(JSON.stringify({
    event: "snapshot_ready",
    snapshot_id: snapId,
    files: manifest.files.length,
    excluded: manifest.excluded_files.length,
    manifest_hash: manifest.manifest_hash,
  }));

  // Index
  const indexResult = runIndexer(manifest, rootDir);
  console.log(JSON.stringify({ event: "index_complete", ...indexResult }));

  // Init runtime (wires manifest + budget state into server)
  initRuntime({ manifest, rootDir, snapshotId: snapId });

  return { manifest, rootDir, snapshotId: snapId };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const cliArgs = parseArgs();
  const config = loadConfig(cliArgs);

  // CLI overrides
  if (cliArgs["port"]) config.server.port = Number(cliArgs["port"]);
  if (cliArgs["host"]) config.server.host = cliArgs["host"];
  if (cliArgs["repo"]) config.repo.path = cliArgs["repo"];

  console.log(JSON.stringify({ event: "startup_begin", config: { port: config.server.port, repo: config.repo.path } }));

  // Initialize repo, snapshot, index, runtime
  const initResult = initRepoAndSnapshot(config);
  if (!initResult) {
    console.error(JSON.stringify({ event: "startup_failed", reason: "repo initialization failed" }));
    process.exit(1);
  }

  // Start the persistent server
  const port = config.server.port as number;
  const { server, url } = await startServer(port, config.server.host);

  console.log(JSON.stringify({
    event: "server_listening",
    url,
    port: config.server.port,
    snapshot_id: initResult.snapshotId,
    status: "ready",
  }));

  console.log(`\n✅ MCP Server is running at ${url}`);
  console.log(`   Snapshot: ${initResult.snapshotId}`);
  console.log(`   Repo:     ${config.repo.path}`);
  console.log(`   Press Ctrl+C to stop.\n`);

  // ─── Graceful shutdown ──────────────────────────────────────────────────

  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(JSON.stringify({ event: "shutdown_begin", signal }));

    server.close(() => {
      console.log(JSON.stringify({ event: "shutdown_complete" }));
      process.exit(0);
    });

    // Force exit after 5s
    setTimeout(() => {
      console.log(JSON.stringify({ event: "shutdown_forced" }));
      process.exit(0);
    }, 5000);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("uncaughtException", (err) => {
    console.error(JSON.stringify({ event: "uncaught_exception", error: String(err), stack: err.stack }));
    shutdown("uncaughtException");
  });
  process.on("unhandledRejection", (reason) => {
    console.error(JSON.stringify({ event: "unhandled_rejection", reason: String(reason) }));
  });
}

main();
