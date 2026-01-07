/**
 * Secure Credential Storage
 * 
 * Stores OAuth tokens securely using:
 * - OS Keychain (keytar) for encryption key storage
 * - AES-256-GCM for token encryption
 * - PBKDF2 fallback for headless environments
 * 
 * Security Architecture:
 * - Encryption key stored in OS keychain (never on disk)
 * - Tokens encrypted before disk write
 * - Atomic file operations (temp-file-and-rename)
 */

import * as crypto from 'crypto';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { OAuthCredentials } from './oauth-manager';

// ============================================================================
// Types
// ============================================================================

interface EncryptedData {
    iv: string;       // Base64 encoded IV
    authTag: string;  // Base64 encoded auth tag
    data: string;     // Base64 encoded encrypted data
    version: number;  // Schema version for future migrations
}

interface StorageConfig {
    serviceName: string;
    accountName: string;
    tokenDir: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: StorageConfig = {
    serviceName: 'cc-mirror-antigravity',
    accountName: 'encryption-key',
    tokenDir: path.join(os.homedir(), '.cc-mirror', 'tokens'),
};

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;  // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const PBKDF2_ITERATIONS = 100000;
const SCHEMA_VERSION = 1;

// ============================================================================
// Credential Store Class
// ============================================================================

export class CredentialStore {
    private config: StorageConfig;
    private encryptionKey: Buffer | null = null;
    private keytarAvailable: boolean = false;
    private keytar: typeof import('keytar') | null = null;

