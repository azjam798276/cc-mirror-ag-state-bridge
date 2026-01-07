/**
 * OAuth Manager - Google Authentication Flow
 * 
 * Implements OAuth 2.0 with PKCE for secure authentication with Google APIs.
 * Uses google-auth-library for token management.
 * 
 * Security Requirements:
 * - PKCE (Proof Key for Code Exchange) for auth code flow
 * - Never log tokens or refresh tokens
 * - Validate redirect URI strictly
 */

import * as http from 'http';
import * as crypto from 'crypto';
import * as url from 'url';
import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

export interface OAuthCredentials {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    email: string;
}

export interface OAuthConfig {
    clientId: string;
    clientSecret?: string; // Optional for public clients
    redirectUri: string;
    scopes: string[];
    tokenRefreshBufferMs: number;
}

export interface PKCEChallenge {
    codeVerifier: string;
    codeChallenge: string;
    codeChallengeMethod: 'S256';
}

// ============================================================================
// Constants
// ============================================================================

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

const DEFAULT_CONFIG: Partial<OAuthConfig> = {
    redirectUri: 'http://localhost:9876/callback',
    scopes: ['openid', 'email', 'profile'],
    tokenRefreshBufferMs: 5 * 60 * 1000, // 5 minutes
};

// ============================================================================
// PKCE Utilities
// ============================================================================

function generatePKCEChallenge(): PKCEChallenge {
    // Generate a random 32-byte code verifier
    const codeVerifier = crypto.randomBytes(32)
        .toString('base64url')
        .replace(/[^a-zA-Z0-9]/g, '')
        .substring(0, 43);

    // Create SHA256 hash of verifier for challenge
    const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

    return {
        codeVerifier,
        codeChallenge,
        codeChallengeMethod: 'S256',
    };
}

function generateState(): string {
    return crypto.randomBytes(16).toString('hex');
}

// ============================================================================
// OAuth Manager Class
// ============================================================================

export class OAuthManager extends EventEmitter {
    private config: OAuthConfig;
    private callbackServer: http.Server | null = null;
    private pendingAuth: {
        pkce: PKCEChallenge;
        state: string;
        resolve: (creds: OAuthCredentials) => void;
        reject: (err: Error) => void;
    } | null = null;

    constructor(config: Partial<OAuthConfig> & { clientId: string }) {
        super();
        this.config = {
            ...DEFAULT_CONFIG,
            ...config,
        } as OAuthConfig;
    }

    // --------------------------------------------------------------------------
    // Public API
    // --------------------------------------------------------------------------

    /**
     * Start the OAuth authentication flow.
     * Opens browser to Google consent screen and waits for callback.
     */
    async startAuthFlow(): Promise<OAuthCredentials> {
        // Generate PKCE challenge
        const pkce = generatePKCEChallenge();
        const state = generateState();

        // Build authorization URL
        const authUrl = this.buildAuthUrl(pkce, state);

        // Start callback server
        await this.startCallbackServer();

        // Create promise for auth completion
        return new Promise<OAuthCredentials>((resolve, reject) => {
            this.pendingAuth = { pkce, state, resolve, reject };

            // Emit event with auth URL (caller opens browser)
            this.emit('auth:url', authUrl);

            // Set timeout for auth flow (5 minutes)
            setTimeout(() => {
                if (this.pendingAuth) {
                    this.pendingAuth.reject(new Error('Authentication timeout'));
                    this.cleanup();
                }
            }, 5 * 60 * 1000);
        });
    }

