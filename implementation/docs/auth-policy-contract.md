# Auth Policy Contract（授权策略契约）

状态：implemented（已实现）。
时间戳：2026-06-21T06:30:00Z。

## Modules

| 模块 | 路径 | 功能 |
|---|---|---|
| Grants | `src/auth/grants.ts` | 授权授予记录 CRUD、显式同意记录、撤销、active 检查、re-consent 检测 |
| Tokens | `src/auth/tokens.ts` | 开发期本地 token 创建/验证/撤销、audience/issuer/scope 校验、令牌透传拒绝 |
| Policy Engine | `src/policy/policy-engine.ts` | 集中授权决策：token → grant → repo → snapshot → tool → path → policy_version → re-consent |
| Policy Types | `src/policy/policy-types.ts` | Grant、GrantBudget、ConsentRecord、AuthResult、PolicyDecision 类型 |

## Authorization Flow

```
caller → token verification (audience, issuer, scope)
       → grant lookup
       → user_id / client_id binding
       → active check (revoked, expired)
       → repo / snapshot match
       → policy version match
       → tool allowlist
       → re-consent check (path/tool/snapshot expansion)
       → path allowlist
       → allowed / denied
```

## Security Hard Boundaries

- No token passthrough (AUTH-003)
- No grant without explicit consent (AC-005)
- Re-consent required on path/tool/snapshot expansion
- Policy version mismatch → denied (must re-authorize)
- Dev tokens are LOCAL ONLY; production MUST use OAuth 2.1 / OIDC
