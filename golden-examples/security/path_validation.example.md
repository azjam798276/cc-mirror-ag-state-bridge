---
id: "canonical_path_traversal_prevention"
source: "cc-mirror Antigravity State Bridge Security Review"
tags: ["typescript", "security", "path-traversal", "validation"]
---

## Problem

User-provided session IDs or paths could contain traversal sequences (`../../../etc/passwd`) to escape the intended directory. Need to validate that resolved paths stay within allowed boundaries without breaking legitimate use cases.

## Solution

```typescript
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';

/**
 * Security error for path validation failures.
 */
export class PathSecurityError extends Error {
  constructor(message: string, public readonly attemptedPath: string) {
    super(message);
    this.name = 'PathSecurityError';
  }
}

/**
 * Validates and sanitizes filesystem paths to prevent traversal attacks.
 */
export class PathValidator {
  private readonly allowedBasePaths: Set<string>;

  constructor(allowedPaths: string[]) {
    // Normalize and deduplicate allowed paths
    this.allowedBasePaths = new Set(
      allowedPaths.map(p => path.resolve(p))
    );
  }

  /**
   * Validate that a path is within allowed boundaries.
   * Returns the canonical (resolved) path if valid.
   * Throws PathSecurityError if path escapes allowed directories.
   */
  async validatePath(userPath: string): Promise<string> {
    // Step 1: Basic input validation
    this.validateInput(userPath);

    // Step 2: Resolve to canonical path (eliminates .., ., symlinks)
    const canonicalPath = await this.resolvePath(userPath);

    // Step 3: Check if within allowed boundaries
    if (!this.isWithinAllowedPaths(canonicalPath)) {
      throw new PathSecurityError(
        `Path escapes allowed directories: ${userPath}`,
        userPath
      );
    }

    // Step 4: Check if path exists and is a file (not directory)
    await this.validateFileType(canonicalPath);

    return canonicalPath;
  }

  /**
   * Safely join a base path with user-provided segments.
   * Validates the result stays within base path.
   */
  async safeJoin(basePath: string, ...segments: string[]): Promise<string> {
    // Ensure base path is allowed
    const canonicalBase = path.resolve(basePath);
    if (!this.allowedBasePaths.has(canonicalBase)) {
      throw new PathSecurityError(
        `Base path not in allowed list: ${basePath}`,
        basePath
      );
    }

    // Join segments
    const joined = path.join(canonicalBase, ...segments);

    // Validate joined path
    return await this.validatePath(joined);
  }

  /**
   * Extract session ID from filename and validate it contains no path separators.
   */
  validateSessionId(sessionId: string): string {
    // Check for path separators (/, \)
    if (sessionId.includes('/') || sessionId.includes('\\')) {
      throw new PathSecurityError(
        `Session ID contains path separators: ${sessionId}`,
        sessionId
      );
    }

    // Check for path traversal sequences
    if (sessionId.includes('..')) {
      throw new PathSecurityError(
        `Session ID contains traversal sequence: ${sessionId}`,
        sessionId
      );
    }

    // Check for null bytes (path truncation attack)
    if (sessionId.includes('\0')) {
      throw new PathSecurityError(
        `Session ID contains null byte: ${sessionId}`,
        sessionId
      );
    }

    // Length check (prevent DOS via extremely long filenames)
    if (sessionId.length > 255) {
      throw new PathSecurityError(
        `Session ID exceeds maximum length (255 chars): ${sessionId}`,
        sessionId
      );
    }

    // Whitelist: alphanumeric, dash, underscore only
    if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
      throw new PathSecurityError(
        `Session ID contains invalid characters: ${sessionId}`,
        sessionId
      );
    }

    return sessionId;
  }

  // ========== PRIVATE METHODS ==========

  private validateInput(userPath: string): void {
    // Reject empty paths
    if (!userPath || userPath.trim().length === 0) {
      throw new PathSecurityError('Path cannot be empty', userPath);
    }

    // Reject null bytes (path truncation vulnerability)
    if (userPath.includes('\0')) {
      throw new PathSecurityError(
        'Path contains null byte (possible attack)',
        userPath
      );
    }

    // Reject extremely long paths (DOS prevention)
    if (userPath.length > 4096) {
      throw new PathSecurityError(
        'Path exceeds maximum length (4096 chars)',
        userPath
      );
    }
  }

  private async resolvePath(userPath: string): Promise<string> {
    try {
      // path.resolve converts to absolute and normalizes .., .
      let resolved = path.resolve(userPath);

      // On case-insensitive filesystems (macOS, Windows), normalize case
      if (process.platform === 'darwin' || process.platform === 'win32') {
        // Get real path (resolves symlinks and normalizes case)
        if (await fs.pathExists(resolved)) {
          resolved = await fs.realpath(resolved);
        }
      }

      return resolved;
    } catch (error) {
      throw new PathSecurityError(
        `Failed to resolve path: ${userPath}`,
        userPath
      );
    }
  }

  private isWithinAllowedPaths(canonicalPath: string): boolean {
    // Check if canonical path starts with any allowed base path
    for (const basePath of this.allowedBasePaths) {
      // Normalize with trailing separator for accurate prefix check
      const baseWithSep = basePath + path.sep;
      const pathWithSep = canonicalPath + path.sep;

      if (pathWithSep.startsWith(baseWithSep) || canonicalPath === basePath) {
        return true;
      }
    }

    return false;
  }

  private async validateFileType(canonicalPath: string): Promise<void> {
    // Check if path exists
    if (!await fs.pathExists(canonicalPath)) {
      throw new PathSecurityError(
        `Path does not exist: ${canonicalPath}`,
        canonicalPath
      );
    }

    // Check if it's a file (not directory)
    const stats = await fs.stat(canonicalPath);
    if (!stats.isFile()) {
      throw new PathSecurityError(
        `Path is not a file: ${canonicalPath}`,
        canonicalPath
      );
    }

    // Check file is readable
    try {
      await fs.access(canonicalPath, fs.constants.R_OK);
    } catch (error) {
      throw new PathSecurityError(
        `File is not readable: ${canonicalPath}`,
        canonicalPath
      );
    }
  }
}

/**
 * Factory function to create validator with standard AG session paths.
 */
export function createSessionPathValidator(): PathValidator {
  const homeDir = os.homedir();
  
  const allowedPaths = [
    path.join(homeDir, '.antigravity', 'sessions'),
    path.join(homeDir, '.config', 'antigravity', 'sessions'),
  ];

  // Platform-specific paths
  if (process.platform === 'win32') {
    if (process.env.APPDATA) {
      allowedPaths.push(path.join(process.env.APPDATA, 'Antigravity', 'sessions'));
    }
  } else if (process.platform === 'darwin') {
    allowedPaths.push(
      path.join(homeDir, 'Library', 'Application Support', 'Antigravity', 'sessions')
    );
  }

  // Environment override
  if (process.env.AG_SESSION_DIR) {
    allowedPaths.push(process.env.AG_SESSION_DIR);
  }

  return new PathValidator(allowedPaths);
}

// Usage Example:
async function example() {
  const validator = createSessionPathValidator();

  // Safe: validate session ID
  try {
    const sessionId = validator.validateSessionId('abc123-session');
    console.log('Valid session ID:', sessionId);
  } catch (error) {
    console.error('Invalid session ID:', error.message);
  }

  // Safe: join base path with user segment
  try {
    const basePath = path.join(os.homedir(), '.antigravity', 'sessions');
    const fullPath = await validator.safeJoin(basePath, 'session-abc123.json');
    console.log('Safe path:', fullPath);
  } catch (error) {
    console.error('Path validation failed:', error.message);
  }

  // ATTACK: Attempt traversal
  try {
    const maliciousId = '../../../etc/passwd';
    validator.validateSessionId(maliciousId); // Will throw
  } catch (error) {
    console.log('Blocked attack:', error.message);
  }

  // ATTACK: Attempt absolute path
  try {
    const maliciousPath = '/etc/passwd';
    await validator.validatePath(maliciousPath); // Will throw
  } catch (error) {
    console.log('Blocked attack:', error.message);
  }
}
```

