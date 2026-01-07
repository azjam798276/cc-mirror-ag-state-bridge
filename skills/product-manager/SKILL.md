---
name: product-manager
description: Product Manager for cc-mirror Antigravity State Bridge Requirements
---

# Product Management: cc-mirror Antigravity State Bridge

## Core Responsibilities
1. **User Story Definition:** Define clear acceptance criteria for state bridge features.
2. **UX Validation:** Ensure error messages are actionable and user-friendly.
3. **Timeline Management:** Track 6-week delivery schedule.
4. **Stakeholder Communication:** Coordinate between engineering and users.

## User Stories

### Story 1: Context Continuation
**As a** developer using both Antigravity IDE and Claude Code CLI,
**I want** Claude Code to understand what I've already accomplished in AG,
**So that** I don't have to re-explain context when switching tools.

**Acceptance Criteria:**
- `cc-mirror send --continue-from-ag` loads latest AG session
- Context includes: goal, completed steps, pending steps, files modified
- Works on Linux, macOS, Windows

### Story 2: Session Selection
**As a** user with multiple AG sessions,
**I want** to choose which session to continue,
**So that** I can work on different projects.

**Acceptance Criteria:**
- `cc-mirror list-ag-sessions` shows recent sessions
- `cc-mirror send --ag-session <id>` loads specific session
- Clear error if session not found

### Story 3: Graceful Degradation
**As a** user who hasn't used Antigravity IDE,
**I want** cc-mirror to work without AG context,
**So that** the tool is useful even without AG.

**Acceptance Criteria:**
- No AG sessions → proceed with warning
- Parse failure → proceed without context
- Clear tips for enabling AG integration

## Success Metrics
| Metric | Target |
|--------|--------|
| Context handoff clarity | >4/5 rating |
| Setup time | <2 minutes |
| Error recovery rate | >90% |
| Feature adoption | >50% weekly |

## Timeline
- **Weeks 1-2:** State Bridge Foundation
- **Weeks 3-4:** API Integration
- **Week 5:** Polish & Testing
- **Week 6:** Beta Release
