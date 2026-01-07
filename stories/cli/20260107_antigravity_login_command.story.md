---
id: "20260107_antigravity_login_command"
difficulty: "medium"
tags: ["cli", "oauth", "authentication", "typescript"]
tech_stack: "Node.js 18+, TypeScript 5.x, commander, open"
---

# User Story
As a developer, I want to run `cc-mirror antigravity login`, so I can authenticate with my Google account.

# Context & Constraints
**Command Syntax:**
```bash
cc-mirror antigravity login
cc-mirror antigravity login --headless
cc-mirror antigravity logout
cc-mirror antigravity status
```

**Login Flow:**
1. Generate PKCE code verifier/challenge
2. Open browser to Google OAuth consent screen
3. Start local callback server on port 9876
4. Wait for callback with authorization code
5. Exchange code for tokens
6. Store tokens securely
7. Display success message

**Headless Mode:**
- Print URL for user to copy
- Accept authorization code via stdin
- Use for SSH/Docker environments

# Acceptance Criteria
- [ ] **Browser Launch:** Open default browser to Google OAuth
- [ ] **Callback Server:** Listen on localhost:9876 for callback
- [ ] **Token Storage:** Store tokens via SecureStorage
- [ ] **Headless Mode:** --headless prints URL, accepts code via stdin
- [ ] **Status Command:** Show current login status and account
- [ ] **Logout:** Revoke tokens and delete from storage
- [ ] **Multi-Account:** Support logging in with multiple accounts
