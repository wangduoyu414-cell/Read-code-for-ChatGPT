# Connector Auth Discovery Contract

状态：implemented（dev_local mode）。
时间戳：2026-06-21T16:45:00Z。

## Connector Identity
- name: `chatgpt-local-repo-001`
- endpoint: `/mcp`
- mode: `dev_local`

## Security Schemes
| Scheme | Status | Applicable |
|---|---|---|
| dev_local_token | implemented | dev only |
| oauth2 | blocked | production |
| mtls | blocked | production |

## Production Requirements
- OAuth 2.1 / OIDC with mature IdP
- mTLS for transport binding
- Short-lived tokens with PKCE
- No token passthrough
- Secure MCP Tunnel or equivalent

## Well-Known Paths
- `/.well-known/oauth-protected-resource`：返回 protected resource metadata（受保护资源元数据）。当前 `dev_local` 模式下 `authorization_servers` 为空，表示没有可用的生产 OAuth authorization server（授权服务器）。
- `/.well-known/oauth-authorization-server`：返回 `501` 和 `oauth_authorization_server_unavailable`，不得挂起或进入 MCP transport（模型上下文协议传输）。
- `/.well-known/openid-configuration`：返回 `501` 和 `oauth_authorization_server_unavailable`，不得挂起或进入 MCP transport（模型上下文协议传输）。
- `/connector-meta`：返回本地连接器 metadata（元数据）和开发/生产边界说明。
- `/mcp`：唯一进入 Streamable HTTP（可流式 HTTP）传输的端点。

## WWW-Authenticate
Unauthorized requests return `_meta["mcp/www_authenticate"]` with available schemes.

## ChatGPT Connector Boundary

- ChatGPT developer mode（聊天网页端开发者模式）的 server URL（服务器网址）必须是 ChatGPT 可访问的 HTTPS（安全网页协议）地址，或选择 Secure MCP Tunnel（安全 MCP 隧道）。
- `http://127.0.0.1:3100/mcp` 只适合本机端点级验证，不适合作为 ChatGPT 网页端的最终 server URL（服务器网址）。
- 当前仓库没有接入真实 OAuth 2.1/OIDC IdP（开放授权二点一/开放身份连接身份提供方）。在 ChatGPT 页面选择 OAuth（开放授权）会要求可用的授权服务器 metadata（元数据）、CIMD（客户端标识元数据文档）或 DCR（动态客户端注册），本仓库当前会明确返回 blocked（阻塞）。
- 生产使用必须另行接入成熟 IdP（身份提供方）、短期 access token（访问令牌）、PKCE（授权码交换保护）、audience（受众）校验和 scope（作用域）校验。
