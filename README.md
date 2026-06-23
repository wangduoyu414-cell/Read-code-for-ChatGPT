# Read Code for ChatGPT

让 ChatGPT 读懂你的本地仓库，但只走你授权的、只读的 MCP（Model Context Protocol，模型上下文协议）通道。

`Read Code for ChatGPT` is a local read-only MCP bridge（本地只读连接桥）for real repositories. You choose one or more folders, the server snapshots them, and ChatGPT gets a small set of safe tools: list repositories, inspect the file map, search indexed text, find symbols, fetch bounded line ranges, and refresh the snapshot when files change.

It is built for the moment when pasting files into chat stops working, but giving a model your whole machine would be a bad idea. ChatGPT can ask better questions about your codebase; the server still owns the boundary.

![Add read code to ChatGPT](docs/assets/chatgpt-connect-modal.svg)

> The SVG（可缩放矢量图）above is a publish-safe homepage visual inspired by the ChatGPT connector dialog. If you want to use the exact screenshot, replace it with `docs/assets/chatgpt-connect-modal.png` and update this image path.

## Why It Exists

ChatGPT can reason across architecture, tasks, tests, and implementation details, but a repository is not a single prompt. This project gives it safe eyes on local code without pretending the whole computer is context:

- list the exact configured repository paths
- inspect a paginated file map before guessing paths
- find lightweight symbol definitions
- search code and docs
- fetch bounded line ranges
- browse an authorized file tree only when directory layout is requested

The design goal is not "give the model my whole disk". The design goal is: **authorize explicit folders, expose bounded non-destructive tools, mark repository content as untrusted data, and keep server-side limits in charge.**

## What ChatGPT Can Read

At startup you choose one or more authorized roots. For a single repository:

```powershell
node dist/startup.js --port 3100 --repo "<authorized-repo-path>"
```

For large repositories, choose the smallest useful project directory: one app, package, service, or module. Avoid binding a whole drive, home directory, network share root, or full monorepo unless the task truly needs that scope.

For multiple repositories, configure `implementation/server.config.json`:

```json
{
  "repos": [
    { "name": "app", "path": "<app-root>" },
    { "name": "library", "path": "<library-root>" }
  ]
}
```

On first use, ChatGPT can call `read_code` with no arguments or call `repo_list`; both return a compact structured `usage_guide` plus the configured repositories. If only one repository is configured, ChatGPT can call `repo_files`, `repo_search`, `repo_symbols`, `repo_fetch`, `repo_tree`, or `repo_refresh` without `repo_path`. If multiple repositories are configured, ChatGPT must call `repo_list` first, then pass the exact returned `repo_path`. Use `repo_path` only to choose the repository; file paths inside the selected repository remain relative.

Recommended read order for an unfamiliar repository: use `repo_list` when needed, then `repo_files` to inspect exact paths and whether files are fetchable or indexed, then `repo_symbols` or `repo_search`, and finally `repo_fetch` for the smallest useful line range. Use `repo_tree` only when the user asks about directory layout or what is inside a folder:

```text
List files under src with repo_files.
Search for createApp.
Find symbols named createApp.
Fetch app/main.ts lines 1-80.
For multiple repositories, call repo_list first and pass repo_path <repo_path-from-repo_list>.
List app/ only if I ask about the app directory layout.
```

Do not put an absolute file path into the tool's file `path` argument. The absolute path belongs in `repo_path`; the file path should be `file.ts` or `subdir/file.ts`.

The snapshot admits common source, config, and documentation files. It also admits project text files without standard extensions, such as `Dockerfile`, `Makefile`, `LICENSE`, `.gitignore`, and unknown-extension files that pass a lightweight text check.

The repository view is snapshot-based. Ask ChatGPT to call `repo_refresh` only when files changed after startup or an earlier result may be stale; the server will scan the same authorized root again, build a new snapshot/index, and switch to it only after the refresh succeeds.

Large repositories may have files that are fetchable but not indexed for search. `repo_files` is the source of truth for file discovery inside the active snapshot: it can show `indexed`, `fetchable_unindexed`, and explicitly requested `excluded` entries without returning file contents. If `repo_search` cannot find a known file, ask ChatGPT to use `repo_files` with a precise `prefix` such as `src`, `tests`, or `tools`, then call `repo_fetch` with the returned relative path.

## Tools

| Tool | Purpose |
|---|---|
| `read_code` | Backward-compatible wrapper for ChatGPT conversations that expect a `read_code` entry; empty arguments return the usage guide and repository list, while explicit operations route to the read-only `repo_*` tools. |
| `api_tool` | Backward-compatible wrapper for older ChatGPT connectors that show the tool as `read_code/api_tool`; empty arguments return the usage guide and repository list, while explicit operations route to the read-only `repo_*` tools. |
| `repo_list` | List configured repository names, exact `repo_path` values, and the same first-use `usage_guide`. |
| `repo_files` | List a paginated file map with fetch/index/exclusion status, without file contents. |
| `repo_symbols` | Find lightweight symbol definitions. |
| `repo_search` | Search indexed text snippets. |
| `repo_fetch` | Fetch a bounded line segment from one file. |
| `repo_tree` | List a bounded directory tree when directory layout is requested. |
| `repo_refresh` | Re-scan the authorized root only when the repository changed or the snapshot may be stale. |

All tools are non-destructive for your repository. `repo_refresh` updates only the server's in-memory snapshot/index. There is no shell execution, no write API（应用程序接口）, and no full repository export tool.