    constructor(config: Partial<StorageConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // --------------------------------------------------------------------------
    // Public API
    // --------------------------------------------------------------------------

    /**
     * Initialize the credential store (load or generate encryption key).
     */
    async initialize(): Promise<void> {
        // Ensure token directory exists
        await fs.ensureDir(this.config.tokenDir);

        // Try to load keytar (optional dependency)
        try {
            this.keytar = await import('keytar');
            this.keytarAvailable = true;
        } catch {
            this.keytarAvailable = false;
            console.warn('[CredentialStore] keytar not available, using PBKDF2 fallback');
        }

        // Load or generate encryption key
        this.encryptionKey = await this.getOrCreateEncryptionKey();
    }

    /**
     * Save OAuth credentials for an account.
     */
    async saveToken(email: string, credentials: OAuthCredentials): Promise<void> {
        if (!this.encryptionKey) {
            throw new Error('CredentialStore not initialized');
        }

        const plaintext = JSON.stringify({
            accessToken: credentials.accessToken,
            refreshToken: credentials.refreshToken,
            expiresAt: credentials.expiresAt.toISOString(),
            email: credentials.email,
        });

        const encrypted = this.encrypt(plaintext);
        const filePath = this.getTokenPath(email);
        const tempPath = `${filePath}.tmp`;

        // Atomic write: write to temp file, then rename
        await fs.writeJson(tempPath, encrypted);
        await fs.rename(tempPath, filePath);
    }

    /**
     * Load OAuth credentials for an account.
     */
    async loadToken(email: string): Promise<OAuthCredentials | null> {
        if (!this.encryptionKey) {
            throw new Error('CredentialStore not initialized');
        }

        const filePath = this.getTokenPath(email);

        if (!await fs.pathExists(filePath)) {
            return null;
        }

        try {
            const encrypted: EncryptedData = await fs.readJson(filePath);
            const plaintext = this.decrypt(encrypted);
            const data = JSON.parse(plaintext);

            return {
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
                expiresAt: new Date(data.expiresAt),
                email: data.email,
            };
        } catch (err) {
            console.error('[CredentialStore] Failed to decrypt token, may be corrupted');
            return null;
        }
    }

    /**
     * Delete OAuth credentials for an account.
     */
    async deleteToken(email: string): Promise<void> {
        const filePath = this.getTokenPath(email);
        await fs.remove(filePath);
    }

    /**
     * List all stored account emails.
     */
    async listAccounts(): Promise<string[]> {
        if (!await fs.pathExists(this.config.tokenDir)) {
            return [];
        }

        const files = await fs.readdir(this.config.tokenDir);
        return files
            .filter(f => f.endsWith('.enc'))
            .map(f => this.emailFromFilename(f));
    }

    /**
     * Clear all stored tokens.
     */
    async clearAll(): Promise<void> {
        await fs.emptyDir(this.config.tokenDir);
    }

    // --------------------------------------------------------------------------
    // Encryption Key Management
    // --------------------------------------------------------------------------

    private async getOrCreateEncryptionKey(): Promise<Buffer> {
        if (this.keytarAvailable && this.keytar) {
            // Try to get key from keychain
            const existingKey = await this.keytar.getPassword(
                this.config.serviceName,
                this.config.accountName
            );

            if (existingKey) {
                return Buffer.from(existingKey, 'base64');
            }

            // Generate and store new key
            const newKey = crypto.randomBytes(KEY_LENGTH);
            await this.keytar.setPassword(
                this.config.serviceName,
                this.config.accountName,
                newKey.toString('base64')
            );
            return newKey;
        }

        // Fallback: derive key from machine-specific data
        return this.deriveKeyFromMachine();
    }

    private async deriveKeyFromMachine(): Promise<Buffer> {
        // Use deterministic machine-specific data for headless environments
        const machineId = await this.getMachineId();
        const salt = 'cc-mirror-antigravity-v1';

        return new Promise((resolve, reject) => {
            crypto.pbkdf2(
                machineId,
                salt,
                PBKDF2_ITERATIONS,
                KEY_LENGTH,
                'sha256',
                (err, key) => {
                    if (err) reject(err);
                    else resolve(key);
                }
            );
        });
    }

    private async getMachineId(): Promise<string> {
        // Try multiple sources for machine identification
        const sources = [
            process.env.MACHINE_ID,
            os.hostname(),
            os.userInfo().username,
        ].filter(Boolean);

        return sources.join('-');
    }

    // --------------------------------------------------------------------------
    // Encryption / Decryption
    // --------------------------------------------------------------------------

    private encrypt(plaintext: string): EncryptedData {
        if (!this.encryptionKey) {
            throw new Error('No encryption key available');
        }

        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(
            ENCRYPTION_ALGORITHM,
            this.encryptionKey,
            iv,
            { authTagLength: AUTH_TAG_LENGTH }
        );

        const encrypted = Buffer.concat([
            cipher.update(plaintext, 'utf8'),
            cipher.final(),
        ]);

        return {
            iv: iv.toString('base64'),
            authTag: cipher.getAuthTag().toString('base64'),
            data: encrypted.toString('base64'),
            version: SCHEMA_VERSION,
        };
    }

    private decrypt(encrypted: EncryptedData): string {
        if (!this.encryptionKey) {
            throw new Error('No encryption key available');
        }

        const iv = Buffer.from(encrypted.iv, 'base64');
        const authTag = Buffer.from(encrypted.authTag, 'base64');
        const data = Buffer.from(encrypted.data, 'base64');

        const decipher = crypto.createDecipheriv(
            ENCRYPTION_ALGORITHM,
            this.encryptionKey,
            iv,
            { authTagLength: AUTH_TAG_LENGTH }
        );

        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([
            decipher.update(data),
            decipher.final(),
        ]);

        return decrypted.toString('utf8');
    }

    // --------------------------------------------------------------------------
    // File Helpers
    // --------------------------------------------------------------------------

    private getTokenPath(email: string): string {
        // Sanitize email for safe filename
        const safeEmail = email.replace(/[^a-zA-Z0-9@._-]/g, '_');
        return path.join(this.config.tokenDir, `${safeEmail}.enc`);
    }

    private emailFromFilename(filename: string): string {
        return filename.replace('.enc', '');
    }
}

export default CredentialStore;
