# Implementation Decisions（实现决策记录）

状态：decided（已决策）。
时间戳：2026-06-21T06:00:00Z。

## Architecture Decisions（架构决策）

| # | 决策 | 选项 | 选择 | 理由 |
|---|---|---|---|---|
| D-001 | 运行时 | Node.js / Python / Go | Node.js + TypeScript | 官方 SDK 优先支持；类型安全；MCP 生态一致 |
| D-002 | MCP SDK | @modelcontextprotocol/sdk / fastmcp / mcp-framework | @modelcontextprotocol/sdk | 官方 SDK；安全敏感主边界不引入第三方抽象 |
| D-003 | Transport | Streamable HTTP / stdio | Streamable HTTP（优先）；stdio 降级 | 符合 Secure MCP Tunnel 出站 HTTPS 模型 |
| D-004 | UI Widget | 有 / 无 | 无 UI widget，仅数据工具 | docs/design/task-card.md §18.4 第一版决策 |
| D-005 | 测试框架 | vitest / jest / node:test | vitest | 轻量、TypeScript 原生、与 Vite 生态一致 |
| D-006 | 包管理 | npm / pnpm / yarn | npm | 零额外依赖；环境通用 |
| D-007 | 模块系统 | ESM / CJS | ESM（"type": "module"） | 现代标准；MCP SDK 默认 ESM |
| D-008 | 日志 | pino / winston / console | console + 结构化 JSON | 最小依赖；审计日志通过独立模块 |
| D-009 | 路径规范化 | 自研 / path-to-regexp | 自研（Node.js path 模块 + 白名单） | 安全敏感；不引入额外解析器 |

## Auth Decisions（鉴权决策）

| # | 决策 | 选项 | 选择 | 理由 |
|---|---|---|---|---|
| D-010 | 开发期鉴权 | OAuth 2.1 / 本地临时 token / 无鉴权 | 本地临时 token（最小） | 开发期不暴露网络；EXEC-004 实现 |
| D-011 | 生产鉴权 | OAuth 2.1 + OIDC / mTLS only | OAuth 2.1 + OIDC（推荐）；mTLS 作为传输层补充 | 符合 task-card §9 和 OE-012 |
| D-012 | Token 存储 | 内存 / 文件 / 外部 IdP | 内存（开发期）；外部 IdP session（生产） | 不持久化长期凭据 |

## Scope Decisions（范围决策）

| # | 决策 | 选项 | 选择 | 理由 |
|---|---|---|---|---|
| D-013 | 用户数 | 单用户 / 多用户 | 单用户 | task-card §4 第一版范围 |
| D-014 | 仓库数 | 单仓库 / 多仓库 | 单仓库 | task-card §4 第一版范围 |
| D-015 | 快照类型 | 不可变快照 / 实时目录 | 不可变快照 | SNAP-001~003 |
| D-016 | 分页 | 支持 / 不支持 | 第一版不支持分页；truncated=true + 预算拒绝 | task-card §18.6 |
| D-017 | 符号范围 | definitions only / definitions + references | definitions only | task-card §18.6 第一版 |
| D-018 | 敏感检测 | 内置规则 / 外部服务 | 内置规则（扩展名 + 路径 + 高熵检测） | 不依赖外部服务 |

## Remaining TBD for Implementation（实现期待确认）

这些项将在对应执行卡中确认或阻塞：
- Secure MCP Tunnel 可用性 → EXEC-010 确认
- ChatGPT structuredContent 支持 → EXEC-010 确认
- Windows 重解析点/大小写别名处理 → EXEC-003 实现时处理
- OAuth 2.1 IdP 选择 → EXEC-004/005 实现时选择
- 快照保留期策略 → EXEC-006 定义
