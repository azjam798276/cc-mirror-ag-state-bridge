/**
 * Integration Tests: OAuth Token Refresh Flow
 *
 * Tests the token refresh mechanism including getValidCredentials() and refreshToken().
 */

import { OAuthManager, OAuthCredentials } from '../../../src/providers/antigravity/oauth/oauth-manager';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('OAuth Token Refresh', () => {
    let manager: OAuthManager;
    const TEST_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
    const TEST_CLIENT_SECRET = 'test-client-secret';

    beforeEach(() => {
        jest.clearAllMocks();
        manager = new OAuthManager({
            clientId: TEST_CLIENT_ID,
            clientSecret: TEST_CLIENT_SECRET,
            redirectUri: 'http://localhost:9876/callback',
            scopes: ['openid', 'email'],
            tokenRefreshBufferMs: 5 * 60 * 1000, // 5 minutes
        });
    });

    describe('refreshToken()', () => {
        it('should refresh an expired token successfully', async () => {
            const expiredCreds: OAuthCredentials = {
                accessToken: 'old-access-token',
                refreshToken: 'valid-refresh-token',
                expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
                email: 'user@example.com',
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    access_token: 'new-access-token',
                    expires_in: 3600,
                    // No refresh_token in response - should keep old one
                }),
            });

            const newCreds = await manager.refreshToken(expiredCreds);

            expect(newCreds.accessToken).toBe('new-access-token');
            expect(newCreds.refreshToken).toBe('valid-refresh-token'); // Preserved
            expect(newCreds.email).toBe('user@example.com'); // Preserved
            expect(newCreds.expiresAt.getTime()).toBeGreaterThan(Date.now());

            // Verify request parameters
            expect(mockFetch).toHaveBeenCalledWith(
                'https://oauth2.googleapis.com/token',
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('grant_type=refresh_token'),
                }),
            );
            expect(mockFetch.mock.calls[0][1].body).toContain(`client_id=${TEST_CLIENT_ID}`);
            expect(mockFetch.mock.calls[0][1].body).toContain('refresh_token=valid-refresh-token');
        });

        it('should use new refresh_token if provided in response', async () => {
            const creds: OAuthCredentials = {
                accessToken: 'old',
                refreshToken: 'old-refresh',
                expiresAt: new Date(Date.now() - 1000),
                email: 'user@example.com',
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    access_token: 'new-access',
                    refresh_token: 'new-refresh-token',
                    expires_in: 7200,
                }),
            });

            const newCreds = await manager.refreshToken(creds);

            expect(newCreds.refreshToken).toBe('new-refresh-token');
        });

        it('should include client_secret when configured', async () => {
            const creds: OAuthCredentials = {
                accessToken: 'old',
                refreshToken: 'refresh',
                expiresAt: new Date(Date.now() - 1000),
                email: 'user@example.com',
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    access_token: 'new',
                    expires_in: 3600,
                }),
            });

            await manager.refreshToken(creds);

            expect(mockFetch.mock.calls[0][1].body).toContain(`client_secret=${TEST_CLIENT_SECRET}`);
        });
    });

    describe('getValidCredentials()', () => {
        it('should return existing credentials if still valid', async () => {
            const validCreds: OAuthCredentials = {
                accessToken: 'valid-token',
                refreshToken: 'refresh',
                expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
                email: 'user@example.com',
            };

            const result = await manager.getValidCredentials(validCreds);

            expect(result).toBe(validCreds); // Same object reference
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should refresh credentials when expired', async () => {
            const expiredCreds: OAuthCredentials = {
                accessToken: 'expired-token',
                refreshToken: 'refresh',
                expiresAt: new Date(Date.now() - 1000),
                email: 'user@example.com',
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    access_token: 'refreshed-token',
                    expires_in: 3600,
                }),
            });

            const result = await manager.getValidCredentials(expiredCreds);

            expect(result.accessToken).toBe('refreshed-token');
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should refresh credentials within buffer window', async () => {
            // Token expires in 4 minutes, buffer is 5 minutes
            const almostExpired: OAuthCredentials = {
                accessToken: 'almost-expired',
                refreshToken: 'refresh',
                expiresAt: new Date(Date.now() + 4 * 60 * 1000),
                email: 'user@example.com',
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    access_token: 'preemptively-refreshed',
                    expires_in: 3600,
                }),
            });

            const result = await manager.getValidCredentials(almostExpired);

            expect(result.accessToken).toBe('preemptively-refreshed');
        });
    });

    describe('isTokenValid() / needsRefresh()', () => {
        it('should correctly identify valid tokens', () => {
            const valid: OAuthCredentials = {
                accessToken: 'token',
                refreshToken: 'refresh',
                expiresAt: new Date(Date.now() + 60 * 60 * 1000),
                email: 'user@example.com',
            };

            expect(manager.isTokenValid(valid)).toBe(true);
            expect(manager.needsRefresh(valid)).toBe(false);
        });

        it('should correctly identify expired tokens', () => {
            const expired: OAuthCredentials = {
                accessToken: 'token',
                refreshToken: 'refresh',
                expiresAt: new Date(Date.now() - 1000),
                email: 'user@example.com',
            };

            expect(manager.isTokenValid(expired)).toBe(false);
            expect(manager.needsRefresh(expired)).toBe(true);
        });

        it('should consider buffer window in validity check', () => {
            // Expires in 3 minutes, but buffer is 5 minutes
            const withinBuffer: OAuthCredentials = {
                accessToken: 'token',
                refreshToken: 'refresh',
                expiresAt: new Date(Date.now() + 3 * 60 * 1000),
                email: 'user@example.com',
            };

            expect(manager.isTokenValid(withinBuffer)).toBe(false);
            expect(manager.needsRefresh(withinBuffer)).toBe(true);
        });
    });
});
