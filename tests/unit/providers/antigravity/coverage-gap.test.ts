
import { createAuthService } from '../../../../src/providers/antigravity/oauth';
import { OAuthManager } from '../../../../src/providers/antigravity/oauth/oauth-manager';
import { CredentialStore } from '../../../../src/providers/antigravity/oauth/credential-store';
import { SessionParseError, SessionNotFoundError } from '../../../../src/providers/antigravity/state-bridge/types';

// Mock dependencies
jest.mock('../../../../src/providers/antigravity/oauth/oauth-manager');
jest.mock('../../../../src/providers/antigravity/oauth/credential-store');

describe('Coverage Gap Fillers', () => {
    describe('OAuth Factory', () => {
        it('should create auth service with dependencies', async () => {
            const mockManager = { some: 'manager' };
            const mockStore = { initialize: jest.fn().mockResolvedValue(undefined) };

            (OAuthManager as unknown as jest.Mock).mockImplementation(() => mockManager);
            (CredentialStore as unknown as jest.Mock).mockImplementation(() => mockStore);

            const service = await createAuthService({
                clientId: 'test-client',
                redirectUri: 'http://localhost/cb'
            });

            expect(OAuthManager).toHaveBeenCalledWith(expect.objectContaining({
                clientId: 'test-client'
            }));
            expect(CredentialStore).toHaveBeenCalled();
            expect(mockStore.initialize).toHaveBeenCalled();
            expect(service.manager).toBe(mockManager);
            expect(service.store).toBe(mockStore);
        });
    });

    describe('State Bridge Types', () => {
        it('should instantiate SessionParseError', () => {
            const error = new SessionParseError('Invalid JSON', '/path/to/file');
            expect(error).toBeInstanceOf(Error);
            expect(error.message).toBe('Invalid JSON');
            expect(error.filePath).toBe('/path/to/file');
            expect(error.name).toBe('SessionParseError');
        });

        it('should instantiate SessionNotFoundError', () => {
            const error = new SessionNotFoundError('Session ID not found');
            expect(error).toBeInstanceOf(Error);
            expect(error.message).toBe('Session ID not found');
            expect(error.name).toBe('SessionNotFoundError');
        });
    });
});
