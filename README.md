# Read code for ChatGPT

让 ChatGPT read your local repository, but only through a narrow, read-only, auditable MCP gate.

`Read code for ChatGPT` is a local MCP（Model Context Protocol，模型上下文协议）server that turns authorized repository folders into bounded tools ChatGPT can call: list, tree, search, fetch, symbols, and refresh. It is built for people who want ChatGPT to understand real codebases without pasting files into the chat window.

![Add read code to ChatGPT](docs/assets/chatgpt-connect-modal.svg)

> The SVG（可缩放矢量图）above is a publish-safe homepage visual inspired by the ChatGPT connector dialog. If you want to use the exact screenshot, replace it with `docs/assets/chatgpt-connect-modal.png` and update this image path.

## Why This Exists

ChatGPT is good at reasoning, but a repository is not a single prompt. This project gives it a small set of safe eyes:

- list the exact configured repository paths
- browse an authorized file tree
- search code and docs
- fetch bounded line ranges
- find lightweight symbol definitions

The design goal is not "give the model my whole disk". The design goal is: **grant explicitly configured folders, expose bounded non-destructive tools, mark all repository content as untrusted, and keep server-side limits in charge.**

## What It Can Read

At startup you choose one or more authorized roots. For a single repository:

```powershell
node dist/startup.js --port 3100 --repo "<authorized-repo-path>"
```

For multiple repositories, configure `implementation/server.config.json`:

```json
{
  "repos": [
    { "name": "app", "path": "D:\\projects\\app" },
    { "name": "library", "path": "D:\\projects\\library" }
  ]
}
```

Inside ChatGPT, call `repo.list` first. It returns each configured `name`, exact `repo_path`, and current `snapshot_id`. Use `repo_path` only to choose the repository; file paths inside `repo.tree`, `repo.search`, `repo.fetch`, `repo.symbols`, and `repo.refresh` remain repository-relative:

```text
List configured repositories, then read the tree for repo_path D:\projects\app.
Search repo_path D:\projects\app for createApp.
Fetch app/main.ts lines 1-80 from repo_path D:\projects\app.
```

Do not put `D:\project\file.ts` or `/Users/name/project/file.ts` into the tool's file `path` argument. The absolute path belongs in `repo_path`; the file path should be `file.ts` or `subdir/file.ts`.

The snapshot admits common source, config, and documentation files. It also admits project text files without standard extensions, such as `Dockerfile`, `Makefile`, `LICENSE`, `.gitignore`, and unknown-extension files that pass a lightweight text check.

The repository view is snapshot-based. If files change after startup, ask ChatGPT to call `repo.refresh`; the server will scan the same authorized root again, build a new snapshot/index, and switch to it only after the refresh succeeds.

## Tools

| Tool | Purpose |
|---|---|
| `repo.list` | List configured repository names and exact `repo_path` values. |
| `repo.tree` | List a bounded directory tree. |
| `repo.search` | Search indexed text snippets. |
| `repo.fetch` | Fetch a bounded line segment from one file. |
| `repo.symbols` | Find lightweight symbol definitions. |
| `repo.refresh` | Re-scan the authorized root and publish a fresh snapshot/index. |

All tools are non-destructive for your repository. `repo.refresh` updates only the server's in-memory snapshot/index. There is no shell execution, no write API（应用程序接口）, and no full repository export tool.

## Safety Model

- absolute paths are rejected
- `..` traversal is rejected
- sensitive paths such as `.git`, `.env`, private keys, and credential files are rejected
- binary files, oversized files, and sensitive files are excluded
- system/unreadable directories are skipped and recorded
- response size, session budget, tool call count, and tree depth are capped
- returned repository content is marked `content_origin=repository_snapshot` and `instruction_trust=untrusted`
- ChatGPT must choose from the configured `repo_path` whitelist; arbitrary paths are rejected

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
| Name | `read code` |
| Description | `Read-only code context for an authorized local repository snapshot.` |
| MCP server | Your HTTPS `/mcp` URL or Secure MCP Tunnel profile |
| Authentication | `No Authentication` for local dev; production needs OAuth 2.1/OIDC |

If your ChatGPT UI requires OAuth（开放授权）, this project is not in production-auth mode yet. Use no-auth local development, or implement production OAuth before exposing private repositories.

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
- multi-repository `repo_path` selection through `repo.list`
- text and symbol indexing
- on-demand snapshot refresh with old-snapshot fallback on failure
- path guard, redaction, budgets, and audit ids
- ChatGPT connector discovery endpoints

Not production-ready yet:

- production OAuth 2.1/OIDC
- multi-user access policy
- hosted deployment hardening

## Publication Note

This repository intentionally ignores local review receipts, tunnel client files, build outputs, `node_modules`, and `.env` files. Before publishing, run [docs/GITHUB_PUBLISH_CHECKLIST.md](docs/GITHUB_PUBLISH_CHECKLIST.md).
