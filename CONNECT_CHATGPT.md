# Connect To ChatGPT（接入 ChatGPT）

This guide explains how to run `Read Code for ChatGPT` locally, authorize one or more repository folders, and connect them to ChatGPT through MCP（Model Context Protocol，模型上下文协议）.

The current project mode is `dev_local`（本地开发）. It is ready for local validation and private connector testing, but production OAuth 2.1/OIDC（开放授权/开放身份连接）is not implemented yet.

## 0. Terms（术语）

- `<repo-root>`: this repository root, containing `README.md`, `CONNECT_CHATGPT.md`, and `tool-schemas.json`.
- `<implementation-root>`: `<repo-root>/implementation`.
- `<authorized-repo-path>`: one local folder you explicitly allow ChatGPT to read.
- `<repo_path>`: the exact authorized repository path returned by `repo_list`.
- MCP endpoint（模型上下文协议端点）: `http://127.0.0.1:3100/mcp` during local development.
- Tunnel（隧道）: an HTTPS（安全超文本传输协议）route that lets ChatGPT reach your local MCP endpoint.

## 1. What ChatGPT Gets（ChatGPT 能获得什么）

ChatGPT receives read-only, non-destructive tools:

| Tool | What it does |
|---|---|
| `read_code` | Compatibility wrapper for ChatGPT conversations that expect a `read_code` entry; empty arguments return the usage guide and repository list, while explicit operations route to the same read-only repository tools. |
| `api_tool` | Compatibility wrapper for older ChatGPT connector imports that show the entry as `read_code/api_tool`; empty arguments return the usage guide and repository list, while explicit operations route to the same read-only repository tools. |
| `repo_list` | List configured repository names, descriptions, exact `repo_path` values, lightweight summaries, and the same first-use `usage_guide`. |
| `repo_files` | List a paginated file map with fetch/index/exclusion status, without file contents. |
| `repo_symbols` | Find lightweight symbol definitions. |
| `repo_search` | Search indexed text. |
| `repo_fetch` | Read the requested line range from one file. |
| `repo_tree` | List bounded repository paths for directory or layout questions. |
| `repo_refresh` | Re-scan only when the repository changed or the snapshot may be stale. |

The server rejects absolute paths, parent traversal, sensitive files, unsupported files, and unreadable/system directories. Single-response size, single-fetch line window, and shared throttle ceilings are disabled by default; grant budget and result-count bounds remain active. Repository content is returned as untrusted data.

Readable repository files include common source, config, and documentation files, plus common project text files such as `Dockerfile`, `Makefile`, `LICENSE`, `.gitignore`, and unknown-extension files that pass a lightweight text check. Binary files and sensitive files stay excluded.

If ChatGPT is unsure how to begin, it can call `read_code` with no arguments or call `repo_list`; both return a compact structured `usage_guide` plus the configured repositories. If one repository is configured, ChatGPT can read with `repo_files`, `repo_search`, `repo_symbols`, `repo_fetch`, `repo_tree`, or `repo_refresh` without passing `repo_path`. If multiple repositories are configured, ChatGPT must call `repo_list` first and pass one exact returned `repo_path`. File paths inside a selected repository stay relative, such as `src/index.ts`.

Recommended read order for an unfamiliar repository: use `repo_list` when needed, then `repo_files` to inspect exact paths and whether files are fetchable or indexed, then use `repo_symbols` or `repo_search` for definitions/text, and finally use `repo_fetch` for the smallest useful line range. Use `repo_tree` only when the user asks about directory layout, file organization, or what is inside a folder.

Compatibility note: if ChatGPT refers to this connector as `read_code` or `read_code/api_tool`, those are legacy wrapper entries. They should be available as `read_code` and `api_tool`, and can be called with no arguments for a guided start, or with `operation=repo_list`, `operation=repo_files`, `operation=repo_fetch`, and the other `repo_*` operations.

Large repositories may contain files that are fetchable but not indexed for search. In that case `repo_search` can miss them, but `repo_files` can still show them as `fetchable_unindexed`, and `repo_fetch` can read the returned relative path.

The repository view is snapshot-based. Call `repo_refresh` only when the repository has changed since the active snapshot or when a previous result may be stale; failed refreshes keep the previous snapshot active.

## 2. Install（安装）

```powershell
cd <repo-root>
cd .\implementation
npm install
```

Required runtime:

- Node.js（节点运行时）18 or newer
- npm（Node 包管理器）

## 3. Build And Test（构建与测试）

```powershell
npm run build
npm test
```

If you run from a Windows UNC（网络共享）path and `npm run` falls back to a Windows system directory, use direct commands:

