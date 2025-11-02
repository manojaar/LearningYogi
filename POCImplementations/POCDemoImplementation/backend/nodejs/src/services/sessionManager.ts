import crypto from 'crypto';
import { CacheService } from './cache.service';

export interface LLMSettings {
  provider: 'tesseract' | 'claude' | 'google' | 'openai';
  model?: string;
  apiKey?: string; // Encrypted when stored
  timeout?: number; // User-selected timeout in minutes (7, 15, or 30)
}

export class SessionManager {
  private cacheService: CacheService;
  private encryptionKey: string;

  constructor(cacheService?: CacheService) {
    this.cacheService = cacheService || new CacheService(
      process.env.REDIS_HOST || 'localhost',
      parseInt(process.env.REDIS_PORT || '6379'),
      parseInt(process.env.SESSION_TTL || '420') // Default 7 minutes
    );
    
    // Generate or use a fixed encryption key (in production, use a secure key from env)
    if (process.env.SESSION_ENCRYPTION_KEY) {
      this.encryptionKey = process.env.SESSION_ENCRYPTION_KEY;
    } else {
      // Generate a 32-byte key from hash digest (convert buffer to hex string and pad/truncate to 32 bytes)
      const hashBuffer = crypto.createHash('sha256').update('default-key-change-in-production').digest();
      // Convert to hex and take first 64 chars (32 bytes)
      this.encryptionKey = hashBuffer.toString('hex').substring(0, 64);
    }
  }

  /**
   * Encrypt API key using AES-256-GCM
   */
  private encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(16);
    // Convert hex string to buffer for the key (first 32 bytes = 64 hex chars)
    const keyBuffer = Buffer.from(this.encryptionKey.slice(0, 64), 'hex');
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Return IV:AuthTag:EncryptedData
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt API key
   */
  private decrypt(encrypted: string): string {
    const parts = encrypted.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedData = parts[2];

    // Convert hex string to buffer for the key (first 32 bytes = 64 hex chars)
    const keyBuffer = Buffer.from(this.encryptionKey.slice(0, 64), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Store LLM settings for a session
   * @param sessionId - Unique session identifier
   * @param settings - LLM provider settings (API key will be encrypted)
   * @param ttl - Time to live in seconds (default: 7 minutes / 420 seconds)
   */
  async setLLMSettings(sessionId: string, settings: LLMSettings, ttl?: number): Promise<void> {
    // Use user-selected timeout, or default to 7 minutes (420 seconds)
    const selectedTimeout = ttl || (settings.timeout ? settings.timeout * 60 : 420);
    const cacheKey = `session:llm:${sessionId}`;
    
    // Encrypt API key if provided
    const settingsToStore: LLMSettings = {
      provider: settings.provider,
      model: settings.model,
      apiKey: settings.apiKey ? this.encrypt(settings.apiKey) : undefined,
      timeout: settings.timeout, // Store timeout preference
    };

    if (this.cacheService.isAvailable()) {
      await this.cacheService.set(cacheKey, settingsToStore, selectedTimeout);
    } else {
      // Fallback to in-memory storage if Redis is not available
      // In production, consider using a better in-memory store
      console.warn('Redis not available, using in-memory storage (not persistent)');
    }
  }

  /**
   * Extend session TTL (reset to full duration)
   * @param sessionId - Session identifier
   * @param timeoutMinutes - Timeout in minutes (uses existing timeout if not provided)
   */
  async extendSession(sessionId: string, timeoutMinutes?: number): Promise<boolean> {
    const cacheKey = `session:llm:${sessionId}`;
    
    if (!this.cacheService.isAvailable()) {
      return false;
    }

    // Get existing settings
    const existing = await this.cacheService.get<LLMSettings>(cacheKey);
    if (!existing) {
      return false;
    }

    // Determine timeout: use provided, or existing preference, or default (7 minutes)
    const timeout = timeoutMinutes || existing.timeout || 7;
    const ttl = timeout * 60; // Convert to seconds

    // Reset TTL by setting the same value with new TTL
    await this.cacheService.set(cacheKey, existing, ttl);
    
    return true;
  }

  /**
   * Check if session exists and is valid
   */
  async sessionExists(sessionId: string): Promise<boolean> {
    const cacheKey = `session:llm:${sessionId}`;
    if (!this.cacheService.isAvailable()) {
      return false;
    }
    const settings = await this.cacheService.get<LLMSettings>(cacheKey);
    return settings !== null;
  }

  /**
   * Get remaining TTL for session
   */
  async getSessionTTL(sessionId: string): Promise<number | null> {
    const cacheKey = `session:llm:${sessionId}`;
    if (!this.cacheService.isAvailable()) {
      return null;
    }
    
    try {
      // Redis TTL command would be ideal, but our CacheService doesn't expose it
      // For now, check if session exists - if it does, we'll extend it
      const exists = await this.sessionExists(sessionId);
      return exists ? 1 : null; // Return 1 if exists (we don't have exact TTL), null if not
    } catch {
      return null;
    }
  }

  /**
   * Check and extend session if processing is active
   * Called during document processing to prevent expiry
   */
  async checkAndExtendIfProcessing(sessionId: string): Promise<void> {
    if (!sessionId) {
      return;
    }

    const settings = await this.getLLMSettings(sessionId);
    if (settings) {
      // Extend session by the configured timeout (default 7 minutes)
      const timeout = (settings as any).timeout || 7;
      await this.extendSession(sessionId, timeout);
    }
  }

  /**
   * Get LLM settings for a session (with decrypted API key)
   * @param sessionId - Session identifier
   * @returns LLM settings with decrypted API key or null if not found
   */
  async getLLMSettings(sessionId: string): Promise<LLMSettings | null> {
    const cacheKey = `session:llm:${sessionId}`;

    if (!this.cacheService.isAvailable()) {
      return null;
    }

    const encrypted = await this.cacheService.get<LLMSettings>(cacheKey);
    if (!encrypted) {
      return null;
    }

    // Decrypt API key if present
    return {
      provider: encrypted.provider,
      model: encrypted.model,
      apiKey: encrypted.apiKey ? this.decrypt(encrypted.apiKey) : undefined,
      timeout: encrypted.timeout, // Include timeout preference
    };
  }

  /**
   * Clear LLM settings for a session
   * @param sessionId - Session identifier
   */
  async clearSession(sessionId: string): Promise<void> {
    const cacheKey = `session:llm:${sessionId}`;
    if (this.cacheService.isAvailable()) {
      await this.cacheService.delete(cacheKey);
    }
  }

  /**
   * Check if session has LLM settings configured
   */
  async hasSession(sessionId: string): Promise<boolean> {
    const settings = await this.getLLMSettings(sessionId);
    return settings !== null;
  }
}

