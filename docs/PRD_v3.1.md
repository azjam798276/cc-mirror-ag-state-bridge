# 📋 PRODUCT REQUIREMENTS DOCUMENT (PRD) v3.1
**Project:** cc-mirror Antigravity Provider with State Bridge  
**Version:** 3.1 (Validation-First Approach)  
**Date:** January 8, 2026 - 6:00 PM SGT  
**Status:** CONDITIONALLY APPROVED - Pending PoC Gate  
**Owner:** Product Team  
**Approvers:** Engineering Director ✅ | Systems Architect ⚠️ | Tech Lead ✅

***

> [!WARNING]
> **CONDITIONAL APPROVAL:** Implementation blocked until 48-hour validation gate passes (>90% success rate for `fetchProjectID()`). Emergency rollback plan required before beta launch.

***

## 📝 Revision History
| Version | Date | Changes | Approver |
|---------|------|---------|----------|
| 3.0 | 2026-01-08 AM | Initial draft with full feature set | DRAFT |
| 3.1 | 2026-01-08 PM | Added validation gate, risk register, deferred dual quota | **APPROVED** |

***

## 🎯 Executive Summary

### The Problem
Our current `oauth-manager.ts` successfully authenticates with Google OAuth but **fails to obtain the GCP Project ID** required for Antigravity API calls, resulting in 100% failure rate (403 errors) when accessing Antigravity-exclusive models.

### The Solution (De-Risked)
**Sprint 6 (Weeks 7-8):** Validate and implement core Project ID authentication
**Sprint 7 (Weeks 9-10):** Add advanced quota management and rotation

### Business Impact
- **Revenue Protection:** Prevents 78% churn observed in beta cohort without Antigravity access
- **Cost Efficiency:** $0/user vs. $150/user/month for equivalent Gemini API usage
- **Competitive Parity:** Matches OpenCode's feature set (currently eating our market share)

### Risk Posture
⚠️ **MEDIUM-HIGH RISK:** Dependency on reverse-engineered Google internal API. Mitigated through validation gate, Safe Mode fallback, and phased rollout.

***

## 📊 Gap Analysis: Current vs. Required

| Feature | Our Implementation | opencode-antigravity-auth | Gap | Sprint |
|---------|-------------------|---------------------------|-----|---------|
| OAuth Flow | ✅ PKCE + Token Refresh | ✅ PKCE + Token Refresh | None | N/A |
| Token Storage | ✅ keytar/AES-256 | ✅ File-based JSON | None | N/A |
| **Project ID Bootstrap** | ❌ **Missing** | ✅ `fetchProjectID()` | **Critical** | **S6** |
| **Circuit Breaker** | ❌ **Missing** | ⚠️ Basic | **High** | **S6** |
| **Safe Mode Fallback** | ❌ **Missing** | ❌ Missing | **High** | **S6** |
| **Dual Quota System** | ❌ **Missing** | ✅ AG + Gemini CLI | **Medium** | **S7** |
| **Multi-Account Rotation** | ⚠️ Partial | ✅ Automatic | **Medium** | **S7** |
| Sticky Account Selection | ❌ Missing | ✅ Prompt cache | **Low** | **S7** |

***

## 🏗️ Features - Sprint 6 (Validation & Core Auth)

### Feature 1: Project ID Bootstrapping ⭐ CRITICAL (P0)

**Business Value:** Unblocks all Antigravity model access. Without this, 0% of API calls succeed.

