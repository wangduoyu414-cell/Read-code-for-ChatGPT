# Official Capability Checklist（官方能力检查清单）

状态：checked（已检查）。
时间戳：2026-06-21T06:00:00Z。

## Capability Status（能力状态）

| # | 能力 | 来源 | 状态 | 确认方法 | 阻塞影响 |
|---|---|---|---|---|---|
| OC-001 | ChatGPT Developer Mode | OE-004 | available | ChatGPT 设置 → 开发者模式可开启 | 若不可用，EXEC-010 ChatGPT 验收 blocked |
| OC-002 | Secure MCP Tunnel | OE-005 | TBD | 需在目标 ChatGPT 工作区验证 tunnel-client 连接 | 若不可用，转为 blocked，禁止公网隧道替代 |
| OC-003 | MCP Inspector | OE-007 | available | `npx @modelcontextprotocol/inspector` 可安装 | 若不可用，EXEC-010 Inspector 验收 blocked |
| OC-004 | API Playground | OE-004 | TBD | 需在 ChatGPT developer mode 中验证 | 若不可用，需用等效原始 HTTP 请求替代 |
| OC-005 | @modelcontextprotocol/sdk (TypeScript) | OE-007 | available | npm registry 可访问 | 若不可用，无法实现 MCP server |
| OC-006 | Streamable HTTP transport | OE-007 | TBD | 需确认 SDK 版本支持 | 若不可用，可能降级为 stdio transport |
| OC-007 | OAuth 2.1 / OIDC | OE-012 | TBD | 需选择 IdP 并确认目标环境 | 第一版可用本地开发临时授权替代 |
| OC-008 | mTLS | task-card §9 | TBD | 需确认 tunnel 和 server 证书配置 | 可后置；第一版开发期用本地回环 |
| OC-009 | structuredContent | OE-003, OE-007 | TBD | 需确认 ChatGPT 客户端是否解析 | 若不可用，需 content fallback 策略 |
| OC-010 | tool annotations (readOnlyHint etc.) | OE-003, OE-007 | TBD | 需确认 ChatGPT 客户端是否遵循 | 注解只是提示，服务端策略必须强制 |

## Platform Confirmation（平台确认）

- 操作系统：Windows 11 Pro 10.0.26100
- Node.js：检查中（见校验命令输出）
- npm：检查中（见校验命令输出）
- 文件系统：NTFS（支持重解析点、大小写不敏感但保留大小写、UNC 路径）
- 第一版目标：仅 Windows；跨平台处理记录为 TBD

## Developer Mode Risk Notice（开发者模式风险声明）

- Developer mode 仅用于本地开发和验收，不得作为生产安全边界
- Developer mode 的"允许自动读取信息"权限不能替代服务端逐次授权
- 远程生产连接必须有正式 OAuth 2.1 / mTLS 鉴权方案
- 本卡完成后，Developer mode 的确认提示不作为安全依赖
