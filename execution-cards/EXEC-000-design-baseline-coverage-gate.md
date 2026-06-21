# EXEC-000：设计基线与执行覆盖核对

状态：ready_for_ai_execution（可由 AI 执行）。

## 1. Objective（目标）

在任何实现前，确认执行代理已读取并绑定父设计产物，建立需求覆盖映射，避免后续任务脱离 `docs/design/task-card.md`、`docs/design/official-evidence.md`、`docs/design/threat-model.md`、`tool-schemas.json` 和 `docs/design/test-matrix.md`。

## 2. Scope（范围）

Allowed files（允许产物）：
- `implementation/docs/design-baseline-read-receipt.md`
- `implementation/docs/requirement-coverage-map.md`
- `implementation/docs/execution-readiness-gate.md`

Forbidden changes（禁止）：
- 不写运行时代码。
- 不读取用户仓库源码。
- 不修改父设计产物，除非单独获得授权。

## 必交产物（Required Deliverables）

Primary deliverables（主产物；路径相对本项目根目录）：
- implementation/docs/design-baseline-read-receipt.md
- implementation/docs/requirement-coverage-map.md
- implementation/docs/execution-readiness-gate.md

Closeout deliverables（收口产物；终止状态回写前必须存在）：
- execution-cards/EXEC-000-design-baseline-coverage-gate.claude-review/cycle1.input.json
- execution-cards/EXEC-000-design-baseline-coverage-gate.claude-review/cycle1.receipt.json
- execution-cards/EXEC-000-design-baseline-coverage-gate.claude-review/closure.json
- execution-cards/EXEC-000-design-baseline-coverage-gate.claude-review/validator_result.json
- execution-cards/EXEC-000-design-baseline-coverage-gate.claude-review/handshake.json（仅整卡委派给子代理执行时必须先创建）

Artifact existence validation（产物存在性校验）：
- 终止状态回写前，执行器必须用 `Test-Path` 或等效方法确认每个必交产物存在。
- required artifact path missing（必交产物路径缺失）、路径仍为通配符且未列出实际文件、或产物无法从证据追踪时，不得写 `complete`（完成）。
## 3. Required Work（必须执行）

- 读取 `docs/design/task-card.md`、`docs/design/official-evidence.md`、`docs/design/threat-model.md`、`tool-schemas.json`、`docs/design/test-matrix.md`、`docs/design/evidence-template.md`。
- 建立 requirement coverage map（需求覆盖映射），把父设计核心要求映射到全部活动执行卡（EXEC-001 到 EXEC-010），不得遗漏最终验收卡。
- 明确哪些要求在本轮执行中仍是 TBD（待确认）。
- 记录执行根目录、技术栈、禁止范围和证据路径。

## 4. Acceptance Criteria（验收标准）

- AC-001：read receipt（阅读回执）列出所有父设计产物路径和摘要。
- AC-002：coverage map（覆盖映射）覆盖官方能力、威胁模型、工具模式、测试矩阵、证据模板。
- AC-003：未覆盖要求必须标记 TBD 并说明阻塞影响。
- AC-004：coverage map 必须列出全部活动卡（EXEC-001 到 EXEC-010）并证明无遗漏。

## 5. Validation（校验）

Commands（命令）：
- `Test-Path` 检查父设计产物存在。
- `ConvertFrom-Json` 解析 `tool-schemas.json`。
- 手工审查 coverage map 完整性。

## 6. Required Evidence（所需证据）

- 父设计产物清单。
- coverage map。
- TBD 列表。

## 7. Completion Writeback（完成回写）

changed files:
- implementation/docs/design-baseline-read-receipt.md
- implementation/docs/requirement-coverage-map.md
- implementation/docs/execution-readiness-gate.md

created artifacts:
- list actual created files
- execution-cards/EXEC-000-design-baseline-coverage-gate.claude-review/cycle1.input.json
- execution-cards/EXEC-000-design-baseline-coverage-gate.claude-review/cycle1.receipt.json
- execution-cards/EXEC-000-design-baseline-coverage-gate.claude-review/closure.json
- execution-cards/EXEC-000-design-baseline-coverage-gate.claude-review/validator_result.json
- execution-cards/EXEC-000-design-baseline-coverage-gate.claude-review/handshake.json（仅整卡委派给子代理时）

validation commands:
- list commands exactly

validation results, including exit code:
- include output summary and exit code

skipped validations and reason:
- list skipped checks

protected files unchanged:
- confirm no user repository source was read

remaining blockers:
- list blockers or none

completion status:
- complete | blocked | failed

## 8. Non-Completion Rule（非完成规则）

通用规则：required artifact path missing（必交产物路径缺失）、终止状态缺少 Claude closeout（Claude 收口复核）侧车证据、`validate_closure.py` 未通过、或 Claude 候选问题未分类时，不得写 `complete`（完成）。

未读取父设计产物、未建立覆盖映射、或存在未说明的未覆盖要求时，不得写 `complete`（完成）。
## Claude Closeout Review（终止回写前外部复核）

- 在写入 `complete`、`blocked`、`failed` 或 `aborted` 等终止状态前，必须调用 `claude-taskcard-review`（Claude 任务卡复核）并把输入、回执、`closure`（收口）和 `validator_result`（校验结果）写入同名 `.claude-review` 侧车目录。
- `closure.json` 必须通过 `$CODEX_HOME/skills/claude-taskcard-review/scripts/validate_closure.py`；若 `CODEX_HOME` 不可用，必须记录解析到的脚本路径或阻塞原因。
- `Claude findings`（Claude 候选问题）只作为 `advisory`（建议性）证据；执行器必须把每个候选问题分类为 `accepted_blocking`、`accepted_non_blocking`、`rejected_false_positive` 或 `rejected_out_of_scope`，并写明本地证据。
- `complete`（完成）要求最新 Claude receipt（回执）为 `call_status=ok`、所有 `accepted_blocking` 已解决、`validate_closure.py` 报告可写完成；否则只能按本地证据写 `blocked`、`failed` 或 `aborted`。
- 若整卡委派给子代理执行，子代理在业务工作前必须先写 `execution-cards/EXEC-000-design-baseline-coverage-gate.claude-review/handshake.json`，且其中 `agent_role` 必须是 `executor`（执行者）。
