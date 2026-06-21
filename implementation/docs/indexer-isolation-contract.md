# Indexer Isolation Contract（索引器隔离契约）

状态：implemented（已实现）。时间戳：2026-06-21T07:00:00Z。

## Modules
| 模块 | 路径 | 功能 |
|---|---|---|
| Indexer | `src/indexer/indexer.ts` | 编排文本和符号索引构建 |
| Text Index | `src/indexer/text-index.ts` | 全文搜索索引 |
| Symbol Index | `src/indexer/symbol-index.ts` | 符号定义索引（v1: definitions only） |

## Isolation
- 只读 manifest 中准入文件
- 不执行代码、脚本、宏、插件
- 不访问网络
- 超时、文件数、文件大小上限
- 解析失败降级为 index_failed，不绕过安全策略

## Symbol Scope (v1)
- 仅 definitions（定义）
- TypeScript/JavaScript/Python/Go 基础模式
- references/调用图后置
