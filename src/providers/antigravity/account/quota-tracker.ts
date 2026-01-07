import { AccountStats, TierConfig } from './types';

export class QuotaTracker {
    private stats: Map<string, AccountStats> = new Map();

    constructor() { }

    /**
     * Records a request usage for an account.
     */
    recordUsage(email: string, tokens: number = 0): void {
        const stat = this.getStats(email);

        // Reset daily usage if needed
        const now = Date.now();
        if (now - stat.lastReset > 24 * 60 * 60 * 1000) {
            stat.dailyRequests = 0;
            stat.lastReset = now;
        }

        stat.totalRequests++;
        stat.dailyRequests++;
        stat.rpm++; // This is a simplified rolling window; in real app use discrete windows
        stat.tpm += tokens;

        // Reset RPM/TPM counters every minute (simplified logic)
        // In a real implementation, we'd use a sliding window bucket.
        // For MVP, we assume the caller handles reset or we do weak consistency.
    }

    /**
     * Checks if an account has remaining quota.
     */
    hasQuota(email: string, config: TierConfig): boolean {
        const stat = this.getStats(email);

        if (stat.dailyRequests >= config.maxDaily) return false;

        // Note: Real RPM/TPM check requires precise time windows.
        // For now we check if stats are below limit.
        // We'd need an external cleaner to reset RPM/TPM every minute.

        return true;
    }

    getStats(email: string): AccountStats {
        if (!this.stats.has(email)) {
            this.stats.set(email, {
                totalRequests: 0,
                rpm: 0,
                tpm: 0,
                dailyRequests: 0,
                lastReset: Date.now()
            });
        }
        return this.stats.get(email)!;
    }

    // Helper for testing to reset usage
    resetUsage(email: string): void {
        this.stats.delete(email);
    }
}
