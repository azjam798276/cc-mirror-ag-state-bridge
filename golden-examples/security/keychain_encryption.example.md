---
id: "aes_256_gcm_with_keychain"
source: "cc-mirror Antigravity State Bridge ADD v1.0"
tags: ["typescript", "security", "encryption", "keychain", "oauth"]
---

## Problem

OAuth tokens must be stored encrypted on disk, but hardcoded encryption keys are insecure. Need to use OS-native keychains (Keychain Access on macOS, Credential Manager on Windows, libsecret on Linux) for key storage, with graceful fallback for headless servers.

## Solution

```typescript
import * as crypto from 'crypto';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as keytar from 'keytar';
import { machineId } from 'node-machine-id';

export interface EncryptedData {
  iv: string;           // Initialization vector (hex)
  authTag: string;      // Authentication tag (hex)
  data: string;         // Encrypted data (hex)
  algorithm: string;    // "aes-256-gcm"
  version: number;      // Format version for future compatibility
}

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date: number;
  token_type: string;
  email: string;
}

/**
 * Manages encryption keys using OS keychain with fallback to machine-ID derivation.
 */
class KeyStore {
  private readonly serviceName = 'cc-mirror-antigravity';
  private readonly accountName = 'encryption-key';
  private readonly fallbackSalt = 'cc-mirror-v1-salt-2026'; // Version-specific salt
  
  // Cache the key in memory to avoid repeated keychain access
  private keyCache: Buffer | null = null;

  /**
   * Get encryption key from OS keychain, or derive from machine ID if unavailable.
   */
  async getKey(): Promise<Buffer> {
    // Return cached key if available
    if (this.keyCache) {
      return this.keyCache;
    }

    // Try OS keychain first
    if (await this.isKeychainAvailable()) {
      try {
        const key = await this.getFromKeychain();
        this.keyCache = key;
        return key;
      } catch (error) {
        console.warn('[KeyStore] Keychain access failed, using machine-ID fallback');
        console.debug('[KeyStore] Error:', error);
      }
    }

    // Fallback to machine-ID derivation (headless mode)
    console.warn('[KeyStore] ⚠️  Using machine-ID key derivation (reduced security)');
    console.warn('[KeyStore] This is normal for headless servers, but not recommended for desktops.');
    
    const key = await this.getFromMachineId();
    this.keyCache = key;
    return key;
  }

  /**
   * Clear cached key (useful for testing or key rotation).
   */
  clearCache(): void {
    this.keyCache = null;
  }

  // ========== PRIVATE METHODS ==========

  private async isKeychainAvailable(): Promise<boolean> {
    try {
      // Attempt to query keychain - will throw if unavailable
      await keytar.findCredentials(this.serviceName);
      return true;
    } catch (error) {
      return false;
    }
  }

  private async getFromKeychain(): Promise<Buffer> {
    // Try to retrieve existing key
    let keyHex = await keytar.getPassword(this.serviceName, this.accountName);

    if (!keyHex) {
      // Generate new 256-bit key
      keyHex = crypto.randomBytes(32).toString('hex');
      
      // Store in keychain
      await keytar.setPassword(this.serviceName, this.accountName, keyHex);
      
      console.info('[KeyStore] Generated new encryption key (stored in OS keychain)');
    }

    return Buffer.from(keyHex, 'hex');
  }

  private async getFromMachineId(): Promise<Buffer> {
    // Get stable machine identifier
    const id = await machineId();
    
    // Derive key using PBKDF2 (slow hash function for security)
    return new Promise<Buffer>((resolve, reject) => {
      crypto.pbkdf2(
        id,                      // Password
        this.fallbackSalt,       // Salt
        100000,                  // Iterations (100k is OWASP recommendation)
        32,                      // Key length (256 bits)
        'sha256',                // Hash algorithm
        (err, derivedKey) => {
          if (err) reject(err);
          else resolve(derivedKey);
        }
      );
    });
  }
}

/**
 * Encrypts and decrypts OAuth tokens using AES-256-GCM.
 */
export class SecureTokenStorage {
  private keyStore: KeyStore;
  private readonly tokenDir: string;

  constructor(baseDir?: string) {
    this.keyStore = new KeyStore();
    this.tokenDir = baseDir || path.join(os.homedir(), '.cc-mirror', 'antigravity-tokens');
    
    // Ensure token directory exists
    fs.ensureDirSync(this.tokenDir, { mode: 0o700 }); // Owner-only permissions
  }

  /**
   * Encrypt and store OAuth tokens for an email account.
   */
  async store(email: string, tokens: OAuthTokens): Promise<void> {
    // Get encryption key
    const key = await this.keyStore.getKey();

    // Encrypt tokens
    const encrypted = await this.encrypt(tokens, key);

    // Write to filesystem
    const filePath = this.getTokenFilePath(email);
    await fs.writeJSON(filePath, encrypted, { 
      spaces: 2,
      mode: 0o600 // Owner read/write only
    });

    console.info(`[SecureTokenStorage] Stored encrypted tokens for ${email}`);
  }

  /**
   * Retrieve and decrypt OAuth tokens for an email account.
   */
  async retrieve(email: string): Promise<OAuthTokens> {
    const filePath = this.getTokenFilePath(email);

    // Check if file exists
    if (!await fs.pathExists(filePath)) {
      throw new Error(`No tokens found for ${email}. Run 'cc-mirror antigravity login' first.`);
    }

    // Read encrypted data
    const encrypted: EncryptedData = await fs.readJSON(filePath);

    // Get encryption key
    const key = await this.keyStore.getKey();

    // Decrypt
    return await this.decrypt(encrypted, key);
  }

  /**
   * Delete tokens for an account.
   */
  async remove(email: string): Promise<void> {
    const filePath = this.getTokenFilePath(email);
    await fs.remove(filePath);
    console.info(`[SecureTokenStorage] Removed tokens for ${email}`);
  }

  /**
   * List all accounts with stored tokens.
   */
  async listAccounts(): Promise<string[]> {
    const files = await fs.readdir(this.tokenDir);
    return files
      .filter(f => f.endsWith('.enc'))
      .map(f => f.replace('.enc', ''));
  }

  // ========== ENCRYPTION METHODS ==========

  private async encrypt(data: any, key: Buffer): Promise<EncryptedData> {
    // Generate random IV (12 bytes for GCM)
    const iv = crypto.randomBytes(12);

    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    // Encrypt data
    const plaintext = JSON.stringify(data);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get authentication tag (for integrity verification)
    const authTag = cipher.getAuthTag();

    return {
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      data: encrypted,
      algorithm: 'aes-256-gcm',
      version: 1
    };
  }

  private async decrypt(encrypted: EncryptedData, key: Buffer): Promise<any> {
    // Verify algorithm
    if (encrypted.algorithm !== 'aes-256-gcm') {
      throw new Error(`Unsupported encryption algorithm: ${encrypted.algorithm}`);
    }

    // Create decipher
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(encrypted.iv, 'hex')
    );

    // Set authentication tag (will throw if data was tampered with)
    decipher.setAuthTag(Buffer.from(encrypted.authTag, 'hex'));

    // Decrypt
    let decrypted = decipher.update(encrypted.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  private getTokenFilePath(email: string): string {
    // Sanitize email for filename (replace @ and . with _)
    const safeName = email.replace(/[@.]/g, '_');
    return path.join(this.tokenDir, `${safeName}.enc`);
  }
}

// Usage Example:
async function example() {
  const storage = new SecureTokenStorage();

  // Store tokens
  const tokens: OAuthTokens = {
    access_token: 'ya29.a0AfH6...',
    refresh_token: '1//0gZxJ...',
    expiry_date: Date.now() + 3600000,
    token_type: 'Bearer',
    email: 'user@gmail.com'
  };

  await storage.store('user@gmail.com', tokens);

  // Retrieve tokens
  const retrieved = await storage.retrieve('user@gmail.com');
  console.log('Access token:', retrieved.access_token);

  // List accounts
  const accounts = await storage.listAccounts();
  console.log('Accounts:', accounts);
}
```

