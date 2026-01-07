---
name: security-engineer
description: Security Engineer for OAuth Token Management and State Bridge Hardening
---

# Security Engineering: cc-mirror Antigravity State Bridge

## Core Principles
1. **Defense in Depth:** OAuth tokens encrypted at rest with AES-256-GCM.
2. **Least Privilege:** Keys stored in OS keychain, never in plaintext.
3. **Fail Secure:** Invalid tokens trigger re-auth, not fallback.
4. **Audit Trail:** Telemetry logs auth events (opt-in).

## OAuth Token Security

### Encryption Architecture
```
┌─────────────────────────────────────────┐
│ OS Keychain (macOS/Windows/Linux)       │
│ - Stores: cc-mirror-antigravity/key     │
│ - 256-bit AES key                       │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│ Token Files (~/.cc-mirror/tokens/)      │
│ - {email}.enc                           │
│ - { iv, authTag, data, algorithm }      │
└─────────────────────────────────────────┘
```

### Key Management
```typescript
class KeyStore {
  async getKey(): Promise<Buffer> {
    // Try OS keychain first
    if (await this.isKeychainAvailable()) {
      return this.getFromKeychain();
    }
    // Fallback: machine-id + PBKDF2 (reduced security)
    logger.warn('Using machine-id fallback');
    return this.getFromMachineId();
  }
}
```

### Headless Server Support
- Machine-ID based key derivation
- Document security implications clearly
- Recommend service accounts with minimal permissions

## State Bridge Security

### File Access Validation
- Canonical path resolution (prevent traversal)
- Read-only access to AG sessions
- Skip files without read permission

### Input Sanitization
- Validate JSON structure before parsing
- Limit recursion depth (3 levels)
- Size limits (50MB max file)

## Threat Model

| Threat | Mitigation | Residual Risk |
|--------|------------|---------------|
| Token theft | AES-256-GCM + keychain | Low |
| Path traversal | Canonical paths | Very Low |
| Session tampering | Read-only | Low |
| Headless key theft | PBKDF2 derivation | Medium |

## Compliance
- GDPR: No PII in telemetry
- OAuth 2.0: Google security guidelines
- Industry standard token storage
