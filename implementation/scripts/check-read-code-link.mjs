#!/usr/bin/env node

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const DEFAULT_MCP_URL = "http://127.0.0.1:3100/mcp";
const DEFAULT_TUNNEL_ADMIN_URL = "http://127.0.0.1:8080";
const DEFAULT_TIMEOUT_MS = 5000;
const EXPECTED_TOOLS = [
  "read_code",
  "api_tool",
  "repo_list",
  "repo_search",
  "repo_files",
  "repo_fetch",
  "repo_tree",
  "repo_symbols",
  "repo_refresh",
];

function parseArgs(argv) {
  const parsed = new Map();
  for (let index = 2; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item?.startsWith("--")) continue;

    const key = item.slice(2);
    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith("--")) {
      parsed.set(key, next);
      index += 1;
    } else {
      parsed.set(key, "true");
    }
  }
  return parsed;
}

function envFlag(name) {
  const value = process.env[name];
  return value === "1" || value === "true" || value === "yes";
}

function timeoutMs(args) {
  const raw = args.get("timeout-ms") ?? process.env.READ_CODE_LINK_TIMEOUT_MS;
  if (raw === undefined) return DEFAULT_TIMEOUT_MS;

  const value = Number(raw);
  if (Number.isInteger(value) && value > 0) return value;
  throw new Error(`Invalid timeout: ${raw}`);
}

function printHelp() {
  console.log(`
Usage:
  npm run check:link
  node scripts/check-read-code-link.mjs --mcp-url http://127.0.0.1:3100/mcp

Options:
  --mcp-url <url>              MCP endpoint. Default: ${DEFAULT_MCP_URL}
  --tunnel-admin-url <url>     Optional tunnel admin base URL. Default: ${DEFAULT_TUNNEL_ADMIN_URL}
  --skip-tunnel                Do not probe the local tunnel admin endpoint.
  --require-tunnel             Fail when the tunnel admin endpoint is not healthy.
  --timeout-ms <ms>            Per-request timeout. Default: ${DEFAULT_TIMEOUT_MS}

Environment:
  READ_CODE_MCP_URL
  READ_CODE_TUNNEL_ADMIN_URL
  READ_CODE_REQUIRE_TUNNEL=1
  READ_CODE_LINK_TIMEOUT_MS
`.trim());
}

function withTimeout(timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

async function fetchText(url, timeout) {
  const timeoutControl = withTimeout(timeout);
  try {
    const response = await fetch(url, { signal: timeoutControl.signal });
    const text = await response.text();
    return { ok: response.ok, status: response.status, text };
  } catch (error) {
    return { ok: false, status: 0, text: String(error) };
  } finally {
    timeoutControl.clear();
  }
}

async function fetchJson(url, timeout) {
  const result = await fetchText(url, timeout);
  if (!result.ok) return { ...result, body: undefined };

  try {
    return { ...result, body: JSON.parse(result.text) };
  } catch (error) {
    return { ...result, ok: false, body: undefined, text: `Invalid JSON: ${String(error)}` };
  }
}

function originFromMcpUrl(mcpUrl) {
  const url = new URL(mcpUrl);
  return `${url.protocol}//${url.host}`;
}

function requiredArray(value, name) {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array.`);
  }
  return value;
}

function requiredObject(value, name) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${name} must be an object.`);
  }
  return value;
}

function toolNames(tools) {
  return tools.map((tool) => {
    const item = requiredObject(tool, "tool");
    if (typeof item.name !== "string" || item.name.length === 0) {
      throw new Error("Tool name must be a non-empty string.");
    }
    return item.name;
  });
}

function requireExpectedTools(names) {
  const missing = EXPECTED_TOOLS.filter((name) => !names.includes(name));
  if (missing.length > 0) {
    throw new Error(`Missing MCP tools: ${missing.join(", ")}`);
  }

  const dotted = names.filter((name) => name.includes("."));
  if (dotted.length > 0) {
    throw new Error(`Public MCP tool names must not contain dots: ${dotted.join(", ")}`);
  }
}