    /**
     * Refresh an expired access token using the refresh token.
     */
    async refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            refresh_token: credentials.refreshToken,
            grant_type: 'refresh_token',
        });

        if (this.config.clientSecret) {
            params.append('client_secret', this.config.clientSecret);
        }

        const response = await fetch(GOOGLE_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Token refresh failed: ${response.status}`);
        }

        const tokens = await response.json() as {
            access_token: string;
            refresh_token?: string;
            expires_in: number;
        };

        return {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token || credentials.refreshToken,
            expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
            email: credentials.email,
        };
    }

    /**
     * Revoke the access and refresh tokens.
     */
    async revokeToken(credentials: OAuthCredentials): Promise<void> {
        // Revoke access token
        const response = await fetch(`${GOOGLE_REVOKE_URL}?token=${credentials.accessToken}`, {
            method: 'POST',
        });

        if (!response.ok && response.status !== 400) {
            throw new Error(`Token revocation failed: ${response.status}`);
        }
    }

    /**
     * Check if the token is still valid (not expired).
     */
    isTokenValid(credentials: OAuthCredentials): boolean {
        const bufferTime = this.config.tokenRefreshBufferMs;
        return credentials.expiresAt.getTime() > Date.now() + bufferTime;
    }

    /**
     * Check if token needs refresh (within buffer window).
     */
    needsRefresh(credentials: OAuthCredentials): boolean {
        return !this.isTokenValid(credentials);
    }

    /**
     * Get valid credentials, refreshing if necessary.
     */
    async getValidCredentials(credentials: OAuthCredentials): Promise<OAuthCredentials> {
        if (this.isTokenValid(credentials)) {
            return credentials;
        }
        return this.refreshToken(credentials);
    }

    // --------------------------------------------------------------------------
    // Private Methods
    // --------------------------------------------------------------------------

    private buildAuthUrl(pkce: PKCEChallenge, state: string): string {
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            response_type: 'code',
            scope: this.config.scopes.join(' '),
            state,
            code_challenge: pkce.codeChallenge,
            code_challenge_method: pkce.codeChallengeMethod,
            access_type: 'offline',
            prompt: 'consent',
        });

        return `${GOOGLE_AUTH_URL}?${params.toString()}`;
    }

    private async startCallbackServer(): Promise<void> {
        if (this.callbackServer) {
            return;
        }

        const redirectUrl = new URL(this.config.redirectUri);
        const port = parseInt(redirectUrl.port) || 9876;
        const path = redirectUrl.pathname;

        return new Promise((resolve, reject) => {
            this.callbackServer = http.createServer(async (req, res) => {
                const requestUrl = new URL(req.url || '', `http://localhost:${port}`);

                if (requestUrl.pathname !== path) {
                    res.writeHead(404);
                    res.end('Not Found');
                    return;
                }

                const code = requestUrl.searchParams.get('code');
                const state = requestUrl.searchParams.get('state');
                const error = requestUrl.searchParams.get('error');

                if (error) {
                    res.writeHead(400, { 'Content-Type': 'text/html' });
                    res.end('<html><body><h1>Authentication Failed</h1><p>You can close this window.</p></body></html>');
                    this.pendingAuth?.reject(new Error(`OAuth error: ${error}`));
                    this.cleanup();
                    return;
                }

                if (!code || !state) {
                    res.writeHead(400);
                    res.end('Missing code or state');
                    return;
                }

                // Validate state
                if (state !== this.pendingAuth?.state) {
                    res.writeHead(400);
                    res.end('Invalid state parameter');
                    this.pendingAuth?.reject(new Error('State mismatch - possible CSRF attack'));
                    this.cleanup();
                    return;
                }

                try {
                    // Exchange code for tokens
                    const credentials = await this.exchangeCodeForTokens(code);

                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end('<html><body><h1>Authentication Successful!</h1><p>You can close this window.</p></body></html>');

                    this.pendingAuth?.resolve(credentials);
                } catch (err) {
                    res.writeHead(500, { 'Content-Type': 'text/html' });
                    res.end('<html><body><h1>Authentication Failed</h1><p>Please try again.</p></body></html>');
                    this.pendingAuth?.reject(err as Error);
                } finally {
                    this.cleanup();
                }
            });

            this.callbackServer.listen(port, () => {
                resolve();
            });

            this.callbackServer.on('error', (err) => {
                reject(err);
            });
        });
    }

    private async exchangeCodeForTokens(code: string): Promise<OAuthCredentials> {
        if (!this.pendingAuth) {
            throw new Error('No pending auth flow');
        }

        const params = new URLSearchParams({
            client_id: this.config.clientId,
            code,
            code_verifier: this.pendingAuth.pkce.codeVerifier,
            grant_type: 'authorization_code',
            redirect_uri: this.config.redirectUri,
        });

        if (this.config.clientSecret) {
            params.append('client_secret', this.config.clientSecret);
        }

        const response = await fetch(GOOGLE_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Token exchange failed: ${response.status}`);
        }

        const tokens = await response.json() as {
            access_token: string;
            refresh_token: string;
            expires_in: number;
        };

        // Get user email from userinfo endpoint
        const userInfo = await this.getUserInfo(tokens.access_token);

        return {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
            email: userInfo.email,
        };
    }

    private async getUserInfo(accessToken: string): Promise<{ email: string }> {
        const response = await fetch(GOOGLE_USERINFO_URL, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
            throw new Error('Failed to get user info');
        }

        return response.json() as Promise<{ email: string }>;
    }

    private cleanup(): void {
        if (this.callbackServer) {
            this.callbackServer.close();
            this.callbackServer = null;
        }
        this.pendingAuth = null;
    }
}

export default OAuthManager;
