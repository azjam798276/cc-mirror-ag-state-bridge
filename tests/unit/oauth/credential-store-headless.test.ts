
import { CredentialStore } from '../../../src/providers/antigravity/oauth/credential-store';
import * as fs from 'fs-extra';

// DO NOT mock keytar module here to verify "import fails" behavior 
// or explicitly mock it to throw if it's installed in node_modules.
// Since Jest mocks are hoisted, we use a trick or just force the logic path if possible.
// Actually, relying on import failure is flaky if dev dependencies exist.
// We can use jest.mock with a factory that throws.

jest.mock('keytar', () => {
    throw new Error('Keytar not found');
}, { virtual: true });

jest.mock('fs-extra');
const mockFs = fs as unknown as jest.Mocked<typeof fs>;

describe('CredentialStore (Headless/No Keytar)', () => {
    let store: CredentialStore;
    const testDir = '/test/tokens/headless';

    beforeEach(() => {
        jest.clearAllMocks();
        store = new CredentialStore({
            tokenDir: testDir,
            serviceName: 'test-service',
            accountName: 'test-account'
        });

        (mockFs.ensureDir as unknown as jest.Mock).mockResolvedValue(undefined);
    });

    it('should fall back to PBKDF2 when keytar is missing', async () => {
        await store.initialize();
        // Access private field to verify
        const key = (store as any).encryptionKey;
        expect(key).toBeDefined();
        expect(Buffer.isBuffer(key)).toBe(true);
        expect(key.length).toBe(32); // 256 bits
    });

    it('should derive consistent key for same machine inputs', async () => {
        // We can't easily change machine ID inputs as they are process.env or os calls.
        // But we can verify idempotency.
        await store.initialize();
        const key1 = (store as any).encryptionKey;

        const store2 = new CredentialStore({ tokenDir: testDir });
        await store2.initialize();
        const key2 = (store2 as any).encryptionKey;

        expect(key1.equals(key2)).toBe(true);
    });
});