function requireChatGptToolMeta(tools) {
  for (const tool of tools) {
    const item = requiredObject(tool, "tool");
    const meta = requiredObject(item._meta, `${item.name}._meta`);
    const ui = requiredObject(meta.ui, `${item.name}._meta.ui`);
    const visibility = requiredArray(ui.visibility, `${item.name}._meta.ui.visibility`);
    if (!visibility.includes("model")) {
      throw new Error(`${item.name} must include _meta.ui.visibility=["model", ...].`);
    }
    if (meta["openai/visibility"] !== "public") {
      throw new Error(`${item.name} must include _meta["openai/visibility"]="public".`);
    }
    if (typeof meta["openai/toolInvocation/invoking"] !== "string") {
      throw new Error(`${item.name} must include invoking status text.`);
    }
    if (typeof meta["openai/toolInvocation/invoked"] !== "string") {
      throw new Error(`${item.name} must include invoked status text.`);
    }

    const securitySchemes = requiredArray(meta.securitySchemes, `${item.name}._meta.securitySchemes`);
    const hasNoAuth = securitySchemes.some((scheme) => {
      const securityScheme = requiredObject(scheme, `${item.name}._meta.securitySchemes[]`);
      return securityScheme.type === "noauth";
    });
    if (!hasNoAuth) {
      throw new Error(`${item.name} must mirror noauth in _meta.securitySchemes.`);
    }
  }
}

function requiredRepoPath(repo) {
  const item = requiredObject(repo, "repository");
  if (typeof item.repo_path !== "string" || item.repo_path.length === 0) {
    throw new Error("repo_list returned a repository without repo_path.");
  }
  return item.repo_path;
}

function requireUsageGuide(value, name) {
  const guide = requiredObject(value, name);
  const calls = requiredArray(guide.recommended_next_calls, `${name}.recommended_next_calls`);
  const toolNames = calls.map((call) => {
    const item = requiredObject(call, `${name}.recommended_next_calls[]`);
    if (typeof item.tool !== "string" || item.tool.length === 0) {
      throw new Error(`${name}.recommended_next_calls[].tool must be a non-empty string.`);
    }
    return item.tool;
  });
  for (const expected of ["repo_list", "repo_files", "repo_fetch", "repo_refresh"]) {
    if (!toolNames.includes(expected)) {
      throw new Error(`${name}.recommended_next_calls must include ${expected}.`);
    }
  }

  const pathRules = requiredArray(guide.path_rules, `${name}.path_rules`);
  if (!pathRules.some((rule) => typeof rule === "string" && rule.includes("repo_path"))) {
    throw new Error(`${name}.path_rules must explain repo_path selection.`);
  }
  return guide;
}

function requireMultiRepoSchema(tools, repositoryCount) {
  if (repositoryCount <= 1) return;

  for (const tool of tools) {
    const item = requiredObject(tool, "tool");
    if (item.name === "read_code" || item.name === "api_tool" || item.name === "repo_list") continue;
    const inputSchema = requiredObject(item.inputSchema, `${item.name}.inputSchema`);
    const required = Array.isArray(inputSchema.required) ? inputSchema.required : [];
    if (!required.includes("repo_path")) {
      throw new Error(`${item.name} must require repo_path when multiple repositories are configured.`);
    }
  }
}

function resultLine(status, name, detail) {
  const suffix = detail ? ` - ${detail}` : "";
  console.log(`[${status}] ${name}${suffix}`);
}

async function checkHttpDiscovery(mcpUrl, timeout) {
  const origin = originFromMcpUrl(mcpUrl);
  const connector = await fetchJson(`${origin}/connector-meta`, timeout);
  if (!connector.ok) {
    throw new Error(`/connector-meta failed with status ${connector.status}: ${connector.text}`);
  }

  const meta = requiredObject(connector.body, "connector metadata");
  if (typeof meta.name !== "string" || meta.name.length === 0) {
    throw new Error("/connector-meta did not return a connector name.");
  }
  if (meta.mode !== "dev_local") {
    throw new Error(`/connector-meta mode must be dev_local, got ${String(meta.mode)}.`);
  }

  const protectedResource = await fetchJson(`${origin}/.well-known/oauth-protected-resource`, timeout);
  if (!protectedResource.ok) {
    throw new Error(`/.well-known/oauth-protected-resource failed with status ${protectedResource.status}: ${protectedResource.text}`);
  }

  const protectedBody = requiredObject(protectedResource.body, "protected resource metadata");
  if (typeof protectedBody.resource !== "string" || !protectedBody.resource.endsWith("/mcp")) {
    throw new Error("Protected resource metadata must point to an /mcp resource.");
  }

  return { connectorName: meta.name, resource: protectedBody.resource };
}