```powershell
node ./node_modules/typescript/bin/tsc -p tsconfig.json
node --import tsx --test tests/*.test.ts
```

## 4. Start With Configured Repositories（按配置仓库启动）

```powershell
node dist/startup.js --port 3100
```

Default authorized roots come from `<implementation-root>/server.config.json`. Use `repo_list` after startup to see the exact configured `repo_path` values.

For fixture-only validation, set `repos[]` back to `implementation/fixtures/safe-repo` or start with `--repo "./fixtures/safe-repo"`.

Local endpoints:

```text
http://127.0.0.1:3100/mcp
http://127.0.0.1:3100/connector-meta
http://127.0.0.1:3100/.well-known/oauth-protected-resource
```

## 5. Start With Your Repository（读取你的仓库）

Bind the smallest useful folder:

```powershell
node dist/startup.js --port 3100 --repo "<authorized-repo-path>"
```

For large repositories, bind the smallest project directory that covers the question, such as one app, package, service, or module. Avoid binding a whole drive, home directory, network share root, or full monorepo unless that entire scope is required.

Placeholder examples:

```powershell
node dist/startup.js --port 3100 --repo "<project-root>"
node dist/startup.js --port 3100 --repo "<workspace>/<project>"
node dist/startup.js --port 3100 --repo "<monorepo>/<package-or-app>"
```

For multiple repositories, edit `<implementation-root>/server.config.json`:

```json
{
  "repos": [
    { "name": "app", "path": "<app-root>" },
    { "name": "library", "path": "<library-root>" }
  ]
}
```

Inside ChatGPT, use the simple form for one repository and the explicit form for multiple repositories:

```text
Search for ConfigLoader.
Find symbols named ConfigLoader.
List files under src with repo_files if the path is unclear.
Fetch src/index.ts lines 1-80.
For multiple repositories, call repo_list first and use repo_path <repo_path-from-repo_list>.
Only list the tree when I ask about folder structure.
If the repository changed or the snapshot looks stale, refresh the selected repository, then search again.
```

Use absolute paths only as `repo_path`. The file `path` argument must stay relative to that repository; `repo_fetch` will reject absolute file paths.

## 6. Local MCP Protocol Check（本地协议验证）

Use the SDK client from `<implementation-root>`:

```powershell
$script = @'
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const client = new Client({ name: 'local-verifier', version: '0.0.1' });
const transport = new StreamableHTTPClientTransport(new URL('http://127.0.0.1:3100/mcp'));
await client.connect(transport);
const tools = await client.listTools();
const listed = await client.callTool({ name: 'repo_list', arguments: {} });
const repoPath = listed.structuredContent.repositories[0].repo_path;
const files = await client.callTool({ name: 'repo_files', arguments: { repo_path: repoPath, limit: 10 } });
const tree = await client.callTool({ name: 'repo_tree', arguments: { repo_path: repoPath, path: '.', depth: 1, limit: 10 } });
await client.close();
console.log(JSON.stringify({ tools: tools.tools.map((t) => t.name), repositories: listed.structuredContent.repositories, files: files.structuredContent, tree: tree.structuredContent }, null, 2));
'@

node --input-type=module -e $script
```

Expected tools:

```text
repo_list
repo_search
repo_files
repo_fetch
repo_tree
repo_symbols
repo_refresh
```

## 7. Connect From ChatGPT（从 ChatGPT 连接）

ChatGPT web（网页端）cannot directly reach `http://127.0.0.1:3100/mcp`. Use Secure MCP Tunnel（安全 MCP 隧道）or another HTTPS route.

High-level flow:

1. Keep the local server running.
2. Create a tunnel whose local target is `http://127.0.0.1:3100/mcp`.
3. Open ChatGPT settings.
4. Enable Developer mode（开发者模式）if available.
5. Create an MCP app/connector（应用/连接器）.
6. Use the tunnel HTTPS `/mcp` URL or tunnel profile.

Suggested fields:

| Field | Value |
|---|---|
| Name | `Read Code` |
| Description | `Let ChatGPT read authorized local repositories through a read-only MCP file map, search, symbol, fetch, and refresh bridge.` |
| Server URL | HTTPS `/mcp` URL from your tunnel |
| Authentication | `No Authentication` for local development |

If ChatGPT forces OAuth（开放授权）, stop and implement production OAuth 2.1/OIDC first. This repository intentionally advertises OAuth as unavailable in `dev_local`.

## 8. Local Link Check（本地链路自检）

After the local server is running, run from `<implementation-root>`:

```powershell
npm run check:link
```

