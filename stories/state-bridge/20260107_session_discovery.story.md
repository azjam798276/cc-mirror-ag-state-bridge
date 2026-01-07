---
id: "20260107_session_discovery"
difficulty: "medium"
tags: ["state-bridge", "filesystem", "typescript", "cross-platform"]
tech_stack: "Node.js 18+, TypeScript 5.x, fs-extra"
---

# User Story
As a developer switching from Antigravity IDE to Claude Code CLI, I want the system to automatically discover my AG sessions, so I can quickly continue my work.

# Context & Constraints
**Interface Requirements (SessionDiscovery):**
```typescript
interface SessionDiscovery {
  findSessions(): Promise<AGSessionMetadata[]>;
  getLatestSession(): Promise<AGSessionMetadata | null>;
  getSessionById(id: string): Promise<AGSessionMetadata | null>;
}

interface AGSessionMetadata {
  sessionId: string;
  filePath: string;
  timestamp: Date;
  sizeBytes: number;
}
```

**Platform Search Paths:**
| Platform | Primary Path | Fallback |
|----------|-------------|----------|
| Linux | `~/.antigravity/sessions/` | `~/.config/antigravity/sessions/` |
| macOS | `~/.antigravity/sessions/` | `~/Library/Application Support/Antigravity/sessions/` |
| Windows | `%APPDATA%/Antigravity/sessions/` | - |

**Performance Thresholds:**
| Metric | Threshold |
|--------|-----------|
| Discovery (100 files) | < 50ms |
| Cache TTL | 60 seconds |

# Acceptance Criteria
- [ ] **Multi-Path Search:** Check all platform-specific paths in order
- [ ] **Environment Override:** Respect `$AG_SESSION_DIR` if set
- [ ] **Metadata Only:** Return file stats without reading content
- [ ] **Sorted Results:** Return sessions sorted by mtime descending
- [ ] **Caching:** Cache results for 60s to avoid redundant I/O
- [ ] **Error Handling:** Skip unreadable files, log warning, continue
- [ ] **Empty State:** Return empty array if no sessions found (no error)
