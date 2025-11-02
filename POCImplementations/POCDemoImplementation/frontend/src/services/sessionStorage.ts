/**
 * Session Management Utility
 * Handles session ID generation and storage
 */

const SESSION_ID_KEY = 'ly_session_id';
const SESSION_PREFERENCE_KEY = 'ly_llm_preference';
const LAST_ACTIVITY_KEY = 'ly_last_activity';

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Get or create session ID
 * Session ID persists in sessionStorage (cleared when tab closes)
 */
export function getSessionId(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
  
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  
  return sessionId;
}

/**
 * Clear session ID
 */
export function clearSession(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(SESSION_ID_KEY);
    sessionStorage.removeItem(SESSION_PREFERENCE_KEY);
  }
}

/**
 * Get stored LLM preference (provider only, not API key)
 */
export function getLLMPreference(): { provider: string; model?: string } | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const preference = sessionStorage.getItem(SESSION_PREFERENCE_KEY);
  if (preference) {
    try {
      return JSON.parse(preference);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Store LLM preference (provider only, not API key)
 */
export function setLLMPreference(preference: { provider: string; model?: string }): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(SESSION_PREFERENCE_KEY, JSON.stringify(preference));
  }
}

/**
 * Check if user has already selected an LLM provider
 */
export function hasLLMPreference(): boolean {
  return getLLMPreference() !== null;
}

/**
 * Update last activity timestamp
 */
export function updateLastActivity(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  }
}

/**
 * Get last activity timestamp
 */
export function getLastActivity(): number | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const timestamp = sessionStorage.getItem(LAST_ACTIVITY_KEY);
  return timestamp ? parseInt(timestamp, 10) : null;
}

