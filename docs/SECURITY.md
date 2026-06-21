# Security Notes（安全说明）

This project is designed as a read-only MCP（Model Context Protocol，模型上下文协议）server for ChatGPT. The server reads only the repository path that the operator explicitly starts it with.

## Public Repo Hygiene（公开仓库卫生）

- Do not commit real API keys（接口密钥）, tunnel ids（隧道标识）, tokens（令牌）, private keys（私钥）, or local machine paths.
- Use placeholders such as `<repo-root>`, `<implementation-root>`, `<authorized-repo-path>`, `<tunnel-id>`, and `<runtime-key>`.
- Historical review receipts may contain local paths. They are ignored by `.gitignore` and should stay local.
- If a secret was ever pasted into a chat or terminal, rotate it before publishing.

## Runtime Boundary（运行边界）

The runtime only exposes four read-only tools:

- `repo.tree`
- `repo.search`
- `repo.fetch`
- `repo.symbols`

Server-side guards reject absolute paths, parent traversal, sensitive file names, unsupported files, oversized responses, and suspicious secret content. Repository content is always marked as untrusted data.

## Real Repository Usage（真实仓库使用）

For private code, bind the smallest useful directory:

```powershell
node dist/startup.js --port 3100 --repo "<authorized-repo-path>"
```

Avoid binding a full drive unless you understand the privacy and indexing cost. For production or shared use, add OAuth 2.1/OIDC（开放授权/开放身份连接）and an audited access policy before exposing private repositories.

## If GitHub Reports A Secret（如果 GitHub 报密钥）

1. Treat it as real until proven otherwise.
2. Rotate or revoke the credential.
3. Remove the value from history if it was committed.
4. Replace examples with placeholders that do not match real credential prefixes.
