# Pre-Commit Hooks

## Installation

The pre-commit hook should be automatically installed. If not, run:

```bash
ln -sf ../../.claude/hooks/pre-commit.sh .git/hooks/pre-commit
chmod +x .claude/hooks/pre-commit.sh
```

## What It Checks

### 🔐 Security Checks
- **Sensitive files:** Blocks `.env`, `.dev.vars`, credentials
- **Hardcoded secrets:** Detects API keys, passwords, tokens
- **Large files:** Warns about files > 1MB

### ✨ Code Quality
- **JavaScript syntax:** Validates with `node --check`
- **Prettier formatting:** Checks code formatting (if installed)
- **Debug statements:** Warns about `console.log()`, `debugger`

### ⚙️ Configuration
- **wrangler.toml:** Validates Cloudflare Workers config
- **API documentation:** Reminds to update docs when handlers change

### 🧪 Testing
- **Test coverage:** Warns if new handlers lack test files

## Bypassing Checks

**Only in emergencies:**

```bash
git commit --no-verify -m "Emergency fix"
```

## Customization

Edit `.claude/hooks/pre-commit.sh` to:
- Add more file patterns to block
- Configure custom linting rules
- Add project-specific checks