**Technical Specification:**
```typescript
interface ProjectBootstrapper {
  /**
   * Discover shadow GCP project ID tied to user's Google account
   * @throws ProjectIDFetchError if endpoint unavailable (triggers Safe Mode)
   */
  fetchProjectID(accessToken: string): Promise<ProjectIDResult>;
  
  /** Cache project ID per-account to avoid repeated calls */
  getCachedProjectID(accountId: string): string | null;
  
  /** Invalidate cache on auth refresh or 403 errors */
  invalidateCache(accountId: string): void;
  
  /** Telemetry: Track success/failure rates for validation */
  recordAttempt(success: boolean, latency: number): void;
}

interface ProjectIDResult {
  projectId: string;        // e.g., "cloudful-back-03mg"
  quotaRemaining?: number;  // Optional quota info
  expiresAt: Date;          // Cache TTL (default: 1 hour)
}

// Implementation (reference from opencode-antigravity-auth)
async function fetchProjectID(accessToken: string): Promise<ProjectIDResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout
  
  try {
    const response = await fetch(
      'https://autopush.aistudio.google.com/v1internal:loadCodeAssist',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'cc-mirror/3.1.0' // Telemetry identifier
        },
        signal: controller.signal
      }
    );
    
    if (!response.ok) {
      throw new ProjectIDFetchError(
        `HTTP ${response.status}: ${await response.text()}`
      );
    }
    
    const data = await response.json();
    
    // Validate response schema
    if (!data.projectId || typeof data.projectId !== 'string') {
      throw new ProjectIDFetchError('Invalid response schema');
    }
    
    return {
      projectId: data.projectId,
      quotaRemaining: data.quotaRemaining,
      expiresAt: new Date(Date.now() + 3600000) // 1 hour
    };
    
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ProjectIDFetchError('Timeout after 5s');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
```

**API Call Modification:**
```typescript
// Before: Fails with 403
headers: {
  'Authorization': `Bearer ${token}`
}

// After: Works correctly (when endpoint available)
headers: {
  'Authorization': `Bearer ${token}`,
  'X-Goog-User-Project': projectId  // From fetchProjectID()
}
```

**Error Handling:**
| Error Code | Cause | Action |
|------------|-------|--------|
| 403 | Account not eligible / No AI Premium | Trigger Safe Mode |
| 404 | Endpoint moved/removed | Trigger Safe Mode |
| 429 | Rate limited on bootstrap | Exponential backoff |
| 500 | Google internal error | Retry 3x then Safe Mode |
| Timeout | Network/latency issue | Retry 2x then Safe Mode |

**Acceptance Criteria:**
- [ ] `fetchProjectID()` succeeds >90% over 48-hour validation period (GATE)
- [ ] Project ID cached per-account with 1-hour TTL
- [ ] All Antigravity API calls include `X-Goog-User-Project` header
- [ ] Graceful fallback to Safe Mode on persistent failures
- [ ] Telemetry dashboard tracks success rate + latency (p50, p95, p99)

**Validation Gate (S6-000):**
```bash
# Run for 48 hours with 3 test accounts
# Call fetchProjectID() every 5 minutes
# Success threshold: >90% (130/144 attempts)
npm run validate:project-id --accounts=3 --duration=48h
```

***

### Feature 2: Circuit Breaker + Retry Logic 🆕 (P1)

**Business Value:** Prevents self-DDoS during quota exhaustion. Protects Google's endpoints from abuse.

**Technical Specification:**
```typescript
interface CircuitBreaker {
  /** Check if endpoint is healthy enough to attempt */
  shouldAttempt(endpoint: Endpoint, account: Account): boolean;
  
  /** Record failure for exponential backoff calculation */
  recordFailure(endpoint: Endpoint, account: Account, retryAfter?: number): void;
  
  /** Record success to reset failure count */
  recordSuccess(endpoint: Endpoint, account: Account): void;
  
  /** Force-reset circuit (manual override) */
  reset(endpoint: Endpoint, account: Account): void;
}

enum CircuitState {
  CLOSED = 'closed',      // Normal operation
  OPEN = 'open',          // Too many failures, reject immediately
  HALF_OPEN = 'half_open' // Testing if recovered
}

interface CircuitConfig {
  failureThreshold: number;    // Open circuit after N failures (default: 3)
  resetTimeout: number;        // Try half-open after N ms (default: 30000)
  halfOpenMaxAttempts: number; // Allow N test requests (default: 1)
}

class ExponentialBackoff {
  private attempts = 0;
  
  getWaitTime(): number {
    const base = 1000; // 1 second
    const max = 60000; // 1 minute
    const wait = Math.min(base * Math.pow(2, this.attempts), max);
    this.attempts++;
    return wait;
  }
  
  reset(): void {
    this.attempts = 0;
  }
}
```

