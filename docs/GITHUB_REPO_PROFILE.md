# GitHub Repo Profile（仓库资料文案）

Use this page when filling GitHub repository About（简介）、topics（主题标签）, and connector-facing descriptions.

## Short Description（短简介）

Let ChatGPT read authorized local repositories through a read-only MCP bridge for file maps, search, symbols, requested-range fetch, and refresh.

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

让 ChatGPT 读懂你的本地仓库，但只走你授权的、只读的 MCP（Model Context Protocol，模型上下文协议）通道。

## Connector Description（连接器描述）

```text
Let ChatGPT read authorized local repositories through a read-only MCP file map, search, symbol, fetch, and refresh bridge.
```

## Longer Project Summary（长描述）

`Read Code for ChatGPT` is a local read-only MCP（Model Context Protocol，模型上下文协议）server for real codebases. You authorize one or more repository folders, the server builds repository snapshots, and ChatGPT can inspect repository structure, file maps, symbols, search results, and requested file segments without receiving shell, write, git, or arbitrary filesystem access.

The project is for developers who want ChatGPT to understand local code without pasting files into a chat window and without exposing an entire machine.

## Safety Positioning（安全定位）

- Explicit authorized roots only.
- Read-only tools only.
- Repository content is treated as untrusted data.
- File paths inside a repository stay relative.
- Sensitive files, absolute paths, parent traversal, oversized responses, and full-repository export are blocked.
- `repo_refresh` updates only the server's in-memory snapshot/index.
