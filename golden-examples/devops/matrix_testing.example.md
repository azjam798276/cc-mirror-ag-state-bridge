---
id: "cross_platform_github_actions_matrix"
source: "cc-mirror Antigravity State Bridge TDD v1.0"
tags: ["devops", "ci-cd", "github-actions", "testing", "cross-platform"]
---

## Problem

Need to ensure cc-mirror works correctly across multiple operating systems (Linux, macOS, Windows) and Node.js versions (18, 20, 22) before releasing. Manual testing on all combinations is time-consuming and error-prone. GitHub Actions matrix strategy can parallelize this, but requires careful handling of platform-specific differences (keychain access, path separators, environment variables).

## Solution

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  # Allow manual trigger
  workflow_dispatch:

# Cancel in-progress runs for same branch
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # ===== JOB 1: LINT & TYPE CHECK =====
  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Run TypeScript compiler
        run: npm run type-check

      - name: Check formatting (Prettier)
        run: npm run format:check

  # ===== JOB 2: UNIT TESTS (Matrix) =====
  test-unit:
    name: Unit Tests (${{ matrix.os }}, Node ${{ matrix.node }})
    runs-on: ${{ matrix.os }}
    
    strategy:
      # Don't cancel other matrix jobs if one fails
      fail-fast: false
      
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: ['18', '20', '22']
        
        # Optional: exclude specific combinations
        # exclude:
        #   - os: windows-latest
        #     node: '18'
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: 'npm'

      # Windows: Install required build tools for native modules (keytar)
      - name: Install Windows build tools
        if: runner.os == 'Windows'
        run: |
          npm install --global windows-build-tools
          npm config set msvs_version 2019
        shell: powershell

      # macOS: Ensure keychain access libraries are available
      - name: Setup macOS keychain dependencies
        if: runner.os == 'macOS'
        run: |
          # No action needed - Keychain Access is built-in
          echo "macOS keychain ready"

      # Linux: Install libsecret for keychain support
      - name: Install Linux keychain dependencies
        if: runner.os == 'Linux'
        run: |
          sudo apt-get update
          sudo apt-get install -y libsecret-1-dev

      - name: Install dependencies
        run: npm ci

      # Build TypeScript (if not pre-compiled)
      - name: Build project
        run: npm run build

      # Run unit tests with coverage
      - name: Run unit tests
        run: npm run test:unit -- --coverage
        env:
          # Set CI flag for Jest
          CI: true
          # Disable interactive prompts
          NO_COLOR: 1

      # Upload coverage to Codecov (only on Linux + Node 20)
      - name: Upload coverage to Codecov
        if: matrix.os == 'ubuntu-latest' && matrix.node == '20'
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/coverage-final.json
          flags: unit
          name: unit-tests-${{ matrix.os }}-node${{ matrix.node }}

  # ===== JOB 3: INTEGRATION TESTS =====
  test-integration:
    name: Integration Tests (${{ matrix.os }})
    runs-on: ${{ matrix.os }}
    
    # Only run integration on one Node version (latest)
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      # Platform-specific setup (same as unit tests)
      - name: Install Windows build tools
        if: runner.os == 'Windows'
        run: |
          npm install --global windows-build-tools
          npm config set msvs_version 2019
        shell: powershell

      - name: Install Linux keychain dependencies
        if: runner.os == 'Linux'
        run: |
          sudo apt-get update
          sudo apt-get install -y libsecret-1-dev

      - name: Install dependencies
        run: npm ci

      - name: Build project
        run: npm run build

      # Create mock Antigravity session directory
      - name: Setup test environment
        run: |
          mkdir -p $HOME/.antigravity/sessions
          echo '{"goal":"test"}' > $HOME/.antigravity/sessions/test-session.json
        shell: bash

      # Run integration tests
      - name: Run integration tests
        run: npm run test:integration
        env:
          CI: true
          NO_COLOR: 1
          # Mock OAuth credentials for testing
          TEST_MODE: true

      # Upload test results (JUnit XML)
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results-${{ matrix.os }}
          path: test-results/
          retention-days: 7

  # ===== JOB 4: SECURITY AUDIT =====
  security:
    name: Security Audit
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      # Check for vulnerabilities
      - name: Run npm audit
        run: npm audit --audit-level=moderate
        continue-on-error: true

      # Check for outdated dependencies
      - name: Check for outdated packages
        run: npm outdated || true

  # ===== JOB 5: BUILD TEST (Ensure package can be built) =====
  build:
    name: Build Package
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build distribution package
        run: npm run build

      - name: Pack package (dry-run publish)
        run: npm pack

      # Upload built package as artifact
      - name: Upload package artifact
        uses: actions/upload-artifact@v4
        with:
          name: npm-package
          path: '*.tgz'
          retention-days: 7

  # ===== JOB 6: REQUIRED CHECKS (Aggregate) =====
  required-checks:
    name: All Required Checks Passed
    runs-on: ubuntu-latest
    needs: [lint, test-unit, test-integration, security, build]
    
    # This job only runs if all dependencies succeed
    steps:
      - name: All checks passed
        run: echo "✅ All required checks passed!"