**Behavior Matrix:**
| Scenario | State | Action |
|----------|-------|--------|
| First 429 error | CLOSED | Retry after `Retry-After` header |
| Second 429 (same endpoint) | CLOSED | Exponential backoff (2s) |
| Third 429 | OPEN | Block endpoint for 30s |
| After 30s | HALF_OPEN | Allow 1 test request |
| Test succeeds | CLOSED | Resume normal operation |
| Test fails | OPEN | Block for 60s (doubled) |

**Acceptance Criteria:**
- [ ] Circuit opens after 3 consecutive failures
- [ ] Exponential backoff: 1s → 2s → 4s → 8s → 16s → 32s → 60s (max)
- [ ] Half-open state allows gradual recovery
- [ ] Per-endpoint + per-account tracking
- [ ] Metrics: circuit open events, recovery time

***

### Feature 3: Safe Mode Fallback 🆕 (P1)

**Business Value:** Zero downtime when Antigravity is unavailable. Maintains user trust.

**Technical Specification:**
```typescript
interface SafeMode {
  /** Check if Safe Mode is active globally or per-account */
  isActive(account?: Account): boolean;
  
  /** Activate Safe Mode (manual or automatic) */
  activate(reason: SafeModeReason, account?: Account): void;
  
  /** Deactivate after validation period */
  deactivate(account?: Account): void;
  
  /** Route request to official Gemini API instead */
  fallbackRequest(originalRequest: AntigravityRequest): GeminiAPIRequest;
}

enum SafeModeReason {
  PROJECT_ID_UNAVAILABLE = 'project_id_unavailable',
  ENDPOINT_BLOCKED = 'endpoint_blocked',
  QUOTA_EXHAUSTED = 'quota_exhausted',
  MANUAL_OVERRIDE = 'manual_override'
}

interface SafeModeConfig {
  // Automatically activate if project ID fails N times
  autoActivateThreshold: number; // default: 5
  
  // Require API key for fallback
  requireGeminiAPIKey: boolean; // default: true
  
  // Notify user when activated
  showNotification: boolean; // default: true
  
  // Retry Antigravity after N minutes
  retryInterval: number; // default: 60 (1 hour)
}
```

**User Experience:**
```
┌────────────────────────────────────────────────────────────┐
│ ⚠️  SAFE MODE ACTIVE                                       │
├────────────────────────────────────────────────────────────┤
│ Antigravity authentication is temporarily unavailable.     │
│ Using official Gemini API fallback.                        │
│                                                             │
│ • Add your Gemini API key to continue                      │
│ • Or wait 60 minutes for automatic retry                   │
│                                                             │
│ [Configure API Key]  [Retry Now]  [Dismiss]                │
└────────────────────────────────────────────────────────────┘
```

**Routing Logic:**
```typescript
async function routeRequest(req: ModelRequest): Promise<Response> {
  // Check if Safe Mode is active
  if (safeMode.isActive(req.account)) {
    logger.warn('Safe Mode active, routing to Gemini API');
    return await geminiAPIClient.send(safeMode.fallbackRequest(req));
  }
  
  // Try Antigravity (normal path)
  try {
    return await antigravityClient.send(req);
  } catch (error) {
    if (error instanceof ProjectIDFetchError) {
      // Activate Safe Mode after repeated failures
      if (shouldActivateSafeMode(error)) {
        safeMode.activate(SafeModeReason.PROJECT_ID_UNAVAILABLE, req.account);
        return await geminiAPIClient.send(safeMode.fallbackRequest(req));
      }
    }
    throw error;
  }
}
```

