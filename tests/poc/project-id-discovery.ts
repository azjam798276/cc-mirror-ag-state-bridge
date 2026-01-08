/**
 * S6-000 PoC: Project ID Discovery (Self-Contained)
 *
 * This PoC validates:
 * 1. OAuth flow via browser-based Google login
 * 2. Project ID discovery via v1internal:loadCodeAssist
 * 3. Response schema (cloudaicompanionProject field)
 *
 * Core logic extracted from opencode-antigravity-auth library.
 * 
 * Usage:
 *   npx ts-node tests/poc/project-id-discovery.ts
 */

import { exec } from 'node:child_process';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import * as crypto from 'node:crypto';

// ============================================
// Constants (from opencode-antigravity-auth)
// ============================================
const ANTIGRAVITY_CLIENT_ID = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com';
const ANTIGRAVITY_CLIENT_SECRET = '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';
const ANTIGRAVITY_SCOPES = [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
];
const CALLBACK_PORT = 51121;
const ANTIGRAVITY_REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/oauth-callback`;

const ANTIGRAVITY_LOAD_ENDPOINTS = [
    'https://cloudcode-pa.googleapis.com',
    'https://daily-cloudcode-pa.sandbox.googleapis.com',
    'https://autopush-cloudcode-pa.sandbox.googleapis.com',
];

// ============================================
// PKCE Implementation
// ============================================
function generatePKCE(): { verifier: string; challenge: string } {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto
        .createHash('sha256')
        .update(verifier)
        .digest('base64url');
    return { verifier, challenge };
}

// ============================================
// OAuth URL Generation
// ============================================
function buildAuthorizationUrl(pkce: { verifier: string; challenge: string }): string {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', ANTIGRAVITY_CLIENT_ID);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', ANTIGRAVITY_REDIRECT_URI);
    url.searchParams.set('scope', ANTIGRAVITY_SCOPES.join(' '));
    url.searchParams.set('code_challenge', pkce.challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('state', Buffer.from(JSON.stringify({ verifier: pkce.verifier })).toString('base64url'));
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    return url.toString();
}

// ============================================
// Browser Open
// ============================================
function openBrowser(url: string): void {
    const platform = process.platform;
    if (platform === 'darwin') {
        exec(`open "${url}"`);
    } else if (platform === 'win32') {
        exec(`start "" "${url}"`);
    } else {
        exec(`xdg-open "${url}"`);
    }
}

// ============================================
// OAuth Callback Server
// ============================================
async function waitForOAuthCallback(): Promise<{ code: string; state: string }> {
    return new Promise((resolve, reject) => {
        const server = createServer((req: IncomingMessage, res: ServerResponse) => {
            const url = new URL(req.url || '', `http://localhost:${CALLBACK_PORT}`);
            if (url.pathname === '/oauth-callback') {
                const code = url.searchParams.get('code');
                const state = url.searchParams.get('state');
                if (code && state) {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end('<h1>✅ Success! Return to terminal.</h1>');
                    server.close();
                    resolve({ code, state });
                } else {
                    res.writeHead(400);
                    res.end('Missing params');
                    server.close();
                    reject(new Error('OAuth callback missing parameters'));
                }
            } else {
                res.writeHead(404);
                res.end('Not Found');
            }
        });
        server.listen(CALLBACK_PORT, () => {
            console.log(`[PoC] OAuth callback server listening on port ${CALLBACK_PORT}`);
        });
        setTimeout(() => { server.close(); reject(new Error('Timeout')); }, 120000);
    });
}

