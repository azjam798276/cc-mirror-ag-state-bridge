---
id: "20260107_oauth_manager"
difficulty: "hard"
tags: ["oauth", "google", "authentication", "typescript", "security"]
tech_stack: "Node.js 18+, TypeScript 5.x, google-auth-library"
---

# User Story
As a developer, I want to authenticate with my Google account, so I can use Antigravity's API quota through cc-mirror.

# Context & Constraints
**Interface Requirements (OAuthManager):**
```typescript
interface OAuthManager {
  startAuthFlow(): Promise<OAuthCredentials>;
  refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials>;
  revokeToken(credentials: OAuthCredentials): Promise<void>;
  isTokenValid(credentials: OAuthCredentials): boolean;
}

interface OAuthCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  email: string;
}
```

**OAuth Configuration:**
| Parameter | Value |
|-----------|-------|
| Client ID | From environment |
| Scopes | `openid email profile` |
| Redirect URI | `http://localhost:9876/callback` |
| Token refresh buffer | 5 minutes before expiry |

**Security Requirements:**
- Never log tokens or refresh tokens
- Use PKCE for authorization code flow
- Validate redirect URI strictly

# Acceptance Criteria
- [ ] **Auth Flow:** Open browser to Google consent screen
- [ ] **Callback Server:** Start local HTTP server on port 9876
- [ ] **Token Exchange:** Exchange code for access + refresh tokens
- [ ] **Token Refresh:** Automatically refresh 5 min before expiry
- [ ] **Revocation:** Revoke tokens on logout
- [ ] **Validation:** Check token expiry before API calls
- [ ] **Error Handling:** Clear error messages for auth failures
