import { Router, Request, Response } from 'express';
import { SessionManager, LLMSettings } from '../services/sessionManager';
import { LLMProviderService } from '../services/llmProvider.service';
import { formatApiError } from '../services/errorFormatter';

/**
 * Create LLM settings router
 */
export function createLLMSettingsRouter(sessionManager: SessionManager): Router {
  const router = Router();

  /**
   * Get available LLM providers
   * GET /api/v1/llm/providers
   */
  router.get('/providers', (req: Request, res: Response) => {
    try {
      const providers = LLMProviderService.getProviders();
      res.json({ providers });
    } catch (error: any) {
      res.status(500).json(formatApiError(error, 500));
    }
  });

  /**
   * Get current LLM settings for session
   * GET /api/v1/llm/settings
   * 
   * If x-internal-request header is present, returns API key for internal services (chatbot)
   */
  router.get('/settings', async (req: Request, res: Response) => {
    try {
      const sessionId = req.headers['x-session-id'] as string || req.query.sessionId as string;
      const isInternalRequest = req.headers['x-internal-request'] === 'true';
      
      if (!sessionId) {
        return res.status(400).json(formatApiError({ 
          message: 'Session ID is required' 
        }, 400));
      }

      const settings = await sessionManager.getLLMSettings(sessionId);
      
      if (!settings) {
        return res.status(404).json(formatApiError({ 
          message: 'No LLM settings found for this session' 
        }, 404));
      }

      // For internal requests (chatbot), return API key
      // For external requests, omit API key for security
      if (isInternalRequest) {
        res.json({
          provider: settings.provider,
          model: settings.model,
          apiKey: settings.apiKey, // Decrypted API key for internal use
          hasApiKey: !!settings.apiKey,
        });
      } else {
        res.json({
          provider: settings.provider,
          model: settings.model,
          hasApiKey: !!settings.apiKey,
        });
      }
    } catch (error: any) {
      res.status(500).json(formatApiError(error, 500));
    }
  });

  /**
   * Set LLM settings for session
   * POST /api/v1/llm/settings
   */
  router.post('/settings', async (req: Request, res: Response) => {
    try {
      const sessionId = req.headers['x-session-id'] as string || req.body.sessionId;
      const { provider, model, apiKey, timeout } = req.body;

      if (!sessionId) {
        return res.status(400).json(formatApiError({ 
          message: 'Session ID is required' 
        }, 400));
      }

      if (!provider) {
        return res.status(400).json(formatApiError({ 
          message: 'Provider is required' 
        }, 400));
      }

      // Validate provider
      const providers = LLMProviderService.getProviders();
      const validProvider = providers.find(p => p.id === provider);
      if (!validProvider) {
        return res.status(400).json(formatApiError({ 
          message: `Invalid provider. Must be one of: ${providers.map(p => p.id).join(', ')}` 
        }, 400));
      }

      // If provider requires API key, validate it
      if (validProvider.requiresApiKey) {
        if (!apiKey) {
          return res.status(400).json(formatApiError({ 
            message: 'API key is required for this provider' 
          }, 400));
        }

        const validation = await LLMProviderService.validateApiKey(
          provider as any,
          apiKey,
          model
        );

        if (!validation.valid) {
          return res.status(400).json(formatApiError({ 
            message: validation.error || 'Invalid API key' 
          }, 400));
        }
      }

      // Use default model if not provided
      const selectedModel = model || LLMProviderService.getDefaultModel(provider as any);

      // Validate timeout (7, 15, or 30 minutes)
      const validTimeouts = [7, 15, 30];
      const selectedTimeout = timeout && validTimeouts.includes(parseInt(timeout)) 
        ? parseInt(timeout) 
        : 7; // Default to 7 minutes

      const settings: LLMSettings = {
        provider: provider as any,
        model: selectedModel,
        apiKey: validProvider.requiresApiKey ? apiKey : undefined,
        timeout: selectedTimeout,
      };

      // Store settings with user-selected timeout (will be converted to seconds internally)
      await sessionManager.setLLMSettings(sessionId, settings);

      res.json({
        success: true,
        provider: settings.provider,
        model: settings.model,
        message: 'LLM settings saved successfully',
      });
    } catch (error: any) {
      res.status(500).json(formatApiError(error, 500));
    }
  });

  /**
   * Validate API key
   * POST /api/v1/llm/validate
   */
  router.post('/validate', async (req: Request, res: Response) => {
    try {
      const { provider, apiKey, model } = req.body;

      if (!provider) {
        return res.status(400).json(formatApiError({ 
          message: 'Provider is required' 
        }, 400));
      }

      if (!apiKey) {
        return res.status(400).json(formatApiError({ 
          message: 'API key is required' 
        }, 400));
      }

      const validation = await LLMProviderService.validateApiKey(
        provider,
        apiKey,
        model
      );

      if (!validation.valid) {
        return res.status(400).json(formatApiError({ 
          message: validation.error || 'Invalid API key' 
        }, 400));
      }

      res.json({ valid: true, message: 'API key is valid' });
    } catch (error: any) {
      res.status(500).json(formatApiError(error, 500));
    }
  });

  /**
   * Clear LLM settings for session
   * DELETE /api/v1/llm/settings
   */
  router.delete('/settings', async (req: Request, res: Response) => {
    try {
      const sessionId = req.headers['x-session-id'] as string || req.query.sessionId as string;
      
      if (!sessionId) {
        return res.status(400).json(formatApiError({ 
          message: 'Session ID is required' 
        }, 400));
      }

      await sessionManager.clearSession(sessionId);
      res.json({ success: true, message: 'LLM settings cleared' });
    } catch (error: any) {
      res.status(500).json(formatApiError(error, 500));
    }
  });

  /**
   * Extend session TTL (activity-based)
   * POST /api/v1/llm/extend-session
   */
  router.post('/extend-session', async (req: Request, res: Response) => {
    try {
      const sessionId = req.headers['x-session-id'] as string || req.body.sessionId;
      const { timeout } = req.body; // Optional: timeout in minutes
      
      if (!sessionId) {
        return res.status(400).json(formatApiError({ 
          message: 'Session ID is required' 
        }, 400));
      }

      const extended = await sessionManager.extendSession(
        sessionId, 
        timeout ? parseInt(timeout) : undefined
      );

      if (!extended) {
        return res.status(404).json(formatApiError({ 
          message: 'Session not found' 
        }, 404));
      }

      res.json({ 
        success: true, 
        message: 'Session extended',
        timeout: timeout || 'using existing preference'
      });
    } catch (error: any) {
      res.status(500).json(formatApiError(error, 500));
    }
  });

  /**
   * Check session status
   * GET /api/v1/llm/session-status
   */
  router.get('/session-status', async (req: Request, res: Response) => {
    try {
      const sessionId = req.headers['x-session-id'] as string || req.query.sessionId as string;
      
      if (!sessionId) {
        return res.status(400).json(formatApiError({ 
          message: 'Session ID is required' 
        }, 400));
      }

      const exists = await sessionManager.sessionExists(sessionId);
      
      if (!exists) {
        return res.status(404).json({
          exists: false,
          message: 'Session expired or not found'
        });
      }

      const settings = await sessionManager.getLLMSettings(sessionId);
      
      res.json({
        exists: true,
        provider: settings?.provider,
        model: settings?.model,
        hasApiKey: !!settings?.apiKey,
        timeout: settings?.timeout || 7,
      });
    } catch (error: any) {
      res.status(500).json(formatApiError(error, 500));
    }
  });

  return router;
}

