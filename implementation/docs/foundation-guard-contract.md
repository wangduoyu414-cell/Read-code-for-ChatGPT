# Foundation Guard Contract（基础守卫契约）

状态：implemented（已实现）。
时间戳：2026-06-21T06:15:00Z。

## Modules

| 模块 | 路径 | 功能 |
|---|---|---|
| Audit ID | `src/audit/audit-id.ts` | 唯一排序 audit_id 生成、最小审计事件类型、内存审计日志 |
| Path Guard | `src/security/path-guard.ts` | 路径规范化、绝对路径拒绝、父目录遍历拒绝、敏感路径检测（.git/.env/SSH/云凭据） |
| Budget | `src/security/budget.ts` | 单响应上限、行窗口上限和共享限流在配置为 `null` 时关闭；单授权字节预算、会话字节计数、调用计数、树深/搜索命中/符号命中限制仍由同一模块执行 |
| Redaction | `src/security/redaction.ts` | 敏感模式脱敏（AWS 密钥/JWT/GitHub token/私钥头）、可配置截断、结构化包装（content_origin/instruction_trust） |
| Secret Scanner | `src/security/secret-scanner.ts` | 高置信度敏感检测（私钥 PEM/连接字符串/Bearer token/敏感文件类型）、默认拒绝不确定样本 |
| Policy Types | `src/policy/policy-types.ts` | Grant、GrantBudget、PolicyVersion、AuthResult、DevTokenClaims、PolicyDecision 类型定义 |

## Error Contract

所有拒绝返回统一结构化错误（§17.6）：
```json
{
  "isError": true,
  "error_code": "<code>",
  "message": "<human-readable>",
  "repo_id": "<repo>",
  "snapshot_id": "<snap>",
  "policy_version": "policy-2026-06-21-v1",
  "audit_id": "audit-<ts>-<counter>-<uuid8>",
  "retryable": false
}
```

## Security Posture

- Path guard: rejects absolute paths, `..`, mixed separators, sensitive file types
- Budget: grant cumulative enforcement remains active. Single-response size, single-fetch line window, and shared throttle ceilings are disabled when their config values are `null`; session bytes and tool-call count are tracked and only enforced when their ceilings are non-null.
- Redaction: pattern-based + entropy detection; wraps all output with untrusted markers
- Secret scanner: default-deny for uncertain samples (AC-004)
