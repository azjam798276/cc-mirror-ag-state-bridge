📄 TECHNICAL DESIGN DOCUMENT (TDD) v3.0
Project: cc-mirror Antigravity Authentication Integration
Document: TDD_Antigravity_Auth_v3.0.md
Version: 3.0 (Pre-Implementation Draft)
Date: January 8, 2026, 8:48 AM SGT
Status: DRAFT - Awaiting Technical Review
Based On: ADD_Antigravity_Auth_v0.2.md, PRD_v3.1.md

📋 Document Metadata
Attribute	Value
Version	3.0 (Pre-Implementation)
Status	DRAFT
Target Audience	Backend 1, Backend 2 (junior-to-mid level developers)
Estimated Implementation	21 hours (2.5 days for single developer)
Prerequisites	Node.js 18+, TypeScript 5.0+, cc-mirror dev environment
Related Documents	ADD v0.2, PRD v3.1
Review Deadline	2026-01-08 17:00 SGT
🎯 1. Implementation Overview
1.1 What We're Building
In one sentence: An adapter layer that integrates the opencode-antigravity-auth library into cc-mirror's provider system, enabling authentication via Google Antigravity.

What you'll deliver:

✅ 1 new provider: AntigravityProvider

✅ 1 adapter class: AntigravityAuthAdapter (~150 lines)

✅ 5 new TypeScript files

✅ 2 new test suites (unit + integration)

✅ 1 CLI command: cc-mirror auth login

✅ Updated configuration schema

What you'll NOT build:

❌ OAuth flow (library handles it)

❌ Project ID fetching (library handles it)

❌ Circuit breaker (library handles it)

❌ Multi-account rotation (library handles it)

Your job: Write the ~200 lines of glue code between library and cc-mirror.

1.2 What Files to Create
text
cc-mirror/
├── src/
│   ├── providers/
│   │   ├── antigravity/                          # NEW DIRECTORY
│   │   │   ├── index.ts                          # NEW - Public API
│   │   │   ├── antigravity-provider.ts           # NEW - Provider implementation (80 lines)
│   │   │   ├── adapter/
│   │   │   │   ├── antigravity-auth-adapter.ts   # NEW - Core adapter (150 lines)
│   │   │   │   ├── field-mapper.ts               # NEW - API response mapping (40 lines)
│   │   │   │   └── error-translator.ts           # NEW - Error handling (60 lines)
│   │   │   ├── types/
│   │   │   │   └── antigravity-types.ts          # NEW - Type definitions (50 lines)
│   │   │   └── config/
│   │   │       └── antigravity-config.ts         # NEW - Config schema (30 lines)
│   ├── cli/
│   │   └── commands/
│   │       └── auth-login.ts                     # MODIFY - Add antigravity subcommand
│   └── config/
│       └── providers.ts                          # MODIFY - Register antigravity provider
├── tests/
│   ├── unit/
│   │   └── antigravity-auth-adapter.test.ts      # NEW - Unit tests (200 lines)
│   └── integration/
│       └── antigravity-e2e.test.ts               # NEW - Integration tests (150 lines)
└── package.json                                  # MODIFY - Add dependency

Total New Files: 8
Total Modified Files: 3
Total New Lines: ~760
1.3 What to Install
bash
# 1. Install library (exact version pinned)
npm install opencode-antigravity-auth@1.2.7 --save-exact

# 2. Install dev dependencies (for testing)
npm install --save-dev @types/jest jest-mock-extended

# 3. Verify installation
npm ls opencode-antigravity-auth
# Should show: opencode-antigravity-auth@1.2.7

# 4. Check TypeScript types
npx tsc --noEmit
# Should have no errors
Why exact version (@1.2.7)?

We validated API responses with this version

Semver updates (^1.2.7) might break field names

We'll upgrade manually after testing

1.4 Implementation Order
DO NOT code in random order. Follow this sequence to avoid blockers:

text
Phase 1: Foundation (2 hours)
  ├─ AG-001: Project setup & directory structure
  └─ Result: npm install works, files created, TypeScript compiles

Phase 2: Type Definitions (1 hour)
  ├─ AG-002: Define TypeScript interfaces in antigravity-types.ts
  └─ Result: All types compile, imported by other files

Phase 3: Core Adapter (4 hours) ← MOST COMPLEX
  ├─ AG-003: Implement authenticate() in AntigravityAuthAdapter
  ├─ AG-004: Implement field mapping (cloudaicompanionProject)
  └─ Result: Can authenticate test account, unit tests pass

Phase 4: Request Handling (4 hours)
  ├─ AG-005: Implement makeRequest() in AntigravityAuthAdapter
  ├─ AG-006: Integrate error translator
  └─ Result: Can make model request, errors mapped

Phase 5: Provider Wrapper (2 hours)
  ├─ AG-007: Implement AntigravityProvider
  └─ Result: Provider shows in cc-mirror list

Phase 6: Integration (4 hours)
  ├─ AG-008: Credential store integration
  ├─ AG-009: Configuration integration
  └─ Result: End-to-end flow works

Phase 7: Testing (4 hours)
  ├─ AG-010: Write unit tests
  ├─ AG-011: Write integration tests
  └─ Result: >80% code coverage, all tests pass

Total: 21 hours (2.5 days for one developer)
Why this order?

Types first → avoid "Cannot find name" errors later

Core adapter before provider → provider depends on adapter

Integration last → verifies everything works together

1.5 Development Timeline
Assuming 1 full-time developer (Backend 1):

text
Day 1 (8 hours):
  Morning:  AG-001, AG-002, AG-003 (Project setup + Types + Start adapter)
  Afternoon: AG-003 continued (Finish authenticate method)
  Evening:   AG-004 (Field mapping)
  
Day 2 (8 hours):
  Morning:   AG-005 (makeRequest method)
  Afternoon: AG-006, AG-007 (Error handling + Provider)
  Evening:   AG-008 (Integration)
  
Day 3 (5 hours):
  Morning:   AG-009, AG-010 (Config + Unit tests)
  Afternoon: AG-011 (Integration tests)
  
Total: 21 hours across 3 days
If parallelizing with Backend 2:

Backend 1: Core adapter (AG-003 through AG-006) - 8 hours

Backend 2: Provider wrapper + tests (AG-007 through AG-011) - 10 hours

Total: 1.5 days with 2 devs

📁 2. File Structure & Naming Conventions
2.1 Complete Directory Tree
text
cc-mirror/
├── src/
│   ├── providers/
│   │   ├── index.ts                              # EXISTING - Export all providers
│   │   ├── base-provider.ts                      # EXISTING - Base class
│   │   ├── openai/                               # EXISTING
│   │   ├── anthropic/                            # EXISTING
│   │   └── antigravity/                          # NEW ←
│   │       ├── index.ts                          # Re-export public API
│   │       ├── antigravity-provider.ts           # Main provider class
│   │       ├── adapter/
│   │       │   ├── index.ts                      # Re-export adapter
│   │       │   ├── antigravity-auth-adapter.ts   # Core adapter logic
│   │       │   ├── field-mapper.ts               # Response field mapping
│   │       │   └── error-translator.ts           # Error handling
│   │       ├── types/
│   │       │   ├── index.ts                      # Re-export types
│   │       │   └── antigravity-types.ts          # All TypeScript interfaces
│   │       └── config/
│   │           ├── index.ts                      # Re-export config
│   │           └── antigravity-config.ts         # Config schema
│   ├── cli/
│   │   └── commands/
│   │       ├── auth.ts                           # EXISTING
│   │       └── auth-login.ts                     # MODIFY - Add 'antigravity' arg
│   ├── config/
│   │   ├── providers.ts                          # MODIFY - Register provider
│   │   └── schema.ts                             # MODIFY - Add config validation
│   └── utils/
│       ├── credential-store.ts                   # EXISTING - Used by adapter
│       └── logger.ts                             # EXISTING - Used for audit logs
├── tests/
│   ├── unit/
│   │   ├── providers/
│   │   │   └── antigravity/
│   │   │       ├── antigravity-auth-adapter.test.ts
│   │   │       ├── field-mapper.test.ts
│   │   │       └── error-translator.test.ts
│   └── integration/
│       └── providers/
│           └── antigravity/
│               └── antigravity-e2e.test.ts
├── docs/
│   ├── ADD_Antigravity_Auth_v0.2.md              # EXISTING - Architecture
│   ├── PRD_v3.1.md                               # EXISTING - Requirements
│   └── TDD_Antigravity_Auth_v3.0.md              # THIS DOCUMENT
└── package.json                                  # MODIFY - Add dependency
2.2 File Naming Rules
Follow these conventions (enforced in code review):

File Type	Pattern	Example	Why
Provider Class	{provider-name}-provider.ts	antigravity-provider.ts	Consistency with existing providers
Adapter Class	{provider-name}-auth-adapter.ts	antigravity-auth-adapter.ts	Clearly indicates auth logic
Types File	{provider-name}-types.ts	antigravity-types.ts	Namespaced type definitions
Test File	{file-name}.test.ts	antigravity-auth-adapter.test.ts	Jest convention
Index File	index.ts	adapter/index.ts	Re-export barrel pattern
Case conventions:

Files: kebab-case.ts (antigravity-provider.ts)

Classes: PascalCase (AntigravityProvider)

Functions/variables: camelCase (authenticate, accessToken)

Constants: SCREAMING_SNAKE_CASE (MAX_RETRIES, DEFAULT_TIMEOUT)

Types/Interfaces: PascalCase (AuthResult, ProjectIDResponse)

2.3 Import Path Conventions
typescript
// ✅ CORRECT: Use absolute imports from src/
import { AntigravityProvider } from '@/providers/antigravity';
import { CredentialStore } from '@/utils/credential-store';
import { Logger } from '@/utils/logger';

// ❌ WRONG: Relative imports (brittle, hard to refactor)
import { AntigravityProvider } from '../../../providers/antigravity';

// ✅ CORRECT: Library imports (named imports when possible)
import { OAuthClient, ProjectIDBootstrapper } from 'opencode-antigravity-auth/dist/core';

