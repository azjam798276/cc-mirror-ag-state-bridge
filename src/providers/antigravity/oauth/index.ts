/**
 * OAuth Module Index
 * 
 * Re-exports all OAuth-related components.
 */

export { OAuthManager, OAuthCredentials, OAuthConfig, PKCEChallenge } from './oauth-manager';
export { CredentialStore } from './credential-store';

// Convenience factory
import { OAuthManager, OAuthConfig } from './oauth-manager';
import { CredentialStore } from './credential-store';

export interface AuthenticationService {
    manager: OAuthManager;
    store: CredentialStore;
}

/**
 * Create a complete authentication service with manager and storage.
 */
export async function createAuthService(config: Partial<OAuthConfig> & { clientId: string }): Promise<AuthenticationService> {
    const manager = new OAuthManager(config);
    const store = new CredentialStore();
    await store.initialize();

    return { manager, store };
}
