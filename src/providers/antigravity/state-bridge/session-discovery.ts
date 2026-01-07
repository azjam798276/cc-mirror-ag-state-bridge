/**
 * SessionDiscovery - Find AG sessions on filesystem
 * Based on TDD v1.0 Module 1 specification
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { AGSessionMetadata } from './types';
import { SecurityUtils } from './security-utils';

export class SessionDiscovery {
    private cache: AGSessionMetadata[] | null = null;
    private cacheTime: number = 0;
    private readonly CACHE_TTL_MS = 60000; // 1 minute

    private getSearchPaths(): string[] {
        const paths: string[] = [];

        // Environment override first
        if (process.env.AG_SESSION_DIR) {
            paths.push(process.env.AG_SESSION_DIR);
        }

        // ACTUAL Antigravity IDE brain directories (highest priority)
        const home = os.homedir();
        paths.push(path.join(home, '.gemini', 'antigravity', 'brain'));

        // Legacy/documented paths (kept for compatibility with PRD spec)
        paths.push(path.join(home, '.antigravity', 'sessions'));

        // Platform-specific fallbacks
        if (process.platform === 'linux') {
            paths.push(path.join(home, '.config', 'antigravity', 'sessions'));
        } else if (process.platform === 'darwin') {
            paths.push(path.join(home, 'Library', 'Application Support', 'Antigravity', 'sessions'));
        } else if (process.platform === 'win32') {
            const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
            paths.push(path.join(appData, 'Antigravity', 'sessions'));
        }

        return paths;
    }


    async findSessions(): Promise<AGSessionMetadata[]> {
        // Check cache
        if (this.cache && Date.now() - this.cacheTime < this.CACHE_TTL_MS) {
            return this.cache;
        }

        const sessionMap = new Map<string, AGSessionMetadata>();
        const searchPaths = this.getSearchPaths();

        for (const basePath of searchPaths) {
            if (!fs.existsSync(basePath)) continue;

            try {
                const entries = fs.readdirSync(basePath, { withFileTypes: true });

                for (const entry of entries) {
                    const entryPath = path.join(basePath, entry.name);

                    // Security Check: Prevent path traversal
                    if (!SecurityUtils.isPathSafe(entryPath, searchPaths)) {
                        console.warn(`Skipping unsafe session path: ${entryPath}`);
                        continue;
                    }

                    let sessionId: string;
                    let filePath: string;
                    let stats: fs.Stats;

                    try {
                        if (entry.isDirectory()) {
                            // Antigravity brain directory - check for task.md
                            const taskPath = path.join(entryPath, 'task.md');
                            if (!fs.existsSync(taskPath)) continue;

                            sessionId = entry.name; // UUID directory name
                            filePath = entryPath;
                            stats = fs.statSync(entryPath);
                        } else if (entry.name.endsWith('.json')) {
                            // Legacy JSON session file
                            sessionId = this.extractSessionId(entry.name);
                            filePath = entryPath;
                            stats = fs.statSync(entryPath);
                        } else {
                            continue; // Skip other files
                        }

                        // Skip if we already found this session in a higher priority path
                        if (sessionMap.has(sessionId)) continue;

                        sessionMap.set(sessionId, {
                            sessionId,
                            filePath,
                            timestamp: stats.mtime,
                            sizeBytes: stats.size,
                            ageString: this.formatAge(stats.mtime)
                        });
                    } catch (e) {
                        // Skip unreadable entries
                        console.warn(`Skipping unreadable session: ${entryPath}`);
                    }
                }
            } catch (e) {
                console.error(`Failed to read directory: ${basePath}`, e);
            }
        }


        const sessions = Array.from(sessionMap.values());

        // Sort by most recent first
        sessions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        // Update cache
        this.cache = sessions;
        this.cacheTime = Date.now();

        return sessions;
    }

    async getLatestSession(): Promise<AGSessionMetadata | null> {
        const sessions = await this.findSessions();
        return sessions[0] || null;
    }

    async getSessionById(id: string): Promise<AGSessionMetadata | null> {
        const sessions = await this.findSessions();
        return sessions.find(s => s.sessionId === id) || null;
    }

    clearCache(): void {
        this.cache = null;
        this.cacheTime = 0;
    }

    private extractSessionId(filename: string): string {
        // Extract from filename: session-abc123.json → abc123
        const base = path.basename(filename, '.json');
        return base.replace(/^session-/, '');
    }

    private formatAge(date: Date): string {
        const ms = Date.now() - date.getTime();
        const hours = Math.floor(ms / (1000 * 60 * 60));
        if (hours < 1) return 'less than an hour ago';
        if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        const days = Math.floor(hours / 24);
        return `${days} day${days > 1 ? 's' : ''} ago`;
    }
}

export { AGSessionMetadata };