```

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*.*.*'  # Trigger on version tags (v1.0.0, v2.1.3, etc.)

jobs:
  # ===== RELEASE BUILD =====
  release:
    name: Build and Publish Release
    runs-on: ubuntu-latest
    
    permissions:
      contents: write  # For creating releases
      packages: write  # For publishing to npm
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Fetch all history for changelog

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      # Extract version from tag (v1.2.3 -> 1.2.3)
      - name: Get version from tag
        id: version
        run: |
          TAG=${GITHUB_REF#refs/tags/v}
          echo "version=$TAG" >> $GITHUB_OUTPUT
          echo "tag=$GITHUB_REF_NAME" >> $GITHUB_OUTPUT

      # Verify package.json version matches tag
      - name: Verify version match
        run: |
          PACKAGE_VERSION=$(node -p "require('./package.json').version")
          if [ "$PACKAGE_VERSION" != "${{ steps.version.outputs.version }}" ]; then
            echo "❌ Version mismatch: package.json=$PACKAGE_VERSION, tag=${{ steps.version.outputs.version }}"
            exit 1
          fi
          echo "✅ Version verified: $PACKAGE_VERSION"

      # Build project
      - name: Build project
        run: npm run build

      # Run tests one final time
      - name: Run tests
        run: npm test

      # Publish to npm
      - name: Publish to npm
        run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      # Generate changelog from commits since last tag
      - name: Generate changelog
        id: changelog
        run: |
          PREVIOUS_TAG=$(git describe --abbrev=0 --tags $(git rev-list --tags --skip=1 --max-count=1) 2>/dev/null || echo "")
          
          if [ -z "$PREVIOUS_TAG" ]; then
            CHANGELOG=$(git log --pretty=format:"- %s (%h)" ${{ steps.version.outputs.tag }})
          else
            CHANGELOG=$(git log --pretty=format:"- %s (%h)" $PREVIOUS_TAG..${{ steps.version.outputs.tag }})
          fi
          
          echo "changelog<<EOF" >> $GITHUB_OUTPUT
          echo "$CHANGELOG" >> $GITHUB_OUTPUT
          echo "EOF" >> $GITHUB_OUTPUT

      # Create GitHub release
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          tag_name: ${{ steps.version.outputs.tag }}
          name: Release ${{ steps.version.outputs.version }}
          body: |
            ## Changes in ${{ steps.version.outputs.version }}
            
            ${{ steps.changelog.outputs.changelog }}
            
            ## Installation
            
            ```bash
            npm install -g cc-mirror@${{ steps.version.outputs.version }}
            ```
            
            ## Documentation
            
            See [README.md](https://github.com/${{ github.repository }}/blob/${{ steps.version.outputs.tag }}/README.md)
          draft: false
          prerelease: ${{ contains(steps.version.outputs.version, '-') }}  # Pre-release if version has hyphen (1.0.0-beta.1)
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      # Notify on success (optional)
      - name: Notify release success
        if: success()
        run: |
          echo "🎉 Released cc-mirror v${{ steps.version.outputs.version }} to npm!"
          echo "📦 https://www.npmjs.com/package/cc-mirror/v/${{ steps.version.outputs.version }}"
          echo "🔖 https://github.com/${{ github.repository }}/releases/tag/${{ steps.version.outputs.tag }}"
```

```yaml
# .github/dependabot.yml
version: 2
updates:
  # Keep npm dependencies up to date
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
      timezone: "Asia/Singapore"
    
    # Group patch updates together
    groups:
      patch-updates:
        patterns:
          - "*"
        update-types:
          - "patch"
    
    # Ignore specific packages (if needed)
    ignore:
      - dependency-name: "keytar"
        update-types: ["version-update:semver-major"]
    
    # Auto-merge minor/patch updates (requires GitHub Actions)
    open-pull-requests-limit: 10
    
    # Prefix commit messages
    commit-message:
      prefix: "chore(deps)"
      include: "scope"
    
    # Assign reviewers
    reviewers:
      - "numman-ali"
    
    # Labels
    labels:
      - "dependencies"
      - "automated"

  # Keep GitHub Actions up to date
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    commit-message:
      prefix: "ci"
    labels:
      - "ci-cd"
      - "automated"
```

