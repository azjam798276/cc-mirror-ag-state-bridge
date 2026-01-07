import { AccountTier, TierConfig, DEFAULT_TIER_CONFIG } from './types';

export class TierManager {
    private tierConfigs: Record<AccountTier, TierConfig>;

    constructor(customConfigs?: Partial<Record<AccountTier, TierConfig>>) {
        this.tierConfigs = { ...DEFAULT_TIER_CONFIG, ...customConfigs };
    }

    getConfig(tier: AccountTier): TierConfig {
        return this.tierConfigs[tier];
    }

    /**
     * Determines if a tier is higher priority than another.
     * Returns true if tierA > tierB
     */
    isHigherPriority(tierA: AccountTier, tierB: AccountTier): boolean {
        return this.tierConfigs[tierA].priority > this.tierConfigs[tierB].priority;
    }
}
