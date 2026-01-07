import { GoogleAccount, AccountTier, AccountStats } from './types';
import { TierManager } from './tier-manager';
import { QuotaTracker } from './quota-tracker';

export class AccountPoolManager {
    private accounts: Map<string, GoogleAccount> = new Map();
    private tierManager: TierManager;
    private quotaTracker: QuotaTracker;

    constructor(tierManager?: TierManager, quotaTracker?: QuotaTracker) {
        this.tierManager = tierManager || new TierManager();
        this.quotaTracker = quotaTracker || new QuotaTracker();
    }

    addAccount(account: GoogleAccount): void {
        this.accounts.set(account.email, account);
    }

    removeAccount(email: string): void {
        this.accounts.delete(email);
    }

    getAccount(email: string): GoogleAccount | undefined {
        return this.accounts.get(email);
    }

    listAccounts(): GoogleAccount[] {
        return Array.from(this.accounts.values());
    }

    /**
     * Selects the best available account based on:
     * 1. Active status
     * 2. Quota availability (Daily, RPM, TPM)
     * 3. Tier priority (Enterprise > Pro > Free)
     * 4. Load balancing (Random among tied best)
     */
    getBestAccount(): GoogleAccount | null {
        const activeAccounts = Array.from(this.accounts.values()).filter(acc => acc.isActive);

        if (activeAccounts.length === 0) {
            return null;
        }

        // Filter by quota availability
        const availableAccounts = activeAccounts.filter(acc => {
            const config = this.tierManager.getConfig(acc.tier);
            return this.quotaTracker.hasQuota(acc.email, config);
        });

        if (availableAccounts.length === 0) {
            return null;
        }

        // Sort by tier priority (descending)
        availableAccounts.sort((a, b) => {
            const priorityA = this.tierManager.getConfig(a.tier).priority;
            const priorityB = this.tierManager.getConfig(b.tier).priority;
            return priorityB - priorityA;
        });

        // Get all accounts with the highest priority found
        const bestPriority = this.tierManager.getConfig(availableAccounts[0].tier).priority;
        const candidates = availableAccounts.filter(
            acc => this.tierManager.getConfig(acc.tier).priority === bestPriority
        );

        // Pick random candidate for load balancing
        const randomIndex = Math.floor(Math.random() * candidates.length);
        return candidates[randomIndex];
    }

    /**
     * Record usage for an account to update quota tracking
     */
    recordUsage(email: string, tokens: number = 0): void {
        if (this.accounts.has(email)) {
            this.quotaTracker.recordUsage(email, tokens);
        }
    }

    getStats(email: string): AccountStats | undefined {
        if (this.accounts.has(email)) {
            return this.quotaTracker.getStats(email);
        }
        return undefined;
    }
}