```typescript
// scripts/test-platform-specific.ts
/**
 * Platform-specific test helper for CI environments.
 * Handles differences in keychain access, file permissions, etc.
 */

import * as os from 'os';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface PlatformTestConfig {
  canAccessKeychain: boolean;
  homeDir: string;
  configDir: string;
  pathSeparator: string;
  platform: NodeJS.Platform;
}

export function getPlatformTestConfig(): PlatformTestConfig {
  const platform = process.platform;
  const homeDir = os.homedir();

  return {
    canAccessKeychain: canAccessKeychainOnCI(),
    homeDir,
    configDir: getConfigDir(platform, homeDir),
    pathSeparator: path.sep,
    platform
  };
}

function canAccessKeychainOnCI(): boolean {
  // In CI environments, keychain access is usually not available
  if (process.env.CI === 'true') {
    return false;
  }

  // On Linux CI, libsecret might be installed but dbus isn't running
  if (process.platform === 'linux' && process.env.CI) {
    return false;
  }

  return true;
}

function getConfigDir(platform: NodeJS.Platform, homeDir: string): string {
  switch (platform) {
    case 'win32':
      return process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
    case 'darwin':
      return path.join(homeDir, 'Library', 'Application Support');
    case 'linux':
    default:
      return path.join(homeDir, '.config');
  }
}

/**
 * Setup test fixtures for platform-specific tests.
 */
export async function setupPlatformTestFixtures(): Promise<string> {
  const config = getPlatformTestConfig();
  
  // Create temporary test directory
  const testDir = path.join(config.homeDir, '.cc-mirror-test-' + Date.now());
  await fs.ensureDir(testDir);

  // Create mock AG sessions
  const sessionDir = path.join(testDir, 'sessions');
  await fs.ensureDir(sessionDir);

  await fs.writeJSON(path.join(sessionDir, 'test-session.json'), {
    goal: 'Test session',
    plan: { steps: [] }
  });

  return testDir;
}

/**
 * Cleanup test fixtures.
 */
export async function cleanupPlatformTestFixtures(testDir: string): Promise<void> {
  await fs.remove(testDir);
}

// Usage in Jest tests:
beforeAll(async () => {
  const config = getPlatformTestConfig();
  console.log(`Running tests on ${config.platform}`);
  
  if (!config.canAccessKeychain) {
    console.log('⚠️  Keychain access not available in CI, using fallback mode');
  }
});
```

## Key Techniques

- **Matrix strategy**: Test all OS × Node version combinations in parallel. The `fail-fast: false` setting ensures one failure doesn't cancel other jobs.

- **Platform-specific dependencies**: Windows needs build tools for native modules, Linux needs libsecret, macOS works out-of-box. Conditionals (`if: runner.os == 'Windows'`) handle this.

- **Caching**: The `cache: 'npm'` option in `setup-node` caches `node_modules`, speeding up repeated runs by ~2-3 minutes.

- **Artifact uploads**: Test results and built packages are uploaded as artifacts. Retention set to 7 days to avoid storage bloat.

- **Required checks job**: The `required-checks` job depends on all other jobs via `needs`. This provides a single pass/fail status for branch protection rules.

- **Semantic versioning**: Release workflow triggers on `v*.*.*` tags. The version is extracted and verified against `package.json` to catch mistakes.

- **Changelog generation**: Uses `git log` to automatically generate changelogs from commits between tags. Saves manual work.

- **Dependabot grouping**: Groups patch updates together to reduce PR noise. Security updates are created individually for visibility.

- **Concurrency limits**: The `concurrency` group cancels in-progress runs when a new commit is pushed. Saves CI minutes on active branches.

## References

- [GitHub Actions Matrix](https://docs.github.com/en/actions/using-jobs/using-a-matrix-for-your-jobs) - Official docs
- [Cross-platform CI Best Practices](https://github.com/microsoft/vscode/blob/main/.github/workflows/ci.yml) - VS Code's approach
- [Dependabot Configuration](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file) - Official spec
- [Semantic Versioning](https://semver.org/) - Versioning scheme