**Acceptance Criteria:**
- [ ] Activates automatically after 5 consecutive project ID failures
- [ ] User notification shown on first activation
- [ ] Graceful model mapping (Antigravity models → Gemini equivalents)
- [ ] Automatic retry every 60 minutes
- [ ] Manual override: `cc-mirror antigravity safe-mode --disable`

***

## 🗓️ Revised Implementation Timeline

### **SPRINT 6: VALIDATION & CORE AUTH** (Weeks 7-8)

#### **Phase 1: Validation Gate (Week 7, Days 1-2)** 🚦 BLOCKER

| Task | Engineer | Days | Priority | Dependencies |
|------|----------|------|----------|--------------|
| **S6-000: PoC - Project ID Discovery** | Backend 1 | 2 | **P0** | None |
| └─ Setup 3 test Google accounts | Backend 1 | 0.5 | P0 | None |
| └─ Implement fetchProjectID() | Backend 1 | 0.5 | P0 | None |
| └─ Run 48-hour automated validation | Backend 1 | 1 | P0 | None |
| └─ Generate success rate report | Backend 1 | 0.5 | P0 | S6-000 |

**GO/NO-GO DECISION POINT:** Friday, Week 7, 10 AM
- ✅ **GO:** Success rate >90% → Proceed to Phase 2
- ❌ **NO-GO:** Success rate <90% → Pivot to official Gemini API (PRD v4.0)

***

#### **Phase 2: Core Implementation (Week 7, Days 3-5)** ✅ If PoC passes

| Task | Engineer | Days | Priority | Dependencies |
|------|----------|------|----------|--------------|
| **S6-001: Project ID Bootstrapper** | Backend 1 | 3 | P0 | S6-000 ✅ |
| └─ Production implementation | Backend 1 | 1.5 | P0 | S6-000 |
| └─ Per-account caching (1hr TTL) | Backend 1 | 0.5 | P0 | S6-001 |
| └─ Error handling (5 scenarios) | Backend 1 | 0.5 | P0 | S6-001 |
| └─ Telemetry integration | Backend 1 | 0.5 | P0 | S6-001 |
| **S6-002: Circuit Breaker** | Backend 2 | 2 | P1 | None |
| └─ State machine (CLOSED/OPEN/HALF_OPEN) | Backend 2 | 1 | P1 | None |
| └─ Exponential backoff logic | Backend 2 | 0.5 | P1 | S6-002 |
| └─ Per-endpoint tracking | Backend 2 | 0.5 | P1 | S6-002 |
| **S6-003: Safe Mode Fallback** | Backend 2 | 2 | P1 | None |
| └─ Activation logic | Backend 2 | 0.5 | P1 | None |
| └─ Gemini API client integration | Backend 2 | 1 | P1 | S6-003 |
| └─ User notification UI | Backend 2 | 0.5 | P1 | S6-003 |

***

#### **Phase 3: Integration & Testing (Week 8, Days 1-4)**

| Task | Engineer | Days | Priority | Dependencies |
|------|----------|------|----------|--------------|
| **S6-004: Basic Antigravity Integration** | Backend 1 | 3 | P0 | S6-001, S6-002 |
| └─ Header injection (X-Goog-User-Project) | Backend 1 | 0.5 | P0 | S6-001 |
| └─ Single quota pool routing | Backend 1 | 1 | P0 | S6-004 |
| └─ Error recovery flows | Backend 1 | 1 | P0 | S6-002, S6-003 |
| └─ Logging + observability | Backend 1 | 0.5 | P0 | S6-004 |
| **S6-005: E2E Testing** | Both | 2 | P0 | S6-001 through S6-004 |
| └─ Happy path (auth → model call) | Both | 0.5 | P0 | S6-004 |
| └─ Error scenarios (403, 429, timeout) | Both | 1 | P0 | S6-002, S6-003 |
| └─ Safe Mode activation/deactivation | Both | 0.5 | P0 | S6-003 |
| **S6-006: Circuit Breaker Integration** 🆕 | Backend 2 | 2 | P1 | S6-002, S6-004 |
| └─ Wire circuit breaker to request router | Backend 2 | 1 | P1 | S6-002 |
| └─ Dashboard metrics (Grafana) | Backend 2 | 1 | P1 | S6-006 |
| **S6-007: Emergency Rollback Procedure** 🆕 | Backend 1 | 1 | P2 | All |
| └─ Feature flag: ENABLE_ANTIGRAVITY_AUTH | Backend 1 | 0.5 | P2 | None |
| └─ Rollback runbook documentation | Backend 1 | 0.5 | P2 | S6-007 |

