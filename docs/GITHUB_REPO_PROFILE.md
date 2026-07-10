# GitHub Repo Profile（仓库资料文案）

Use this page when filling GitHub repository About（简介）、topics（主题标签）, and connector-facing descriptions.

## Short Description（短简介）

Let ChatGPT inspect authorized local repositories through a snapshot-based, read-only MCP bridge for file maps, search, symbols, targeted fetch, and refresh.

## Homepage / Website（主页链接）

Use the repository URL unless you publish hosted docs:

```text
https://github.com/wangduoyu414-cell/Read-code-for-ChatGPT
```

## Topics（主题标签）

```text
chatgpt
mcp
model-context-protocol
local-repository
code-search
read-only
developer-tools
typescript
openai
repository-analysis
```

## README Tagline（首页标语）

让 ChatGPT 在明确授权、只读且可核验的边界内理解你的本地代码仓库。

## Connector Description（连接器描述）

```text
Read authorized local repositories through a snapshot-based, read-only MCP bridge.
```

## Longer Project Summary（长描述）

`Read Code for ChatGPT` is a local read-only MCP（Model Context Protocol，模型上下文协议）server for real codebases. You authorize one or more repository folders, the server builds immutable snapshots and indexes, and ChatGPT can inspect repository structure, file maps, symbols, search coverage, and requested file segments without receiving shell, write, Git（版本控制）, or arbitrary filesystem access.

The project is for developers who want ChatGPT to understand local code without pasting files into a chat window or exposing an entire machine. An optional user-local supervisor keeps the MCP service and tunnel healthy after login, but is never exposed as a ChatGPT tool.

## Safety Positioning（安全定位）

- Explicit authorized roots only.
- Read-only tools only.
- Repository content is treated as untrusted data.
- File paths inside a repository stay relative.
- Sensitive files, absolute paths, parent traversal, oversized responses, and full-repository export are blocked.
- `repo_refresh` updates only the server's in-memory snapshot/index.
- The local supervisor can restart only child processes that it created; it cannot be called by ChatGPT.
