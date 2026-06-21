# Evidence Template（证据模板）

## 基本信息

- evidence_id（证据编号）：
- test_id（测试编号）：
- timestamp（时间戳）：
- validator（验证者）：
- validation_surface（验证入口）：MCP Inspector / ChatGPT developer mode / API Playground / manual review
- repo_id（仓库标识）：
- snapshot_id（快照标识）：
- policy_version（策略版本）：

## 请求

- tool（工具）：
- input_summary（输入摘要）：
- full_input_available（是否保存完整输入）：yes/no
- sensitive_input_present（是否包含敏感输入）：must be no

## 响应

- outcome（结果）：allowed / denied / truncated / error
- error_code（错误码）：
- response_summary（响应摘要）：
- path_returned（返回路径）：
- line_range_returned（返回行号范围）：
- byte_count（字节数）：
- truncated（是否截断）：
- sensitive_content_returned（是否返回敏感内容）：must be no

## 审计

- audit_id（审计编号）：
- decision_reason（决策原因）：
- rate_limit_state（限流状态）：
- redaction_action（脱敏动作）：
- raw_code_logged（是否记录代码正文）：must be no
- raw_prompt_logged（是否记录原始提示词）：must be no

## 判定

- expected_result（期望结果）：
- actual_result（实际结果）：
- pass_fail（通过/失败）：
- exit_code（退出码）：N/A if manual
- skipped_reason（跳过原因）：
- remaining_blocker（剩余阻塞）：

## Integrity Fields（完整性字段）

- request_hash（请求摘要哈希）：
- response_hash（响应摘要哈希）：
- tool_schema_version（工具模式版本）：
- snapshot_manifest_hash（快照清单哈希）：
- grant_id（授权编号）：
- budget_state_before（调用前预算）：
- budget_state_after（调用后预算）：
- retention_until（证据保留到期）：
- evidence_storage_path（证据保存路径）：
- tamper_check（篡改检查）：pass/fail/N/A