// ❌ WRONG: Importing entire library (tree-shaking fails)
import * as antigravityAuth from 'opencode-antigravity-auth';

// ✅ CORRECT: Internal re-exports via index.ts
import { AntigravityAuthAdapter } from '@/providers/antigravity/adapter';
// This goes through adapter/index.ts → antigravity-auth-adapter.ts

// ❌ WRONG: Bypassing index.ts
import { AntigravityAuthAdapter } from '@/providers/antigravity/adapter/antigravity-auth-adapter';
Why absolute imports?

Easier refactoring (move files without changing imports)

Clearer dependency tree

Aligns with cc-mirror conventions

Configure in tsconfig.json:

json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
🛠️ 3. Development Workflow
3.1 Environment Setup
Prerequisites:

bash
# 1. Node.js version (check)
node --version
# Required: v18.0.0 or higher

# 2. TypeScript version (check)
npx tsc --version
# Required: 5.0.0 or higher

# 3. Clone repo
git clone https://github.com/your-org/cc-mirror.git
cd cc-mirror

# 4. Install dependencies
npm install

# 5. Create feature branch
git checkout -b feature/antigravity-auth

# 6. Install antigravity library
npm install opencode-antigravity-auth@1.2.7 --save-exact

# 7. Verify setup
npm run build
npm test
# All existing tests should pass
Test Account Setup:

bash
# You need 3 Google accounts with AI Premium for testing
# (Ops team should provide these)

# Verify you can auth:
# 1. Go to https://aistudio.google.com
# 2. Sign in with test account
# 3. Verify you see "Gemini Advanced" badge
# 4. Note email for later use

# Store credentials securely
export TEST_ACCOUNT_1_EMAIL="test1@example.com"
export TEST_ACCOUNT_1_REFRESH_TOKEN="..." # From ops team
3.2 Running Locally
bash
# Development mode (watch for changes)
npm run dev

# In another terminal, test the provider
npm run cli -- provider list
# Should show: openai, anthropic, antigravity (if registered)

# Test authentication (will open browser)
npm run cli -- auth login --provider=antigravity

# Test with a simple request
npm run cli -- complete \
  --provider=antigravity \
  --model=antigravity-gemini-3-pro-high \
  --prompt="Hello world"

# Expected output:
# Authenticating with Google...
# Project ID: vertical-ability-f3lbr
# Response: [AI response here]
Debugging Mode:

bash
# Enable verbose logging
DEBUG=cc-mirror:* npm run cli -- complete \
  --provider=antigravity \
  --model=antigravity-gemini-3-pro-high \
  --prompt="Test"

# Logs will show:
# cc-mirror:adapter authenticate() called for account-123
# cc-mirror:adapter Fetching project ID...
# cc-mirror:adapter Project ID: vertical-ability-f3lbr (cached: false)
# cc-mirror:adapter Making request to model...
3.3 Testing Workflow
bash
# Run unit tests only
npm run test:unit -- antigravity

# Run integration tests (requires test accounts)
npm run test:integration -- antigravity

# Run all tests
npm test

# Run tests in watch mode (re-run on file change)
npm run test:watch -- antigravity

# Generate coverage report
npm run test:coverage -- antigravity
# Open: coverage/lcov-report/index.html
# Target: >80% coverage
Test with real Google account (manual QA):

bash
# 1. Clear any cached credentials
rm -rf ~/.config/cc-mirror/credentials/antigravity

# 2. Run auth flow
npm run cli -- auth login --provider=antigravity
# Opens browser → Google OAuth → Success

# 3. Verify credentials stored
ls ~/.config/cc-mirror/credentials/antigravity/
# Should show: account-{hash}.json

# 4. Make a request
npm run cli -- complete --provider=antigravity --model=antigravity-gemini-3-pro-high --prompt="What is 2+2?"
# Should return: "4" or similar
3.4 Debugging Tips
Common Issues & Solutions:

Issue	Symptom	Solution
"Cannot find module 'opencode-antigravity-auth'"	Import error	Run npm install, check package.json
"Property 'cloudaicompanionProject' does not exist"	Type error	Update response type in antigravity-types.ts
"Access token expired"	401 errors	Library should auto-refresh; check refresh token in keytar
"Project ID fetch returns 403"	Auth error	Verify account has AI Premium subscription
Tests hang indefinitely	Timeout	Check for missing await keywords, increase Jest timeout
"Circuit breaker opened"	Rate limit	Wait 30s for circuit breaker to close, or reset manually
Debugging Tools:

typescript
// Add breakpoints in VS Code
// File: antigravity-auth-adapter.ts
async authenticate(accountId: string): Promise<AuthResult> {
  debugger; // ← VS Code will stop here
  const credentials = await this.credentialStore.get(accountId);
  // ...
}

// Or use console.log (remove before commit!)
console.log('[DEBUG] Project ID response:', JSON.stringify(response, null, 2));

// Or use logger (safe for commit)
this.logger.debug('Project ID fetched', {
  accountId,
  projectId: response.cloudaicompanionProject,
  cached: false
});
Inspect library state:

typescript
// Check if library's circuit breaker is open
const circuitState = (adapter as any).circuitBreaker.getState();
console.log('Circuit breaker state:', circuitState);

// Check library's cache
const cachedProjectId = (adapter as any).projectIdBootstrapper.getCached(accountId);
console.log('Cached project ID:', cachedProjectId);
🔧 4. Detailed Component Specifications
4.1 AntigravityAuthAdapter
Responsibility
One sentence: Translates between cc-mirror's credential/request formats and the opencode-antigravity-auth library's interfaces.

Dependencies
typescript
// External library (3rd party)
import { 
  OAuthClient,
  ProjectIDBootstrapper,
  AccountManager,
  DualQuotaRouter,
  CircuitBreaker 
} from 'opencode-antigravity-auth/dist/core';

// cc-mirror internal
import { CredentialStore } from '@/utils/credential-store';
import { Logger } from '@/utils/logger';
import { 
  AuthResult, 
  AntigravityConfig, 
  CCMirrorRequestPayload, 
  CCMirrorResponse 
} from '@/providers/antigravity/types';
import { FieldMapper } from './field-mapper';
import { ErrorTranslator } from './error-translator';
Interface (TypeScript)
typescript
/**
 * Adapter for integrating opencode-antigravity-auth library into cc-mirror.
 * 
 * This is the CORE component - all authentication logic flows through here.
 * 
 * @example
 * ```typescript
 * const adapter = new AntigravityAuthAdapter(credStore, config, logger);
 * const authResult = await adapter.authenticate('account-123');
 * console.log(authResult.projectId); // "vertical-ability-f3lbr"
 * ```
 */
export class AntigravityAuthAdapter {
  private oauthClient: OAuthClient;
  private projectIdBootstrapper: ProjectIDBootstrapper;
  private accountManager: AccountManager;
  private quotaRouter: DualQuotaRouter;
  private fieldMapper: FieldMapper;
  private errorTranslator: ErrorTranslator;
  
  /**
   * Initialize adapter with dependencies.
   * 
   * @param credentialStore - cc-mirror's credential storage (keytar wrapper)
   * @param config - Antigravity-specific configuration
   * @param logger - Logger instance for audit trails
   */
  constructor(
    private credentialStore: CredentialStore,
    private config: AntigravityConfig,
    private logger: Logger
  );
  
  /**
   * Authenticate user and retrieve project context.
   * 
   * This method:
   * 1. Loads credentials from cc-mirror's credential store
   * 2. Delegates OAuth token refresh to library
   * 3. Fetches GCP shadow project ID (cached by library)
   * 4. Maps response fields to cc-mirror format
   * 
   * @param accountId - cc-mirror account identifier (format: "antigravity-{hash}")
   * @returns Authentication result with access token and project ID
   * @throws AuthenticationError if OAuth fails
   * @throws ProjectIDError if project ID fetch fails
   * 
   * @example
   * ```typescript
   * const result = await adapter.authenticate('antigravity-abc123');
   * // result.accessToken = "ya29.a0AfH6..." (1 hour TTL)
   * // result.projectId = "vertical-ability-f3lbr"
   * // result.tier = { id: "standard-tier", ... }
   * ```
   */
  authenticate(accountId: string): Promise<AuthResult>;
  
  /**
   * Make authenticated request to Antigravity model.
   * 
   * Handles:
   * - Account selection (via library's AccountManager)
   * - Dual quota routing (Antigravity → fallback to Gemini CLI)
   * - Circuit breaker protection
   * - Automatic retry with account rotation on 429
   * 
   * @param model - Model identifier (e.g., "antigravity-gemini-3-pro-high")
   * @param payload - Request payload in cc-mirror format
   * @param options - Optional: account override, timeout, etc.
   * @returns Model response in cc-mirror format
   * @throws RateLimitError if all accounts exhausted
   * @throws ModelError if model inference fails
   * 
   * @example
   * ```typescript
   * const response = await adapter.makeRequest(
   *   'antigravity-gemini-3-pro-high',
   *   { messages: [...], temperature: 0.7 }
   * );
   * console.log(response.content); // AI-generated text
   * ```
   */
  makeRequest(
    model: string,
    payload: CCMirrorRequestPayload,
    options?: RequestOptions
  ): Promise<CCMirrorResponse>;
  
  /**
   * Select next available account for request.
   * 
   * Uses library's AccountManager to handle:
   * - Round-robin rotation
   * - Skipping rate-limited accounts
   * - Recovering from circuit breaker open state
   * 
   * @returns Account ID to use for next request
   * @throws NoAccountsAvailableError if all accounts unavailable
   * 
   * @internal - Called by makeRequest(), not exposed publicly
   */
  private selectAccount(): Promise<string>;
  
  /**
   * Handle authentication errors and activate Safe Mode if needed.
   * 
   * Tracks failures and activates Safe Mode after threshold (5 failures in 5 minutes).
   * 
   * @param error - Error from library
   * @param accountId - Account that failed
   * @throws Translated error for cc-mirror UX
   * 
   * @internal
   */
  private handleAuthError(error: LibraryError, accountId: string): Promise<never>;
}

