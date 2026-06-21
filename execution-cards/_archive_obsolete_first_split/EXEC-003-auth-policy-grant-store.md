# EXEC-003：授权授予记录与策略引擎

状态：ready_for_ai_execution（可由 AI 执行）。
依赖：EXEC-002 complete（完成）。

## 1. Objective（目标）

实现服务端授权授予记录、策略校验和撤销流程，使每次工具调用都绑定用户、客户端、仓库、快照、工具、预算和过期时间。

## 2. Scope（范围）

Allowed files（允许修改）：
- `implementation/src/auth/grants.ts`
- `implementation/src/auth/tokens.ts`
- `implementation/src/policy/policy-engine.ts`
- `implementation/src/policy/policy-types.ts`
- `implementation/src/errors.ts`
- `implementation/tests/auth-policy.test.ts`
- `implementation/docs/auth-policy-contract.md`

Forbidden changes（禁止）：
- 不实现真实生产 IdP（身份提供方）接入。
- 不存储真实密钥。
- 不读取仓库内容。
- 不把会话标识当认证凭据。

## 3. Required Work（必须执行）

- 定义 `grant_id/user_id/client_id/repo_id/snapshot_id/allowed_tools/allowed_paths/data_budget/expiry/revoked_at/policy_version`。
- 实现内存或文件型开发 grant store（授权存储），标明仅开发使用。
- 实现 `authorizeToolCall`，校验用户、客户端、仓库、快照、工具、过期、撤销、预算。
- 实现撤销函数，撤销后旧 grant 必须拒绝。
- 设计但不强制实现 `securitySchemes`、well-known discovery（发现）和 `_meta["mcp/www_authenticate"]`（运行时授权挑战）接口契约。

## 4. Acceptance Criteria（验收标准）

- AC-001：合法 grant 允许对应工具调用。
- AC-002：错误 repo_id、snapshot_id、tool、过期 grant、撤销 grant 全部拒绝。
- AC-003：拒绝返回统一错误对象，包含 error_code、audit_id、policy_version。
- AC-004：文档说明生产环境必须接入 OAuth 2.1/OIDC 或成熟 IdP。

## 5. Validation（校验）

Commands（命令）：
- `npm test -- auth-policy`
- `npm run typecheck`

## 6. Required Evidence（所需证据）

- 授权正例和负例测试输出。
- 拒绝响应样本。
- 文档说明不含真实密钥。

## 7. Completion Writeback（完成回写）

changed files:
- implementation/src/auth/grants.ts
- implementation/src/auth/tokens.ts
- implementation/src/policy/policy-engine.ts
- implementation/src/policy/policy-types.ts
- implementation/src/errors.ts
- implementation/tests/auth-policy.test.ts
- implementation/docs/auth-policy-contract.md

created artifacts:
- list actual files

validation commands:
- list exact commands

validation results, including exit code:
- include summary and exit code

skipped validations and reason:
- production OAuth live integration may be skipped with reason

protected files unchanged:
- confirm no real secrets and no repository source read

remaining blockers:
- list blockers or none

completion status:
- complete | blocked | failed

## 8. Non-Completion Rule（非完成规则）

撤销、过期、跨仓库和跨快照负例未通过时，不得写 complete（完成）。
