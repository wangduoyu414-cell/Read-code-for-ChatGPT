# Safe Repo Fixture

Test fixture for EXEC-006 through EXEC-009. Simulates a safe multi-language repo.

## Structure
- 3+ directory levels (src/ui/, src/utils/, tests/)
- 2+ languages (TypeScript, Python)
- .env sample (for secret scanner testing)
- .git directory (for sensitive path rejection)
- Prompt injection text in code comments
- Symbol definitions (class, function, interface)

## Safety
- No real secrets
- No real credentials
- No executable code that affects the system