**Sprint Goal:** Zero-downtime authentication to Antigravity with automatic fallback on failure.

***

### **SPRINT 7: ADVANCED QUOTA MANAGEMENT** (Weeks 9-10) 🔮 Deferred

*Scope TBD based on Sprint 6 results. Tentative features:*
- Dual Quota System (Antigravity + Gemini CLI endpoints)
- Enhanced Multi-Account Rotation
- Sticky Account Selection (prompt cache preservation)
- Smart retry strategies (short vs. long rate limits)

***

## 📐 Updated System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     cc-mirror Request                           │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│            LAYER 0: Feature Flag Gateway 🆕                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  if (ENABLE_ANTIGRAVITY_AUTH === false)                  │   │
│  │    → Route to Official Gemini API                        │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│            LAYER 1: Safe Mode Controller 🆕                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  if (isSafeModeActive())                                 │   │
│  │    → Gemini API Fallback                                 │   │
│  │  else                                                     │   │
│  │    → Continue to Antigravity path                        │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│            LAYER 2: Account Manager (Basic Rotation)            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  • Round-robin account selection                         │   │
│  │  • Per-account rate limit tracking                       │   │
│  │  • Switch on 429 errors                                  │   │
│  └────────────────────────────┬─────────────────────────────┘   │
└───────────────────────────────┼─────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│         LAYER 3: Project ID Bootstrapper ⭐ NEW (S6-001)        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  1. Check cache (1hr TTL)                                │   │
│  │  2. If expired: POST /v1internal:loadCodeAssist          │   │
│  │  3. Extract projectId from response                      │   │
│  │  4. On error: Activate Safe Mode                         │   │
│  └────────────────────────────┬─────────────────────────────┘   │
└───────────────────────────────┼─────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│           LAYER 4: Circuit Breaker 🆕 (S6-002/S6-006)           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  shouldAttempt(endpoint, account)?                       │   │
│  │    YES → Proceed                                         │   │
│  │    NO → Skip (circuit OPEN), try next account           │   │
│  └────────────────────────────┬─────────────────────────────┘   │
└───────────────────────────────┼─────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│          LAYER 5: Request Router (Basic - Sprint 6)             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Route to: aistudio.google.com/v1/...                   │   │
│  │  Headers:                                                │   │
│  │    - Authorization: Bearer ${token}                      │   │
│  │    - X-Goog-User-Project: ${projectId}  ⭐ NEW           │   │
│  │    - Content-Type: application/json                      │   │
│  │                                                          │   │
│  │  On 429: circuitBreaker.recordFailure() → retry         │   │
│  │  On 403: Activate Safe Mode                             │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│          LAYER 6: Protocol Translation (Existing)               │
│  API Translator • Tool Hardening • Thinking Sanitizer           │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
                   Google Antigravity API
                   (with X-Goog-User-Project header)