## Key Techniques

- **OS Keychain Integration**: Uses `keytar` library to access native keychains. This is the same approach used by VS Code, GitHub CLI, and other professional tools.

- **AES-256-GCM**: Authenticated encryption mode that provides both confidentiality and integrity. The auth tag prevents tampering attacks.

- **Random IV per encryption**: Each encryption uses a fresh random IV. This is critical for GCM mode security—never reuse IVs.

- **Machine-ID fallback**: For headless servers without keychain, derive key from machine ID using PBKDF2 (100K iterations). This is deterministic but still requires machine access.

- **File permissions**: Token files are created with mode `0o600` (owner read/write only). This prevents other users on the system from reading tokens.

- **Key caching**: The encryption key is retrieved once and cached in memory. This avoids repeated keychain queries (which can prompt for passwords).

- **Version field**: The `EncryptedData` structure includes a version number. This enables future algorithm upgrades without breaking existing tokens.

- **Graceful degradation**: If keychain is unavailable, warn user but continue with machine-ID derivation. Better than failing completely.

## References

- [AES-GCM Specification](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf) - NIST standard
- [keytar Library](https://github.com/atom/node-keytar) - Cross-platform keychain access
- [OWASP PBKDF2](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) - Key derivation best practices
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security) - Same patterns used by Electron apps
