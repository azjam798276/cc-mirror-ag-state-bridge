import * as path from 'path';

/**
 * SecurityUtils - Providing scrubbing and path safety checks
 * Based on P2-003 security hardening requirements
 */
export class SecurityUtils {
    /**
     * Scrub sensitive patterns from text
     * - OAuth tokens
     * - Bearer tokens
     * - API Keys
     * - Emails
     * - Absolute local paths (to prevent environment leaking)
     */
    static scrub(text: string): string {
        if (!text) return text;

        let scrubbed = text;

        // Redact OAuth/Bearer tokens (broad match for long hex/base64-like strings)
        scrubbed = scrubbed.replace(/(bearer|token|key|secret)(["\s:=]+)([a-zA-Z0-9\-_.~=+]{32,})/gi, '$1$2[REDACTED]');

        // Redact email addresses
        scrubbed = scrubbed.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]');

        // Redact absolute local paths (e.g., /home/user/...)
        // This is a simple heuristic: matches strings starting with / or C:\ that look like paths
        scrubbed = scrubbed.replace(/(\/Users\/|\/home\/|\/root\/|[A-Z]:\\Users\\|[A-Z]:\\home\\)[a-zA-Z0-9._\-/\\ ]+/g, '[PATH_REDACTED]');

        return scrubbed;
    }

    /**
     * Validate that a target path is canonicalized and resides within authorized base directories.
     */
    static isPathSafe(targetPath: string, authorizedBases: string[]): boolean {
        try {
            const canonicalTarget = path.resolve(targetPath);

            return authorizedBases.some(base => {
                const canonicalBase = path.resolve(base);
                // Check if target starts with base and is not exactly the same as base (if we want to enforce it's inside)
                // Or just that it's within the subtree.
                return canonicalTarget.startsWith(canonicalBase);
            });
        } catch (e) {
            return false;
        }
    }
}
