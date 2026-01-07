---
id: "20260107_secure_storage"
difficulty: "hard"
tags: ["oauth", "security", "encryption", "keychain", "typescript"]
tech_stack: "Node.js 18+, TypeScript 5.x, keytar, crypto"
---

# User Story
As a developer, I want my OAuth tokens stored securely, so they can't be stolen from my filesystem.

# Context & Constraints
**Interface Requirements (SecureStorage):**
```typescript
interface SecureStorage {
  saveToken(email: string, credentials: OAuthCredentials): Promise<void>;
  loadToken(email: string): Promise<OAuthCredentials | null>;
  deleteToken(email: string): Promise<void>;
  listAccounts(): Promise<string[]>;
}
```

**Encryption Architecture:**
```
┌─────────────────────────────────────────┐
│ OS Keychain (keytar)                    │
│ - Service: cc-mirror-antigravity        │
│ - Account: encryption-key               │
│ - Value: 256-bit AES key                │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│ Token Files (~/.cc-mirror/tokens/)      │
│ - {email}.enc                           │
│ - Format: { iv, authTag, data }         │
└─────────────────────────────────────────┘
```

**Security Requirements:**
| Requirement | Implementation |
|-------------|----------------|
| Encryption | AES-256-GCM |
| Key storage | OS keychain (keytar) |
| Fallback | Machine-ID + PBKDF2 |
| IV | Random 16 bytes per token |

# Acceptance Criteria
- [ ] **Keychain Integration:** Store encryption key in OS keychain
- [ ] **Encryption:** Encrypt tokens with AES-256-GCM before disk write
- [ ] **Decryption:** Decrypt tokens on load; fail gracefully if corrupted
- [ ] **Headless Fallback:** Use machine-id + PBKDF2 if no keychain
- [ ] **Multi-Account:** Support storing tokens for multiple emails
- [ ] **Atomic Writes:** Use temp-file-and-rename to prevent corruption
- [ ] **No Plaintext:** Never write unencrypted tokens to disk
