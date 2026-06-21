# EXEC-006：路径安全、敏感过滤与累计预算

状态：ready_for_ai_execution（可由 AI 执行）。
依赖：EXEC-005 complete（完成）。

## 1. Objective（目标）

实现强制路径规范化、敏感数据过滤和累计外泄预算，使只读工具不能通过多次小请求或路径变体泄露仓库内容。

## 2. Scope（范围）

Allowed files（允许修改）：
- `implementation/src/security/path-guard.ts`
- `implementation/src/security/secret-scanner.ts`
- `implementation/src/security/redaction.ts`
- `implementation/src/security/budget.ts`
- `implementation/src/policy/policy-engine.ts`
- `implementation/tests/security-guards.test.ts`
- `implementation/docs/security-guardrails.md`

Forbidden changes（禁止）：
- 不把过滤只做成黑名单。
- 不在日志中保存敏感原文。
- 不扩大工具能力。

## 3. Required Work（必须执行）

- 拒绝 `..`、绝对路径、混合分隔符、URL 编码变体、大小写别名、符号链接、目录联接、重解析点越界。
- 敏感路径默认拒绝：`.env`、`.git`、私钥、令牌、云凭据、SSH、系统配置、二进制大文件、超大文件。
- 实现高熵疑似密钥检测；不确定样本默认拒绝。
- 实现 data_budget（数据预算）：单响应、单文件窗口、单会话、单授权、调用次数、树深、命中数。
- 预算耗尽返回 `budget_exceeded` 或 `rate_limited`。

## 4. Acceptance Criteria（验收标准）

- AC-001：路径越界矩阵全部拒绝。
- AC-002：敏感文件矩阵全部拒绝或脱敏，不回传原文。
- AC-003：累计预算负例触发 `budget_exceeded`。
- AC-004：所有拒绝均有 audit_id。

## 5. Validation（校验）

Commands（命令）：
- `npm test -- security-guards`
- `npm run typecheck`

## 6. Required Evidence（所需证据）

- 路径负例矩阵输出。
- 敏感数据负例矩阵输出。
- 预算耗尽输出。

## 7. Completion Writeback（完成回写）

changed files:
- implementation/src/security/path-guard.ts
- implementation/src/security/secret-scanner.ts
- implementation/src/security/redaction.ts
- implementation/src/security/budget.ts
- implementation/src/policy/policy-engine.ts
- implementation/tests/security-guards.test.ts
- implementation/docs/security-guardrails.md

created artifacts:
- list actual files

validation commands:
- list exact commands

validation results, including exit code:
- include summary and exit code

skipped validations and reason:
- list skipped checks

protected files unchanged:
- confirm logs do not include sensitive raw content

remaining blockers:
- list blockers or none

completion status:
- complete | blocked | failed

## 8. Non-Completion Rule（非完成规则）

任何越界路径、敏感文件、累计预算绕过或原文泄露日志出现时，不得写 complete（完成）。
