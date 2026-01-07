export enum AccountTier {
    FREE = 'free',
    PRO = 'pro',
    ENTERPRISE = 'enterprise'
}

export interface AccountStats {
    totalRequests: number;
    rpm: number;
    tpm: number;
    dailyRequests: number;
    lastReset: number;
}

export interface GoogleAccount {
    email: string;
    tier: AccountTier;
    isActive: boolean;
    credentialsPath?: string;
}

export interface TierConfig {
    maxRPM: number;
    maxTPM: number;
    maxDaily: number;
    priority: number; // Higher is better
}

export const DEFAULT_TIER_CONFIG: Record<AccountTier, TierConfig> = {
    [AccountTier.FREE]: {
        maxRPM: 60,
        maxTPM: 32000,
        maxDaily: 1000,
        priority: 1
    },
    [AccountTier.PRO]: {
        maxRPM: 300,
        maxTPM: 100000,
        maxDaily: 5000,
        priority: 2
    },
    [AccountTier.ENTERPRISE]: {
        maxRPM: 1000,
        maxTPM: 1000000,
        maxDaily: 20000,
        priority: 3
    }
};