Expected result:

```text
[OK] local HTTP discovery
[OK] MCP tools
[OK] read_code guide
[OK] repo_list
[OK] repo_files
[OK] repo_fetch
[OK] repo_tree
```

The check verifies the local MCP server, tool registration, first-use guide, repository listing, file map listing, bounded fetch, and a small tree read. It also probes the default local tunnel admin endpoint if available. To require tunnel health:

```powershell
$env:READ_CODE_REQUIRE_TUNNEL = "1"
npm run check:link
```

To use a non-default server:

```powershell
$env:READ_CODE_MCP_URL = "http://127.0.0.1:3101/mcp"
npm run check:link
```

Important boundary: this self-check cannot prove that a particular ChatGPT conversation has actually selected the connector. If this check passes but ChatGPT still says it cannot read the repository, the next check is in ChatGPT itself: open a fresh chat, select `Read Code` from the tool picker, and ask it to call `repo_list`.

If the connector was created before this project exposed underscore tool names, refresh or recreate the connector/app. A new chat may still reuse cached connector metadata; the imported tools must be `repo_list`, `repo_search`, `repo_files`, `repo_fetch`, `repo_tree`, `repo_symbols`, and `repo_refresh`.

Windows UNC（网络共享）note: if `npm run check:link` starts from a network share and looks under `C:\Windows`, use the direct command:

```powershell
node .\scripts\check-read-code-link.mjs
```

or map the share for the command:

```powershell
cmd /d /s /c "pushd ""<implementation-root>"" && npm run check:link && popd"
```

## 9. Stop The Server（停止服务）

Press `Ctrl+C` in the server terminal.

If it is running in the background:

```powershell
Get-CimInstance Win32_Process -Filter "name = 'node.exe'" |
  Where-Object { $_.CommandLine -like '*dist/startup.js --port 3100*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId }
```

## 10. Common Problems（常见问题）

| Symptom | Fix |
|---|---|
| ChatGPT cannot reach `127.0.0.1` | Use Secure MCP Tunnel or another HTTPS route. |
| `npm run check:link` passes but ChatGPT still cannot read | The local MCP chain is healthy. Re-select `Read Code` in the current chat, refresh connector metadata, or start a fresh chat and ask it to call `repo_list`. |
| ChatGPT still mentions `repo.list` or says no `repo_list` tool exists | The connector likely cached old tool metadata. Refresh or recreate the connector/app, then ask for `repo_list`. |
| `npm run check:link` fails at `repo_list` | The local server is reachable but the MCP tool call failed; restart with the intended `--repo` or config file and re-run the check. |
| `repo_search` cannot find a file that should exist | Use `repo_files` with a precise `prefix` such as `src`, `tests`, or `tools`; if the file is `fetchable_unindexed`, call `repo_fetch` with the returned relative path. |
| `repo_files` returns `excluded` for a path | The file is outside the active fetch/index set, usually because of policy, size, binary/text detection, sensitivity, or snapshot entry limits. Narrow the authorized root or refresh after changing the repository if needed. |
| OAuth setup fails | Current mode is `dev_local`; choose `No Authentication` for local testing. |
| `repo_fetch` rejects an absolute file path | Use the absolute value only as `repo_path`; use a relative file `path` such as `src/index.ts`. |
| Large repository scans are slow | Bind the smallest useful project folder instead of a drive, home directory, network share root, or full monorepo. |
| Port `3100` is busy | Start with `--port 3101` and update tunnel target. |
| New files do not appear | Ask ChatGPT to call `repo_refresh` only for the selected `repo_path`, then use `repo_search` or `repo_symbols` again before fetching. |
| GitHub reports a secret | Rotate the value, remove it from history, and replace examples with placeholders. |

## 11. Official References（官方参考）

- OpenAI Apps SDK（应用开发包）: https://developers.openai.com/apps-sdk/
- Connect from ChatGPT（从 ChatGPT 连接）: https://developers.openai.com/apps-sdk/deploy/connect-chatgpt
- ChatGPT Developer mode（开发者模式）: https://developers.openai.com/api/docs/guides/developer-mode
- Secure MCP tunnels（安全 MCP 隧道）: https://developers.openai.com/api/docs/guides/secure-mcp-tunnels
- MCP in Apps SDK（模型上下文协议）: https://developers.openai.com/apps-sdk/concepts/mcp-server
- Apps SDK security and privacy（安全与隐私）: https://developers.openai.com/apps-sdk/guides/security-privacy
- MCP tools specification（工具规范）: https://modelcontextprotocol.io/specification/2025-06-18/server/tools
