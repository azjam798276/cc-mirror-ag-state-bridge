/**
 * Unit tests for OAuthManager
 * Focus on internal functions and error paths for S3-004
 */
// Mock http module
jest.mock('http', () => ({
    createServer: jest.fn(),
}));

import { OAuthManager, type OAuthCredentials, type PKCEChallenge } from '../../../src/providers/antigravity/oauth/oauth-manager';
import * as http from 'http';

//Mock fetch globally
global.fetch = jest.fn();

describe('OAuthManager', () => {
    let manager: OAuthManager;

    beforeEach(() => {
        jest.clearAllMocks();
        manager = new OAuthManager({
            clientId: 'test-client-id',
            clientSecret: 'test-secret',
            redirectUri: 'http://localhost:9876/callback',
            scopes: ['openid', 'email'],
        });
    });

    // -------------------------------------------------------------------------
    // buildAuthUrl Tests (S3-004)
    // -------------------------------------------------------------------------
    describe('buildAuthUrl', () => {
        it('should construct valid OAuth URL with all parameters', () => {
            const pkce: PKCEChallenge = {
                codeVerifier: 'test-verifier-123',
                codeChallenge: 'test-challenge-abc',
                codeChallengeMethod: 'S256',
            };
            const state = 'random-state-xyz';

            // Access private method via any cast
            const url = (manager as any).buildAuthUrl(pkce, state);

            expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth?');
            expect(url).toContain('client_id=test-client-id');
            expect(url).toContain('response_type=code');
            expect(url).toContain('code_challenge=test-challenge-abc');
        });

        it('should URL-encode special characters in scopes', () => {
            const customManager = new OAuthManager({
                clientId: 'test-id',
                scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
            });

            const pkce: PKCEChallenge = {
                codeVerifier: 'v',
                codeChallenge: 'c',
                codeChallengeMethod: 'S256',
            };

            const url = (customManager as any).buildAuthUrl(pkce, 'state');
            expect(url).toContain('scope=https%3A%2F%2Fwww.googleapis.com');
        });
    });

    // -------------------------------------------------------------------------
    // Token Refresh Error Paths (S3-004)
    // -------------------------------------------------------------------------
    describe('refreshToken - error handling', () => {
        it('should throw on 401 Unauthorized', async () => {
            const credentials: OAuthCredentials = {
                accessToken: 'old-token',
                refreshToken: 'refresh-token',
                expiresAt: new Date(Date.now() - 1000),
                email: 'test@example.com',
            };

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 401,
                text: async () => 'Unauthorized',
            });

            await expect(manager.refreshToken(credentials)).rejects.toThrow('Token refresh failed: 401');
        });

        it('should throw on network failure', async () => {
            const credentials: OAuthCredentials = {
                accessToken: 'old-token',
                refreshToken: 'refresh-token',
                expiresAt: new Date(Date.now() - 1000),
                email: 'test@example.com',
            };

            (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

            await expect(manager.refreshToken(credentials)).rejects.toThrow('Network error');
        });

        it('should preserve email and refresh token on successful refresh', async () => {
            const credentials: OAuthCredentials = {
                accessToken: 'old-token',
                refreshToken: 'old-refresh',
                expiresAt: new Date(Date.now() - 1000),
                email: 'test@example.com',
            };

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    access_token: 'new-access-token',
                    expires_in: 3600,
                }),
            });

            const result = await manager.refreshToken(credentials);

            expect(result.accessToken).toBe('new-access-token');
            expect(result.refreshToken).toBe('old-refresh');
            expect(result.email).toBe('test@example.com');
        });
    });

    // -------------------------------------------------------------------------
    // Token Validation Logic (S3-004)
    // -------------------------------------------------------------------------
    describe('isTokenValid', () => {
        it('should return false for expired token', () => {
            const credentials: OAuthCredentials = {
                accessToken: 'token',
                refreshToken: 'refresh',
                expiresAt: new Date(Date.now() - 1000),
                email: 'test@example.com',
            };
            expect(manager.isTokenValid(credentials)).toBe(false);
        });

        it('should return false for token within buffer window', () => {
            const credentials: OAuthCredentials = {
                accessToken: 'token',
                refreshToken: 'refresh',
                expiresAt: new Date(Date.now() + 4 * 60 * 1000),
                email: 'test@example.com',
            };
            expect(manager.isTokenValid(credentials)).toBe(false);
        });

        it('should return true for valid token outside buffer', () => {
            const credentials: OAuthCredentials = {
                accessToken: 'token',
                refreshToken: 'refresh',
                expiresAt: new Date(Date.now() + 10 * 60 * 1000),
                email: 'test@example.com',
            };
            expect(manager.isTokenValid(credentials)).toBe(true);
        });
    });

    describe('needsRefresh', () => {
        it('should return true if token is invalid', () => {
            const credentials: OAuthCredentials = {
                accessToken: 'token',
                refreshToken: 'refresh',
                expiresAt: new Date(Date.now() - 1000),
                email: 'test@example.com',
            };
            expect(manager.needsRefresh(credentials)).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // getValidCredentials (S3-004)
    // -------------------------------------------------------------------------
    describe('getValidCredentials', () => {
        it('should return credentials if still valid', async () => {
            const credentials: OAuthCredentials = {
                accessToken: 'valid-token',
                refreshToken: 'refresh',
                expiresAt: new Date(Date.now() + 10 * 60 * 1000),
                email: 'test@example.com',
            };
            const result = await manager.getValidCredentials(credentials);
            expect(result).toBe(credentials);
        });

        it('should refresh credentials if expired', async () => {
            const credentials: OAuthCredentials = {
                accessToken: 'old-token',
                refreshToken: 'refresh-token',
                expiresAt: new Date(Date.now() - 1000),
                email: 'test@example.com',
            };

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    access_token: 'new-token',
                    expires_in: 3600,
                }),
            });

            const result = await manager.getValidCredentials(credentials);
            expect(result.accessToken).toBe('new-token');
        });
    });

    // -------------------------------------------------------------------------
    // revokeToken Error Paths (S3-004)
    // -------------------------------------------------------------------------
    describe('revokeToken - error handling', () => {
        it('should succeed on 200 OK', async () => {
            const credentials: OAuthCredentials = {
                accessToken: 'token-to-revoke',
                refreshToken: 'refresh',
                expiresAt: new Date(),
                email: 'test@example.com',
            };
            (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
            await expect(manager.revokeToken(credentials)).resolves.toBeUndefined();
        });

        it('should tolerate 400 Bad Request', async () => {
            const credentials: OAuthCredentials = {
                accessToken: 'already-revoked',
                refreshToken: 'refresh',
                expiresAt: new Date(),
                email: 'test@example.com',
            };
            (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 400 });
            await expect(manager.revokeToken(credentials)).resolves.toBeUndefined();
        });

        it('should throw on 500 Internal Server Error', async () => {
            const credentials: OAuthCredentials = {
                accessToken: 'token',
                refreshToken: 'refresh',
                expiresAt: new Date(),
                email: 'test@example.com',
            };
            (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 });
            await expect(manager.revokeToken(credentials)).rejects.toThrow('Token revocation failed: 500');
        });
    });

    // -------------------------------------------------------------------------
    // Callback Server & Handler Tests (S3-004)
    // -------------------------------------------------------------------------
    describe('Callback Server Logic', () => {
        let mockServer: any;
        let requestHandler: (req: any, res: any) => void;

        beforeEach(() => {
            mockServer = {
                listen: jest.fn((port, cb) => cb && cb()),
                on: jest.fn(),
                close: jest.fn((cb) => cb && cb()),
            };

            // Mock implementation for createServer to capture the handler
            (http.createServer as jest.Mock).mockImplementation((handler: any) => {
                requestHandler = handler;
                return mockServer;
            });
        });

        it('should handle successful OAuth callback with user info fetch', async () => {
            // Start the flow (this starts the server)
            const authPromise = manager.startAuthFlow();

            await new Promise(resolve => setTimeout(resolve, 0));

            expect(http.createServer).toHaveBeenCalled();
            expect(requestHandler).toBeDefined();

            // Mock successful token exchange (Call 1)
            const mockTokens = {
                access_token: 'new-g-token',
                refresh_token: 'new-g-refresh',
                expires_in: 3600
            };

            // Mock user info fetch (Call 2)
            const mockUserInfo = {
                email: 'user@example.com'
            };

            (global.fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockTokens,
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockUserInfo,
                });

            const internalState = (manager as any).pendingAuth.state;

            const req = { url: `/callback?code=g-code&state=${internalState}` };
            const res = {
                writeHead: jest.fn(),
                end: jest.fn(),
            };

            await requestHandler(req, res);

            const creds = await authPromise;
            expect(creds.accessToken).toBe('new-g-token');
            expect(creds.email).toBe('user@example.com');
            expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything());
        });

        it('should reject on state mismatch', async () => {
            const authPromise = manager.startAuthFlow().catch(e => e);
            await new Promise(resolve => setTimeout(resolve, 0));

            const req = { url: '/callback?code=foo&state=wrong-state' };
            const res = { writeHead: jest.fn(), end: jest.fn() };

            await requestHandler(req, res);

            const err = await authPromise;
            expect(err.message).toContain('State mismatch');
            expect(res.writeHead).toHaveBeenCalledWith(400);
        });

        it('should return 404 for invalid path', async () => {
            manager.startAuthFlow();
            await new Promise(resolve => setTimeout(resolve, 0));

            const req = { url: '/wrong-path' };
            const res = { writeHead: jest.fn(), end: jest.fn() };

            await requestHandler(req, res);
            expect(res.writeHead).toHaveBeenCalledWith(404);
        });
    });
});
