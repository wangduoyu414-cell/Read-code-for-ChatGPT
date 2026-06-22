# E2E Validation Plan（端到端验证计划）

状态：planned（已规划）。时间戳：2026-06-21T07:00:00Z。

## Validation Chains（验证链）

### Chain 1: MCP Inspector
1. 启动本地 MCP server
2. MCP Inspector 连接服务
3. 调用 repo.search 正例（搜索 "App"）和负例（搜索 .env 路径）
4. 调用 repo.fetch 正例和负例（路径越权）
5. 验证响应包含 content_origin、instruction_trust、audit_id

### Chain 2: API Playground
1. 原始 HTTP POST 到 /mcp 端点
2. 发送 tools/call JSON-RPC 请求
3. 验证结构化响应

### Chain 3: ChatGPT Developer Mode（若可用）
1. 配置连接器指向本地 MCP server
2. 对话中触发工具调用
3. 验证与 Chain 1/2 结果一致

## Prerequisites
- Node.js v24+
- MCP Inspector (npx @modelcontextprotocol/inspector)
- 本地 server 启动 (node dist/server.js)
- ChatGPT Developer Mode（可能 TBD）

## Exit Criteria
- 至少两条独立验证链通过
- 当前工具各至少一个正例和一个负例有证据；`repo.refresh` 需证明刷新后新快照可用
- 越权路径、敏感文件全部拒绝
- 证据包无敏感原文
