import { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { getSessionId, setLLMPreference, hasLLMPreference, updateLastActivity } from '@/services/sessionStorage';
import { getLLMProviders, getLLMSettings, setLLMSettings, validateAPIKey, extendSession, checkSessionStatus } from '@/services/api';

export interface LLMProvider {
  id: string;
  name: string;
  description: string;
  models: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
  requiresApiKey: boolean;
}

export interface LLMSettings {
  provider: string;
  model?: string;
  hasApiKey?: boolean;
  timeout?: number;
}

interface LLMContextType {
  sessionId: string;
  providers: LLMProvider[];
  currentSettings: LLMSettings | null;
  isLoading: boolean;
  showSelector: boolean;
  setShowSelector: (show: boolean) => void;
  loadSettings: () => Promise<void>;
  saveSettings: (provider: string, model?: string, apiKey?: string, timeout?: number) => Promise<void>;
  validateKey: (provider: string, apiKey: string, model?: string) => Promise<boolean>;
}

const LLMContext = createContext<LLMContextType | undefined>(undefined);

export function LLMProvider({ children }: { children: ReactNode }) {
  const [sessionId] = useState<string>(getSessionId());
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [currentSettings, setCurrentSettings] = useState<LLMSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSelector, setShowSelector] = useState(false);
  const activityCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const extendSessionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadProviders = async () => {
    try {
      const response = await getLLMProviders();
      setProviders(response.providers);
    } catch (error) {
      console.error('Failed to load LLM providers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const settings = await getLLMSettings(sessionId);
      setCurrentSettings(settings);
      
      // Store preference (without API key)
      if (settings) {
        setLLMPreference({
          provider: settings.provider,
          model: settings.model,
        });
      }
    } catch (error) {
      console.error('Failed to load LLM settings:', error);
      // If no settings found, show selector
      setShowSelector(true);
    }
  };

  const saveSettings = async (provider: string, model?: string, apiKey?: string, timeout?: number) => {
    try {
      await setLLMSettings(sessionId, provider, model, apiKey, timeout);
      
      const settings = await getLLMSettings(sessionId);
      setCurrentSettings(settings);
      
      // Store preference (without API key)
      setLLMPreference({
        provider,
        model,
      });
      
      updateLastActivity();
      setShowSelector(false);
    } catch (error) {
      console.error('Failed to save LLM settings:', error);
      throw error;
    }
  };

  const validateKey = async (provider: string, apiKey: string, model?: string): Promise<boolean> => {
    try {
      const result = await validateAPIKey(provider, apiKey, model);
      return result.valid;
    } catch (error) {
      return false;
    }
  };

  // Set up activity tracking to extend session
  const setupActivityTracking = useCallback(() => {
    // Track user activity (mouse move, click, scroll, keypress)
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    const handleActivity = () => {
      updateLastActivity();
      
      // Debounce: only extend session every 30 seconds
      if (extendSessionTimeoutRef.current) {
        clearTimeout(extendSessionTimeoutRef.current);
      }
      
      extendSessionTimeoutRef.current = setTimeout(() => {
        if (!showSelector && sessionId) {
          // Wrap async operation to prevent unhandled rejections
          Promise.resolve().then(async () => {
            try {
              await extendSession(sessionId);
            } catch (error) {
              // If session expired, show selector
              if (error && typeof error === 'object' && 'response' in error) {
                const axiosError = error as any;
                if (axiosError.response?.status === 404) {
                  setShowSelector(true);
                }
              }
              // Silently handle other errors to prevent console noise
              // Only log unexpected errors that aren't network/404 related
              if (error && typeof error === 'object' && 'response' in error) {
                const axiosError = error as any;
                if (axiosError.response?.status !== 404 && axiosError.response?.status !== 0) {
                  console.debug('Session extension error:', error);
                }
              }
            }
          }).catch(() => {
            // Catch any errors from the promise chain itself
            // This should rarely happen, but prevents unhandled rejections
          });
        }
      }, 30000); // 30 second debounce
    };

    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Cleanup function
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      if (extendSessionTimeoutRef.current) {
        clearTimeout(extendSessionTimeoutRef.current);
        extendSessionTimeoutRef.current = null;
      }
    };
  }, [sessionId, showSelector]);

  // Set up session expiry checking
  const setupSessionExpiryCheck = useCallback(() => {
    // Clear existing interval if any
    if (activityCheckIntervalRef.current) {
      clearInterval(activityCheckIntervalRef.current);
    }

    // Check session status every 30 seconds
    activityCheckIntervalRef.current = setInterval(() => {
      if (!sessionId || showSelector) {
        return;
      }

      // Wrap async operation to prevent unhandled rejections
      Promise.resolve().then(async () => {
        try {
          const status = await checkSessionStatus(sessionId);
          if (!status.exists) {
            // Session expired - show LLM selector
            setShowSelector(true);
            // Clear local preference
            sessionStorage.removeItem('ly_llm_preference');
          }
        } catch (error) {
          // On error, assume session expired
          setShowSelector(true);
          sessionStorage.removeItem('ly_llm_preference');
          // Only log unexpected errors (not network issues)
          if (error && typeof error === 'object' && 'response' in error) {
            const axiosError = error as any;
            if (axiosError.response?.status !== 404 && axiosError.response?.status !== 0) {
              console.debug('Session status check error:', error);
            }
          }
        }
      }).catch(() => {
        // Catch any errors from the promise chain itself
        // This should rarely happen, but prevents unhandled rejections
      });
    }, 30000); // Check every 30 seconds
  }, [sessionId, showSelector]);

  // Load providers on mount
  useEffect(() => {
    loadProviders();
    
    // Check if user needs to select LLM on first visit
    if (!hasLLMPreference()) {
      setShowSelector(true);
    } else {
      loadSettings();
    }
  }, []);

  // Set up activity tracking and session expiry check
  useEffect(() => {
    if (showSelector) {
      // Don't track activity if selector is showing
      return;
    }

    // Set up activity tracking for session extension
    const cleanupActivity = setupActivityTracking();
    setupSessionExpiryCheck();

    // Cleanup on unmount or when selector shows
    return () => {
      if (cleanupActivity) {
        cleanupActivity();
      }
      if (activityCheckIntervalRef.current) {
        clearInterval(activityCheckIntervalRef.current);
        activityCheckIntervalRef.current = null;
      }
      if (extendSessionTimeoutRef.current) {
        clearTimeout(extendSessionTimeoutRef.current);
        extendSessionTimeoutRef.current = null;
      }
    };
  }, [showSelector, sessionId, setupActivityTracking, setupSessionExpiryCheck]);

  return (
    <LLMContext.Provider
      value={{
        sessionId,
        providers,
        currentSettings,
        isLoading,
        showSelector,
        setShowSelector,
        loadSettings,
        saveSettings,
        validateKey,
      }}
    >
      {children}
    </LLMContext.Provider>
  );
}

export function useLLM() {
  const context = useContext(LLMContext);
  if (context === undefined) {
    throw new Error('useLLM must be used within an LLMProvider');
  }
  return context;
}

