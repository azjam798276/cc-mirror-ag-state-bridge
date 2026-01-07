---
id: "20260107_context_security_review"
difficulty: "medium"
tags: ["security", "secrets", "logging", "masking", "threat-model"]
tech_stack: "TypeScript, Node.js, Jest"
---

# User Story
As a security engineer, I want to perform a comprehensive security review of the context injection flow to ensure no secrets, tokens, or sensitive data from Antigravity sessions are leaked into logs, console output, or API requests.

# Context & Constraints

## Threat Model
The context injection flow processes AG session data that may contain:
- API keys and tokens in `session.variables`
- Passwords or credentials in terminal history
- Sensitive file paths or environment variables
- PII (personally identifiable information)

**Attack Vectors:**
1. **Log Injection:** Secrets written to console/file logs
2. **API Leakage:** Secrets sent to Claude API in context messages
3. **Storage Leakage:** Secrets persisted in plaintext cache files

## Required Security Controls

### 1. Secret Detection
Identify sensitive field patterns:
```typescript
const SENSITIVE_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /password/i,
  /token/i,
  /credential/i,
  /_key$/i,
  /auth/i
];
```

### 2. Log Masking
Replace secrets with `***REDACTED***` in all console.log() and logger calls:
```typescript
function maskSecrets(obj: any): any {
  // Recursively mask sensitive fields
}
```

### 3. Sanitization Before Injection
Clean session.variables before building context message:
```typescript
buildContextMessage(session: ParsedSession): string {
  const sanitized = {
    ...session,
    variables: this.sanitizeVariables(session.variables)
  };
  // ... build message
}
```

## Acceptance Criteria
- [ ] Threat model document created (STRIDE analysis)
- [ ] Sensitive field patterns identified and documented
- [ ] Log masking implemented for all logger/console calls
- [ ] Unit tests verify masked output (secrets → `***REDACTED***`)
- [ ] Security checklist added to docs/
- [ ] No plaintext secrets in E2E test logs

## Test Cases

### Test 1: Secret Detection
```typescript
const session = {
  variables: {
    API_KEY: "sk-1234567890",
    DB_PASSWORD: "super_secret",
    USER_NAME: "alice"
  }
};

const detected = detectSecrets(session.variables);
expect(detected).toEqual(["API_KEY", "DB_PASSWORD"]);
```

### Test 2: Log Masking
```typescript
const logOutput = captureConsoleLog(() => {
  logger.info("Session vars:", session.variables);
});

expect(logOutput).not.toContain("sk-1234567890");
expect(logOutput).toContain("***REDACTED***");
```

### Test 3: Context Sanitization
```typescript
const context = injector.buildContextMessage(session);

expect(context).not.toContain("sk-1234567890");
expect(context).toContain("API_KEY: ***REDACTED***");
```

# Dependencies
- ContextInjector class (P2-001)
- CLI integration (P2-002)
- SessionParser with variables field

# Exit Criteria
- All tests pass with 100% coverage for masking logic
- Manual E2E run shows no secrets in terminal output
- Security docs added to docs/security/context-hardening.md
