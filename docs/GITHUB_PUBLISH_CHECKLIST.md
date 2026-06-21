# GitHub Publish Checklist（发布检查清单）

Run this before pushing the repository to GitHub（代码托管平台）.

## 1. Build And Test（构建与测试）

From `<repo-root>/implementation`:

```powershell
npm install
npm run build
npm test
```

If the project is on a Windows UNC（网络共享）path and `npm run` falls back to `C:\Windows`, use:

```powershell
node ./node_modules/typescript/bin/tsc -p tsconfig.json
node --import tsx --test tests/*.test.ts
```

## 2. Secret Scan（密钥扫描）

From `<repo-root>`:

```powershell
rg -n -e "sk" -e "OPENAI" -e "client" -e "secret" -e "tunnel"
rg -n "([A-Z]:\\|\\\\192\.168\.|C:\\Users\\|D:\\)"
```

Expected result: no real secrets and no machine-specific publish instructions. Code tests may contain generic absolute-path rejection samples.

## 3. Git Hygiene（版本库卫生）

```powershell
git status --short
git remote -v
git log --oneline -5
```

Make sure `.gitignore` excludes:

- `node_modules/`
- `implementation/dist/`
- `.env*`
- review receipt sidecars such as `*.claude-review/`
- local tunnel/client files

## 4. Remote（远程仓库）

Recommended remote:

```powershell
git remote add origin https://github.com/wangduoyu414-cell/Read-code-for-ChatGPT.git
git branch -M main
git push -u origin main
```