## Key Techniques

- **Canonical path resolution**: Use `path.resolve()` and `fs.realpath()` to eliminate `..`, `.`, and symlinks. This is the only reliable way to detect traversal.

- **Whitelist validation**: Check that resolved path starts with one of the allowed base paths. Never use blacklist approaches (too many edge cases).

- **Null byte detection**: Reject paths containing `\0` characters. In some older systems, this can truncate paths and bypass checks.

- **Session ID whitelist**: Only allow alphanumeric, dash, and underscore in session IDs. This prevents injection of path separators or special chars.

- **Case normalization**: On case-insensitive filesystems (macOS, Windows), use `fs.realpath()` to get the canonical case. Prevents attacks like `SesSion/../etc/passwd`.

- **Length limits**: Enforce maximum path length (4096 chars) and session ID length (255 chars). Prevents DOS attacks via extremely long inputs.

- **File type validation**: Verify the path points to a regular file (not directory, symlink, device). Prevents attacks that try to read sensitive files.

- **Readable check**: Use `fs.access()` to verify file is readable before returning path. Prevents information disclosure via existence checks.

## References

- [OWASP Path Traversal](https://owasp.org/www-community/attacks/Path_Traversal) - Attack patterns
- [Node.js path.resolve](https://nodejs.org/api/path.html#path_path_resolve_paths) - Canonical resolution
- [Null Byte Injection](https://cwe.mitre.org/data/definitions/158.html) - CWE-158
- [Electron Path Validation](https://www.electronjs.org/docs/latest/tutorial/security#13-validate-the-sender-of-all-ipc-messages) - Similar patterns
