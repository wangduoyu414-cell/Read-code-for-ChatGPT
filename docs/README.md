# Documentation Index（文档索引）

This directory keeps project documents grouped by responsibility. Public setup docs should use relative paths or placeholders, never one machine's absolute path.

## Start Here（先看这里）

- `../README.md`: homepage and project story（首页与项目介绍）
- `../CONNECT_CHATGPT.md`: setup manual（接入手册）
- `SECURITY.md`: security notes（安全说明）
- `REFERENCES.md`: official references（官方参考）
- `GITHUB_PUBLISH_CHECKLIST.md`: publish checklist（发布检查清单）

## Design（设计权威）

- `design/task-card.md`: parent task card and invariants（父级任务卡与不变量）
- `design/official-evidence.md`: official evidence（官方依据）
- `design/threat-model.md`: threat model（威胁模型）
- `design/test-matrix.md`: validation matrix（验收矩阵）
- `design/evidence-template.md`: evidence template（证据模板）

## Reports（报告与本地证据）

- `reports/validation-report.md`: validation summary（验证报告）
- `reports/*.receipt.json`: local review receipts（本地复核回执）

Receipt files can include local paths or executable locations. They are useful as private evidence but are ignored for GitHub publication.

## Implementation Docs（实现文档）

Implementation-specific docs stay under `../implementation/docs/`:

- `../implementation/docs/chatgpt-connector-setup.md`
- `../implementation/docs/mcp-gateway-contract.md`
- `../implementation/docs/requirement-coverage-map.md`
- `../implementation/docs/snapshot-manifest-contract.md`

## Execution Cards（执行任务卡）

`../execution-cards/` stores task cards and closure notes. Local `.claude-review/` sidecars are ignored by `.gitignore` because they can contain machine-specific paths.