/**
 * Options for makeRequest()
 */
export interface RequestOptions {
  accountId?: string;        // Override account selection
  timeout?: number;          // Request timeout (default: 30000ms)
  retries?: number;          // Max retries (default: 3)
  bypassCircuitBreaker?: boolean;  // For testing only
}
Implementation Guide (Step-by-Step)
Step 1: Constructor - Initialize Library Components

typescript
constructor(
  private credentialStore: CredentialStore,
  private config: AntigravityConfig,
  private logger: Logger
) {
  // Initialize library components (they're stateless, safe to reuse)
  this.oauthClient = new OAuthClient({
    clientId: 'YOUR_GOOGLE_OAUTH_CLIENT_ID',  // From config
    clientSecret: 'YOUR_SECRET',
    redirectUri: 'http://localhost:8080/callback'
  });
  
  this.projectIdBootstrapper = new ProjectIDBootstrapper({
    oauthClient: this.oauthClient,
    cacheTTL: this.config.cache.projectIdTTL  // 1 hour default
  });
  
  this.accountManager = new AccountManager({
    rotationStrategy: 'round-robin'
  });
  
  this.quotaRouter = new DualQuotaRouter({
    antigravityEndpoint: 'https://autopush.aistudio.google.com',
    geminiCLIEndpoint: 'https://generativelanguage.googleapis.com'
  });
  
  // Initialize our helpers
  this.fieldMapper = new FieldMapper();
  this.errorTranslator = new ErrorTranslator(logger);
}
Step 2: authenticate() - Main Authentication Method

typescript
async authenticate(accountId: string): Promise<AuthResult> {
  this.logger.info('Starting authentication', { accountId });
  
  try {
    // 1. Load credentials from cc-mirror store
    const credentials = await this.credentialStore.get(accountId);
    if (!credentials) {
      throw new AuthenticationError(`Account not found: ${accountId}`, accountId);
    }
    
    // 2. Convert to library format
    const libraryAccount = this.toLibraryAccount(credentials);
    
    // 3. Get access token (library handles refresh)
    const accessToken = await this.oauthClient.getAccessToken(
      libraryAccount.refreshToken
    );
    this.logger.debug('Access token obtained', { 
      accountId, 
      expiresIn: 3600  // 1 hour
    });
    
    // 4. Fetch project ID (library handles caching)
    const projectResponse = await this.projectIdBootstrapper.fetch(accessToken);
    this.logger.debug('Project ID fetched', { 
      accountId,
      raw: projectResponse  // Log full response for debugging
    });
    
    // 5. Map response fields (CRITICAL: use cloudaicompanionProject, not projectId!)
    const projectId = this.fieldMapper.extractProjectID(projectResponse);
    const tier = this.fieldMapper.extractTier(projectResponse);
    
    // 6. Validate tier eligibility
    this.validateTier(tier, accountId);
    
    // 7. Return cc-mirror format
    return {
      accountId,
      accessToken,
      projectId,
      tier,
      expiresAt: new Date(Date.now() + 3600000)  // 1 hour from now
    };
    
  } catch (error) {
    // Translate library errors to cc-mirror errors
    return this.handleAuthError(error, accountId);
  }
}

/**
 * Convert cc-mirror credentials to library format
 */
private toLibraryAccount(credentials: CCMirrorCredentials): LibraryAccount {
  return {
    id: credentials.accountId,
    refreshToken: credentials.refreshToken,
    email: credentials.email
  };
}

/**
 * Validate user has eligible tier
 */
private validateTier(tier: TierInfo, accountId: string): void {
  const validTiers = ['standard-tier', 'free-tier'];
  if (!validTiers.includes(tier.id)) {
    this.logger.error('Invalid tier', { accountId, tier: tier.id });
    throw new AuthenticationError(
      `Unsupported tier: ${tier.id}. Required: ${validTiers.join(' or ')}`,
      accountId
    );
  }
  
  this.logger.info('Tier validated', { 
    accountId, 
    tier: tier.id, 
    name: tier.name 
  });
}
Step 3: makeRequest() - Model Request Handling

typescript
async makeRequest(
  model: string,
  payload: CCMirrorRequestPayload,
  options: RequestOptions = {}
): Promise<CCMirrorResponse> {
  this.logger.info('Making model request', { model });
  
  try {
    // 1. Select account (use override or auto-select)
    const accountId = options.accountId || await this.selectAccount();
    
    // 2. Authenticate (uses cached token if valid)
    const auth = await this.authenticate(accountId);
    
    // 3. Convert payload to library format
    const libraryPayload = this.toLibraryPayload(payload, model);
    
    // 4. Route request through library (handles dual quota + circuit breaker)
    const libraryResponse = await this.quotaRouter.route({
      model: model.replace('antigravity-', ''),  // Strip prefix
      payload: libraryPayload,
      auth: {
        accessToken: auth.accessToken,
        projectId: auth.projectId
      },
      account: {
        id: accountId,
        email: auth.tier.name  // For logging
      },
      timeout: options.timeout || this.config.timeouts.apiCall
    });
    
    // 5. Convert response back to cc-mirror format
    const ccMirrorResponse = this.toCCMirrorResponse(libraryResponse);
    
    this.logger.info('Request succeeded', { 
      model, 
      accountId, 
      latency: libraryResponse.latency 
    });
    
    return ccMirrorResponse;
    
  } catch (error) {
    // Translate and re-throw
    throw this.errorTranslator.translate(error, { model, accountId: options.accountId });
  }
}

/**
 * Select next available account
 */
private async selectAccount(): Promise<string> {
  const accounts = await this.credentialStore.listAccounts('antigravity');
  
  if (accounts.length === 0) {
    throw new NoAccountsConfiguredError('No Antigravity accounts configured. Run: cc-mirror auth login');
  }
  
  // Library handles rotation + rate limit tracking
  const selected = this.accountManager.selectAccount(
    accounts.map(a => ({
      id: a.accountId,
      refreshToken: a.refreshToken,
      email: a.email
    }))
  );
  
  if (!selected) {
    throw new NoAccountsAvailableError('All accounts are rate-limited. Try again in 60s.');
  }
  
  return selected.id;
}

/**
 * Convert cc-mirror payload to library format
 */
private toLibraryPayload(
  payload: CCMirrorRequestPayload,
  model: string
): LibraryPayload {
  // cc-mirror uses OpenAI-like format:
  // { messages: [{ role, content }], temperature, ... }
  
  // Library expects Gemini format:
  // { contents: [{ parts: [{ text }] }], generationConfig: { temperature } }
  
  return {
    contents: payload.messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    })),
    generationConfig: {
      temperature: payload.temperature || 0.7,
      maxOutputTokens: payload.max_tokens || 4096
    }
  };
}

/**
 * Convert library response to cc-mirror format
 */
private toCCMirrorResponse(response: LibraryResponse): CCMirrorResponse {
  // Library returns Gemini format:
  // { candidates: [{ content: { parts: [{ text }] } }] }
  
  // cc-mirror expects OpenAI-like format:
  // { content: string, usage: { ... } }
  
  const text = response.candidates[0]?.content?.parts[0]?.text || '';
  
  return {
    content: text,
    usage: {
      prompt_tokens: response.usageMetadata?.promptTokenCount || 0,
      completion_tokens: response.usageMetadata?.candidatesTokenCount || 0,
      total_tokens: response.usageMetadata?.totalTokenCount || 0
    },
    model: response.modelVersion || 'unknown'
  };
}
Step 4: Error Handling

typescript
private async handleAuthError(error: any, accountId: string): Promise<never> {
  // Use error translator to map library errors to cc-mirror errors
  const translatedError = this.errorTranslator.translate(error, { accountId });
  
  // Record failure for Safe Mode tracking
  this.failureTracker.record(accountId, translatedError);
  
  // Check if we should activate Safe Mode
  if (this.shouldActivateSafeMode(accountId)) {
    await this.activateSafeMode(accountId, translatedError.message);
  }
  
  // Re-throw the translated error
  throw translatedError;
}

private shouldActivateSafeMode(accountId: string): boolean {
  const failures = this.failureTracker.get(accountId);
  const recentFailures = failures.filter(f => 
    Date.now() - f.timestamp < this.config.safeMode.failureWindow
  );
  return recentFailures.length >= this.config.safeMode.failureThreshold;
}

