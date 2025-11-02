import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { useLLM } from '@/context/LLMContext';

interface LLMSelectorProps {
  onClose?: () => void;
}

export const LLMSelector: React.FC<LLMSelectorProps> = ({ onClose }) => {
  const {
    providers,
    isLoading,
    saveSettings,
    validateKey,
  } = useLLM();

  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [sessionTimeout, setSessionTimeout] = useState<number>(7); // Default 7 minutes

  const selectedProviderInfo = providers.find(p => p.id === selectedProvider);

  const handleProviderChange = (providerId: string) => {
    setSelectedProvider(providerId);
    setSelectedModel('');
    setApiKey('');
    setError(null);
    setValidationError(null);
  };

  const handleValidateKey = async () => {
    if (!apiKey.trim()) {
      setValidationError('Please enter an API key');
      return;
    }

    setIsValidating(true);
    setValidationError(null);

    try {
      const isValid = await validateKey(selectedProvider, apiKey, selectedModel);
      if (isValid) {
        setValidationError(null);
      } else {
        setValidationError('Invalid API key. Please check and try again.');
      }
    } catch (err: any) {
      setValidationError(err.message || 'Failed to validate API key');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = async () => {
    setError(null);

    // Validate required fields
    if (selectedProviderInfo?.requiresApiKey && !apiKey.trim()) {
      setError('API key is required for this provider');
      return;
    }

    if (selectedProviderInfo && selectedProviderInfo.models.length > 0 && !selectedModel) {
      setError('Please select a model');
      return;
    }

    setIsSaving(true);

    try {
      await saveSettings(
        selectedProvider,
        selectedModel || undefined,
        selectedProviderInfo?.requiresApiKey ? apiKey : undefined,
        sessionTimeout
      );
      
      if (onClose) {
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    // Use default Claude with 7 minute timeout (since tesseract is removed)
    if (providers.length > 0) {
      const firstProvider = providers[0];
      saveSettings(firstProvider.id, undefined, undefined, 7).then(() => {
        if (onClose) {
          onClose();
        }
      }).catch(() => {
        // Ignore errors on skip
      });
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading providers...</p>
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-primary-600" />
              <h2 className="text-2xl font-bold text-gray-900">Select Processing Method</h2>
            </div>
            <button
              onClick={onClose || handleSkip}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Provider Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Choose a Processing Method
              </label>
              <div className="space-y-3">
                {providers.map((provider) => (
                  <label
                    key={provider.id}
                    className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedProvider === provider.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="provider"
                        value={provider.id}
                        checked={selectedProvider === provider.id}
                        onChange={(e) => handleProviderChange(e.target.value)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-gray-900">{provider.name}</h3>
                          {!provider.requiresApiKey && (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                              Free
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{provider.description}</p>
                        
                        {/* Model Selection */}
                        {selectedProvider === provider.id && provider.models.length > 0 && (
                          <div className="mt-3">
                            <label className="block text-xs font-medium text-gray-700 mb-2">
                              Select Model
                            </label>
                            <select
                              value={selectedModel}
                              onChange={(e) => setSelectedModel(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                              {provider.models.map((model) => (
                                <option key={model.id} value={model.id}>
                                  {model.name} {model.description && `- ${model.description}`}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* API Key Input */}
                        {selectedProvider === provider.id && provider.requiresApiKey && (
                          <div className="mt-3">
                            <label className="block text-xs font-medium text-gray-700 mb-2">
                              API Key
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => {
                                  setApiKey(e.target.value);
                                  setValidationError(null);
                                }}
                                placeholder="Enter your API key"
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                              <button
                                type="button"
                                onClick={handleValidateKey}
                                disabled={isValidating || !apiKey.trim()}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                {isValidating ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  'Validate'
                                )}
                              </button>
                            </div>
                            {validationError && (
                              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {validationError}
                              </p>
                            )}
                            {!validationError && apiKey && isValidating === false && (
                              <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                API key format is valid
                              </p>
                            )}
                            <p className="mt-1 text-xs text-gray-500">
                              Your API key is encrypted and stored securely for this session only.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Session Timeout Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Session Timeout
              </label>
              <select
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value={7}>7 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Session will expire after {sessionTimeout} minutes of inactivity. Session will be extended automatically during document processing.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-sm text-red-800">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={handleSkip}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 disabled:opacity-50"
              >
                Skip (Use Default)
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || isValidating}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Save & Continue
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