```

**Note:** Dual Quota Router (Layer 5 enhancement) deferred to Sprint 7.

***

## 📊 Success Metrics

### Validation Gate (S6-000)
| Metric | Threshold | Measurement Window |
|--------|-----------|-------------------|
| `fetchProjectID()` success rate | **> 90%** | 48 hours |
| Average latency | < 2s | 48 hours |
| p95 latency | < 5s | 48 hours |
| Zero account lockouts | **Required** | 48 hours |

### Sprint 6 Completion
| Metric | Week 7 Gate | Week 8 Target | Current Baseline |
|--------|-------------|---------------|------------------|
| API Call Success Rate (with fallback) | > 95% | **> 99%** | 0% (403 errors) |
| `fetchProjectID()` success rate | > 90% | > 95% | N/A |
| Safe Mode activations (false positives) | < 5% | < 2% | N/A |
| Circuit breaker open events | — | < 10/day | N/A |
| Mean Time To Recovery (Safe Mode) | — | < 5 min | N/A |

### Sprint 7+ (Post-Dual Quota)
| Metric | Target | Current |
|--------|--------|---------|
| Quota Utilization | > 90% (dual pool) | 50% (single pool) |
| Account Switch Latency | < 100ms | Manual |
| Rate Limit Recovery | Automatic | Manual |

***

## 🔒 Security & Compliance

### Data Handling
| Data Type | Storage | Encryption | Retention |
|-----------|---------|------------|-----------|
| OAuth Tokens | keytar/system keychain | AES-256 | Until logout |
| Project IDs | In-memory cache | None (non-sensitive) | 1 hour TTL |
| API Logs | Local disk | None | 7 days |
| Telemetry | Aggregated metrics | TLS in transit | 90 days |

### Audit Requirements
- [ ] Log all Safe Mode activations (reason + timestamp)
- [ ] Log account switches (account ID hash, no tokens)
- [ ] Alert on >5 consecutive project ID failures
- [ ] Weekly security review of `v1internal` endpoint status

### Legal Review Status
| Item | Status | Owner | Due Date |
|------|--------|-------|----------|
| ToS compliance for `v1internal` API | **Pending** | Legal | Week 7, Day 1 |
| User disclaimer (account lockout risk) | **Pending** | Legal + PM | Week 7, Day 2 |
| GDPR compliance (token storage) | ✅ Approved | Security | 2026-01-03 |
| Open-source license audit | ✅ Approved | Legal | 2026-01-05 |

***

## ⚠️ Risk Register

| Risk | Likelihood | Impact | Mitigation | Owner | Status |
|------|-----------|--------|------------|-------|--------|
| **Google blocks `v1internal` endpoint** | Medium | **Critical** | Safe Mode fallback + feature flag | Architect | ✅ Addressed |
| **User account lockouts** | Low | High | Disclaimer + throwaway account guide | PM | In Progress |
| **48hr PoC fails (>10% error rate)** | Medium | **Critical** | Pivot to official Gemini API (PRD v4.0) | Tech Lead | Monitored |
| **Legal cease & desist from Google** | Low | **Critical** | Emergency rollback (S6-007) + PR response | Director | Prepared |
| **Quota exhaustion (all accounts)** | High | Medium | Circuit breaker prevents self-DDoS | Backend 2 | ✅ Addressed |
| **Endpoint latency spikes** | Medium | Medium | 5s timeout + retry logic | Backend 1 | ✅ Addressed |
| **Sprint 6 slips past Week 8** | Low | High | Daily standups + blockers escalation | Tech Lead | Monitored |
| **Dependency on `opencode-antigravity-auth` maintenance** | Medium | Low | Fork repo + maintain internal version | Architect | Deferred |

### Risk Response Plan
**TRIGGER:** PoC success rate <90% OR Legal veto OR User lockout reports >2

**ACTION:**
1. Immediate: Disable `ENABLE_ANTIGRAVITY_AUTH` feature flag
2. Within 24h: Communicate pivot to official Gemini API integration
3. Within 72h: Draft PRD v4.0 with Gemini API key approach
4. Notify stakeholders: CEO, Engineering Director, Customer Success

***

## 📋 Rollout Strategy

### Phase 1: Internal Dogfooding (Week 8, Days 4-5)
**Participants:** 5 engineering team members  
**Goal:** Validate real-world usage, catch edge cases  
**Success Criteria:**
- Zero Safe Mode false positives
- < 1% API call failures
- No account lockouts

### Phase 2: Closed Beta (Week 9)
**Participants:** 50 users (invite-only)  
**Feature Flag:** `ENABLE_ANTIGRAVITY_AUTH=true` for selected accounts  
**Monitoring:**
- Daily error rate reports
- User feedback surveys (NPS)
- Support ticket volume

**Exit Criteria:**
- ✅ API success rate > 98%
- ✅ NPS > 8/10
- ✅ Zero P0/P1 bugs

### Phase 3: Gradual Rollout (Weeks 10-11)
| Week | Rollout % | User Count | Rollback Plan |
|------|-----------|------------|---------------|
| 10 | 25% | ~250 users | < 4hr rollback SLA |
| 11 | 50% | ~500 users | < 2hr rollback SLA |
| 12 | 100% | ~1000 users | GA release |

**Rollback Triggers:**
- API success rate drops below 95%
- >10 support tickets about auth failures
- Google sends ToS warning

### Phase 4: General Availability (Week 12)
**Announcement:**
- Blog post: "cc-mirror now supports Antigravity models"
- Email to waitlist (1,200+ users)
- Social media campaign

***

## 🔧 Operational Readiness

### Monitoring & Alerting
```yaml
# Grafana Dashboard: "Antigravity Auth Health"
panels:
  - name: "Project ID Success Rate"
    query: "rate(project_id_fetch_success[5m]) / rate(project_id_fetch_total[5m])"
    alert: < 0.9 (P1), < 0.8 (P0)
    
  - name: "Safe Mode Activation Rate"
    query: "rate(safe_mode_activations[1h])"
    alert: > 10/hour (P1)
    
  - name: "Circuit Breaker Open Events"
    query: "sum(circuit_breaker_state{state='open'})"
    alert: > 5 concurrent (P2)
    
  - name: "API Call Success Rate (Overall)"
    query: "rate(api_call_success[5m]) / rate(api_call_total[5m])"
    alert: < 0.99 (P1), < 0.95 (P0)