private async activateSafeMode(accountId: string, reason: string): Promise<void> {
  this.logger.warn('Activating Safe Mode', { accountId, reason });
  
  // Set flag (future requests will use fallback)
  this.safeModeManager.activate(accountId, {
    reason,
    activatedAt: new Date()
  });
  
  // Notify user (if TUI is active)
  this.eventEmitter.emit('safe-mode:activated', { accountId, reason });
}
Error Scenarios
Input	Error Type	User Message	HTTP Status
Invalid accountId	AuthenticationError	"Account not found. Run 'cc-mirror auth login'."	404
Expired refresh token	AuthenticationError	"Session expired. Please re-authenticate."	401
403 from project ID API	ProjectIDError	"AI Premium subscription required. Enable Safe Mode to use Gemini API fallback."	403
404 from project ID API	ProjectIDError	"Antigravity endpoint unavailable. Using Gemini API fallback."	404
429 from model API	RateLimitError	"Rate limited. Retrying in {delay}s..."	429
500 from model API	ModelError	"Google API error. Retrying..."	500
Network timeout	TimeoutError	"Request timed out after {timeout}s. Retrying..."	408
All accounts rate-limited	NoAccountsAvailableError	"All accounts rate-limited. Try again in {min_retry}s or add more accounts."	429
Invalid tier	AuthenticationError	"Unsupported tier: {tier_id}. Required: standard-tier or free-tier."	403
Missing cloudaicompanionProject field	ProjectIDError	"Invalid API response format. Please report this bug."	500
Testing (Given/When/Then Format)
typescript
describe('AntigravityAuthAdapter.authenticate()', () => {
  
  test('GIVEN valid credentials WHEN authenticate called THEN returns AuthResult', async () => {
    // GIVEN
    const accountId = 'antigravity-test123';
    mockCredStore.get.mockResolvedValue({
      accountId,
      refreshToken: 'test-refresh-token',
      email: 'test@example.com'
    });
    mockOAuthClient.getAccessToken.mockResolvedValue('test-access-token');
    mockProjectIDBootstrapper.fetch.mockResolvedValue({
      cloudaicompanionProject: 'vertical-ability-f3lbr',
      currentTier: { id: 'standard-tier', name: 'Gemini Code Assist', userDefinedCloudaicompanionProject: true },
      allowedTiers: [],
      gcpManaged: false
    });
    
    // WHEN
    const result = await adapter.authenticate(accountId);
    
    // THEN
    expect(result).toEqual({
      accountId,
      accessToken: 'test-access-token',
      projectId: 'vertical-ability-f3lbr',
      tier: expect.objectContaining({ id: 'standard-tier' }),
      expiresAt: expect.any(Date)
    });
  });
  
  test('GIVEN missing cloudaicompanionProject field WHEN authenticate called THEN throws ProjectIDError', async () => {
    // GIVEN
    mockProjectIDBootstrapper.fetch.mockResolvedValue({
      projectId: 'wrong-field-name'  // Old assumed field
    });
    
    // WHEN / THEN
    await expect(adapter.authenticate('test')).rejects.toThrow(ProjectIDError);
    await expect(adapter.authenticate('test')).rejects.toThrow('Missing cloudaicompanionProject');
  });
  
  test('GIVEN invalid tier WHEN authenticate called THEN throws AuthenticationError', async () => {
    // GIVEN
    mockProjectIDBootstrapper.fetch.mockResolvedValue({
      cloudaicompanionProject: 'test-project',
      currentTier: { id: 'enterprise-tier', ... }  // Unsupported tier
    });
    
    // WHEN / THEN
    await expect(adapter.authenticate('test')).rejects.toThrow('Unsupported tier: enterprise-tier');
  });
});
Common Mistakes & How to Avoid
Mistake	Why It's Wrong	Correct Approach
Using response.projectId	Field doesn't exist (validated in PoC)	Use response.cloudaicompanionProject
Logging access tokens	Security violation, tokens in logs	Use logger.redact() or filter in middleware
Not awaiting library calls	Library is async, will cause race conditions	Always await every library method
Caching access token in adapter	Library already caches, duplication causes staleness	Let library handle caching
Swallowing errors	Debugging becomes impossible	Always re-throw with context
Hardcoding timeout values	Not configurable, fails in slow networks	Use config.timeouts.*
Blocking event loop	Node.js is single-threaded	Never use fs.readFileSync(), always async
Modifying library objects	Library expects immutable inputs	Clone objects before modification
Code Example (Complete authenticate() Implementation)
typescript
/**
 * Complete working example of authenticate() method
 */
async authenticate(accountId: string): Promise<AuthResult> {
  const startTime = Date.now();
  this.logger.info('authenticate() called', { accountId });
  
  try {
    // Step 1: Load credentials from keytar
    const credentials = await this.credentialStore.get(accountId);
    if (!credentials) {
      throw new AuthenticationError(
        `Account not found: ${accountId}`,
        accountId
      );
    }
    this.logger.debug('Credentials loaded', { 
      accountId, 
      email: credentials.email 
    });
    
    // Step 2: Get access token (library handles refresh)
    const accessToken = await this.oauthClient.getAccessToken(
      credentials.refreshToken
    );
    this.logger.debug('Access token obtained', { 
      accountId,
      tokenLength: accessToken.length,
      expiresIn: 3600
    });
    
    // Step 3: Fetch project ID (library handles caching)
    const projectResponse = await this.projectIdBootstrapper.fetch(accessToken);
    this.logger.debug('Project ID response received', {
      accountId,
      hasProjectId: !!projectResponse.cloudaicompanionProject,
      tier: projectResponse.currentTier?.id
    });
    
    // Step 4: Extract fields using FieldMapper
    const projectId = this.fieldMapper.extractProjectID(projectResponse);
    const tier = this.fieldMapper.extractTier(projectResponse);
    
    // Step 5: Validate tier eligibility
    this.validateTier(tier, accountId);
    
    // Step 6: Log success metrics
    const latency = Date.now() - startTime;
    this.logger.info('authenticate() succeeded', {
      accountId,
      projectId,
      tier: tier.id,
      latency: `${latency}ms`
    });
    
    // Step 7: Return result
    return {
      accountId,
      accessToken,
      projectId,
      tier,
      expiresAt: new Date(Date.now() + 3600000)
    };
    
  } catch (error) {
    const latency = Date.now() - startTime;
    this.logger.error('authenticate() failed', {
      accountId,
      error: error.message,
      latency: `${latency}ms`
    });
    
    // Handle and translate error
    return this.handleAuthError(error, accountId);
  }
}
4.2 FieldMapper (Helper Class)
Responsibility
Extract and validate fields from Google API responses (handles schema changes).

Interface
typescript
/**
 * Maps Google API response fields to cc-mirror format.
 * 
 * Isolated from adapter for easier testing and schema updates.
 */
export class FieldMapper {
  /**
   * Extract project ID from API response.
   * 
   * CRITICAL: Uses 'cloudaicompanionProject' field (validated in PoC).
   * 
   * @param response - Raw response from /v1internal:loadCodeAssist
   * @returns Project ID string
   * @throws ProjectIDError if field missing or invalid format
   */
  extractProjectID(response: ProjectIDResponse): string {
    const projectId = response.cloudaicompanionProject;
    
    if (!projectId) {
      throw new ProjectIDError(
        'Missing cloudaicompanionProject field in API response',
        500
      );
    }
    
    // Validate format (lowercase, hyphens, alphanumeric)
    if (!/^[a-z]+-[a-z]+-[a-z0-9]+$/.test(projectId)) {
      throw new ProjectIDError(
        `Invalid project ID format: ${projectId}`,
        500
      );
    }
    
    return projectId;
  }
  
  /**
   * Extract tier information from API response.
   */
  extractTier(response: ProjectIDResponse): TierInfo {
    const { currentTier } = response;
    
    if (!currentTier) {
      throw new ProjectIDError(
        'Missing currentTier in API response',
        500
      );
    }
    
    return {
      id: currentTier.id,
      name: currentTier.name,
      description: currentTier.description,
      userDefined: currentTier.userDefinedCloudaicompanionProject
    };
  }
}
Implementation
typescript
// File: src/providers/antigravity/adapter/field-mapper.ts

export class FieldMapper {
  extractProjectID(response: ProjectIDResponse): string {
    // Primary field (validated in PoC)
    if (response.cloudaicompanionProject) {
      return this.validateAndReturn(response.cloudaicompanionProject);
    }
    
    // Fallback for old API versions (defensive coding)
    if ((response as any).projectId) {
      console.warn('[FieldMapper] Using deprecated projectId field');
      return this.validateAndReturn((response as any).projectId);
    }
    
    // Error if neither field exists
    throw new ProjectIDError(
      'Missing project ID field in API response. Expected: cloudaicompanionProject',
      500
    );
  }
  
  private validateAndReturn(projectId: string): string {
    // Format: lowercase-words-alphanumeric
    // Example: "vertical-ability-f3lbr"
    const regex = /^[a-z]+-[a-z]+-[a-z0-9]+$/;
    
    if (!regex.test(projectId)) {
      throw new ProjectIDError(
        `Invalid project ID format: "${projectId}". Expected format: "word-word-alphanum"`,
        500
      );
    }
    
    return projectId;
  }
  
  extractTier(response: ProjectIDResponse): TierInfo {
    const { currentTier } = response;
    
    if (!currentTier || !currentTier.id) {
      throw new ProjectIDError(
        'Missing or invalid currentTier in API response',
        500
      );
    }
    
    return {
      id: currentTier.id,
      name: currentTier.name || 'Unknown Tier',
      description: currentTier.description || '',
      userDefined: currentTier.userDefinedCloudaicompanionProject ?? false
    };
  }
}
4.3 ErrorTranslator (Helper Class)
Responsibility
Translate library errors to cc-mirror error types with user-friendly messages.

Interface
typescript
/**
 * Translates errors from opencode-antigravity-auth library to cc-mirror format.
 */
export class ErrorTranslator {
  constructor(private logger: Logger);
  
  /**
   * Translate library error to cc-mirror error.
   * 
   * @param error - Error from library
   * @param context - Additional context (model, accountId, etc.)
   * @returns Translated error
   */
  translate(error: any, context: ErrorContext): Error;
}

interface ErrorContext {
  model?: string;
  accountId?: string;
  operation?: string;
}
Implementation
typescript
// File: src/providers/antigravity/adapter/error-translator.ts

import { 
  AuthenticationError, 
  ProjectIDError, 
  RateLimitError, 
  ModelError,
  TimeoutError
} from '@/providers/antigravity/types';

export class ErrorTranslator {
  constructor(private logger: Logger) {}
  
  translate(error: any, context: ErrorContext): Error {
    // Log original error for debugging
    this.logger.debug('Translating error', {
      originalError: error.message,
      stack: error.stack,
      context
    });
    
    // HTTP errors from Google API
    if (error.status || error.statusCode) {
      return this.translateHTTPError(error, context);
    }
    
    // Library-specific errors
    if (error.name === 'OAuthError') {
      return new AuthenticationError(
        'Authentication failed. Please re-login.',
        context.accountId || 'unknown',
        error
      );
    }
    
    if (error.name === 'CircuitBreakerOpenError') {
      return new RateLimitError(
        'Rate limit protection active. Try again in 30s.',
        30,
        error
      );
    }
    
    // Timeout errors
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      return new TimeoutError(
        `Request timed out after ${error.timeout}ms`,
        error.timeout,
        error
      );
    }
    