// ============================================
// Token Exchange
// ============================================
async function exchangeCodeForTokens(code: string, verifier: string): Promise<any> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: ANTIGRAVITY_CLIENT_ID,
            client_secret: ANTIGRAVITY_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: ANTIGRAVITY_REDIRECT_URI,
            code_verifier: verifier,
        }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token exchange failed: ${errorText}`);
    }
    return response.json();
}

// ============================================
// Project ID Fetch (Core validation target)
// ============================================
async function fetchProjectID(accessToken: string): Promise<{ projectId: string; rawResponse: any; endpoint: string; latency: number }> {
    for (const baseEndpoint of ANTIGRAVITY_LOAD_ENDPOINTS) {
        const url = `${baseEndpoint}/v1internal:loadCodeAssist`;
        console.log(`[PoC] Trying endpoint: ${url}`);

        const start = Date.now();
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'cc-mirror-poc/1.0',
                },
                body: JSON.stringify({
                    metadata: {
                        ideType: 'IDE_UNSPECIFIED',
                        platform: 'PLATFORM_UNSPECIFIED',
                        pluginType: 'GEMINI',
                    },
                }),
            });
            const latency = Date.now() - start;

            if (!response.ok) {
                console.log(`[PoC]   ❌ ${response.status} ${response.statusText} (${latency}ms)`);
                continue;
            }

            const data = await response.json();
            console.log(`[PoC]   ✅ ${response.status} (${latency}ms)`);

            // Extract project ID (library uses cloudaicompanionProject)
            let projectId = '';
            if (typeof data.cloudaicompanionProject === 'string') {
                projectId = data.cloudaicompanionProject;
            } else if (data.cloudaicompanionProject?.id) {
                projectId = data.cloudaicompanionProject.id;
            }

            return { projectId, rawResponse: data, endpoint: baseEndpoint, latency };
        } catch (err) {
            console.log(`[PoC]   ❌ Network error: ${err}`);
        }
    }
    throw new Error('All endpoints failed');
}

// ============================================
// Main
// ============================================
async function main() {
    console.log('='.repeat(60));
    console.log('S6-000 PoC: Project ID Discovery Validation');
    console.log('='.repeat(60));
    console.log('');

    // Step 1: Generate PKCE and auth URL
    console.log('[Step 1] Generating OAuth authorization URL...');
    const pkce = generatePKCE();
    const authUrl = buildAuthorizationUrl(pkce);
    console.log('[Step 1] Opening browser for Google login...');
    openBrowser(authUrl);
    console.log('>>> Please log in with your Google account <<<');
    console.log('');

    // Step 2: Wait for callback
    console.log('[Step 2] Waiting for OAuth callback...');
    const { code, state } = await waitForOAuthCallback();
    const decodedState = JSON.parse(Buffer.from(state.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    console.log('[Step 2] Received OAuth callback!');
    console.log('');

    // Step 3: Exchange code for tokens
    console.log('[Step 3] Exchanging authorization code for tokens...');
    const tokens = await exchangeCodeForTokens(code, decodedState.verifier);
    console.log(`[Step 3] Access token received (expires in ${tokens.expires_in}s)`);
    console.log('');

    // Step 4: Fetch Project ID (THE KEY VALIDATION)
    console.log('[Step 4] Fetching Project ID via v1internal:loadCodeAssist...');
    const result = await fetchProjectID(tokens.access_token);

    // Results
    console.log('');
    console.log('='.repeat(60));
    console.log('PoC RESULTS');
    console.log('='.repeat(60));
    console.log(`Endpoint Used:    ${result.endpoint}`);
    console.log(`Latency:          ${result.latency}ms`);
    console.log(`Project ID:       ${result.projectId || 'NOT FOUND'}`);
    console.log('');
    console.log('Raw Response:');
    console.log(JSON.stringify(result.rawResponse, null, 2));
    console.log('');

    if (result.projectId) {
        console.log('🎉 VALIDATION PASSED: Project ID discovery works!');
        console.log('');
        console.log('ADD v3.0 Update Required:');
        console.log('  - Response field: `cloudaicompanionProject` (confirmed)');
        process.exit(0);
    } else {
        console.log('⚠️  WARNING: Project ID not returned.');
        process.exit(1);
    }
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
