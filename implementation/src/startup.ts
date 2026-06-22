/**
 * Startup script — initializes the full runtime and starts the MCP server as a persistent daemon.
 *
 * Usage:
 *   node dist/startup.js                    # uses server.config.json
 *   node dist/startup.js --port 3101        # override port
 *   node dist/startup.js --repo ./my-repo   # override repo path
 *   node dist/startup.js --repo-name app    # optional name for --repo
 *
 * The server stays running until terminated (Ctrl+C / SIGTERM).
 */

import { readFileSync, existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { startServer, initRuntime } from "./server.js";
import { registerRepo, bindRepo, clearCatalog, normalizeRepoRootPath } from "./repo/repo-catalog.js";
import { requestSnapshot, transitionState, attachManifest, clearRegistry } from "./snapshot/snapshot-registry.js";
import { ingestDirectory } from "./snapshot/snapshot-ingest.js";
import { runIndexer } from "./indexer/indexer.js";
import { clearTextIndex } from "./indexer/text-index.js";
import { clearSymbolIndex } from "./indexer/symbol-index.js";

// ─── Config ──────────────────────────────────────────────────────────────────

interface StartupConfig {
  server: { port: number; host: string };
  repo?: { path: string; description?: string; name?: string };
  repos: Array<{ name: string; path: string; description?: string }>;
  snapshot: { autoCreate: boolean; expireHours: number };
}

function repoNameFromPath(repoPath: string): string {
  return basename(normalizeRepoRootPath(repoPath)) || "repository";
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
    repos: [{ name: "safe-repo", path: "./fixtures/safe-repo" }],
    snapshot: { autoCreate: true, expireHours: 24 },
  };

  if (existsSync(configPath)) {
    try {
      const file = JSON.parse(readFileSync(configPath, "utf-8"));
      const repos = Array.isArray(file.repos)
        ? file.repos.map((repo: { name?: string; path: string; description?: string }) => ({
          name: repo.name ?? repoNameFromPath(repo.path),
          path: repo.path,
          description: repo.description,
        }))
        : file.repo
          ? [{ name: file.repo.name ?? repoNameFromPath(file.repo.path), path: file.repo.path, description: file.repo.description }]
          : defaults.repos;
      return {
        server: { ...defaults.server, ...file.server },
        repo: file.repo,
        repos,
        snapshot: { ...defaults.snapshot, ...file.snapshot },
      };
    } catch (e) {
      console.error(JSON.stringify({ event: "config_parse_error", path: configPath, error: String(e) }));
    }
  }

  return defaults;
}

// ─── Runtime initialization ──────────────────────────────────────────────────

interface InitializedRepo {
  manifest: unknown;
  rootDir: string;
  repoPath: string;
  repoName: string;
  snapshotId: string;
}

function initRepoAndSnapshot(repoConfig: { name: string; path: string; description?: string }): InitializedRepo | null {
  const rootDir = normalizeRepoRootPath(repoConfig.path);

  if (!existsSync(rootDir)) {
    console.error(JSON.stringify({ event: "repo_not_found", path: rootDir }));
    return null;
  }

  // Repo binding
  const repo = registerRepo(rootDir, { name: repoConfig.name, description: repoConfig.description });
  bindRepo(repo.repo_id);
  console.log(JSON.stringify({ event: "repo_bound", repo_id: repo.repo_id, name: repoConfig.name, path: rootDir }));

  // Snapshot lifecycle
  const snapId = `snap-${Date.now()}-${randomUUID().slice(0, 8)}`;
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
  const indexResult = runIndexer(manifest, rootDir, { clearExisting: false });
  console.log(JSON.stringify({ event: "index_complete", ...indexResult }));

  return { manifest, rootDir, repoPath: repo.repo_path, repoName: repoConfig.name, snapshotId: snapId };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const cliArgs = parseArgs();
  const config = loadConfig(cliArgs);

  // CLI overrides
  if (cliArgs["port"]) config.server.port = Number(cliArgs["port"]);
  if (cliArgs["host"]) config.server.host = cliArgs["host"];
  if (cliArgs["repo"]) {
    config.repos = [{
      name: cliArgs["repo-name"] ?? repoNameFromPath(cliArgs["repo"]),
      path: cliArgs["repo"],
      description: "CLI-selected repository",
    }];
  }

  console.log(JSON.stringify({
    event: "startup_begin",
    config: {
      port: config.server.port,
      repos: config.repos.map((repo) => ({ name: repo.name, path: repo.path })),
    },
  }));

  clearCatalog();
  clearRegistry();
  clearTextIndex();
  clearSymbolIndex();

  const initResults: InitializedRepo[] = [];
  for (const repoConfig of config.repos) {
    const initResult = initRepoAndSnapshot(repoConfig);
    if (initResult) initResults.push(initResult);
  }

  if (initResults.length === 0) {
    console.error(JSON.stringify({ event: "startup_failed", reason: "repo initialization failed" }));
    process.exit(1);
  }

  // Init runtime (wires manifests + budget states into server)
  initRuntime({
    repositories: initResults.map((repo) => ({
      manifest: repo.manifest,
      rootDir: repo.rootDir,
      repoPath: repo.repoPath,
      repoName: repo.repoName,
      snapshotId: repo.snapshotId,
    })),
  });

  // Start the persistent server
  const port = config.server.port as number;
  const { server, url } = await startServer(port, config.server.host);

  console.log(JSON.stringify({
    event: "server_listening",
    url,
    port: config.server.port,
    repositories: initResults.map((repo) => ({ name: repo.repoName, repo_path: repo.repoPath, snapshot_id: repo.snapshotId })),
    status: "ready",
  }));

  console.log(`\n✅ MCP Server is running at ${url}`);
  for (const repo of initResults) {
    console.log(`   Repo:     ${repo.repoName} -> ${repo.repoPath}`);
    console.log(`   Snapshot: ${repo.snapshotId}`);
  }
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