Compatibility note: older ChatGPT conversations may refer to the connector entry as `read_code` or `read_code/api_tool`. In this server, those entries are exposed as `read_code` and `api_tool`; both internally route to the same read-only `repo_list`, `repo_files`, `repo_search`, `repo_fetch`, `repo_tree`, `repo_symbols`, and `repo_refresh` operations. Calling either wrapper with no arguments is intentionally equivalent to a guided `repo_list` start.

## Safety Model

- absolute paths are rejected
- `..` traversal is rejected
- sensitive paths such as `.git`, `.env`, private keys, and credential files are rejected
- binary files, oversized files, and sensitive files are excluded
- system/unreadable directories are skipped and recorded
- response size, session budget, tool call count, and tree depth are capped
- returned repository content is marked `content_origin=repository_snapshot` and `instruction_trust=untrusted`
- ChatGPT can use the single configured repository automatically, but arbitrary paths are still rejected; in multi-repository mode it must choose a configured `repo_path`

More detail: [docs/SECURITY.md](docs/SECURITY.md).

## Quick Start

```powershell
git clone https://github.com/wangduoyu414-cell/Read-code-for-ChatGPT.git
cd Read-code-for-ChatGPT
cd implementation
npm install
npm run build
npm test
node dist/startup.js --port 3100 --repo "<authorized-repo-path>"
```

Local endpoint:

```text
http://127.0.0.1:3100/mcp
```

For ChatGPT web（网页端）, expose that local endpoint through Secure MCP Tunnel（安全 MCP 隧道）or another HTTPS（安全超文本传输协议）route. The ChatGPT page cannot directly reach `127.0.0.1` on your machine.

Full setup guide: [CONNECT_CHATGPT.md](CONNECT_CHATGPT.md).

## ChatGPT App / Connector Setup

In ChatGPT Developer mode（开发者模式）, create an MCP app/connector（连接器）with:

| Field | Value |
|---|---|
| Name | `Read Code` |
| Description | `Let ChatGPT read authorized local repositories through a read-only MCP file map, search, symbol, fetch, and refresh bridge.` |
| MCP server | Your HTTPS `/mcp` URL or Secure MCP Tunnel profile |
| Authentication | `No Authentication` for local dev; production needs OAuth 2.1/OIDC |

If your ChatGPT UI requires OAuth（开放授权）, this project is not in production-auth mode yet. Use no-auth local development, or implement production OAuth before exposing private repositories.

## Local Link Check

After the server is running, verify the local chain from `<implementation-root>`:

```powershell
npm run check:link
```

This checks local discovery, MCP tool registration, the first-use `read_code` guide, `repo_list`, `repo_files`, `repo_fetch`, a small `repo_tree` read, and the optional local tunnel admin endpoint. It proves the local MCP chain is reachable; it does not prove the current ChatGPT chat selected the connector.

If an older connector/app was created before tool names were normalized, refresh or recreate that connector so ChatGPT imports `repo_list`, `repo_search`, `repo_files`, `repo_fetch`, `repo_tree`, `repo_symbols`, and `repo_refresh`. Starting a new chat alone may keep using cached connector metadata.

Full options, expected output, and Windows UNC（网络共享）workarounds: [CONNECT_CHATGPT.md#8-local-link-check本地链路自检](CONNECT_CHATGPT.md#8-local-link-check本地链路自检).

## Project Layout

```text
.
├─ CONNECT_CHATGPT.md
├─ README.md
├─ tool-schemas.json
├─ docs/
│  ├─ SECURITY.md
│  ├─ REFERENCES.md
│  └─ GITHUB_PUBLISH_CHECKLIST.md
├─ execution-cards/
└─ implementation/
   ├─ src/
   ├─ tests/
   ├─ fixtures/
   └─ package.json
```

## References

- OpenAI Apps SDK（应用开发包）: https://developers.openai.com/apps-sdk/
- Connect from ChatGPT（从 ChatGPT 连接）: https://developers.openai.com/apps-sdk/deploy/connect-chatgpt
- ChatGPT Developer mode（开发者模式）: https://developers.openai.com/api/docs/guides/developer-mode
- Secure MCP tunnels（安全 MCP 隧道）: https://developers.openai.com/api/docs/guides/secure-mcp-tunnels
- MCP in Apps SDK（模型上下文协议）: https://developers.openai.com/apps-sdk/concepts/mcp-server
- Apps SDK security and privacy（安全与隐私）: https://developers.openai.com/apps-sdk/guides/security-privacy
- MCP tools specification（工具规范）: https://modelcontextprotocol.io/specification/2025-06-18/server/tools

## Status

Current mode: `dev_local`.

Implemented:

- Streamable HTTP MCP server
- read-only tool registry
- repository snapshot manifest
- multi-repository `repo_path` selection through `repo_list`
- paginated `repo_files` file map with fetch/index/exclusion status
- source-priority snapshot scanning for common code-review directories
- text and symbol indexing
- first-call `usage_guide` returned by `read_code` and `repo_list`
- on-demand snapshot refresh with old-snapshot fallback on failure
- path guard, redaction, budgets, and audit ids
- ChatGPT connector discovery endpoints
- ChatGPT-compatible underscore tool names, with legacy dotted names accepted only as server-side aliases

Not production-ready yet:

- production OAuth 2.1/OIDC
- multi-user access policy
- hosted deployment hardening

## Publication Note

This repository intentionally ignores local review receipts, tunnel client files, build outputs, `node_modules`, and `.env` files. Before publishing, run [docs/GITHUB_PUBLISH_CHECKLIST.md](docs/GITHUB_PUBLISH_CHECKLIST.md).
