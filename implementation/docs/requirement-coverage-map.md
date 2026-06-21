# Requirement Coverage Map（需求覆盖映射）

状态：covered（已覆盖）。
时间戳：2026-06-21T05:55:00Z。

## 父设计要求 → 执行卡映射

| 父要求 | 来源 | 覆盖执行卡 | 状态 |
|---|---|---|---|
| 目标胶囊与全局意图 | docs/design/task-card.md §1 | EXEC-000, EXEC-001 | covered |
| 权威依据（官方能力确认） | docs/design/task-card.md §2, docs/design/official-evidence.md | EXEC-001 | covered |
| 业务场景（Given/When/Then） | docs/design/task-card.md §3 | EXEC-010 | covered |
| 系统架构（8 模块） | docs/design/task-card.md §5 | EXEC-002, EXEC-003, EXEC-004, EXEC-006, EXEC-007, EXEC-008, EXEC-009 | covered |
| 安全不变量 INV-001~INV-010 | docs/design/task-card.md §6 | EXEC-003, EXEC-004, EXEC-008, EXEC-009 | covered |
| 工具规格（4 工具 schema） | docs/design/task-card.md §7, tool-schemas.json | EXEC-008 | covered |
| 路径与快照规则 PATH-001~004, SNAP-001~003 | docs/design/task-card.md §8 | EXEC-003, EXEC-006 | covered |
| 认证与授权 AUTH-001~005 | docs/design/task-card.md §9 | EXEC-004, EXEC-005 | covered |
| 状态流（10 种失败状态） | docs/design/task-card.md §10 | EXEC-003 | covered |
| 测试矩阵 T-001~T-032 | docs/design/task-card.md §11, docs/design/test-matrix.md | EXEC-010 | covered |
| 证据要求与完整性字段 | docs/design/task-card.md §12, docs/design/evidence-template.md | EXEC-009 | covered |
| 授权授予记录 §17.1 | docs/design/task-card.md | EXEC-004 | covered |
| 快照清单 §17.2 | docs/design/task-card.md | EXEC-006 | covered |
| 解析器/索引器隔离 §17.3 | docs/design/task-card.md | EXEC-007 | covered |
| 数据外泄预算 §17.4 | docs/design/task-card.md | EXEC-003 | covered |
| 提示注入隔离 §17.5 | docs/design/task-card.md | EXEC-008, EXEC-009 | covered |
| 错误响应契约 §17.6 | docs/design/task-card.md | EXEC-003 | covered |
| 证据完整性 §17.7 | docs/design/task-card.md | EXEC-009 | covered |
| 工具元数据 §18.1 | docs/design/task-card.md | EXEC-008 | covered |
| 授权发现与挑战 §18.2 | docs/design/task-card.md | EXEC-005 | covered |
| 连接器发现 §18.3 | docs/design/task-card.md | EXEC-005 | covered |
| UI 决策（第一版无 UI） §18.4 | docs/design/task-card.md | EXEC-002 | covered |
| 依赖选择 §18.5 | docs/design/task-card.md | EXEC-002 | covered |
| 分页与符号范围 §18.6 | docs/design/task-card.md | EXEC-008, EXEC-007 | covered |
| 设计待确认 §17.8 | docs/design/task-card.md | EXEC-001 | covered |

## 执行卡覆盖确认

| 执行卡 | 覆盖要求数 | 遗漏检查 |
|---|---|---|
| EXEC-000 | N/A（基线读取） | 无遗漏 |
| EXEC-001 | 3 | 无遗漏 |
| EXEC-002 | 3 | 无遗漏 |
| EXEC-003 | 4 | 无遗漏 |
| EXEC-004 | 3 | 无遗漏 |
| EXEC-005 | 3 | 无遗漏 |
| EXEC-006 | 3 | 无遗漏 |
| EXEC-007 | 2 | 无遗漏 |
| EXEC-008 | 5 | 无遗漏 |
| EXEC-009 | 4 | 无遗漏 |
| EXEC-010 | 3 | 无遗漏 |

## TBD（待确认项）

| 项目 | 阻塞影响 | 覆盖卡 |
|---|---|---|
| 目标 ChatGPT 工作区 Secure MCP Tunnel 可用性 | 若不可用，隧道连接需 blocked | EXEC-001 |
| 目标账号/组织 Developer mode 权限 | 若不可用，ChatGPT 验收需 blocked | EXEC-001 |
| 目标客户端 Streamable HTTP/OAuth 2.1 支持 | 影响协议选择 | EXEC-001 |
| Windows 重解析点/大小写别名/UNC 路径处理 | 影响路径规范化 | EXEC-003 |
| OAuth 2.1 或等效短期主体绑定方案 | 影响鉴权实现 | EXEC-004, EXEC-005 |
| 快照强不可变性与旧快照保留期 | 影响快照生命周期 | EXEC-006 |

所有 TBD 项将在对应执行卡中确认或阻塞。
