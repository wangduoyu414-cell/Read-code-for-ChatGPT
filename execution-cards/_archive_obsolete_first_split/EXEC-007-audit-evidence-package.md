# EXEC-007：结构化审计与证据包

状态：ready_for_ai_execution（可由 AI 执行）。
依赖：EXEC-006 complete（完成）。

## 1. Objective（目标）

实现结构化审计日志和证据包生成，使未来验收可以证明请求、响应、授权、预算、快照和策略之间的闭环关系。

## 2. Scope（范围）

Allowed files（允许修改）：
- `implementation/src/audit/audit-log.ts`
- `implementation/src/audit/evidence-writer.ts`
- `implementation/src/audit/hash.ts`
- `implementation/src/tools/tool-output.ts`
- `implementation/tests/audit-evidence.test.ts`
- `implementation/docs/evidence-package-contract.md`
- `implementation/docs/evidence-samples/*.md`

Forbidden changes（禁止）：
- 不记录原始代码正文。
- 不记录原始提示词。
- 不记录密钥、令牌、凭据。
- 不把审计当作访问控制替代品。

## 3. Required Work（必须执行）

- 审计记录包含：audit_id、timestamp、user_id 摘要、grant_id、repo_id、snapshot_id、tool、decision、error_code、policy_version、budget_before/after。
- 证据包包含：request_hash、response_hash、tool_schema_version、snapshot_manifest_hash、policy_version、audit_id、validation_surface。
- 支持写入 Markdown（标记文本）证据样本。
- 所有敏感字段脱敏或哈希化。

## 4. Acceptance Criteria（验收标准）

- AC-001：工具成功和失败都产生审计记录。
- AC-002：证据包可关联请求、响应、快照、策略和审计。
- AC-003：审计和证据中没有原始代码正文或原始提示词。
- AC-004：证据样本可用于 test-matrix（测试矩阵）的未来验收。

## 5. Validation（校验）

Commands（命令）：
- `npm test -- audit-evidence`
- `npm run typecheck`

## 6. Required Evidence（所需证据）

- 成功审计样本。
- 拒绝审计样本。
- 证据包样本。
- 脱敏检查结果。

## 7. Completion Writeback（完成回写）

changed files:
- implementation/src/audit/audit-log.ts
- implementation/src/audit/evidence-writer.ts
- implementation/src/audit/hash.ts
- implementation/src/tools/tool-output.ts
- implementation/tests/audit-evidence.test.ts
- implementation/docs/evidence-package-contract.md
- implementation/docs/evidence-samples/*.md

created artifacts:
- list actual files

validation commands:
- list exact commands

validation results, including exit code:
- include summary and exit code

skipped validations and reason:
- list skipped checks

protected files unchanged:
- confirm no raw code/prompt/secrets logged

remaining blockers:
- list blockers or none

completion status:
- complete | blocked | failed

## 8. Non-Completion Rule（非完成规则）

如果证据包无法关联 audit_id、snapshot_manifest_hash、policy_version，或日志包含原始敏感内容，不得写 complete（完成）。