    // Network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return new ModelError(
        'Network error. Check your internet connection.',
        0,
        error
      );
    }
    
    // Default: wrap unknown error
    this.logger.warn('Unknown error type', { error, context });
    return new ModelError(
      `Unexpected error: ${error.message}`,
      0,
      error
    );
  }
  
  private translateHTTPError(error: any, context: ErrorContext): Error {
    const status = error.status || error.statusCode;
    const message = error.message || error.data?.error?.message || 'Unknown error';
    
    switch (status) {
      case 400:
        return new ModelError(
          `Invalid request: ${message}`,
          400,
          error
        );
      
      case 401:
        return new AuthenticationError(
          'Session expired. Please re-authenticate.',
          context.accountId || 'unknown',
          error
        );
      
      case 403:
        // Check if it's project ID fetch or model request
        if (context.operation === 'fetchProjectID') {
          return new ProjectIDError(
            'AI Premium subscription required. Enable Safe Mode to use Gemini API fallback.',
            403,
            error
          );
        }
        return new AuthenticationError(
          'Permission denied. Check your account tier.',
          context.accountId || 'unknown',
          error
        );
      
      case 404:
        if (context.operation === 'fetchProjectID') {
          return new ProjectIDError(
            'Antigravity endpoint unavailable. Using Gemini API fallback.',
            404,
            error
          );
        }
        return new ModelError(
          `Model not found: ${context.model}`,
          404,
          error
        );
      
      case 429:
        const retryAfter = parseInt(error.headers?.['retry-after'] || '60', 10);
        return new RateLimitError(
          `Rate limited. Retrying in ${retryAfter}s...`,
          retryAfter,
          error
        );
      
      case 500:
      case 502:
      case 503:
        return new ModelError(
          'Google API error. Retrying...',
          status,
          error
        );
      
      default:
        return new ModelError(
          `HTTP ${status}: ${message}`,
          status,
          error
        );
    }
  }
}

## 🔗 5. Integration Points

### 5.1 Existing Provider Interface (cc-mirror)

**Location:** `src/providers/base-provider.ts` (EXISTING)

```typescript
/**
 * Standard interface all providers must implement
 * Antigravity provider will implement this interface
 */
export interface ProviderInterface {
  // Provider metadata
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly models: string[];
  
  // Authentication
  authenticate(accountId: string): Promise<void>;
  
  // Model inference
  complete(
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): Promise<CompletionResult>;
  
  // Streaming (optional)
  streamComplete?(
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): AsyncGenerator<CompletionChunk>;
  
  // Health checks
  isConfigured(): Promise<boolean>;
  getHealthStatus?(): Promise<ProviderHealthStatus>;
}

/**
 * Message format (OpenAI-compatible)
 */
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

/**
 * Completion options
 */
export interface CompletionOptions {
  temperature?: number;      // 0-2, default 0.7
  maxTokens?: number;        // Max output tokens
  topP?: number;             // 0-1, nucleus sampling
  stopSequences?: string[];  // Stop generation at these sequences
  stream?: boolean;          // Enable streaming
}

/**
 * Completion result
 */
export interface CompletionResult {
  content: string;           // Generated text
  model: string;             // Model used
  finishReason: 'stop' | 'length' | 'error';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

**Integration:** `AntigravityProvider` implements this interface exactly as-is. No changes to existing code needed.

***

### 5.2 Credential Store Integration

**Location:** `src/utils/credential-store.ts` (EXISTING)

```typescript
/**
 * Existing credential store interface (uses keytar internally)
 * Adapter will use this to load/store credentials
 */
export class CredentialStore {
  /**
   * Get credentials for an account
   * 
   * @param accountId - Format: "{provider}-{hash}" (e.g., "antigravity-abc123")
   * @returns Credentials or null if not found
   */
  async get(accountId: string): Promise<Credentials | null>;
  
  /**
   * Store credentials for an account
   * 
   * @param accountId - Account identifier
   * @param credentials - Credentials to store (refresh token, etc.)
   */
  async set(accountId: string, credentials: Credentials): Promise<void>;
  
  /**
   * List all accounts for a provider
   * 
   * @param provider - Provider ID (e.g., "antigravity")
   * @returns Array of account IDs
   */
  async listAccounts(provider: string): Promise<string[]>;
  
  /**
   * Delete an account's credentials
   */
  async delete(accountId: string): Promise<void>;
}

/**
 * Generic credentials format
 */
export interface Credentials {
  accountId: string;
  provider: string;
  refreshToken?: string;     // For OAuth providers
  apiKey?: string;           // For API key providers
  email?: string;            // For display
  metadata?: Record<string, any>;
  createdAt: Date;
  lastUsed: Date;
}
```

**Integration:**

```typescript
// In AntigravityAuthAdapter constructor
constructor(
  private credentialStore: CredentialStore,  // Injected
  // ...
) {
  // Use existing store, no modifications needed
}

// When storing credentials after OAuth
async storeCredentials(accountId: string, refreshToken: string, email: string) {
  await this.credentialStore.set(accountId, {
    accountId,
    provider: 'antigravity',
    refreshToken,
    email,
    metadata: {},
    createdAt: new Date(),
    lastUsed: new Date()
  });
}
```

**No changes to `CredentialStore` class needed.** It already supports any provider.

***

### 5.3 Configuration System Integration

**Location:** `src/config/schema.ts` (MODIFY)

**Existing config schema:**

```typescript
// Current cc-mirror config structure
export interface CCMirrorConfig {
  providers: {
    openai?: OpenAIConfig;
    anthropic?: AnthropicConfig;
    // Add antigravity here
  };
  logging: LoggingConfig;
  ui: UIConfig;
}
```

**Add Antigravity config:**

```typescript
// File: src/config/schema.ts (ADD)
import { z } from 'zod';

// Zod schema for validation
export const AntigravityConfigSchema = z.object({
  enabled: z.boolean().default(false),
  cache: z.object({
    projectIdTTL: z.number().min(60000).max(86400000).default(3600000)  // 1 min to 24 hours
  }).optional(),
  timeouts: z.object({
    authentication: z.number().min(1000).max(30000).default(5000),
    apiCall: z.number().min(5000).max(60000).default(30000)
  }).optional(),
  safeMode: z.object({
    failureThreshold: z.number().min(1).max(10).default(5),
    failureWindow: z.number().min(60000).max(600000).default(300000),
    scope: z.enum(['global', 'per-account']).default('per-account')
  }).optional()
});

// TypeScript type (inferred from schema)
export type AntigravityConfig = z.infer<typeof AntigravityConfigSchema>;

// Add to main config
export interface CCMirrorConfig {
  providers: {
    openai?: OpenAIConfig;
    anthropic?: AnthropicConfig;
    antigravity?: AntigravityConfig;  // ← ADD THIS
  };
  // ... rest unchanged
}
```

**User configuration file:** `~/.cc-mirrorrc.json`

```json
{
  "providers": {
    "openai": { "enabled": true },
    "anthropic": { "enabled": true },
    "antigravity": {
      "enabled": true,
      "cache": {
        "projectIdTTL": 3600000
      },
      "safeMode": {
        "failureThreshold": 5,
        "failureWindow": 300000,
        "scope": "per-account"
      }
    }
  }
}
```

**Migration:** No migration needed. New users will not have `antigravity` key (defaults applied). Existing users unaffected.

***

### 5.4 Logging & Metrics Integration

**Location:** `src/utils/logger.ts` (EXISTING)

```typescript
/**
 * Existing logger interface
 * Adapter will use this for audit trails
 */
export class Logger {
  constructor(private namespace: string);
  
  debug(message: string, metadata?: Record<string, any>): void;
  info(message: string, metadata?: Record<string, any>): void;
  warn(message: string, metadata?: Record<string, any>): void;
  error(message: string, metadata?: Record<string, any>): void;
}
```

**Integration:** Adapter uses logger with namespace `'antigravity'`:

```typescript
// In adapter
this.logger = new Logger('antigravity');

// Logs will appear as:
// [2026-01-08 09:04:12] [antigravity] INFO: Authenticating account {"accountId":"test-123"}
```

**Metrics Endpoints:** (If Prometheus enabled)

```typescript
// New metrics added by adapter
antigravity_auth_total{status="success|failure"}           // Counter
antigravity_auth_latency_seconds                           // Histogram
antigravity_project_id_fetch_total{cached="true|false"}    // Counter
antigravity_safe_mode_activations_total                    // Counter
antigravity_circuit_breaker_opens_total                    // Counter
antigravity_requests_total{model, status}                  // Counter
antigravity_request_latency_seconds{model}                 // Histogram
```

**No changes to logger/metrics system needed.** Adapter emits standard metrics format.

***

### 5.5 CLI Integration

**Location:** `src/cli/commands/auth.ts` (MODIFY)

**Existing command:**

```bash
cc-mirror auth login --provider=openai
```

**Add antigravity support:**

```typescript
// File: src/cli/commands/auth.ts (MODIFY)

import { AntigravityProvider } from '@/providers/antigravity';

