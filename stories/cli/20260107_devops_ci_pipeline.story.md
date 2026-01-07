---
id: "20260107_devops_ci_pipeline"
role: "devops-engineer"
difficulty: "medium"
tags: ["ci", "github-actions", "npm", "multi-platform"]
tech_stack: "Node.js 18+, GitHub Actions, npm"
---

# User Story: CI Pipeline for cc-mirror

**As a** maintainer of cc-mirror,
**I want** a CI pipeline that runs on every PR,
**So that** code quality is verified before merge.

## Context & Constraints
- Must run on Linux, macOS, and Windows
- Node.js 18 and 20 LTS versions
- Tests must pass with coverage ≥90%
- ESLint and TypeScript type-checking required

## Acceptance Criteria
1. GitHub Actions workflow triggers on push and pull_request
2. Matrix builds for all OS/Node combinations
3. npm ci, npm test, npm run lint all pass
4. Coverage report uploaded as artifact
5. Build fails if any step fails

## Implementation Hints
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
```
