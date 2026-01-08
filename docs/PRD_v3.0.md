# 📋 PRODUCT REQUIREMENTS DOCUMENT (PRD) v3.0
**Project:** cc-mirror Antigravity Provider with State Bridge  
**Version:** 3.0 (Enhanced Authentication & Dual Quota)  
**Date:** January 8, 2026  
**Status:** DRAFT - Pending Approval  
**Owner:** Product Team + Engineering  

> [!IMPORTANT]
> **Key Discovery:** Analysis of [opencode-antigravity-auth](https://github.com/NoeFabris/opencode-antigravity-auth) reveals critical missing functionality in our current OAuth implementation. This PRD addresses those gaps.

---

## 📊 Gap Analysis: Current vs. Required

| Feature | Our Implementation | opencode-antigravity-auth | Gap |
|---------|-------------------|---------------------------|-----|
| OAuth Flow | ✅ PKCE + Token Refresh | ✅ PKCE + Token Refresh | None |
| Token Storage | ✅ keytar/AES-256 | ✅ File-based JSON | None |
| **Project ID Bootstrap** | ❌ **Missing** | ✅ `fetchProjectID()` | **Critical** |
| **Dual Quota System** | ❌ **Missing** | ✅ AG + Gemini CLI pools | **High** |
| **Multi-Account Rotation** | ⚠️ Partial | ✅ Automatic switching | **Medium** |
| Rate Limit Retry | ⚠️ Basic | ✅ Exponential backoff | **Medium** |
| Sticky Account Selection | ❌ Missing | ✅ Preserves prompt cache | **Low** |

---

## 🎯 Executive Summary

### The Problem

Our current `oauth-manager.ts` successfully authenticates with Google OAuth but **fails to obtain the GCP Project ID** required for Antigravity API calls.

When making API requests to Antigravity models (e.g., `gemini-3-pro-high`, `claude-opus-4-5-thinking`), Google's backend requires:

```http
Authorization: Bearer ya29.a0Ae4...  ✅ (we have this)
X-Goog-User-Project: cloudful-back-03mg  ❌ (we don't have this)
```

Without the project ID, all Antigravity model requests fail with `403 Forbidden`.

### The Solution

Integrate three critical features from `opencode-antigravity-auth`:

1. **Project ID Bootstrapping** - Call `loadCodeAssist` endpoint to discover shadow GCP project
2. **Dual Quota System** - Route requests to both Antigravity and Gemini CLI endpoints
3. **Multi-Account Rotation** - Automatic failover when rate-limited

---

## 🏗️ New Features (Sprint 6)

### Feature 1: Project ID Bootstrapping ⭐ CRITICAL

**Why It's Needed:**
- Antigravity IDE creates a "shadow" GCP project for each user
- This project is not visible in Google Cloud Console
- It provides billing/quota context for API calls
- Without it: `403 Forbidden: Missing project context`

**Technical Specification:**

```typescript
interface ProjectBootstrapper {
  // Discover shadow GCP project ID tied to user's Google account
  fetchProjectID(accessToken: string): Promise<string>;
  
  // Cache project ID to avoid repeated calls
  getCachedProjectID(): string | null;
  
  // Invalidate cache on auth refresh
  invalidateCache(): void;
}

// Implementation
async function fetchProjectID(accessToken: string): Promise<string> {
  const response = await fetch(
    'https://autopush.aistudio.google.com/v1internal:loadCodeAssist',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  if (!response.ok) {
    throw new ProjectIDFetchError(`Failed: ${response.status}`);
  }
  
  const data = await response.json();
  return data.projectId; // e.g., "cloudful-back-03mg"
}
```

**API Call Modification:**

```typescript
// Before: Fails with 403
headers: {
  'Authorization': `Bearer ${token}`
}

// After: Works correctly
headers: {
  'Authorization': `Bearer ${token}`,
  'X-Goog-User-Project': projectId  // From fetchProjectID()
}
```

**Acceptance Criteria:**
- [ ] `fetchProjectID()` successfully discovers shadow project
- [ ] Project ID is cached per-account
- [ ] All Antigravity API calls include `X-Goog-User-Project` header
- [ ] Graceful fallback if endpoint unavailable

---

### Feature 2: Dual Quota System

**Why It's Needed:**
- Antigravity has TWO independent quota pools per account:
  1. **Antigravity Quota** (`aistudio.google.com/v1/...`) - IDE quota
  2. **Gemini CLI Quota** (`generativelanguage.googleapis.com/v1beta/...`) - API quota
- This effectively **doubles** available quota per account

**Technical Specification:**

```typescript
interface DualQuotaManager {
  // Select appropriate endpoint based on model and quota status
  selectEndpoint(model: string, account: Account): Endpoint;
  
  // Track quota usage per endpoint
  trackUsage(endpoint: Endpoint, tokens: number): void;
  
  // Check if endpoint is rate-limited
  isRateLimited(endpoint: Endpoint): boolean;
  
  // Fallback to alternate quota pool
  fallback(endpoint: Endpoint): Endpoint | null;
}

enum Endpoint {
  ANTIGRAVITY = 'aistudio.google.com',
  GEMINI_CLI = 'generativelanguage.googleapis.com'
}
```

**Routing Logic:**

```
Request → TryAntigravityEndpoint
            ├─ Success → Return response
            └─ 429 Rate Limited
                  └─ TryGeminiCLIEndpoint
                        ├─ Success → Return response
                        └─ 429 Rate Limited
                              └─ SwitchAccount
```

**Acceptance Criteria:**
- [ ] Requests route to Antigravity endpoint by default
- [ ] Automatic fallback to Gemini CLI on 429
- [ ] Quota tracked separately per endpoint
- [ ] Works for Gemini models (Claude uses Antigravity only)

---

### Feature 3: Enhanced Multi-Account Rotation

**Why It's Needed:**
- Current implementation has basic account switching
- Missing: sticky selection, per-model limits, smart retry

**Technical Specification:**

```typescript
interface AccountRotator {
  // Select account with sticky preference
  selectAccount(modelFamily: ModelFamily): Account;
  
  // Handle rate limit with smart retry
  handleRateLimit(account: Account, retryAfter: number): void;
  
  // Track limits per model family
  setRateLimited(account: Account, modelFamily: ModelFamily): void;
}

interface RotationConfig {
  // Stick to same account until rate-limited (preserves prompt cache)
  stickySelection: boolean;
  
  // Short limits (<= threshold) retry same account
  shortRetryThresholdMs: number; // default: 5000
  
  // Exponential backoff config
  backoff: {
    initial: number;  // 1000ms
    max: number;      // 60000ms
    multiplier: number; // 2
  };
}
```

**Behavior Matrix:**

| Scenario | Current Behavior | New Behavior |
|----------|------------------|--------------|
| Rate limited (2s) | Switch account | Retry same account |
| Rate limited (30s) | Switch account | Switch account |
| All accounts limited | Fail | Queue with backoff |
| New session start | Random account | Prefer last successful |

**Acceptance Criteria:**
- [ ] Sticky account selection preserves prompt cache
- [ ] Short rate limits (<5s) retry same account
- [ ] Per-model-family rate limit tracking
- [ ] Exponential backoff for consecutive limits

---

## 📐 Updated Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     cc-mirror Request                           │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│               LAYER 1: Account Manager (ENHANCED)               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Account Rotator                                         │   │
│  │  - Sticky selection (preserves prompt cache)             │   │
│  │  - Per-model-family rate limits                          │   │
│  │  - Smart retry (short limits stay on account)            │   │
│  └────────────────────────────┬─────────────────────────────┘   │
│                               │                                  │
│  ┌────────────────────────────▼─────────────────────────────┐   │
│  │  Project ID Bootstrapper ⭐ NEW                          │   │
│  │  - POST /v1internal:loadCodeAssist                       │   │
│  │  - Discovers shadow GCP project                          │   │
│  │  - Cached per-account                                    │   │
│  └────────────────────────────┬─────────────────────────────┘   │
└───────────────────────────────┼─────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              LAYER 2: Dual Quota Router ⭐ NEW                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Request → Antigravity Pool (primary)                    │   │
│  │            ├─ Success                                    │   │
│  │            └─ 429 → Gemini CLI Pool (fallback)           │   │
│  │                     ├─ Success                           │   │
│  │                     └─ 429 → Next Account                │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              LAYER 3: Protocol Translation (Existing)           │
│  API Translator • Tool Hardening • Thinking Sanitizer           │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
                   Google Antigravity API
                   (with X-Goog-User-Project header)
```

---

## 🗓️ Implementation Timeline

### Sprint 6: Authentication Hardening (Weeks 7-8)

| Task | Engineer | Days | Priority |
|------|----------|------|----------|
| S6-001: Project ID Bootstrapper | Backend 1 | 2 | **P0** |
| S6-002: Dual Quota Router | Backend 1 | 3 | P1 |
| S6-003: Enhanced Account Rotation | Backend 2 | 3 | P1 |
| S6-004: Rate Limit Queue | Backend 2 | 2 | P2 |
| S6-005: Integration Tests | Both | 2 | P1 |

**Sprint Goal:** All Antigravity API calls succeed with proper project context.

---

## 📊 Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| API Call Success Rate | 0% (403 errors) | > 99% |
| Quota Utilization | 50% (single pool) | > 90% (dual pool) |
| Rate Limit Recovery | Manual intervention | Automatic |
| Account Switch Latency | N/A | < 100ms |

---

## 🔒 Security Considerations

1. **Project ID Caching** - Store per-account, invalidate on token refresh
2. **Endpoint Validation** - Only allow known Google domains
3. **Token Isolation** - Each account's credentials remain separate
4. **Audit Logging** - Log account switches (not tokens)

---

## 📚 References

- [opencode-antigravity-auth](https://github.com/NoeFabris/opencode-antigravity-auth) - Reference implementation
- [Antigravity API Spec](https://github.com/NoeFabris/opencode-antigravity-auth/blob/main/docs/ANTIGRAVITY_API_SPEC.md) - Endpoint documentation
- [PRD v2.0](./PRD_v2.0.md) - Previous version (State Bridge)

---

## ✅ Approval

| Role | Name | Status | Date |
|------|------|--------|------|
| Product Manager | — | DRAFT | 2026-01-08 |
| Engineering Lead | — | Pending | — |
| Security Review | — | Pending | — |