// Add to provider switch
async function handleLogin(provider: string): Promise<void> {
  switch (provider) {
    case 'openai':
      await loginOpenAI();
      break;
    case 'anthropic':
      await loginAnthropic();
      break;
    case 'antigravity':  // ← ADD THIS CASE
      await loginAntigravity();
      break;
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// New function
async function loginAntigravity(): Promise<void> {
  console.log('Opening Google OAuth in browser...');
  
  const provider = new AntigravityProvider(config);
  
  // Library handles OAuth flow (opens browser)
  const { accountId, email } = await provider.initOAuth();
  
  console.log(`✓ Authenticated as ${email}`);
  console.log(`  Account ID: ${accountId}`);
  
  // Test authentication
  console.log('Testing authentication...');
  await provider.authenticate(accountId);
  
  console.log('✓ Authentication successful!');
  console.log(`\nYou can now use Antigravity models:`);
  console.log(`  cc-mirror complete --provider=antigravity --model=antigravity-gemini-3-pro-high`);
}
```

**Usage:**

```bash
# User runs
cc-mirror auth login --provider=antigravity

# Output:
# Opening Google OAuth in browser...
# [Browser opens to accounts.google.com]
# ✓ Authenticated as user@example.com
#   Account ID: antigravity-abc123def456
# Testing authentication...
# ✓ Authentication successful!
# 
# You can now use Antigravity models:
#   cc-mirror complete --provider=antigravity --model=antigravity-gemini-3-pro-high
```

***

### 5.6 Integration Summary Table

| System | Location | Modification | Effort |
|--------|----------|--------------|--------|
| **Provider Registry** | `src/config/providers.ts` | Add `antigravity: AntigravityProvider` | 1 line |
| **Config Schema** | `src/config/schema.ts` | Add `AntigravityConfigSchema` | 20 lines |
| **CLI Auth Command** | `src/cli/commands/auth.ts` | Add `case 'antigravity'` + handler | 30 lines |
| **Provider List** | `src/cli/commands/provider.ts` | Auto-detected (no change) | 0 lines |
| **Credential Store** | `src/utils/credential-store.ts` | No changes (already generic) | 0 lines |
| **Logger** | `src/utils/logger.ts` | No changes (already generic) | 0 lines |
| **Metrics** | `src/utils/metrics.ts` | No changes (adapter emits standard format) | 0 lines |

**Total Integration Code: ~50 lines across 3 files.**

***

## 🧪 6. Testing Specifications

### 6.1 Unit Test Cases

#### Test Suite 1: AntigravityAuthAdapter.authenticate()

| Test Case | Given | When | Then | Priority |
|-----------|-------|------|------|----------|
| **Happy path** | Valid credentials, library returns project ID | `authenticate('account-123')` | Returns `AuthResult` with `projectId='vertical-ability-f3lbr'` | P0 |
| **Missing cloudaicompanionProject** | Library returns `{projectId: 'old-field'}` | `authenticate('account-123')` | Throws `ProjectIDError('Missing cloudaicompanionProject')` | P0 |
| **Invalid tier** | Library returns `tier.id='enterprise-tier'` | `authenticate('account-123')` | Throws `AuthenticationError('Unsupported tier')` | P1 |
| **Account not found** | CredentialStore returns null | `authenticate('unknown')` | Throws `AuthenticationError('Account not found')` | P0 |
| **OAuth refresh fails** | Library throws `OAuthError` | `authenticate('account-123')` | Throws `AuthenticationError('Session expired')` | P0 |
| **Project ID 403** | Library throws HTTP 403 | `authenticate('account-123')` | Throws `ProjectIDError('AI Premium required')` | P1 |
| **Project ID 404** | Library throws HTTP 404 | `authenticate('account-123')` | Throws `ProjectIDError('Endpoint unavailable')` | P1 |
| **Cached project ID** | Library returns cached ID (<1ms) | `authenticate('account-123')` (2nd call) | Returns immediately, no API call | P1 |

#### Test Suite 2: AntigravityAuthAdapter.makeRequest()

| Test Case | Given | When | Then | Priority |
|-----------|-------|------|------|----------|
| **Happy path** | Valid auth, library returns response | `makeRequest('gemini-3-pro-high', {...})` | Returns `CCMirrorResponse` with content | P0 |
| **Account rotation** | First account rate-limited | `makeRequest(...)` | Automatically tries second account | P0 |
| **All accounts rate-limited** | All accounts return 429 | `makeRequest(...)` | Throws `NoAccountsAvailableError` | P0 |
| **Circuit breaker open** | Circuit breaker in OPEN state | `makeRequest(...)` | Throws `RateLimitError('Wait 30s')` | P1 |
| **Model not found** | Library throws 404 | `makeRequest('invalid-model', ...)` | Throws `ModelError('Model not found')` | P1 |
| **Timeout** | Library times out after 30s | `makeRequest(...)` | Throws `TimeoutError` | P2 |
| **Retry on 500** | Library throws 500 on 1st try, succeeds on 2nd | `makeRequest(...)` | Returns success after retry | P1 |

#### Test Suite 3: FieldMapper.extractProjectID()

| Test Case | Input | Output | Priority |
|-----------|-------|--------|----------|
| **Valid field** | `{cloudaicompanionProject: 'vertical-ability-f3lbr', ...}` | `'vertical-ability-f3lbr'` | P0 |
| **Missing field** | `{projectId: 'old-field'}` | Throws `ProjectIDError` | P0 |
| **Invalid format (uppercase)** | `{cloudaicompanionProject: 'INVALID-FORMAT'}` | Throws `ProjectIDError` | P1 |
| **Invalid format (no hyphens)** | `{cloudaicompanionProject: 'noHyphens123'}` | Throws `ProjectIDError` | P1 |
| **Empty string** | `{cloudaicompanionProject: ''}` | Throws `ProjectIDError` | P1 |
| **Null value** | `{cloudaicompanionProject: null}` | Throws `ProjectIDError` | P0 |

#### Test Suite 4: ErrorTranslator.translate()

| Test Case | Library Error | Translated Error | User Message | Priority |
|-----------|---------------|------------------|--------------|----------|
| **HTTP 403** | `{status: 403, message: '...'}` | `ProjectIDError` | "AI Premium subscription required" | P0 |
| **HTTP 429** | `{status: 429, headers: {'retry-after': '60'}}` | `RateLimitError` | "Rate limited. Retrying in 60s..." | P0 |
| **OAuth error** | `{name: 'OAuthError', ...}` | `AuthenticationError` | "Session expired. Please re-login." | P0 |
| **Timeout** | `{code: 'ETIMEDOUT', timeout: 30000}` | `TimeoutError` | "Request timed out after 30000ms" | P1 |
| **Unknown error** | `{message: 'Unknown'}` | `ModelError` | "Unexpected error: Unknown" | P2 |

***

### 6.2 Integration Test Scenarios

#### Scenario 1: End-to-End Authentication

```typescript
test('E2E: Authenticate and make request', async () => {
  // Setup: Use real test account
  const accountId = process.env.TEST_ACCOUNT_ID;
  const provider = new AntigravityProvider(realConfig);
  
  // Step 1: Authenticate
  await provider.authenticate(accountId);
  
  // Step 2: Make request
  const result = await provider.complete(
    'antigravity-gemini-3-pro-high',
    [{ role: 'user', content: 'What is 2+2?' }]
  );
  
  // Assertions
  expect(result.content).toContain('4');
  expect(result.usage.totalTokens).toBeGreaterThan(0);
});
```

**Prerequisites:** 3 test accounts with AI Premium, credentials in env vars.

#### Scenario 2: Multi-Account Rotation

```typescript
test('E2E: Automatic account rotation on rate limit', async () => {
  // Setup: 2 accounts, exhaust first account
  const provider = new AntigravityProvider(realConfig);
  
  // Exhaust first account (send 60 requests)
  for (let i = 0; i < 60; i++) {
    await provider.complete('antigravity-gemini-3-flash', testMessages);
  }
  
  // This request should auto-switch to second account
  const result = await provider.complete('antigravity-gemini-3-flash', testMessages);
  
  expect(result).toBeDefined();
  // Verify second account was used (check logs)
});
```

#### Scenario 3: Safe Mode Activation

```typescript
test('E2E: Safe Mode activates after 5 failures', async () => {
  // Setup: Mock project ID endpoint to return 403
  mockGoogleAPI.projectID.mockResponse(403);
  
  const provider = new AntigravityProvider(realConfig);
  
  // Trigger 5 failures
  for (let i = 0; i < 5; i++) {
    try {
      await provider.authenticate('test-account');
    } catch (e) {
      // Expected
    }
  }
  
  // Check Safe Mode activated
  const health = await provider.getHealthStatus();
  expect(health.safeModeActive).toBe(true);
});
```

#### Scenario 4: Circuit Breaker Protection

```typescript
test('E2E: Circuit breaker opens after 3 429 errors', async () => {
  // Setup: Mock to return 429 three times
  mockGoogleAPI.model.mockResponses([429, 429, 429]);
  
  const provider = new AntigravityProvider(realConfig);
  
  // First 3 requests fail with 429
  for (let i = 0; i < 3; i++) {
    await expect(provider.complete('test-model', testMessages))
      .rejects.toThrow(RateLimitError);
  }
  
  // 4th request should fail immediately (circuit open)
  const start = Date.now();
  await expect(provider.complete('test-model', testMessages))
    .rejects.toThrow('circuit');
  const duration = Date.now() - start;
  
  expect(duration).toBeLessThan(100); // No API call made
});
```

***

### 6.3 Mocking Strategies

#### Mock Library Components (Unit Tests)

```typescript
// File: tests/mocks/library-mocks.ts

export function createMockOAuthClient(): jest.Mocked<OAuthClient> {
  return {
    getAccessToken: jest.fn().mockResolvedValue('mock-access-token'),
    refreshToken: jest.fn().mockResolvedValue({
      accessToken: 'new-token',
      expiresIn: 3600
    }),
    initiatLogin: jest.fn()
  };
}

export function createMockProjectIDBootstrapper(): jest.Mocked<ProjectIDBootstrapper> {
  return {
    fetch: jest.fn().mockResolvedValue({
      cloudaicompanionProject: 'vertical-ability-f3lbr',
      currentTier: {
        id: 'standard-tier',
        name: 'Gemini Code Assist',
        userDefinedCloudaicompanionProject: true
      },
      allowedTiers: [],
      gcpManaged: false
    }),
    getCached: jest.fn().mockReturnValue(null),
    invalidateCache: jest.fn()
  };
}

export function createMockAccountManager(): jest.Mocked<AccountManager> {
  return {
    selectAccount: jest.fn().mockReturnValue({
      id: 'account-1',
      refreshToken: 'token-1',
      email: 'test@example.com'
    }),
    markRateLimited: jest.fn(),
    isAvailable: jest.fn().mockReturnValue(true)
  };
}
```

#### Mock Google APIs (Integration Tests)

```typescript
// File: tests/mocks/google-api-mock.ts

import nock from 'nock';

export class GoogleAPIMock {
  mockProjectIDSuccess(projectId: string = 'vertical-ability-f3lbr') {
    nock('https://autopush.aistudio.google.com')
      .post('/v1internal:loadCodeAssist')
      .reply(200, {
        cloudaicompanionProject: projectId,
        currentTier: { id: 'standard-tier', name: 'Gemini Code Assist', userDefinedCloudaicompanionProject: true },
        allowedTiers: [],
        gcpManaged: false
      });
  }
  
  mockProjectID403() {
    nock('https://autopush.aistudio.google.com')
      .post('/v1internal:loadCodeAssist')
      .reply(403, {
        error: {
          code: 403,
          message: 'AI Premium subscription required',
          status: 'PERMISSION_DENIED'
        }
      });
  }
  
  mockModelSuccess(response: string = 'Hello!') {
    nock('https://autopush.aistudio.google.com')
      .post(/\/v1\/models\/.*:generateContent/)
      .reply(200, {
        candidates: [{
          content: { parts: [{ text: response }] }
        }],
        usageMetadata: {
          promptTokenCount: 5,
          candidatesTokenCount: 3,
          totalTokenCount: 8
        }
      });
  }
  
  mockModel429(retryAfter: number = 60) {
    nock('https://autopush.aistudio.google.com')
      .post(/\/v1\/models\/.*:generateContent/)
      .reply(429, {
        error: { code: 429, message: 'Quota exceeded' }
      }, {
        'Retry-After': retryAfter.toString()
      });
  }
  
  cleanup() {
    nock.cleanAll();
  }
}
```

***

### 6.4 Test Coverage Requirements

| Component | Coverage Target | Why |
|-----------|----------------|-----|
| **AntigravityAuthAdapter** | >80% | Core component, many code paths |
| **FieldMapper** | >90% | Critical for schema changes, simple logic |
| **ErrorTranslator** | >80% | Many error types to cover |
| **AntigravityProvider** | >75% | Thin wrapper, mainly delegates |
| **Type definitions** | N/A | No logic to test |
| **Overall** | >80% | Company standard |

**Measure coverage:**

```bash
npm run test:coverage -- antigravity

# Output:
# ----------------------------|---------|----------|---------|---------|
# File                        | % Stmts | % Branch | % Funcs | % Lines |
# ----------------------------|---------|----------|---------|---------|
# antigravity-auth-adapter.ts |   85.23 |    78.12 |   90.00 |   84.56 |
# field-mapper.ts             |   92.31 |    88.89 |  100.00 |   91.67 |
# error-translator.ts         |   81.25 |    75.00 |   85.71 |   80.95 |
# antigravity-provider.ts     |   77.78 |    70.00 |   80.00 |   76.92 |
# ----------------------------|---------|----------|---------|---------|
# All files                   |   82.14 |    76.50 |   87.50 |   81.52 |
# ----------------------------|---------|----------|---------|---------|
```

***

### 6.5 Performance Test Cases

| Test | Target | Measurement |
|------|--------|-------------|
| **authenticate() cold start** | < 1000ms | Time from call to return (no cache) |
| **authenticate() warm start** | < 50ms | Time with cached project ID |
| **makeRequest() latency** | < 2000ms | Time from call to response (Gemini 3 Pro) |
| **Account rotation overhead** | < 100ms | Extra time to switch accounts |
| **Memory usage** | < 50MB | Heap size increase after 100 requests |

**Run performance tests:**

```bash
npm run test:perf -- antigravity

# Output:
# ✓ authenticate() cold start: 894ms (target: <1000ms) PASS
# ✓ authenticate() warm start: 42ms (target: <50ms) PASS
# ✓ makeRequest() latency: 1756ms (target: <2000ms) PASS
# ✓ Memory usage: 38MB (target: <50MB) PASS
```

***

## ✅ 7. Implementation Checklist (Tickets)

### AG-001: Project Setup & Dependencies
**Assigned:** Backend 1  
**Estimated:** 2 hours  
**Dependencies:** None  
**Risks:** None

**Tasks:**
- [ ] Create directory structure (`src/providers/antigravity/...`)
- [ ] Install `opencode-antigravity-auth@1.2.7 --save-exact`
- [ ] Create placeholder files with exports
- [ ] Update `tsconfig.json` paths if needed
- [ ] Run `npm run build` → should compile with no errors
- [ ] Run `npm test` → existing tests should pass

**Definition of Done:**
- ✅ `npm install` completes successfully
- ✅ `npm run build` completes with no TypeScript errors
- ✅ All existing tests pass
- ✅ Directory structure matches TDD Section 2.1

**Blockers:** None (can work offline)

***

### AG-002: Type Definitions
**Assigned:** Backend 1  
**Estimated:** 1 hour  
**Dependencies:** AG-001  
**Risks:** None

**Tasks:**
- [ ] Create `types/antigravity-types.ts`
- [ ] Define all interfaces from TDD Section 4.5
- [ ] Add JSDoc comments
- [ ] Export via `types/index.ts`
- [ ] Run `npx tsc --noEmit` → should compile

**Definition of Done:**
- ✅ All types compile without errors
- ✅ Types imported successfully in other files
- ✅ JSDoc appears in IDE hover tooltips

**Blockers:** None

***

### AG-003: FieldMapper Implementation
**Assigned:** Backend 1  
**Estimated:** 2 hours  
**Dependencies:** AG-002  
**Risks:** Low (simple logic)

**Tasks:**
- [ ] Create `adapter/field-mapper.ts`
- [ ] Implement `extractProjectID()` with validation
- [ ] Implement `extractTier()`
- [ ] Write unit tests (TDD Section 6.1, Test Suite 3)
- [ ] Run tests → should pass

**Definition of Done:**
- ✅ `extractProjectID()` handles valid/invalid inputs correctly
- ✅ Unit tests pass (>90% coverage)
- ✅ Edge cases handled (null, empty, wrong format)

**Blockers:** None

***

### AG-004: ErrorTranslator Implementation
**Assigned:** Backend 1 or Backend 2 (parallel)  
**Estimated:** 2 hours  
**Dependencies:** AG-002  
**Risks:** Low

**Tasks:**
- [ ] Create `adapter/error-translator.ts`
- [ ] Implement `translate()` method
- [ ] Handle all error types (TDD Section 6.1, Test Suite 4)
- [ ] Write unit tests
- [ ] Run tests → should pass

**Definition of Done:**
- ✅ All library errors mapped correctly
- ✅ User messages are user-friendly
- ✅ Unit tests pass (>80% coverage)

**Blockers:** None

***

### AG-005: AntigravityAuthAdapter - authenticate()
**Assigned:** Backend 1  
**Estimated:** 4 hours  
**Dependencies:** AG-003, AG-004  
**Risks:** **HIGH** - Library API might differ from docs

**Mitigation:**
- Pair with Architect for first hour
- Use real test account to validate
- Add extensive logging for debugging

**Tasks:**
- [ ] Create `adapter/antigravity-auth-adapter.ts`
- [ ] Implement constructor (initialize library components)
- [ ] Implement `authenticate()` method (TDD Section 4.1, Step 2)
- [ ] Integrate FieldMapper and ErrorTranslator
- [ ] Write unit tests (TDD Section 6.1, Test Suite 1)
- [ ] Test with real account → should return valid project ID

**Definition of Done:**
- ✅ `authenticate()` returns `AuthResult` with correct fields
- ✅ Unit tests pass (>80% coverage)
- ✅ Integration test with real account succeeds
- ✅ Errors translated correctly

**Blockers:**
- Test accounts might not have AI Premium (verify before starting)

***

### AG-006: AntigravityAuthAdapter - makeRequest()
**Assigned:** Backend 1  
**Estimated:** 4 hours  
**Dependencies:** AG-005  
**Risks:** Medium - Account rotation logic complex

**Tasks:**
- [ ] Implement `makeRequest()` method (TDD Section 4.1, Step 3)
- [ ] Implement `selectAccount()` private method
- [ ] Integrate library's DualQuotaRouter
- [ ] Implement payload/response conversion
- [ ] Write unit tests (TDD Section 6.1, Test Suite 2)
- [ ] Test with real account → should get model response

**Definition of Done:**
- ✅ `makeRequest()` returns valid model response
- ✅ Account rotation works (test with 2 accounts)
- ✅ Unit tests pass (>80% coverage)
- ✅ Payload conversion correct (OpenAI → Gemini format)

**Blockers:** None

***

### AG-007: AntigravityProvider Wrapper
**Assigned:** Backend 2  
**Estimated:** 2 hours  
**Dependencies:** AG-006  
**Risks:** Low (thin wrapper)

**Tasks:**
- [ ] Create `antigravity-provider.ts`
- [ ] Implement `ProviderInterface` (TDD Section 4.4)
- [ ] Wire up adapter instance
- [ ] Implement health status methods
- [ ] Write unit tests (TDD Section 4.4, Test Spec)
- [ ] Run tests → should pass

**Definition of Done:**
- ✅ Provider implements all `ProviderInterface` methods
- ✅ Unit tests pass (>75% coverage)
- ✅ `getHealthStatus()` returns correct status

**Blockers:** None

***

### AG-008: Provider Registration
**Assigned:** Backend 2  
**Estimated:** 1 hour  
**Dependencies:** AG-007  
**Risks:** None

**Tasks:**
- [ ] Update `src/config/providers.ts` (add to registry)
- [ ] Update `src/config/schema.ts` (add config schema)
- [ ] Update `src/cli/commands/auth.ts` (add login handler)
- [ ] Test CLI command → should open OAuth flow

**Definition of Done:**
- ✅ `cc-mirror provider list` shows "antigravity"
- ✅ `cc-mirror auth login --provider=antigravity` works
- ✅ Config validates correctly

**Blockers:** None

***

### AG-009: Integration Tests
**Assigned:** Backend 1  
**Estimated:** 3 hours  
**Dependencies:** AG-008  
**Risks:** Medium - Requires test accounts

**Tasks:**
- [ ] Create `tests/integration/antigravity-e2e.test.ts`
- [ ] Implement Scenario 1 (E2E auth + request)
- [ ] Implement Scenario 2 (Multi-account rotation)
- [ ] Implement Scenario 3 (Safe Mode)
- [ ] Run with real accounts → should pass

**Definition of Done:**
- ✅ All integration scenarios pass
- ✅ Tests run in CI (with test account credentials)
- ✅ Performance targets met (TDD Section 6.5)

**Blockers:**
- Need 3 test accounts with AI Premium (from ops team)

***

### AG-010: Documentation & Cleanup
**Assigned:** Backend 2  
**Estimated:** 2 hours  
**Dependencies:** AG-009  
**Risks:** None

**Tasks:**
- [ ] Write user-facing docs (`docs/antigravity-setup.md`)
- [ ] Update main README with Antigravity section
- [ ] Add inline code comments
- [ ] Run linter → fix any issues
- [ ] Remove debug logs

**Definition of Done:**
- ✅ User docs complete (setup, usage, troubleshooting)
- ✅ Code comments added to complex functions
- ✅ Linter passes with no warnings
- ✅ No `console.log()` statements in production code

**Blockers:** None

***

### Ticket Summary

| Ticket | Assignee | Hours | Dependencies | Can Parallelize? |
|--------|----------|-------|--------------|------------------|
| AG-001 | Backend 1 | 2 | None | No |
| AG-002 | Backend 1 | 1 | AG-001 | No |
| AG-003 | Backend 1 | 2 | AG-002 | No |
| AG-004 | Backend 2 | 2 | AG-002 | ✅ Yes (with AG-003) |
| AG-005 | Backend 1 | 4 | AG-003, AG-004 | No |
| AG-006 | Backend 1 | 4 | AG-005 | No |
| AG-007 | Backend 2 | 2 | AG-006 | No |
| AG-008 | Backend 2 | 1 | AG-007 | No |
| AG-009 | Backend 1 | 3 | AG-008 | No |
| AG-010 | Backend 2 | 2 | AG-009 | ✅ Yes (can start earlier) |
| **Total** | | **23 hours** | | **~2.5 days (1 dev) or 1.5 days (2 devs)** |

***

## 🔍 8. Code Review Checklist

Use this checklist when reviewing PRs for this feature.

### 8.1 Security Requirements

- [ ] **No tokens logged:** Access tokens/refresh tokens never appear in logs
- [ ] **Tokens redacted:** Logger middleware filters `Authorization` header
- [ ] **Keytar used:** Refresh tokens stored in OS keychain, not disk
- [ ] **HTTPS only:** All API calls use `https://`, never `http://`
- [ ] **Input validation:** All user inputs validated (account IDs, model names)
- [ ] **No secrets in code:** Client IDs/secrets loaded from config, not hardcoded
- [ ] **Error messages safe:** Error messages don't leak sensitive data

### 8.2 Performance Requirements

- [ ] **No blocking calls:** All I/O operations use async/await
- [ ] **Timeouts set:** All API calls have timeouts (5s auth, 30s model)
- [ ] **Caching used:** Project IDs cached (1 hour TTL)
- [ ] **No memory leaks:** Event listeners cleaned up
- [ ] **No infinite loops:** Retry logic has max attempts
- [ ] **Efficient data structures:** Use Maps for O(1) lookups, not arrays

### 8.3 Error Handling Requirements

- [ ] **All errors caught:** No unhandled promise rejections
- [ ] **Errors translated:** Library errors mapped to cc-mirror errors
- [ ] **Context preserved:** Errors include account ID, model, etc.
- [ ] **User-friendly messages:** Error messages actionable for users
- [ ] **Logged properly:** Errors logged with stack traces
- [ ] **Retry logic:** Transient errors (429, 500, timeout) retried
- [ ] **Circuit breaker:** Rate limits trigger circuit breaker

### 8.4 Test Coverage Requirements

- [ ] **Unit tests exist:** All public methods have unit tests
- [ ] **Edge cases covered:** Null, empty, invalid inputs tested
- [ ] **Mocks used:** Library components mocked in unit tests
- [ ] **Integration tests:** At least 2 E2E scenarios tested
- [ ] **Coverage >80%:** Run `npm run test:coverage`
- [ ] **Tests pass:** All tests pass locally and in CI

### 8.5 Code Quality Requirements

- [ ] **TypeScript strict:** No `any` types (use `unknown` if needed)
- [ ] **JSDoc comments:** All public methods documented
- [ ] **Consistent naming:** Follows TDD Section 2.2 conventions
- [ ] **No console.log:** Use `logger.debug/info/warn/error`
- [ ] **Linter passes:** No ESLint warnings
- [ ] **Formatted:** Prettier applied

### 8.6 Integration Requirements

- [ ] **Implements ProviderInterface:** Provider matches interface exactly
- [ ] **Config schema valid:** Zod schema validates correctly
- [ ] **CLI works:** `cc-mirror auth login --provider=antigravity` works
- [ ] **Provider listed:** Shows in `cc-mirror provider list`
- [ ] **Metrics emitted:** Prometheus metrics emitted correctly

***

## 📋 9. Known Gaps & Assumptions

### 9.1 Gaps (Things We Don't Know Yet)

| Gap | Impact | Resolution Plan | Owner |
|-----|--------|-----------------|-------|
| **Rate limit for `/v1internal:loadCodeAssist`** | Medium | Measure in AG-009 (burst test 100 calls) | Backend 1 |
| **Do project IDs ever change?** | Low | Monitor same account over 7 days | Ops Team |
| **What happens if `gcpManaged: true`?** | Low | Test with Google Workspace account in Sprint 7 | Backend 1 |
| **Are there other tier IDs?** | Low | Document as encountered | Backend 1 |
| **Optimal cache TTL for project IDs** | Medium | Test 1hr vs 24hr in Sprint 7 | Backend 1 |
| **Library's circuit breaker threshold** | Low | Documented as 3 failures, verify in tests | Backend 1 |
| **Does library handle token refresh errors?** | High | Test with expired refresh token in AG-005 | Backend 1 |

### 9.2 Assumptions (Things We're Betting On)

| Assumption | Risk | Validation | Contingency |
|------------|------|------------|-------------|
| **Library's CircuitBreaker works as documented** | Medium | Test in AG-006 with forced 429 errors | Implement our own if broken |
| **`cloudaicompanionProject` field never null** | High | Add null check in FieldMapper | Fallback to error with Safe Mode |
| **Library handles OAuth refresh automatically** | High | Test in AG-005 with expired token | Implement manual refresh if needed |
| **Gemini CLI endpoint always available** | Medium | Test Safe Mode fallback in AG-009 | Document manual API key setup |
| **keytar works on all platforms** | Medium | Test on Linux/Mac/Windows in QA | Fallback to encrypted file if keytar fails |
| **Test accounts have AI Premium** | High | Verify with ops team before AG-005 | Request AI Premium access if needed |
| **Library's account rotation is round-robin** | Low | Verify in AG-006 with logs | Acceptable if different strategy |
| **Project IDs stable for 1 hour** | Medium | Validated in PoC, recheck in prod | Reduce TTL to 15min if unstable |

### 9.3 Decisions Deferred to Sprint 7

| Decision | Why Deferred | Sprint 7 Plan |
|----------|-------------|---------------|
| **Redis-backed circuit breaker** | Not needed for 5 internal users | Implement if >50 users |
| **Persistent project ID cache** | In-memory sufficient for now | Evaluate if cold start >2s |
| **Streaming support** | Library supports it, but low priority | Add if users request |
| **Multiple Safe Mode scopes** | Per-account sufficient | Add global scope if needed |
| **Admin CLI tools** | Nice-to-have, not critical | Add if ops team requests |

***

## 📚 10. Appendices

### 10.1 Library API Quick Reference

```typescript
// Quick reference for opencode-antigravity-auth library

// OAuth Client
class OAuthClient {
  getAccessToken(refreshToken: string): Promise<string>;
  // Returns: "ya29.a0AfH6..." (1 hour TTL)
}

// Project ID Bootstrapper
class ProjectIDBootstrapper {
  fetch(accessToken: string): Promise<ProjectIDResponse>;
  // Returns: { cloudaicompanionProject: "vertical-ability-f3lbr", ... }
  // Cached for 1 hour by default
}

// Account Manager
class AccountManager {
  selectAccount(accounts: Account[]): Account | null;
  // Returns: Next available account (round-robin, skips rate-limited)
  
  markRateLimited(accountId: string, retryAfter: number): void;
  // Marks account as unavailable for N seconds
}

// Dual Quota Router
class DualQuotaRouter {
  route(request: RouteRequest): Promise<Response>;
  // Tries Antigravity endpoint → falls back to Gemini CLI on error
}
```

### 10.2 Google API Response Examples

**Success Response (v1internal:loadCodeAssist):**

```json
{
  "cloudaicompanionProject": "vertical-ability-f3lbr",
  "currentTier": {
    "id": "standard-tier",
    "name": "Gemini Code Assist",
    "description": "Unlimited coding assistant with the most powerful Gemini models",
    "userDefinedCloudaicompanionProject": true
  },
  "allowedTiers": [
    {
      "id": "standard-tier",
      "name": "Gemini Code Assist",
      "description": "Unlimited coding assistant"
    },
    {
      "id": "free-tier",
      "name": "Gemini Free",
      "description": "Limited access"
    }
  ],
  "gcpManaged": false
}
```

**Error Response (403):**

```json
{
  "error": {
    "code": 403,
    "message": "AI Premium subscription required",
    "status": "PERMISSION_DENIED",
    "details": [
      {
        "reason": "SUBSCRIPTION_REQUIRED",
        "domain": "aistudio.googleapis.com"
      }
    ]
  }
}
```

### 10.3 Debugging Common Issues

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **"Cannot find module 'opencode-antigravity-auth'"** | Import fails | Run `npm install`, check `node_modules/` |
| **"Missing cloudaicompanionProject field"** | Project ID fetch fails | Check FieldMapper implementation, log raw response |
| **"Session expired"** | 401 errors | Library should auto-refresh; check refresh token in keytar |
| **"All accounts rate-limited"** | No requests succeed | Wait for `retryAfter` period or add more accounts |
| **Tests hang** | Jest times out | Check for missing `await`, increase timeout in jest.config |
| **"Circuit breaker opened"** | Requests blocked | Wait 30s for recovery or manually reset |
| **Memory leak** | Memory usage grows | Check for unhandled event listeners, profile with `--inspect` |
| **Slow authentication** | >2s latency | Check network, verify cache working |

***

