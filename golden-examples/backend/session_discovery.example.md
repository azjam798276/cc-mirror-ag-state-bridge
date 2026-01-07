---
id: "session_discovery_with_caching"
source: "cc-mirror Antigravity State Bridge TDD v1.0"
tags: ["typescript", "filesystem", "caching", "performance", "backend"]
---

## Problem

Need to efficiently discover Antigravity IDE session files across multiple OS-specific directories without repeatedly scanning the filesystem on every request. Must handle missing directories gracefully and support custom paths via environment variables.

## Solution

```typescript
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

export interface AGSessionMetadata {
  sessionId: string;
  filePath: string;
  timestamp: Date;
  sizeBytes: number;
  ageString: string;
}

export interface SessionDiscoveryConfig {
  customPath?: string;
  cacheTimeout?: number;
  debug?: boolean;
}

/**
 * Discovers Antigravity IDE session files with intelligent caching.
 * Implements 1-minute cache to avoid repeated filesystem scans.
 */
export class SessionDiscovery {
  private searchPaths: string[];
  private cache: Map<string, AGSessionMetadata[]> = new Map();
  private cacheTimestamp: number = 0;
  private readonly cacheTimeout: number;
  private readonly debug: boolean;

  constructor(config: SessionDiscoveryConfig = {}) {
    this.cacheTimeout = config.cacheTimeout ?? 60000; // 1 minute default
    this.debug = config.debug ?? false;
    this.searchPaths = this.buildSearchPaths(config);
    
    if (this.debug) {
      console.debug('[SessionDiscovery] Initialized with paths:', this.searchPaths);
    }
  }

  /**
   * Find all Antigravity session files, sorted by most recent first.
   * Results are cached for the configured timeout period.
   */
  async findSessions(): Promise<AGSessionMetadata[]> {
    // Return cached results if still valid
    if (this.isCacheValid()) {
      if (this.debug) {
        console.debug('[SessionDiscovery] Returning cached sessions');
      }
      return this.cache.get('sessions') ?? [];
    }

    const sessions: AGSessionMetadata[] = [];
    const discoveryStart = Date.now();

    // Scan all search paths in parallel
    const scanPromises = this.searchPaths.map(basePath => 
      this.scanDirectory(basePath)
    );
    
    const results = await Promise.allSettled(scanPromises);
    
    // Collect successful scans
    for (const result of results) {
      if (result.status === 'fulfilled') {
        sessions.push(...result.value);
      }
    }

    // Sort by most recent first
    sessions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Add human-readable age strings
    sessions.forEach(session => {
      session.ageString = this.computeAgeString(session.timestamp);
    });

    // Update cache
    this.cache.set('sessions', sessions);
    this.cacheTimestamp = Date.now();

    if (this.debug) {
      const duration = Date.now() - discoveryStart;
      console.debug(`[SessionDiscovery] Found ${sessions.length} sessions in ${duration}ms`);
    }

    return sessions;
  }

  /**
   * Get the most recently modified session.
   */
  async getLatestSession(): Promise<AGSessionMetadata | null> {
    const sessions = await this.findSessions();
    return sessions[0] ?? null;
  }

  /**
   * Find a specific session by its ID.
   */
  async getSessionById(sessionId: string): Promise<AGSessionMetadata | null> {
    const sessions = await this.findSessions();
    return sessions.find(s => s.sessionId === sessionId) ?? null;
  }

  /**
   * Manually clear the cache (useful for testing or forced refresh).
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheTimestamp = 0;
  }

  // ========== PRIVATE METHODS ==========

  private isCacheValid(): boolean {
    if (!this.cache.has('sessions')) {
      return false;
    }
    const age = Date.now() - this.cacheTimestamp;
    return age < this.cacheTimeout;
  }

  private async scanDirectory(basePath: string): Promise<AGSessionMetadata[]> {
    const sessions: AGSessionMetadata[] = [];

    try {
      // Check if path exists (don't throw on missing dirs)
      const exists = await fs.pathExists(basePath);
      if (!exists) {
        if (this.debug) {
          console.debug(`[SessionDiscovery] Path does not exist: ${basePath}`);
        }
        return sessions;
      }

      // Read directory contents
      const files = await fs.readdir(basePath);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      if (this.debug) {
        console.debug(`[SessionDiscovery] Found ${jsonFiles.length} JSON files in ${basePath}`);
      }

      // Process each file
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(basePath, file);
          const stats = await fs.stat(filePath);

          // Skip directories (edge case: .json directory)
          if (stats.isDirectory()) {
            continue;
          }

          sessions.push({
            sessionId: this.extractSessionId(file),
            filePath,
            timestamp: stats.mtime,
            sizeBytes: stats.size,
            ageString: '' // Will be computed later
          });
        } catch (fileError) {
          // Log but don't fail entire scan if one file is problematic
          if (this.debug) {
            console.debug(`[SessionDiscovery] Failed to process ${file}:`, fileError);
          }
        }
      }
    } catch (dirError) {
      // Log but don't fail if directory is inaccessible
      if (this.debug) {
        console.debug(`[SessionDiscovery] Failed to scan ${basePath}:`, dirError);
      }
    }

    return sessions;
  }

  private buildSearchPaths(config: SessionDiscoveryConfig): string[] {
    const paths: string[] = [];
    const homeDir = os.homedir();

    // Priority 1: Environment variable override
    if (process.env.AG_SESSION_DIR) {
      paths.push(process.env.AG_SESSION_DIR);
    }

    // Priority 2: Config override
    if (config.customPath) {
      paths.push(config.customPath);
    }

    // Priority 3: Standard cross-platform locations
    paths.push(
      path.join(homeDir, '.antigravity', 'sessions'),
      path.join(homeDir, '.config', 'antigravity', 'sessions')
    );

    // Priority 4: Platform-specific paths
    switch (process.platform) {
      case 'win32':
        if (process.env.APPDATA) {
          paths.push(path.join(process.env.APPDATA, 'Antigravity', 'sessions'));
        }
        if (process.env.LOCALAPPDATA) {
          paths.push(path.join(process.env.LOCALAPPDATA, 'Antigravity', 'sessions'));
        }
        break;

      case 'darwin':
        paths.push(
          path.join(homeDir, 'Library', 'Application Support', 'Antigravity', 'sessions')
        );
        break;

      case 'linux':
        // XDG_DATA_HOME support
        const xdgData = process.env.XDG_DATA_HOME || path.join(homeDir, '.local', 'share');
        paths.push(path.join(xdgData, 'antigravity', 'sessions'));
        break;
    }

    // Remove duplicates and filter out undefined
    return [...new Set(paths.filter(Boolean))];
  }

  private extractSessionId(filename: string): string {
    // Remove .json extension
    const base = path.basename(filename, '.json');

    // Handle common naming patterns:
    // - session-abc123.json → abc123
    // - ag-session-abc123.json → abc123
    // - abc123.json → abc123
    const patterns = [
      /^session-(.+)$/i,
      /^ag-session-(.+)$/i,
      /^(.+)$/ // Fallback: use entire name
    ];

    for (const pattern of patterns) {
      const match = base.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return base;
  }

  private computeAgeString(timestamp: Date): string {
    const ageMs = Date.now() - timestamp.getTime();
    const seconds = Math.floor(ageMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    }
    if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    }
    if (minutes > 0) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    }
    return 'just now';
  }
}

// Usage Example:
async function example() {
  const discovery = new SessionDiscovery({
    cacheTimeout: 60000, // 1 minute
    debug: true
  });

  // First call: scans filesystem
  const sessions1 = await discovery.findSessions();
  console.log(`Found ${sessions1.length} sessions`);

  // Second call within 1 minute: returns cached
  const sessions2 = await discovery.findSessions();
  console.log('Retrieved from cache');

  // Get latest session
  const latest = await discovery.getLatestSession();
  if (latest) {
    console.log(`Latest: ${latest.sessionId} (${latest.ageString})`);
  }
}
```

## Key Techniques

- **Time-based cache invalidation**: Cache results for 1 minute to balance performance and freshness. The `isCacheValid()` check prevents repeated filesystem scans.

- **Parallel directory scanning**: Use `Promise.allSettled()` to scan multiple paths concurrently. This is faster than sequential scans and doesn't fail if one path is inaccessible.

- **Graceful degradation**: Missing directories or permission errors don't crash the entire discovery process. Each path failure is isolated.

- **Platform-aware path resolution**: Different OSes store config in different locations (Windows APPDATA, macOS Library, Linux XDG). The code detects platform via `process.platform`.

- **Priority-based path search**: Environment variable > config override > standard locations > platform-specific. This gives users flexibility while maintaining sensible defaults.

- **Lazy computation**: Age strings are computed after sorting, not during filesystem scan. This separates concerns and keeps the scan phase focused on I/O.

- **Memory-efficient caching**: Only cache the metadata array, not the full session content. Parsing happens on-demand.

## References

- [Node.js fs-extra](https://github.com/jprichardson/node-fs-extra) - Promise-based filesystem operations
- [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html) - Linux config paths
- [Cache-Aside Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside) - Caching strategy
