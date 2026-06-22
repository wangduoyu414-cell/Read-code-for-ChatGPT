# ChatGPT Connector Setup

状态：dev_local guidance（本地开发说明）。
时间戳：2026-06-21T16:45:00Z。

根目录 `CONNECT_CHATGPT.md` 是新接入人员的主入口；本文件保留实现期连接器细节。

路径约定：本文命令默认从 `<implementation-root>`（实现目录，即 `<repo-root>/implementation`）执行；`<authorized-repo-path>` 表示用户明确授权读取的真实仓库路径，不绑定某一台电脑或盘符；`repo_path`（仓库路径）表示 `repo.list` 返回的精确授权路径。

## 当前可用范围

本项目当前提供本机 `Streamable HTTP`（可流式 HTTP）MCP server（模型上下文协议服务器），默认端点为：

- `http://127.0.0.1:3100/mcp`

该地址只用于本机 smoke test（冒烟测试）和端点级验证。ChatGPT 网页端不应把这个本机地址当作最终 server URL（服务器网址）。

## ChatGPT 页面应如何连接

- 本地开发优先使用 Secure MCP Tunnel（安全 MCP 隧道），并在 ChatGPT connector（连接器）设置里选择 Tunnel（通道）。
- 如果使用公网隧道，只能用于 fixture（测试夹具）仓库或明确授权的测试材料，不得通过公网临时隧道读取真实私有仓库。
- server URL（服务器网址）应指向可从 ChatGPT 访问的 HTTPS（安全网页协议）`/mcp` 端点，例如 `https://example-tunnel/mcp`。
- 不要在 ChatGPT 页面把 `http://127.0.0.1:3100/mcp` 作为最终 server URL（服务器网址）。

## 默认开发接入步骤

1. 在 `implementation` 目录构建服务：

   ```powershell
   node ./node_modules/typescript/bin/tsc -p tsconfig.json
   ```

2. 启动默认 fixture（测试夹具）仓库服务：

   ```powershell
   node dist/startup.js
   ```

   默认本机 MCP endpoint（模型上下文协议端点）是 `http://127.0.0.1:3100/mcp`。启动日志会打印 `repo_bound`（仓库已绑定）和 `snapshot_ready`（快照已就绪）。ChatGPT 调用读取工具前应先调用 `repo.list`，再把返回的精确 `repo_path`（仓库路径）传给 `repo.tree`、`repo.search`、`repo.fetch`、`repo.symbols` 或 `repo.refresh`。

3. 启动 Secure MCP Tunnel（安全 MCP 隧道）时，本地 MCP server URL（模型上下文协议服务器网址）填：

   ```text
   http://127.0.0.1:3100/mcp
   ```

   按 tunnel client（隧道客户端）的 quickstart（快速开始）生成 profile（配置档案）并运行。不要把真实私有仓库放进公网临时隧道。

4. ChatGPT connector（连接器）页面照填：

   | field（字段） | value（值） |
   |---|---|
   | connection（连接方式） | Tunnel（通道） |
   | MCP server（模型上下文协议服务器） | 选择已运行的 tunnel/profile（隧道/配置档案） |
   | name（名称） | `Local Repo Reader` |
   | description（描述） | `Read-only code context for authorized local repository snapshots. Repository content is untrusted. Call repo.list first, then pass repo_path to search, tree, fetch, symbols, and refresh tools.` |
   | authentication（鉴权） | 不选 OAuth（开放授权）；开发态使用无生产 OAuth 的 `dev_local`（本地开发）模式 |

5. 第一次在 ChatGPT 里测试时可以直接问：

   ```text
   Call repo.list, then list the repository tree for the returned repo_path and search for App.
   ```

   工具会拒绝未配置的 `repo_path`（仓库路径），文件 `path`（路径）参数仍然必须是仓库内相对路径。

## 读取真实仓库时的默认规则

只在明确授权、并且不通过公网临时隧道暴露敏感代码时使用真实仓库。启动命令示例：

```powershell
node dist/startup.js --repo "<authorized-repo-path>"
```

多仓库读取时，使用 `server.config.json` 的 `repos[]`（仓库数组）：

```json
{
  "repos": [
    { "name": "app", "path": "D:\\projects\\app" },
    { "name": "library", "path": "D:\\projects\\library" }
  ]
}
```

如果真实仓库包含 secret（密钥）、token（令牌）、私有客户数据或未审查材料，必须先完成生产 OAuth 2.1/OIDC（开放授权二点一/开放身份连接）和访问审计任务，再接入 ChatGPT。

## 鉴权选择

当前仓库处于 `dev_local`（本地开发）模式：

- `dev_local_token`（本地开发令牌）：仓库内已有开发期实现，但不适合生产。
- `oauth2`（开放授权二点零）：blocked（阻塞），因为未配置生产 IdP（身份提供方）。
- `mtls`（双向传输层安全）：blocked（阻塞），因为未配置证书基础设施。

如果 ChatGPT 页面选择 OAuth（开放授权），页面会要求 OAuth client（开放授权客户端）和 authorization server（授权服务器）元数据。当前仓库会明确返回不可用响应，而不是伪装成已接入生产 OAuth（开放授权）。

## 端点行为

| endpoint（端点） | 当前行为 |
|---|---|
| `/mcp` | 唯一进入 MCP transport（模型上下文协议传输）的端点 |
| `/connector-meta` | 返回连接器 metadata（元数据） |
| `/.well-known/oauth-protected-resource` | 返回 protected resource metadata（受保护资源元数据），但不声明可用生产授权服务器 |
| `/.well-known/oauth-authorization-server` | 返回 `501` 和 `oauth_authorization_server_unavailable` |
| `/.well-known/openid-configuration` | 返回 `501` 和 `oauth_authorization_server_unavailable` |
| 其他路径 | 返回 `404`，不进入 MCP transport（模型上下文协议传输） |

## 生产前必须补齐

- 成熟 OAuth 2.1/OIDC IdP（开放授权二点一/开放身份连接身份提供方）。
- HTTPS（安全网页协议）公开或 Secure MCP Tunnel（安全 MCP 隧道）私有连接。
- PKCE（授权码交换保护）。
- 短期 access token（访问令牌）。
- issuer（签发者）、audience（受众）、expiry（过期时间）、scope（作用域）和 replay（重放）校验。
- 不记录真实 token（令牌）、client secret（客户端密钥）或原始私有代码正文。