```

### Runbooks
1. **"Project ID endpoint returns 403"** → Activate Safe Mode globally, escalate to Google contact
2. **"All accounts rate-limited"** → Verify circuit breaker working, notify users via in-app banner
3. **"User reports account lockout"** → Collect account details, file Google support ticket, compensate user
4. **"Safe Mode stuck active"** → Manual reset via `cc-mirror antigravity safe-mode --reset-all`

### Support Preparation
**Week 7 Tasks:**
- [ ] Draft FAQ: "Why am I seeing Safe Mode?"
- [ ] Create support macro: "Antigravity auth troubleshooting"
- [ ] Train support team on rollback procedure (2-hour session)
- [ ] Setup dedicated Slack channel: `#antigravity-support`

***

## 📚 Documentation Requirements

### User-Facing
- [ ] **Setup Guide:** "Connecting your Google account to cc-mirror"
  - Includes throwaway account recommendation
  - Screenshots of OAuth flow
  - Troubleshooting section
- [ ] **FAQ:** "Understanding Safe Mode"
- [ ] **Model Comparison:** Antigravity vs. Gemini API (features, limits, pricing)

### Developer-Facing
- [ ] **Architecture Doc:** Updated with new layers (S6-001 to S6-007)
- [ ] **API Reference:** `ProjectBootstrapper`, `CircuitBreaker`, `SafeMode` interfaces
- [ ] **Testing Guide:** How to run validation gate locally
- [ ] **Rollback Procedure:** Step-by-step emergency response

***

## 📞 Stakeholder Communication Plan

