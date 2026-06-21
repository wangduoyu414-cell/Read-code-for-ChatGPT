# Official Evidence（官方证据表）

本表只记录官方文档依据，不记录本地仓库事实。

| ID | 官方来源 | 事实摘录/判断 | 对任务卡的约束 |
|---|---|---|---|
| OE-001 | OpenAI Apps SDK Quickstart: https://developers.openai.com/apps-sdk/quickstart | `Apps SDK`（应用开发套件）应用使用 `MCP`（模型上下文协议）连接 `ChatGPT`（聊天网页端）；必需 `MCP server`，`UI`（界面）可选。 | 第一版可以无界面，核心是 `MCP server` 和工具。 |
| OE-002 | OpenAI Build your MCP server: https://developers.openai.com/apps-sdk/build/mcp-server | `MCP server` 定义工具、执行鉴权、返回数据，可指向 `UI`（界面）资源。 | 鉴权和数据返回必须在服务端完成。 |
| OE-003 | OpenAI Define tools: https://developers.openai.com/apps-sdk/plan/tools | 工具是 `MCP server` 与模型之间的契约；需要明确 `inputSchema`、`outputSchema`、结构化输出、读写拆分、工具提示。 | 四个工具必须稳定命名、单一职责、结构化返回。 |
| OE-004 | OpenAI Connect from ChatGPT: https://developers.openai.com/apps-sdk/deploy/connect-chatgpt | `Developer mode`（开发者模式）可连接 `MCP server`；本地开发可用 `Secure MCP Tunnel` 或公网隧道；权限设置可允许自动读取信息。 | 私有代码场景不能依赖确认提示；服务端必须逐次校验。 |
| OE-005 | OpenAI Secure MCP Tunnel: https://developers.openai.com/api/docs/guides/secure-mcp-tunnels | `tunnel-client` 不需要入站互联网；私有 `MCP server` 保持在客户控制环境内，经出站 `HTTPS` 连接 `OpenAI`。 | 私有本地仓库默认只采用 `Secure MCP Tunnel`。 |
| OE-006 | OpenAI Security & Privacy: https://developers.openai.com/apps-sdk/guides/security-privacy | 要求最小权限、明确同意、纵深防御、假设提示注入和恶意输入会到达服务器、验证所有内容并保留审计日志。 | 必须有威胁模型、输入校验、输出脱敏和审计。 |
| OE-007 | MCP Tools spec: https://modelcontextprotocol.io/specification/2025-06-18/server/tools | 工具支持 `inputSchema`、`outputSchema`、`annotations`、`structuredContent`；服务器必须校验输入、访问控制、限流和输出清理。 | 工具模式和安全要求必须进入任务卡。 |
| OE-008 | MCP Resources spec: https://modelcontextprotocol.io/specification/2025-06-18/server/resources | 资源可用 `file://`、`git://` 等 URI，但资源能力会扩大读取面。 | 第一版不启用通用资源读取；如返回资源链接，必须受策略限制。 |
| OE-009 | MCP Roots draft: https://modelcontextprotocol.io/specification/draft/client/roots | `roots`（根目录）是提示性信息，不是访问控制；新实现不应采用已弃用的 Roots 作为核心边界。 | 授权根必须是服务端仓库目录，不是协议 Roots。 |
| OE-010 | MCP Security Best Practices: https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices | 覆盖混淆代理、令牌透传、SSRF、会话劫持、本地服务器攻陷、范围最小化等风险。 | 禁止令牌透传，补充会话、SSRF、本地沙箱风险。 |
| OE-011 | MCP Authorization: https://modelcontextprotocol.io/docs/tutorials/security/authorization | 敏感资源建议使用授权；生产环境强制 `HTTPS`；最小作用域；不要记录凭据。 | 真实使用必须有授权、作用域、令牌校验和日志脱敏。 |

## 待确认官方能力点

- 目标 `ChatGPT`（聊天网页端）工作区是否可用 `Secure MCP Tunnel`（安全 MCP 隧道）。
- 目标账号/组织是否允许 `Developer mode`（开发者模式）。
- 目标客户端对 `Streamable HTTP`（可流式 HTTP）、`OAuth 2.1`（授权协议 2.1）、工具注解和 `structuredContent`（结构化内容）的实际支持情况。
- 若后续需要 `UI`（界面），需要确认 `_meta.ui.resourceUri` 与兼容别名支持情况。

| OE-012 | OpenAI Apps SDK Auth: https://developers.openai.com/apps-sdk/build/auth | ChatGPT 授权需要安全方案元数据与运行时挑战，例如 `_meta["mcp/www_authenticate"]`。 | 任务卡必须补授权发现与挑战链路。 |
| OE-013 | OpenAI Apps SDK submission/connect docs | 公开提交和生产连接不能等同于本地开发隧道；公开应用需要公网 HTTPS、域名和策略材料。 | 第一版保持私有开发设计；公开发布另开任务。 |
| OE-014 | OpenAI Apps SDK tool planning | 数据工具和渲染工具应分离；工具元数据影响 discovery（发现）。 | 第一版无 UI widget；工具 metadata 必须完整。 |
