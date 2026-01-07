
import { AccountPoolManager } from '../../../../../src/providers/antigravity/account/account-pool';
import { AccountTier, GoogleAccount } from '../../../../../src/providers/antigravity/account/types';
import { TierManager } from '../../../../../src/providers/antigravity/account/tier-manager';
import { QuotaTracker } from '../../../../../src/providers/antigravity/account/quota-tracker';

describe('AccountPoolManager', () => {
    let pool: AccountPoolManager;
    let tierManager: TierManager;
    let quotaTracker: QuotaTracker;

    beforeEach(() => {
        tierManager = new TierManager();
        quotaTracker = new QuotaTracker();
        pool = new AccountPoolManager(tierManager, quotaTracker);
    });

    const mockAccount = (email: string, tier: AccountTier, isActive: boolean = true): GoogleAccount => ({
        email, tier, isActive
    });

    it('should add and list accounts', () => {
        const acc = mockAccount('test@example.com', AccountTier.FREE);
        pool.addAccount(acc);
        expect(pool.listAccounts()).toHaveLength(1);
        expect(pool.getAccount('test@example.com')).toEqual(acc);
    });

    it('should remove accounts', () => {
        const acc = mockAccount('test@example.com', AccountTier.FREE);
        pool.addAccount(acc);
        pool.removeAccount('test@example.com');
        expect(pool.listAccounts()).toHaveLength(0);
    });

    describe('Selection Logic', () => {
        it('should prioritize Enterprise over Pro over Free', () => {
            pool.addAccount(mockAccount('free@test.com', AccountTier.FREE));
            pool.addAccount(mockAccount('pro@test.com', AccountTier.PRO));
            pool.addAccount(mockAccount('ent@test.com', AccountTier.ENTERPRISE));

            const best = pool.getBestAccount();
            expect(best?.email).toBe('ent@test.com');
        });

        it('should skip inactive accounts', () => {
            pool.addAccount(mockAccount('ent@test.com', AccountTier.ENTERPRISE, false));
            pool.addAccount(mockAccount('pro@test.com', AccountTier.PRO, true));

            const best = pool.getBestAccount();
            expect(best?.email).toBe('pro@test.com');
        });

        it('should skip accounts without quota', () => {
            const ent = mockAccount('ent@test.com', AccountTier.ENTERPRISE);
            pool.addAccount(ent);
            pool.addAccount(mockAccount('free@test.com', AccountTier.FREE));

            // Exhaust quota for enterprise
            const config = tierManager.getConfig(AccountTier.ENTERPRISE);
            // Manually set usage to maxDaily
            // Since we can't access QuotaTracker internal state easily from here without protected/public methods,
            // we assume QuotaTracker is working.
            // But wait, account-pool takes QuotaTracker as dependency.
            // We can spy on it or manipulate it if we pass the same instance.

            // Let's use recordUsage to exhaust
            for (let i = 0; i < config.maxDaily; i++) {
                pool.recordUsage(ent.email);
            }

            const best = pool.getBestAccount();
            expect(best?.email).toBe('free@test.com');
        });

        it('should return null if no accounts available', () => {
            expect(pool.getBestAccount()).toBeNull();
        });
    });

    describe('Usage Tracking', () => {
        it('should track stats', () => {
            const email = 'test@test.com';
            pool.addAccount(mockAccount(email, AccountTier.FREE));
            pool.recordUsage(email);

            const stats = pool.getStats(email);
            expect(stats).toBeDefined();
            expect(stats?.totalRequests).toBe(1);
        });
    });
});