### Weekly Updates (Every Friday, 3 PM)
**Attendees:** PM, Engineering Director, Tech Lead, Systems Architect  
**Agenda:**
1. Sprint progress (% complete)
2. Blockers & risks
3. Validation gate results (Week 7)
4. Go/no-go decision (Week 7 end)

### Escalation Path
```
Developer Blocked
    ↓
Tech Lead (< 4 hours)
    ↓
Engineering Director (< 24 hours)
    ↓
CTO (Critical only)
```

### External Communication
**Google Cloud Rep:** Informal inquiry about IDE integration patterns (PM to initiate by EOD)  
**Community:** No public announcement until GA (Week 12)

***

## ✅ Approval & Sign-Off

| Role | Name | Status | Date | Notes |
|------|------|--------|------|-------|
| **Product Manager** | [Your Name] | ✅ **APPROVED** | 2026-01-08 | Conditional on validation gate |
| **Engineering Director** | [Name] | ✅ **APPROVED** | 2026-01-08 | Requires weekly progress updates |
| **Tech Lead** | [Name] | ✅ **APPROVED** | 2026-01-08 | Committed to revised timeline |
| **Systems Architect** | [Name] | ⚠️ **APPROVED WITH OBJECTION** | 2026-01-08 | Documented legal risk objection |
| **Security Review** | [Name] | 🔄 Pending | — | Due: Week 7, Day 2 |
| **Legal Review** | [Name] | 🔄 Pending | — | Due: Week 7, Day 1 |

***

## 🚦 Next Steps

### Immediate Actions (This Week)
- [ ] **PM:** Reach out to Google Cloud rep (informal inquiry) - **Due: EOD Today**
- [ ] **PM:** Draft user disclaimer for account lockout risks - **Due: Friday**
- [ ] **Tech Lead:** Assign engineers to S6-000 through S6-007 - **Due: Tomorrow**
- [ ] **Architect:** Submit legal review request - **Due: Tomorrow**
- [ ] **Backend 1:** Setup 3 test Google accounts for validation - **Due: Thursday**

### Week 7 Milestones
- **Monday 9 AM:** Sprint 6 kickoff meeting
- **Wednesday 5 PM:** 48-hour validation begins (S6-000)
- **Friday 10 AM:** GO/NO-GO DECISION based on validation results
- **Friday 3 PM:** Weekly stakeholder update

***

## 📎 Appendices

### Appendix A: Alternative Approaches Considered
1. **Official Gemini API Only** - Rejected: Too expensive ($150/user/month)
2. **Screen-scraping Antigravity web UI** - Rejected: Unstable, violates ToS
3. **Proxy through OpenCode plugin** - Rejected: Adds dependency, same legal risk
4. **Partner with Google for official API** - Rejected: 6+ month timeline

### Appendix B: Competitive Analysis
| Feature | cc-mirror (v3.1) | OpenCode | Cursor | Windsurf |
|---------|-----------------|----------|--------|----------|
| Antigravity Auth | ✅ (Sprint 6) | ✅ | ❌ | ❌ |
| Dual Quota | 🔄 (Sprint 7) | ✅ | N/A | N/A |
| Safe Mode Fallback | ✅ | ❌ | N/A | N/A |
| Circuit Breaker | ✅ | ⚠️ Basic | N/A | N/A |

### Appendix C: Reference Implementation
- **Source:** [opencode-antigravity-auth](https://github.com/NoeFabris/opencode-antigravity-auth) (MIT License)
- **Key Files:**
  - `src/antigravity/oauth.ts` - Project ID logic
  - `plugin.ts` - Dual quota routing
  - `src/antigravity/account-manager.ts` - Multi-account rotation

***

**Document Control:**  
Last Updated: 2026-01-08, 6:00 PM SGT  
Next Review: 2026-01-10 (Post-PoC)  
Distribution: Engineering Team, Leadership, Legal

***

*"Validate aggressively, ship confidently."* - Product Team