async function checkMcpAcceptCompatibility(mcpUrl, timeout) {
  const body = {
    jsonrpc: "2.0",
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "read-code-link-check", version: "0.0.1" },
    },
    id: 1,
  };
  const timeoutControl = withTimeout(timeout);

  try {
    const response = await fetch(mcpUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: timeoutControl.signal,
    });
    const text = await response.text();

    if (!response.ok) {
      throw new Error(`status ${response.status}: ${text}`);
    }
    if (!text.includes("serverInfo") || !text.includes("chatgpt-local-repo-001")) {
      throw new Error(`unexpected initialize response: ${text.slice(0, 200)}`);
    }

    return { status: response.status };
  } finally {
    timeoutControl.clear();
  }
}

async function checkMcpTools(mcpUrl) {
  const client = new Client({ name: "read-code-link-check", version: "0.0.1" });
  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));
  let connected = false;

  try {
    await client.connect(transport);
    connected = true;

    const toolsResponse = await client.listTools();
    const tools = requiredArray(toolsResponse.tools, "tools");
    const names = toolNames(tools);
    requireExpectedTools(names);
    requireChatGptToolMeta(tools);

    const readCodeGuideResult = await client.callTool({ name: "read_code", arguments: {} });
    if (readCodeGuideResult.isError === true) {
      throw new Error("read_code returned an MCP error for an empty first-use call.");
    }
    const structuredReadCodeGuide = requiredObject(readCodeGuideResult.structuredContent, "read_code first-use structuredContent");
    requireUsageGuide(structuredReadCodeGuide.usage_guide, "read_code usage_guide");
    requiredArray(structuredReadCodeGuide.repositories, "read_code first-use repositories");

    const listResult = await client.callTool({ name: "repo_list", arguments: {} });
    if (listResult.isError === true) {
      throw new Error("repo_list returned an MCP error.");
    }

    const structuredList = requiredObject(listResult.structuredContent, "repo_list structuredContent");
    requireUsageGuide(structuredList.usage_guide, "repo_list usage_guide");
    const repositories = requiredArray(structuredList.repositories, "repositories");
    if (repositories.length === 0) {
      throw new Error("repo_list returned zero repositories.");
    }

    requireMultiRepoSchema(tools, repositories.length);

    const apiToolResult = await client.callTool({ name: "api_tool", arguments: { operation: "repo_list" } });
    if (apiToolResult.isError === true) {
      throw new Error("api_tool returned an MCP error for operation=repo_list.");
    }
    const structuredApiTool = requiredObject(apiToolResult.structuredContent, "api_tool structuredContent");
    requiredArray(structuredApiTool.repositories, "api_tool repositories");

    const readCodeResult = await client.callTool({ name: "read_code", arguments: { operation: "repo_list" } });
    if (readCodeResult.isError === true) {
      throw new Error("read_code returned an MCP error for operation=repo_list.");
    }
    const structuredReadCode = requiredObject(readCodeResult.structuredContent, "read_code structuredContent");
    requiredArray(structuredReadCode.repositories, "read_code repositories");

    const repoPath = requiredRepoPath(repositories[0]);
    const treeResult = await client.callTool({
      name: "repo_tree",
      arguments: { repo_path: repoPath, path: ".", depth: 1, limit: 10 },
    });
    if (treeResult.isError === true) {
      throw new Error("repo_tree returned an MCP error for the first repository.");
    }

    const structuredTree = requiredObject(treeResult.structuredContent, "repo_tree structuredContent");
    const entries = requiredArray(structuredTree.entries, "tree entries");

    const filesResult = await client.callTool({
      name: "repo_files",
      arguments: { repo_path: repoPath, limit: 10 },
    });
    if (filesResult.isError === true) {
      throw new Error("repo_files returned an MCP error for the first repository.");
    }

    const structuredFiles = requiredObject(filesResult.structuredContent, "repo_files structuredContent");
    const items = requiredArray(structuredFiles.items, "file map items");
    const counts = requiredObject(structuredFiles.counts, "file map counts");
    if (typeof counts.discovered_total !== "number") {
      throw new Error("repo_files counts.discovered_total must be a number.");
    }
    const fetchableItem = items.map((item) => requiredObject(item, "file map item")).find((item) => item.fetchable === true && typeof item.path === "string");
    if (!fetchableItem) {
      throw new Error("repo_files did not return any fetchable file map item.");
    }

    const fetchResult = await client.callTool({
      name: "repo_fetch",
      arguments: { repo_path: repoPath, path: fetchableItem.path, line_start: 1, line_end: 1, purpose: "link-check first-use fetch probe" },
    });
    if (fetchResult.isError === true) {
      throw new Error(`repo_fetch returned an MCP error for ${fetchableItem.path}.`);
    }
    const structuredFetch = requiredObject(fetchResult.structuredContent, "repo_fetch structuredContent");
    if (typeof structuredFetch.content !== "string") {
      throw new Error("repo_fetch structuredContent.content must be a string.");
    }

    return {
      toolNames: names,
      modelVisibleToolCount: tools.length,
      repositories,
      firstRepoPath: repoPath,
      treeEntries: entries.length,
      fileItems: items.length,
      fetchedPath: fetchableItem.path,
      readCodeRepositories: structuredReadCode.repositories.length,
      readCodeGuideRepositories: requiredArray(structuredReadCodeGuide.repositories, "read_code first-use repositories").length,
      apiToolRepositories: structuredApiTool.repositories.length,
    };
  } finally {
    if (connected) {
      await client.close();
    }
  }
}

