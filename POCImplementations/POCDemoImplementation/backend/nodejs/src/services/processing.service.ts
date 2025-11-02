import axios, { AxiosInstance, AxiosError } from 'axios';
import { TimetableData } from '../models/types';

/**
 * Processing service to orchestrate OCR and AI pipeline
 */
export class ProcessingService {
  private aiApi: AxiosInstance;

  constructor(pythonApiUrl: string) {
    this.aiApi = axios.create({
      baseURL: pythonApiUrl,
      timeout: 300000,  // 5 minutes (300 seconds) - increased for AI processing
    });
  }

  /**
   * Handle API errors with better context and structured error extraction
   */
  private handleApiError(error: any, operation: string): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        // Server responded with error status
        const status = axiosError.response.status;
        const data = axiosError.response.data as any;

        // Try to extract structured error from Python API
        let errorMessage: string;
        let errorDetails: any = {};

        if (typeof data?.detail === 'object') {
          // Structured error from Python
          errorDetails = data.detail;
          errorMessage = errorDetails.error || JSON.stringify(errorDetails);
        } else if (typeof data?.detail === 'string') {
          errorMessage = data.detail;
        } else {
          errorMessage = data?.error || data?.message || axiosError.message;
        }

        // Log detailed error for debugging
        console.error(`${operation} API Error:`, {
          status,
          message: errorMessage,
          details: errorDetails,
          provider: errorDetails.provider,
          model: errorDetails.model,
          errorType: errorDetails.error_type
        });

        throw new Error(`${operation} failed (${status}): ${errorMessage}`);
      } else if (axiosError.request) {
        // Request made but no response received
        throw new Error(`${operation} failed: No response from AI service. Please check if the Python AI service is running.`);
      } else {
        // Error setting up request
        throw new Error(`${operation} failed: ${axiosError.message}`);
      }
    }
    throw error;
  }

  /**
   * Preprocess image
   */
  async preprocessImage(imagePath: string, outputDir: string): Promise<string> {
    try {
      const response = await this.aiApi.post('/preprocess/enhance', {
        image_path: imagePath,
        output_dir: outputDir,
      });

      return response.data.enhanced_image_path;
    } catch (error) {
      this.handleApiError(error, 'Image preprocessing');
    }
  }

  /**
   * Process OCR
   */
  async processOCR(imagePath: string): Promise<any> {
    try {
      const response = await this.aiApi.post('/ocr/process', {
        image_path: imagePath,
      });

      return response.data;
    } catch (error) {
      this.handleApiError(error, 'OCR processing');
    }
  }

  /**
   * Extract timetable with AI (supports multiple providers)
   * Uses async endpoint for better performance
   */
  async extractWithAI(
    imagePath: string, 
    provider?: string,
    model?: string,
    apiKey?: string,
    useAsync: boolean = true
  ): Promise<TimetableData> {
    try {
      const endpoint = useAsync ? '/ai/extract-async' : '/ai/extract';
      const response = await this.aiApi.post(endpoint, {
        image_path: imagePath,
        provider: provider || 'claude', // Default to claude for backward compatibility
        model: model,
        api_key: apiKey, // Pass API key if provided
      });

      return response.data;
    } catch (error) {
      this.handleApiError(error, 'AI extraction');
    }
  }

  /**
   * Get quality gate decision
   */
  async getQualityGate(ocrResult: any): Promise<any> {
    try {
      const response = await this.aiApi.post('/ocr/quality-gate', ocrResult);
      return response.data;
    } catch (error) {
      this.handleApiError(error, 'Quality gate evaluation');
    }
  }
}

