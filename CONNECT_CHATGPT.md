# Connect To ChatGPT（接入 ChatGPT）

This guide explains how to run `Read code for ChatGPT` locally, authorize one repository folder, and connect it to ChatGPT through MCP（Model Context Protocol，模型上下文协议）.

The current project mode is `dev_local`（本地开发）. It is ready for local validation and private connector testing, but production OAuth 2.1/OIDC（开放授权/开放身份连接）is not implemented yet.

## 0. Terms（术语）

- `<repo-root>`: this repository root, containing `README.md`, `CONNECT_CHATGPT.md`, and `tool-schemas.json`.
- `<implementation-root>`: `<repo-root>/implementation`.
- `<authorized-repo-path>`: the local folder you explicitly allow ChatGPT to read.
- MCP endpoint（模型上下文协议端点）: `http://127.0.0.1:3100/mcp` during local development.
- Tunnel（隧道）: an HTTPS（安全超文本传输协议）route that lets ChatGPT reach your local MCP endpoint.

## 1. What ChatGPT Gets（ChatGPT 能获得什么）

ChatGPT receives four read-only tools:

| Tool | What it does |
|---|---|
| `repo.tree` | List bounded repository paths. |
| `repo.search` | Search indexed text. |
| `repo.fetch` | Read a bounded line range from one file. |
| `repo.symbols` | Find lightweight symbol definitions. |

The server rejects absolute paths, parent traversal, sensitive files, oversized responses, unsupported files, and unreadable/system directories. Repository content is returned as untrusted data.

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

## 4. Start With A Fixture（先用测试仓库启动）

```powershell
node dist/startup.js --port 3100
```

Default authorized root:

```text
implementation/fixtures/safe-repo
```

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

Good examples:

```powershell
node dist/startup.js --port 3100 --repo "D:\projects\my-app"
node dist/startup.js --port 3100 --repo "C:\projects\my-app"
node dist/startup.js --port 3100 --repo "/Users/me/projects/my-app"
```

Avoid binding a whole drive unless you understand the privacy and indexing cost.

Inside ChatGPT, ask for relative paths:

```text
List the repository tree.
Read docs/README.md.
Search for ConfigLoader.
Fetch src/index.ts lines 1-100.
```

Do not ask ChatGPT to read absolute paths. The server will reject them.

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
const tree = await client.callTool({ name: 'repo.tree', arguments: { path: '.', depth: 1, limit: 10 } });
await client.close();
console.log(JSON.stringify({ tools: tools.tools.map((t) => t.name), tree: tree.structuredContent }, null, 2));
'@

node --input-type=module -e $script
```

Expected tools:

```text
repo.search
repo.fetch
repo.tree
repo.symbols
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
| Name | `read code` |
| Description | `Read-only code context for an authorized local repository snapshot.` |
| Server URL | HTTPS `/mcp` URL from your tunnel |
| Authentication | `No Authentication` for local development |

If ChatGPT forces OAuth（开放授权）, stop and implement production OAuth 2.1/OIDC first. This repository intentionally advertises OAuth as unavailable in `dev_local`.

## 8. Stop The Server（停止服务）

Press `Ctrl+C` in the server terminal.

If it is running in the background:

```powershell
Get-CimInstance Win32_Process -Filter "name = 'node.exe'" |
  Where-Object { $_.CommandLine -like '*dist/startup.js --port 3100*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId }
```

## 9. Common Problems（常见问题）

| Symptom | Fix |
|---|---|
| ChatGPT cannot reach `127.0.0.1` | Use Secure MCP Tunnel or another HTTPS route. |
| OAuth setup fails | Current mode is `dev_local`; choose `No Authentication` for local testing. |
| `repo.tree` rejects `D:\...` | Use relative paths inside ChatGPT. |
| Full drive scan is slow | Bind a specific project folder instead of `D:\` or `/`. |
| Port `3100` is busy | Start with `--port 3101` and update tunnel target. |
| GitHub reports a secret | Rotate the value, remove it from history, and replace examples with placeholders. |

## 10. Official References（官方参考）

- OpenAI Apps SDK（应用开发包）: https://developers.openai.com/apps-sdk/
- Connect from ChatGPT（从 ChatGPT 连接）: https://developers.openai.com/apps-sdk/deploy/connect-chatgpt
- ChatGPT Developer mode（开发者模式）: https://developers.openai.com/api/docs/guides/developer-mode
- Secure MCP tunnels（安全 MCP 隧道）: https://developers.openai.com/api/docs/guides/secure-mcp-tunnels
- MCP in Apps SDK（模型上下文协议）: https://developers.openai.com/apps-sdk/concepts/mcp-server
- Apps SDK security and privacy（安全与隐私）: https://developers.openai.com/apps-sdk/guides/security-privacy
- MCP tools specification（工具规范）: https://modelcontextprotocol.io/specification/2025-06-18/server/tools