async function checkTunnelAdmin(adminUrl, timeout, requireTunnel) {
  const health = await fetchText(`${adminUrl.replace(/\/$/, "")}/healthz`, timeout);
  const ready = await fetchText(`${adminUrl.replace(/\/$/, "")}/readyz`, timeout);
  const healthy = health.ok && ready.ok && /live/i.test(health.text) && /ready/i.test(ready.text);

  if (!healthy && requireTunnel) {
    throw new Error(`Tunnel admin check failed: health=${health.status} ${health.text}; ready=${ready.status} ${ready.text}`);
  }

  return {
    healthy,
    health: health.ok ? health.text.trim() : `status ${health.status}`,
    ready: ready.ok ? ready.text.trim() : `status ${ready.status}`,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.has("help") || args.has("h")) {
    printHelp();
    return;
  }

  const mcpUrl = args.get("mcp-url") ?? process.env.READ_CODE_MCP_URL ?? DEFAULT_MCP_URL;
  const tunnelAdminUrl = args.get("tunnel-admin-url") ?? process.env.READ_CODE_TUNNEL_ADMIN_URL ?? DEFAULT_TUNNEL_ADMIN_URL;
  const skipTunnel = args.has("skip-tunnel");
  const requireTunnel = args.has("require-tunnel") || envFlag("READ_CODE_REQUIRE_TUNNEL");
  const timeout = timeoutMs(args);

  console.log(`Read Code link check`);
  console.log(`MCP URL: ${mcpUrl}`);

  try {
    const http = await checkHttpDiscovery(mcpUrl, timeout);
    resultLine("OK", "local HTTP discovery", `${http.connectorName} -> ${http.resource}`);

    const accept = await checkMcpAcceptCompatibility(mcpUrl, timeout);
    resultLine("OK", "MCP Accept compatibility", `initialize accepted with status ${accept.status}`);

    const mcp = await checkMcpTools(mcpUrl);
    resultLine("OK", "MCP tools", mcp.toolNames.join(", "));
    resultLine("OK", "ChatGPT tool metadata", `${mcp.modelVisibleToolCount} model-visible tool descriptor(s)`);
    resultLine("OK", "read_code guide", `${mcp.readCodeGuideRepositories} repository/repositories with first-use usage guide`);
    resultLine("OK", "read_code", `${mcp.readCodeRepositories} repository/repositories through explicit compatibility wrapper`);
    resultLine("OK", "api_tool", `${mcp.apiToolRepositories} repository/repositories through compatibility wrapper`);
    resultLine("OK", "repo_list", `${mcp.repositories.length} repository/repositories`);
    resultLine("OK", "repo_tree", `${mcp.firstRepoPath} (${mcp.treeEntries} entries at depth 1)`);
    resultLine("OK", "repo_files", `${mcp.firstRepoPath} (${mcp.fileItems} file map item(s))`);
    resultLine("OK", "repo_fetch", mcp.fetchedPath);

    if (skipTunnel) {
      resultLine("SKIP", "tunnel admin", "not probed");
    } else {
      const tunnel = await checkTunnelAdmin(tunnelAdminUrl, timeout, requireTunnel);
      if (tunnel.healthy) {
        resultLine("OK", "tunnel admin", `health=${tunnel.health}; ready=${tunnel.ready}`);
      } else {
        resultLine("WARN", "tunnel admin", `not healthy or not running at ${tunnelAdminUrl}`);
      }
    }

    resultLine("INFO", "ChatGPT web", "this check cannot prove the current ChatGPT chat selected the connector; ask ChatGPT to call read_code or api_tool with operation=repo_list, or call repo_list directly.");
  } catch (error) {
    resultLine("FAIL", "link check", String(error));
    process.exitCode = 1;
  }
}

await main();
