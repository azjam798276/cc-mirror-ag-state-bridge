---
name: devops-engineer
description: DevOps Engineer for cc-mirror CI/CD and Release Management
---

# DevOps Engineering: cc-mirror State Bridge

## Core Principles
1. **Automated Testing:** CI runs all unit and integration tests on PR.
2. **Multi-Platform:** Build and test on Linux, macOS, Windows.
3. **Semantic Versioning:** Follow semver for releases.
4. **Secure Pipeline:** No secrets in logs; use GitHub Secrets.

## CI/CD Pipeline

### GitHub Actions Workflow
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: [18, 20]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
      - run: npm ci
      - run: npm test
      - run: npm run lint
```

### Release Process
1. Update version in `package.json`
2. Create GitHub Release with changelog
3. npm publish (automated via CI)
4. Update documentation

## Dependency Management
- **Production:** `google-auth-library`, `keytar`, `fs-extra`
- **Dev:** `jest`, `typescript`, `eslint`
- Dependabot enabled for security updates

## Monitoring
- Error tracking (opt-in telemetry)
- Parse failure rates
- OAuth success rates
