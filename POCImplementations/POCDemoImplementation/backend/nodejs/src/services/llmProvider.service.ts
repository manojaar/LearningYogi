import axios, { AxiosInstance, AxiosError } from 'axios';
import { LLMSettings } from './sessionManager';

export type LLMProvider = 'tesseract' | 'claude' | 'google' | 'openai';

export interface LLMProviderInfo {
  id: LLMProvider;
  name: string;
  description: string;
  models: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
  requiresApiKey: boolean;
}

export class LLMProviderService {
  /**
   * Get available LLM providers with their models
   */
  static getProviders(): LLMProviderInfo[] {
    return [
      {
        id: 'claude',
        name: 'Claude Vision Models',
        description: 'Anthropic Claude vision models for accurate extraction.',
        models: [
          { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most capable model' },
          { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', description: 'Balanced performance' },
          { id: 'claude-3-haiku-20240229', name: 'Claude 3 Haiku', description: 'Fast and efficient' },
        ],
        requiresApiKey: true,
      },
      {
        id: 'openai',
        name: 'OpenAI Vision Models',
        description: 'OpenAI GPT-4 Vision for advanced image understanding.',
        models: [
          { id: 'gpt-4o', name: 'GPT-4o', description: 'Latest multimodal model with vision (Recommended)' },
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Cost-effective model with vision support' },
          { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Fast vision processing' },
        ],
        requiresApiKey: true,
      },
    ];
  }

  /**
   * Validate API key by making a test call to the provider
   */
  static async validateApiKey(provider: LLMProvider, apiKey: string, model?: string): Promise<{ valid: boolean; error?: string }> {
    try {
      // This will make a minimal test call to validate the API key
      // For now, we'll do basic validation. Full validation would require actual API calls
      
      if (!apiKey || apiKey.trim().length === 0) {
        return { valid: false, error: 'API key is required for this provider' };
      }

      // Basic format validation
      if (provider === 'claude' && !apiKey.startsWith('sk-ant-')) {
        return { valid: false, error: 'Invalid Claude API key format' };
      }

      if (provider === 'openai' && !apiKey.startsWith('sk-')) {
        return { valid: false, error: 'Invalid OpenAI API key format' };
      }


      // In production, you might want to make actual test API calls here
      // For now, format validation is sufficient for POC
      return { valid: true };
    } catch (error: any) {
      return { valid: false, error: error.message || 'Failed to validate API key' };
    }
  }

  /**
   * Get default model for a provider
   */
  static getDefaultModel(provider: LLMProvider): string | undefined {
    const providers = this.getProviders();
    const providerInfo = providers.find(p => p.id === provider);
    if (providerInfo && providerInfo.models.length > 0) {
      return providerInfo.models[0].id;
    }
    return undefined;
  }
}

